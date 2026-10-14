/* Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License. */
import { STORAGE_KEYS } from '../core/constants.js';
import { now } from '../platform/time.js';
import { getLocalStorage, setLocalStorage, withStorageLock } from './storage-service.js';

// The support reminder: a heart on the toolbar icon and one card in the popup.
// It waits 14 days after the state is first created, then repeats every 30 days
// after the card was last shown. The user can turn it off for good.
const DAY_MS = 86400000;
export const SUPPORT_NUDGE_INITIAL_DELAY_DAYS = 14;
export const SUPPORT_NUDGE_INTERVAL_DAYS = 30;
export const SUPPORT_NUDGE_BADGE_TEXT = '♥';
export const SUPPORT_NUDGE_BADGE_COLOR = '#c8323a';

function positiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// The key lives outside the sanitized schema snapshot, so every read validates the stored value itself.
export function normalizeSupportNudge(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return {
    installedAt: positiveNumber(value.installedAt),
    lastShownAt: positiveNumber(value.lastShownAt),
    shownCount: Math.floor(positiveNumber(value.shownCount)),
    optOut: value.optOut === true
  };
}

export function isSupportNudgeDue(nudge, at = now()) {
  const state = normalizeSupportNudge(nudge);
  // No state yet means the grace period has not started; seeding starts it.
  if (!state || state.optOut || !state.installedAt) return false;
  if (!state.lastShownAt) return at >= state.installedAt + SUPPORT_NUDGE_INITIAL_DELAY_DAYS * DAY_MS;
  return at - state.lastShownAt >= SUPPORT_NUDGE_INTERVAL_DAYS * DAY_MS;
}

export async function readSupportNudge() {
  const stored = await getLocalStorage([STORAGE_KEYS.SUPPORT_NUDGE]);
  return normalizeSupportNudge(stored?.[STORAGE_KEYS.SUPPORT_NUDGE]);
}

async function updateSupportNudge(update) {
  return withStorageLock(async () => {
    const stored = await getLocalStorage([STORAGE_KEYS.SUPPORT_NUDGE]);
    const current = normalizeSupportNudge(stored?.[STORAGE_KEYS.SUPPORT_NUDGE]);
    const next = update(current, now());
    if (next) await setLocalStorage({ [STORAGE_KEYS.SUPPORT_NUDGE]: next });
    return next || current;
  });
}

/** Starts the grace period once. Existing state, including an opt-out, is never changed. */
export function seedSupportNudge() {
  return updateSupportNudge((current, at) => (current && current.installedAt ? null : { ...(current || {}), installedAt: at, lastShownAt: current?.lastShownAt || 0, shownCount: current?.shownCount || 0, optOut: current?.optOut === true }));
}

export function markSupportNudgeShown() {
  return updateSupportNudge((current, at) => ({
    installedAt: current?.installedAt || at,
    lastShownAt: at,
    shownCount: (current?.shownCount || 0) + 1,
    optOut: current?.optOut === true
  }));
}

export function optOutSupportNudge() {
  return updateSupportNudge((current, at) => ({
    installedAt: current?.installedAt || at,
    lastShownAt: current?.lastShownAt || 0,
    shownCount: current?.shownCount || 0,
    optOut: true
  }));
}
