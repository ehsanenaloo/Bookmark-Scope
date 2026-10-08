/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 */

import { runtimeMessages } from '../runtime/messages.js';
import { HEALTH_STATUSES } from '../core/constants.js';

export function getHealthKey(bookmark) {
  return bookmark?.parsed?.normalizedPageKey || bookmark?.url || '';
}

export function getHealthRecord(bookmark, healthByKey = {}) {
  const key = getHealthKey(bookmark);
  const mapped = key ? healthByKey[key] || null : null;
  if (mapped) return mapped;
  const status = bookmark?.healthStatus;
  if (!status) return null;
  return {
    status,
    checkedAt: bookmark?.healthCheckedAt || null,
    statusCode: bookmark?.healthStatusCode || null,
    finalUrl: bookmark?.healthFinalUrl || bookmark?.url || '',
    error: bookmark?.healthError || '',
    method: bookmark?.healthMethod || ''
  };
}

export function summarizeHealth(items, healthByKey = {}) {
  const summary = {
    checked: 0,
    healthy: 0,
    redirected: 0,
    broken: 0,
    serverError: 0,
    unreachable: 0,
    unknown: 0
  };
  const seen = new Set();
  for (const item of items || []) {
    const key = getHealthKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const record = healthByKey[key];
    if (!record) {
      summary.unknown += 1;
      continue;
    }
    summary.checked += 1;
    switch (record.status) {
      case HEALTH_STATUSES.HEALTHY:
        summary.healthy += 1;
        break;
      case HEALTH_STATUSES.REDIRECTED:
        summary.redirected += 1;
        break;
      case HEALTH_STATUSES.BROKEN:
        summary.broken += 1;
        break;
      case HEALTH_STATUSES.SERVER_ERROR:
        summary.serverError += 1;
        break;
      case HEALTH_STATUSES.UNREACHABLE:
        summary.unreachable += 1;
        break;
      case HEALTH_STATUSES.UNKNOWN:
      default:
        summary.unknown += 1;
        break;
    }
  }
  return summary;
}

export function getBookmarksByHealthStatus(statuses, items, healthByKey = {}) {
  const wanted = new Set(statuses);
  return (items || []).filter((bookmark) => {
    const record = getHealthRecord(bookmark, healthByKey);
    return record && wanted.has(record.status);
  });
}

export function getRedirectedBookmarks(items, healthByKey = {}) {
  return (items || []).filter((bookmark) => {
    const record = getHealthRecord(bookmark, healthByKey);
    return record && record.status === HEALTH_STATUSES.REDIRECTED && record.finalUrl && record.finalUrl !== bookmark.url;
  });
}

export function healthLabel(record, t) {
  if (!record) return t('Unchecked');
  switch (record.status) {
    case HEALTH_STATUSES.HEALTHY:
      return record.statusCode ? t('Healthy {{code}}', { code: record.statusCode }) : t('Healthy');
    case HEALTH_STATUSES.REDIRECTED:
      return record.statusCode ? t('Redirected {{code}}', { code: record.statusCode }) : t('Redirected');
    case HEALTH_STATUSES.BROKEN:
      return record.statusCode ? t('Broken {{code}}', { code: record.statusCode }) : t('Broken');
    case HEALTH_STATUSES.SERVER_ERROR:
      return record.statusCode ? t('Server {{code}}', { code: record.statusCode }) : t('Server error');
    case HEALTH_STATUSES.UNREACHABLE:
      return record.timedOut ? t('Timed out') : t('Unreachable');
    case HEALTH_STATUSES.UNKNOWN:
      return record?.checkedAt || record?.error || record?.skipped ? t('Check failed') : t('Unchecked');
    default:
      return t('Unchecked');
  }
}

export function healthBadgeClass(record) {
  if (!record) return 'duplicate-badge';
  if (record.status === HEALTH_STATUSES.UNKNOWN && (record?.checkedAt || record?.error || record?.skipped)) {
    return 'duplicate-badge health-unreachable';
  }
  switch (record.status) {
    case HEALTH_STATUSES.HEALTHY:
      return 'duplicate-badge health-healthy';
    case HEALTH_STATUSES.REDIRECTED:
      return 'duplicate-badge health-redirected';
    case HEALTH_STATUSES.BROKEN:
      return 'duplicate-badge health-broken';
    case HEALTH_STATUSES.SERVER_ERROR:
      return 'duplicate-badge health-server-error';
    case HEALTH_STATUSES.UNREACHABLE:
      return 'duplicate-badge health-unreachable';
    default:
      return 'duplicate-badge';
  }
}

export function bookmarkStatusBadgeClass(label) {
  const normalized = String(label || '').toLowerCase();
  if (normalized.startsWith('old ')) return 'duplicate-badge status-old';
  if (normalized.includes('duplicate')) return 'duplicate-badge status-duplicate';
  if (normalized.includes('untitled')) return 'duplicate-badge status-untitled';
  if (normalized.includes('collision')) return 'duplicate-badge status-collision';
  return 'duplicate-badge';
}

export function shouldSkipHealthFetch(url) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return true;
    const host = parsed.hostname.toLowerCase();
    return host === 'chrome.google.com' || host === 'chromewebstore.google.com';
  } catch {
    return true;
  }
}

export async function inspectUrlHealth({ url, sendMessage, timeoutMs, requestIdFactory, inspectControllers, now, t }) {
  if (shouldSkipHealthFetch(url)) {
    return { status: HEALTH_STATUSES.UNKNOWN, checkedAt: now(), finalUrl: url, skipped: true, error: t('Skipped by policy') };
  }

  const requestId = requestIdFactory('health');
  inspectControllers?.add?.(requestId);
  try {
    const record = await sendMessage(runtimeMessages.fetchUrlHealth({ url, timeoutMs, requestId }));
    if (record && record.status) return record;
    return { status: HEALTH_STATUSES.UNKNOWN, checkedAt: now(), finalUrl: url, error: t('No health response') };
  } catch (error) {
    return { status: HEALTH_STATUSES.UNREACHABLE, error: error?.message || t('Network failure'), checkedAt: now(), finalUrl: url };
  } finally {
    inspectControllers?.delete?.(requestId);
  }
}

export async function runWithConcurrency(items, limit, worker, shouldAbort = () => false) {
  const queue = [...items];
  let failed = false;
  const workers = Array.from({ length: Math.min(limit, Math.max(1, queue.length)) }, async () => {
    while (queue.length && !failed && !shouldAbort()) {
      const next = queue.shift();
      if (next) {
        try { await worker(next); }
        catch (error) { failed = true; throw error; }
      }
    }
  });
  // A rejected worker must not let its peers continue after the caller has
  // cleaned up session state. Drain all active work before propagating failure.
  const outcomes = await Promise.allSettled(workers);
  const failure = outcomes.find(outcome => outcome.status === 'rejected');
  if (failure) throw failure.reason;
}
