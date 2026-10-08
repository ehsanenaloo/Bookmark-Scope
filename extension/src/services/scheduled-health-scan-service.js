/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 *
 * scheduled-health-scan-service.js
 *
 * Runs a small, capped link-health scan on a configurable schedule (off
 * by default; opt-in via Options page). Designed for service-worker life-
 * cycle:
 *
 *   - The scan is fired by a chrome.alarms callback, so the worker wakes
 *     for it even when the user isn't actively in the dashboard.
 *   - Each run attempts at most BG_HEALTH_SCAN_MAX_PER_RUN URLs serially.
 *     The persisted cursor advances before every attempt, including failures.
 *   - Sorted candidates wrap after that cursor independently of cache expiry.
 *     A shared scan lock prevents overlapping runs across extension contexts.
 *   - Newly bad status transitions trigger a grouped notification. Expired
 *     observations cannot establish whether a bad result was already known.
 *
 * Requires the optional host permission (HTTP and HTTPS origins). If
 * the user hasn't granted that, schedule scans are no-ops with a logged
 * warning — re-enabling needs them to opt in from Options anyway.
 */

import { now } from '../platform/time.js';
import {
  clearAlarm,
  createAlarm,
  containsPermissions,
  createNotification
} from '../platform/browser-api.js';
import { getLocalStorage, setLocalStorage } from './storage-service.js';
import { getNormalizedBookmarks } from '../core/bookmark-utils.js';
import { shouldSkipHealthCheck } from '../background/health-check.js';
import { loadHealthCache, writeHealthRecord, awaitPendingHealthWrites, getHealthCacheGeneration } from './health-cache-service.js';
import {
  STORAGE_KEYS,
  HEALTH_STATUSES,
  BG_HEALTH_SCAN_MAX_PER_RUN,
  BG_HEALTH_SCAN_CONCURRENCY,
  BG_HEALTH_SCAN_DEFAULT_INTERVAL_DAYS,
  OPTIONAL_HOST_PATTERNS
} from '../core/constants.js';
import { runWithConcurrency } from '../dashboard/health.js';
import { t } from '../locales/i18n.js';

export const BG_HEALTH_SCAN_ALARM = 'bookmark-scope-scheduled-health-scan';
const DAY_MS = 24 * 60 * 60 * 1000;
const NOTIFICATION_ID = 'bookmark-scope-scheduled-scan-broken';

/**
 * Loads the current schedule preferences with safe defaults.
 */
export async function loadBgHealthScanSettings() {
  const stored = await getLocalStorage([
    STORAGE_KEYS.BG_HEALTH_SCAN_ENABLED,
    STORAGE_KEYS.BG_HEALTH_SCAN_INTERVAL_DAYS,
    STORAGE_KEYS.BG_HEALTH_SCAN_LAST_RUN_AT,
    STORAGE_KEYS.BG_HEALTH_SCAN_LAST_BROKEN_COUNT
  ]);
  return {
    enabled: Boolean(stored?.[STORAGE_KEYS.BG_HEALTH_SCAN_ENABLED]),
    intervalDays: Number(stored?.[STORAGE_KEYS.BG_HEALTH_SCAN_INTERVAL_DAYS] || BG_HEALTH_SCAN_DEFAULT_INTERVAL_DAYS),
    lastRunAt: Number(stored?.[STORAGE_KEYS.BG_HEALTH_SCAN_LAST_RUN_AT] || 0),
    lastBrokenCount: Number(stored?.[STORAGE_KEYS.BG_HEALTH_SCAN_LAST_BROKEN_COUNT] || 0)
  };
}

export async function saveBgHealthScanSettings({ enabled, intervalDays, lastRunAt, lastBrokenCount }) {
  const values = {};
  if (enabled !== undefined) values[STORAGE_KEYS.BG_HEALTH_SCAN_ENABLED] = Boolean(enabled);
  if (intervalDays !== undefined) values[STORAGE_KEYS.BG_HEALTH_SCAN_INTERVAL_DAYS] = Number.isFinite(Number(intervalDays)) ? Math.max(1, Math.min(90, Number(intervalDays))) : BG_HEALTH_SCAN_DEFAULT_INTERVAL_DAYS;
  if (lastRunAt !== undefined) values[STORAGE_KEYS.BG_HEALTH_SCAN_LAST_RUN_AT] = Number(lastRunAt);
  if (lastBrokenCount !== undefined) values[STORAGE_KEYS.BG_HEALTH_SCAN_LAST_BROKEN_COUNT] = Number(lastBrokenCount);
  await setLocalStorage(values);
}

/**
 * (Re)schedules or clears the alarm based on stored prefs. Called from
 * background.js onInstalled / onStartup, and from settings storage-change
 * events when the user toggles the feature or changes the interval.
 */
export async function scheduleBgHealthScan() {
  const settings = await loadBgHealthScanSettings();
  await clearAlarm(BG_HEALTH_SCAN_ALARM);
  if (!settings.enabled) return settings;

  // Don't double up: if a run happened recently, target the next slot.
  const intervalMs = settings.intervalDays * DAY_MS;
  const elapsed = now() - settings.lastRunAt;
  // Always wait at least one minute even if "overdue" — the alarms API
  // will throttle to one minute anyway, and waiting avoids hammering
  // the network the instant the user toggles the feature on.
  const when = elapsed >= intervalMs
    ? now() + 60 * 1000
    : settings.lastRunAt + intervalMs;
  await createAlarm(BG_HEALTH_SCAN_ALARM, { when, periodInMinutes: settings.intervalDays * 24 * 60 });
  return settings;
}

