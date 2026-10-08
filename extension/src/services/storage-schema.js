import {
  CLEANUP_FILTERS,
  COLOR_PALETTES,
  DASHBOARD_STORAGE_KEYS,
  GROUP_BY_OPTIONS,
  GROUP_SORT_OPTIONS,
  MATCH_MODES,
  MERGE_STRATEGIES,
  POPUP_WIDTHS,
  SORT_OPTIONS,
  STORAGE_KEYS,
  THEME_MODES
} from '../core/constants.js';
import { getLocalStorage, setLocalStorage, withStorageLock } from './storage-service.js';

export const STORAGE_SCHEMA_VERSION = 7;

const VALID = {
  popupMode: new Set(Object.values(MATCH_MODES)),
  popupSort: new Set(Object.values(SORT_OPTIONS)),
  popupWidth: new Set(Object.values(POPUP_WIDTHS)),
  mergeStrategy: new Set(Object.values(MERGE_STRATEGIES)),
  cleanupFilter: new Set(Object.values(CLEANUP_FILTERS)),
  themeMode: new Set(Object.values(THEME_MODES)),
  colorPalette: new Set(Object.values(COLOR_PALETTES)),
  groupBy: new Set(Object.values(GROUP_BY_OPTIONS)),
  groupSort: new Set(Object.values(GROUP_SORT_OPTIONS))
};

