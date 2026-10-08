import { formatDateTime, t } from '../i18n.js';
import { now } from '../platform/time.js';
import { clearAlarm, createAlarm } from '../platform/browser-api.js';
import { loadReviewReminderPreferences, saveReviewReminderPreferences } from './preferences-service.js';

export const REVIEW_REMINDER_ALARM = 'bookmark-manager-review-reminder';
export const DAY_MS = 24 * 60 * 60 * 1000;

export async function getReviewReminderSettings(defaultIntervalDays = 14) {
  return loadReviewReminderPreferences(defaultIntervalDays);
}

export function buildReviewReminderLabel(timestamp) {
  if (!timestamp) return t('No review date saved');
  return formatDateTime(timestamp, { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Computes the timestamp for the next scheduled review.
 *
 * Design note: if `nextReviewAt` is already set in storage we honour it —
 * this avoids accidentally shifting the schedule every time the alarm fires.
 * All code paths that intentionally advance the schedule
 * (deferReviewReminderByInterval, handleMarkReviewedNow) write a new value
 * explicitly, so the sticky behaviour here is correct and by design.
 */
export function computeNextReviewTimestamp({ enabled, intervalDays, lastReviewAt, nextReviewAt }, currentTime = now()) {
  if (!enabled) return 0;
  if (nextReviewAt) return Number(nextReviewAt);
  const anchor = Number(lastReviewAt || currentTime);
  return anchor + (Math.max(1, Number(intervalDays || 14)) * DAY_MS);
}

export async function scheduleReviewReminderAlarm(forceSettings = null, currentTime = now()) {
  const settings = forceSettings || await getReviewReminderSettings();
  await clearAlarm(REVIEW_REMINDER_ALARM);
  if (!settings.enabled) return settings;

  let nextAt = computeNextReviewTimestamp(settings, currentTime);
  if (!settings.nextReviewAt && nextAt) {
    await saveReviewReminderPreferences({
      enabled: settings.enabled,
      intervalDays: settings.intervalDays,
      lastReviewAt: settings.lastReviewAt,
      nextReviewAt: nextAt
    });
    settings.nextReviewAt = nextAt;
  }

  const when = nextAt > currentTime ? nextAt : currentTime + 60 * 1000;
  await createAlarm(REVIEW_REMINDER_ALARM, { when });
  return settings;
}

/**
 * Advances the next-review timestamp by one configured reminder interval
 * (falling back to 14 days) and reschedules the alarm.
 * Called from background.js after firing a review notification so the
 * reminder re-arms itself without losing the user's configured cadence.
 *
 * Note: the previous name `deferReviewReminderByOneDay` was misleading —
 * it deferred by `intervalDays`, not one day. Renamed in 4.35.0.
 */
export async function deferReviewReminderByInterval(settings, currentTime = now()) {
  const intervalMs = Math.max(1, Number(settings?.intervalDays || 14)) * DAY_MS;
  const nextAt = currentTime + intervalMs;
  await saveReviewReminderPreferences({
    enabled: settings?.enabled ?? true,
    intervalDays: settings?.intervalDays ?? 14,
    lastReviewAt: settings?.lastReviewAt ?? 0,
    nextReviewAt: nextAt
  });
  await createAlarm(REVIEW_REMINDER_ALARM, { when: nextAt });
  return nextAt;
}