/**
 * Picks bookmarks to scan in this run. Priority order:
 *   1. URLs not present in the health cache at all (never checked).
 *   2. URLs in the cache, oldest `checkedAt` first.
 *
 * Bookmarks with non-http(s) URLs and known store URLs are skipped
 * via shouldSkipHealthCheck. Caller may want to dedupe by URL before
 * passing in (we also dedupe internally for safety).
 *
 * Exported for unit testing.
 */
export function selectScanCandidates(bookmarks, healthCache, limit = BG_HEALTH_SCAN_MAX_PER_RUN) {
  const seenUrls = new Set();
  const unchecked = [];
  const stale = [];
  for (const bookmark of bookmarks || []) {
    const url = bookmark?.url;
    if (!url || seenUrls.has(url)) continue;
    if (shouldSkipHealthCheck(url)) continue;
    seenUrls.add(url);
    const key = bookmark?.parsed?.normalizedPageKey || url;
    const record = healthCache?.[key];
    if (!record) {
      unchecked.push(bookmark);
    } else {
      stale.push([bookmark, Number(record.checkedAt || 0)]);
    }
  }
  // Sort stale ascending — oldest first.
  stale.sort((a, b) => a[1] - b[1]);
  const ordered = [...unchecked, ...stale.map((s) => s[0])];
  return ordered.slice(0, Math.max(0, limit));
}

/**
 * Counts how many entries in the health cache are in a "bad" status.
 * Treats broken / server-error / unreachable as bad; not redirected
 * (redirected is informational, not user-facing failure).
 */
export function countBrokenInCache(cache) {
  let count = 0;
  for (const record of Object.values(cache || {})) {
    const status = record?.status;
    if (
      status === HEALTH_STATUSES.BROKEN ||
      status === HEALTH_STATUSES.SERVER_ERROR ||
      status === HEALTH_STATUSES.UNREACHABLE
    ) count++;
  }
  return count;
}

/**
 * Fires the actual scan. Called from background.js's alarm listener.
 * Uses the supplied `runHealthFetch` to make each request — in production
 * that's fetchHealthStatusInBackground from background.js. Tests can
 * inject a stub.
 */
export function selectScanCandidatesAfterCursor(bookmarks, cursor = '', limit = BG_HEALTH_SCAN_MAX_PER_RUN) {
  const eligible = selectScanCandidates(bookmarks, {}, Number.MAX_SAFE_INTEGER).sort((a,b) => a.url < b.url ? -1 : a.url > b.url ? 1 : 0);
  if (!eligible.length) return [];
  const found = eligible.findIndex(item => item.url > cursor);
  const start = found < 0 ? 0 : found;
  return [...eligible.slice(start), ...eligible.slice(0,start)].slice(0, Math.max(0, limit));
}

export async function runScheduledHealthScan({ runHealthFetch, logger = null } = {}) {
  if (typeof runHealthFetch !== 'function') throw new Error('runScheduledHealthScan requires runHealthFetch');
  return navigator.locks.request('bookmark-scope-scheduled-scan', { ifAvailable: true }, async lock => {
    if (!lock) return { ran: false, reason: 'already-running' };
    const settings = await loadBgHealthScanSettings();
    if (!settings.enabled) { await scheduleBgHealthScan(); return { ran: false, reason: 'disabled' }; }
    // Persist an attempt time, including denied/empty/error attempts, so the
    // finally re-arm waits the chosen interval instead of retrying each minute.
    await saveBgHealthScanSettings({ lastRunAt: now() });
    try {
      if (!await containsPermissions({ origins: [...OPTIONAL_HOST_PATTERNS] })) {
        logger?.warn?.('bg_health_scan_skipped_no_permission');
        return { ran: false, reason: 'no-permission' };
      }
      const bookmarks = await getNormalizedBookmarks();
      const stored = await getLocalStorage([STORAGE_KEYS.BG_HEALTH_SCAN_CURSOR]);
      const candidates = selectScanCandidatesAfterCursor(bookmarks, stored[STORAGE_KEYS.BG_HEALTH_SCAN_CURSOR] || '');
      const generation = await getHealthCacheGeneration();
      const cache = await loadHealthCache();
      let scanned = 0;
      let newBroken = 0;
      // Serial attempts make the durable cursor exactly the attempted prefix,
      // including failed requests. Worker termination does not lose fairness.
      for (const bookmark of candidates) {
        const current = await loadBgHealthScanSettings();
        if (!current.enabled) break;
        await setLocalStorage({ [STORAGE_KEYS.BG_HEALTH_SCAN_CURSOR]: bookmark.url });
        try {
          const record = await runHealthFetch(bookmark.url);
          if (!record || record.aborted) continue;
          const key = bookmark?.parsed?.normalizedPageKey || bookmark.url;
          if (!await writeHealthRecord(key, record, generation)) break;
          if (countBrokenInCache({ [key]: record }) && !countBrokenInCache({ [key]: cache[key] })) newBroken++;
          cache[key] = record;
          scanned++;
        } catch (error) {
          logger?.warn?.('bg_health_scan_fetch_failed', { url: bookmark.url, message: error?.message || String(error) });
        }
      }
      await awaitPendingHealthWrites();
      const brokenNow = countBrokenInCache(cache);
      await saveBgHealthScanSettings({ lastRunAt: now(), lastBrokenCount: brokenNow });
      if (newBroken > 0) {
        try {
          await createNotification(NOTIFICATION_ID, { type: 'basic', iconUrl: 'icons/icon-128.png', title: t('Bookmark Scope: new broken links found'), message: t('{{count}} bookmarks now appear broken. Open the dashboard to review and clean up.', { count: newBroken }) });
        } catch (error) { logger?.warn?.('bg_health_scan_notification_failed', { message: error?.message || String(error) }); }
      }
      return { ran: true, scanned, broken: brokenNow, newBroken };
    } finally { await scheduleBgHealthScan(); }
  });
}
