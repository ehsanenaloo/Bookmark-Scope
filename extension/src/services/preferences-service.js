import { DASHBOARD_STORAGE_KEYS, MATCH_MODES, POPUP_WIDTHS, SORT_OPTIONS, CLEANUP_FILTERS, GROUP_BY_OPTIONS, GROUP_SORT_OPTIONS, MERGE_STRATEGIES, STORAGE_KEYS, THEME_MODES } from '../constants.js';
import { getLocalStorage, setLocalStorage } from './storage-service.js';

export async function loadPopupPreferences() {
  const stored = await getLocalStorage([
    STORAGE_KEYS.POPUP_MODE,
    STORAGE_KEYS.POPUP_SORT,
    STORAGE_KEYS.IGNORE_QUERY,
    STORAGE_KEYS.IGNORE_HASH,
    STORAGE_KEYS.THEME_MODE,
    STORAGE_KEYS.PIN_ONBOARDING_VISIBLE,
    STORAGE_KEYS.POPUP_WIDTH
  ]);

  return {
    popupWidth: stored[STORAGE_KEYS.POPUP_WIDTH] || POPUP_WIDTHS.COMFORTABLE,
    mode: stored[STORAGE_KEYS.POPUP_MODE] || MATCH_MODES.DOMAIN,
    sort: stored[STORAGE_KEYS.POPUP_SORT] || SORT_OPTIONS.TITLE_ASC,
    ignoreQueryString: Boolean(stored[STORAGE_KEYS.IGNORE_QUERY]),
    ignoreHashFragment: stored[STORAGE_KEYS.IGNORE_HASH] !== false,
    themeMode: stored[STORAGE_KEYS.THEME_MODE] || THEME_MODES.SYSTEM,
    pinOnboardingVisible: stored[STORAGE_KEYS.PIN_ONBOARDING_VISIBLE] === true
  };
}

export async function savePopupPreferences({ mode, sort, ignoreQueryString, ignoreHashFragment }) {
  return setLocalStorage({
    [STORAGE_KEYS.POPUP_MODE]: mode,
    [STORAGE_KEYS.POPUP_SORT]: sort,
    [STORAGE_KEYS.IGNORE_QUERY]: ignoreQueryString,
    [STORAGE_KEYS.IGNORE_HASH]: ignoreHashFragment
  });
}

export async function loadDashboardPreferences() {
  const stored = await getLocalStorage([
    DASHBOARD_STORAGE_KEYS.SORT,
    DASHBOARD_STORAGE_KEYS.DUPLICATES_ONLY,
    STORAGE_KEYS.IGNORE_QUERY,
    STORAGE_KEYS.IGNORE_HASH,
    STORAGE_KEYS.POPUP_WIDTH,
    STORAGE_KEYS.MERGE_STRATEGY,
    DASHBOARD_STORAGE_KEYS.CLEANUP_FILTER,
    DASHBOARD_STORAGE_KEYS.SIDEBAR_COLLAPSED,
    DASHBOARD_STORAGE_KEYS.GROUP_BY,
    DASHBOARD_STORAGE_KEYS.GROUP_SORT,
    STORAGE_KEYS.REVIEW_SESSIONS,
    STORAGE_KEYS.CLEANUP_HISTORY,
    STORAGE_KEYS.REVIEW_REMINDER_ENABLED,
    STORAGE_KEYS.REVIEW_REMINDER_INTERVAL_DAYS,
    STORAGE_KEYS.REVIEW_REMINDER_LAST_REVIEW_AT,
    STORAGE_KEYS.REVIEW_REMINDER_NEXT_AT,
    STORAGE_KEYS.THEME_MODE,
    STORAGE_KEYS.PIN_ONBOARDING_VISIBLE
  ]);

  const cleanupFilter = stored[DASHBOARD_STORAGE_KEYS.CLEANUP_FILTER] || CLEANUP_FILTERS.ALL;
  return {
    sort: Object.values(SORT_OPTIONS).includes(stored[DASHBOARD_STORAGE_KEYS.SORT]) ? stored[DASHBOARD_STORAGE_KEYS.SORT] : SORT_OPTIONS.TITLE_ASC,
    ignoreQueryString: Boolean(stored[STORAGE_KEYS.IGNORE_QUERY]),
    ignoreHashFragment: stored[STORAGE_KEYS.IGNORE_HASH] !== false,
    popupWidth: stored[STORAGE_KEYS.POPUP_WIDTH] || POPUP_WIDTHS.COMFORTABLE,
    mergeStrategy: stored[STORAGE_KEYS.MERGE_STRATEGY] || MERGE_STRATEGIES.KEEP_NEWEST,
    cleanupFilter,
    duplicatesOnly: cleanupFilter === CLEANUP_FILTERS.DUPLICATES,
    sidebarCollapsed: stored[DASHBOARD_STORAGE_KEYS.SIDEBAR_COLLAPSED] === undefined
      ? true
      : Boolean(stored[DASHBOARD_STORAGE_KEYS.SIDEBAR_COLLAPSED]),
    groupBy: stored[DASHBOARD_STORAGE_KEYS.GROUP_BY] || GROUP_BY_OPTIONS.FLAT,
    groupSort: Object.values(GROUP_SORT_OPTIONS).includes(stored[DASHBOARD_STORAGE_KEYS.GROUP_SORT])
      ? stored[DASHBOARD_STORAGE_KEYS.GROUP_SORT]
      : GROUP_SORT_OPTIONS.DEFAULT,
    reviewSessions: Array.isArray(stored[STORAGE_KEYS.REVIEW_SESSIONS]) ? stored[STORAGE_KEYS.REVIEW_SESSIONS] : [],
    cleanupHistory: Array.isArray(stored[STORAGE_KEYS.CLEANUP_HISTORY]) ? stored[STORAGE_KEYS.CLEANUP_HISTORY] : [],
    reminderEnabled: Boolean(stored[STORAGE_KEYS.REVIEW_REMINDER_ENABLED]),
    reminderIntervalDays: Number(stored[STORAGE_KEYS.REVIEW_REMINDER_INTERVAL_DAYS] || 14),
    lastReviewAt: Number(stored[STORAGE_KEYS.REVIEW_REMINDER_LAST_REVIEW_AT] || 0),
    nextReviewAt: Number(stored[STORAGE_KEYS.REVIEW_REMINDER_NEXT_AT] || 0),
    themeMode: stored[STORAGE_KEYS.THEME_MODE] || THEME_MODES.SYSTEM,
    pinOnboardingVisible: stored[STORAGE_KEYS.PIN_ONBOARDING_VISIBLE] === true
  };
}