function boolOr(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function numOr(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function enumOr(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

function sanitizeHistory(value, limit) {
  return Array.isArray(value) ? value.filter(Boolean).slice(0, limit) : [];
}

export function sanitizeStorageSnapshot(snapshot = {}) {
  return {
    [STORAGE_KEYS.SMART_VIEWS]: Array.isArray(snapshot[STORAGE_KEYS.SMART_VIEWS]) ? snapshot[STORAGE_KEYS.SMART_VIEWS] : [],
    [STORAGE_KEYS.HEALTH_SCAN_JOB]: snapshot[STORAGE_KEYS.HEALTH_SCAN_JOB] ?? null,
    [STORAGE_KEYS.SNAPSHOT_RESTORE_JOURNAL]: Array.isArray(snapshot[STORAGE_KEYS.SNAPSHOT_RESTORE_JOURNAL]) ? snapshot[STORAGE_KEYS.SNAPSHOT_RESTORE_JOURNAL] : [],
    [STORAGE_KEYS.HEALTH_CACHE_KEY_VERSION]: 2,
    [STORAGE_KEYS.HEALTH_CACHE_GENERATION]: numOr(snapshot[STORAGE_KEYS.HEALTH_CACHE_GENERATION], 0),
    [STORAGE_KEYS.BG_HEALTH_SCAN_CURSOR]: typeof snapshot[STORAGE_KEYS.BG_HEALTH_SCAN_CURSOR] === 'string' ? snapshot[STORAGE_KEYS.BG_HEALTH_SCAN_CURSOR] : '',
    [STORAGE_KEYS.POPUP_MODE]: enumOr(snapshot[STORAGE_KEYS.POPUP_MODE], VALID.popupMode, MATCH_MODES.DOMAIN),
    [STORAGE_KEYS.POPUP_SORT]: enumOr(snapshot[STORAGE_KEYS.POPUP_SORT], VALID.popupSort, SORT_OPTIONS.TITLE_ASC),
    [STORAGE_KEYS.IGNORE_QUERY]: boolOr(snapshot[STORAGE_KEYS.IGNORE_QUERY], false),
    [STORAGE_KEYS.IGNORE_HASH]: boolOr(snapshot[STORAGE_KEYS.IGNORE_HASH], true),
    [STORAGE_KEYS.POPUP_WIDTH]: enumOr(snapshot[STORAGE_KEYS.POPUP_WIDTH], VALID.popupWidth, POPUP_WIDTHS.COMFORTABLE),
    [STORAGE_KEYS.MERGE_STRATEGY]: enumOr(snapshot[STORAGE_KEYS.MERGE_STRATEGY], VALID.mergeStrategy, MERGE_STRATEGIES.KEEP_NEWEST),
    [DASHBOARD_STORAGE_KEYS.CLEANUP_FILTER]: enumOr(snapshot[DASHBOARD_STORAGE_KEYS.CLEANUP_FILTER], VALID.cleanupFilter, CLEANUP_FILTERS.ALL),
    [DASHBOARD_STORAGE_KEYS.SORT]: enumOr(snapshot[DASHBOARD_STORAGE_KEYS.SORT], VALID.popupSort, SORT_OPTIONS.TITLE_ASC),
    [DASHBOARD_STORAGE_KEYS.DUPLICATES_ONLY]: boolOr(snapshot[DASHBOARD_STORAGE_KEYS.DUPLICATES_ONLY], false),
    [DASHBOARD_STORAGE_KEYS.SIDEBAR_COLLAPSED]: boolOr(snapshot[DASHBOARD_STORAGE_KEYS.SIDEBAR_COLLAPSED], true),
    [DASHBOARD_STORAGE_KEYS.GROUP_BY]: enumOr(snapshot[DASHBOARD_STORAGE_KEYS.GROUP_BY], VALID.groupBy, GROUP_BY_OPTIONS.FLAT),
    [DASHBOARD_STORAGE_KEYS.GROUP_SORT]: enumOr(snapshot[DASHBOARD_STORAGE_KEYS.GROUP_SORT], VALID.groupSort, GROUP_SORT_OPTIONS.DEFAULT),
    [STORAGE_KEYS.REVIEW_SESSIONS]: sanitizeHistory(snapshot[STORAGE_KEYS.REVIEW_SESSIONS], 20),
    [STORAGE_KEYS.CLEANUP_HISTORY]: sanitizeHistory(snapshot[STORAGE_KEYS.CLEANUP_HISTORY], 60),
    [STORAGE_KEYS.REVIEW_REMINDER_ENABLED]: boolOr(snapshot[STORAGE_KEYS.REVIEW_REMINDER_ENABLED], false),
    [STORAGE_KEYS.REVIEW_REMINDER_INTERVAL_DAYS]: numOr(snapshot[STORAGE_KEYS.REVIEW_REMINDER_INTERVAL_DAYS], 14, 1, 365),
    [STORAGE_KEYS.REVIEW_REMINDER_LAST_REVIEW_AT]: numOr(snapshot[STORAGE_KEYS.REVIEW_REMINDER_LAST_REVIEW_AT], 0),
    [STORAGE_KEYS.REVIEW_REMINDER_NEXT_AT]: numOr(snapshot[STORAGE_KEYS.REVIEW_REMINDER_NEXT_AT], 0),
    [STORAGE_KEYS.THEME_MODE]: enumOr(snapshot[STORAGE_KEYS.THEME_MODE], VALID.themeMode, THEME_MODES.SYSTEM),
    [STORAGE_KEYS.COLOR_PALETTE]: enumOr(snapshot[STORAGE_KEYS.COLOR_PALETTE], VALID.colorPalette, COLOR_PALETTES.TEAL),
    [STORAGE_KEYS.PIN_ONBOARDING_VISIBLE]: boolOr(snapshot[STORAGE_KEYS.PIN_ONBOARDING_VISIBLE], false),
    [STORAGE_KEYS.LOCALE_PREFERENCE]: typeof snapshot[STORAGE_KEYS.LOCALE_PREFERENCE] === 'string' ? snapshot[STORAGE_KEYS.LOCALE_PREFERENCE] : 'auto',
    [STORAGE_KEYS.LOCALE_OVERRIDES]: snapshot[STORAGE_KEYS.LOCALE_OVERRIDES] && typeof snapshot[STORAGE_KEYS.LOCALE_OVERRIDES] === 'object'
      ? snapshot[STORAGE_KEYS.LOCALE_OVERRIDES]
      : {},
    [STORAGE_KEYS.DIAGNOSTIC_EVENTS]: sanitizeHistory(snapshot[STORAGE_KEYS.DIAGNOSTIC_EVENTS], 200),
    [STORAGE_KEYS.HEALTH_CACHE]: snapshot[STORAGE_KEYS.HEALTH_CACHE] && typeof snapshot[STORAGE_KEYS.HEALTH_CACHE] === 'object' && !Array.isArray(snapshot[STORAGE_KEYS.HEALTH_CACHE])
      ? snapshot[STORAGE_KEYS.HEALTH_CACHE]
      : {},
    [STORAGE_KEYS.BG_HEALTH_SCAN_ENABLED]: boolOr(snapshot[STORAGE_KEYS.BG_HEALTH_SCAN_ENABLED], false),
    [STORAGE_KEYS.BG_HEALTH_SCAN_INTERVAL_DAYS]: numOr(snapshot[STORAGE_KEYS.BG_HEALTH_SCAN_INTERVAL_DAYS], 7, 1, 90),
    [STORAGE_KEYS.BG_HEALTH_SCAN_LAST_RUN_AT]: numOr(snapshot[STORAGE_KEYS.BG_HEALTH_SCAN_LAST_RUN_AT], 0),
    [STORAGE_KEYS.BG_HEALTH_SCAN_LAST_BROKEN_COUNT]: numOr(snapshot[STORAGE_KEYS.BG_HEALTH_SCAN_LAST_BROKEN_COUNT], 0),
    // Tags overlay: must be a plain object (bookmarkId → tags[]).
    // Arrays or scalars from a corrupted import get reset to {}.
    [STORAGE_KEYS.TAGS_BY_BOOKMARK]: snapshot[STORAGE_KEYS.TAGS_BY_BOOKMARK]
      && typeof snapshot[STORAGE_KEYS.TAGS_BY_BOOKMARK] === 'object'
      && !Array.isArray(snapshot[STORAGE_KEYS.TAGS_BY_BOOKMARK])
        ? snapshot[STORAGE_KEYS.TAGS_BY_BOOKMARK]
        : {},
    [STORAGE_KEYS.STORAGE_SCHEMA_VERSION]: STORAGE_SCHEMA_VERSION,
    [STORAGE_KEYS.STORAGE_SCHEMA_UPDATED_AT]: Date.now()
  };
}

// Keys whose values change on every call and must not be included in the
// "did anything actually change?" comparison. They are still written when a
// real migration occurs, but they never trigger one on their own.
const VOLATILE_SCHEMA_KEYS = new Set([STORAGE_KEYS.STORAGE_SCHEMA_UPDATED_AT]);

export async function ensureStorageSchema() {
  return withStorageLock(async () => {
  const stored = await getLocalStorage(null);
  const currentVersion = Number(stored?.[STORAGE_KEYS.STORAGE_SCHEMA_VERSION] || 0);
  const sanitized = sanitizeStorageSnapshot(stored || {});
  if (stored?.[STORAGE_KEYS.HEALTH_CACHE_KEY_VERSION] !== 2) {
    sanitized[STORAGE_KEYS.HEALTH_CACHE] = {};
    sanitized[STORAGE_KEYS.HEALTH_CACHE_GENERATION] += 1;
  }

  const changed = currentVersion !== STORAGE_SCHEMA_VERSION || Object.keys(sanitized).some((key) => {
    if (VOLATILE_SCHEMA_KEYS.has(key)) return false;
    const before = JSON.stringify(stored?.[key] ?? null);
    const after = JSON.stringify(sanitized[key] ?? null);
    return before !== after;
  });

  if (changed) {
    await setLocalStorage(sanitized);
  }

  return {
    version: STORAGE_SCHEMA_VERSION,
    migrated: changed,
    previousVersion: currentVersion
  };
  });
}

/**
 * The subset of storage keys that the Options page owns and may reset.
 * Derived from sanitizeStorageSnapshot so that adding/removing a key in the
 * schema automatically keeps options.js in sync — no manual duplication.
 *
 * Dashboard-only keys (cleanupFilter, groupBy, etc.) are intentionally
 * excluded: the Options page has no UI for them.
 */
export const OPTION_PAGE_DEFAULTS = Object.freeze({
  [STORAGE_KEYS.POPUP_MODE]: MATCH_MODES.DOMAIN,
  [STORAGE_KEYS.POPUP_SORT]: SORT_OPTIONS.TITLE_ASC,
  [STORAGE_KEYS.IGNORE_QUERY]: false,
  [STORAGE_KEYS.IGNORE_HASH]: true,
  [STORAGE_KEYS.POPUP_WIDTH]: POPUP_WIDTHS.COMFORTABLE,
  [STORAGE_KEYS.MERGE_STRATEGY]: MERGE_STRATEGIES.KEEP_NEWEST,
  [STORAGE_KEYS.THEME_MODE]: THEME_MODES.SYSTEM,
  [STORAGE_KEYS.COLOR_PALETTE]: COLOR_PALETTES.TEAL,
  [STORAGE_KEYS.LOCALE_PREFERENCE]: 'auto'
});