export async function saveDashboardPreferences({
  sort,
  duplicatesOnly,
  ignoreQueryString,
  ignoreHashFragment,
  popupWidth,
  mergeStrategy,
  cleanupFilter,
  sidebarCollapsed,
  groupBy,
  groupSort
}) {
  return setLocalStorage({
    [DASHBOARD_STORAGE_KEYS.SORT]: sort,
    [DASHBOARD_STORAGE_KEYS.DUPLICATES_ONLY]: duplicatesOnly,
    [STORAGE_KEYS.IGNORE_QUERY]: ignoreQueryString,
    [STORAGE_KEYS.IGNORE_HASH]: ignoreHashFragment,
    [STORAGE_KEYS.POPUP_WIDTH]: popupWidth,
    [STORAGE_KEYS.MERGE_STRATEGY]: mergeStrategy,
    [DASHBOARD_STORAGE_KEYS.CLEANUP_FILTER]: cleanupFilter,
    [DASHBOARD_STORAGE_KEYS.SIDEBAR_COLLAPSED]: sidebarCollapsed,
    [DASHBOARD_STORAGE_KEYS.GROUP_BY]: groupBy,
    [DASHBOARD_STORAGE_KEYS.GROUP_SORT]: groupSort
  });
}

export async function setPinOnboardingVisible(visible) {
  return setLocalStorage({ [STORAGE_KEYS.PIN_ONBOARDING_VISIBLE]: Boolean(visible) });
}

export async function saveReviewSessions(sessions, limit = 20) {
  return setLocalStorage({ [STORAGE_KEYS.REVIEW_SESSIONS]: (sessions || []).slice(0, limit) });
}

export async function saveCleanupHistory(history, limit = 60) {
  return setLocalStorage({ [STORAGE_KEYS.CLEANUP_HISTORY]: (history || []).slice(0, limit) });
}

export async function loadReviewReminderPreferences(defaultIntervalDays = 14) {
  const stored = await getLocalStorage([
    STORAGE_KEYS.REVIEW_REMINDER_ENABLED,
    STORAGE_KEYS.REVIEW_REMINDER_INTERVAL_DAYS,
    STORAGE_KEYS.REVIEW_REMINDER_LAST_REVIEW_AT,
    STORAGE_KEYS.REVIEW_REMINDER_NEXT_AT
  ]);
  return {
    enabled: Boolean(stored[STORAGE_KEYS.REVIEW_REMINDER_ENABLED]),
    intervalDays: Number(stored[STORAGE_KEYS.REVIEW_REMINDER_INTERVAL_DAYS] || defaultIntervalDays),
    lastReviewAt: Number(stored[STORAGE_KEYS.REVIEW_REMINDER_LAST_REVIEW_AT] || 0),
    nextReviewAt: Number(stored[STORAGE_KEYS.REVIEW_REMINDER_NEXT_AT] || 0)
  };
}

export async function saveReviewReminderPreferences({ enabled, intervalDays, lastReviewAt, nextReviewAt }) {
  return setLocalStorage({
    [STORAGE_KEYS.REVIEW_REMINDER_ENABLED]: Boolean(enabled),
    [STORAGE_KEYS.REVIEW_REMINDER_INTERVAL_DAYS]: Number(intervalDays || 14),
    [STORAGE_KEYS.REVIEW_REMINDER_LAST_REVIEW_AT]: Number(lastReviewAt || 0),
    [STORAGE_KEYS.REVIEW_REMINDER_NEXT_AT]: Number(nextReviewAt || 0)
  });
}
