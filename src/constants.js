/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 */

export const MATCH_MODES = {
  PAGE: 'page',
  HOST: 'host',
  DOMAIN: 'domain'
};

export const SORT_OPTIONS = {
  TITLE_ASC: 'title-asc',
  URL_ASC: 'url-asc',
  NEWEST: 'newest',
  OLDEST: 'oldest',
  PATH_ASC: 'path-asc'
};

// Rows rendered in the popup list before the "open the dashboard" hint appears.
export const POPUP_MAX_ROWS = 20;

export const POPUP_WIDTHS = {
  COMPACT: 'compact',
  COMFORTABLE: 'comfortable'
};

export const THEME_MODES = {
  SYSTEM: 'system',
  LIGHT: 'light',
  DARK: 'dark'
};

export const COLOR_PALETTES = {
  TEAL: 'teal',
  BLUE: 'blue',
  INDIGO: 'indigo',
  NEUTRAL: 'neutral'
};

export const MERGE_STRATEGIES = {
  KEEP_NEWEST: 'keep-newest',
  KEEP_OLDEST: 'keep-oldest'
};

export const CLEANUP_FILTERS = {
  ALL: 'all',
  DUPLICATES: 'duplicates',
  UNTITLED: 'untitled',
  OLD: 'old',
  TITLE_COLLISIONS: 'title-collisions'
};

export const OLD_BOOKMARK_DAYS = 730;

export const DASHBOARD_MODE = 'library';

export const STORAGE_KEYS = {
  POPUP_MODE: 'popupMode',
  POPUP_SORT: 'popupSort',
  DUPLICATES_ONLY: 'duplicatesOnly',
  IGNORE_QUERY: 'ignoreQueryString',
  IGNORE_HASH: 'ignoreHashFragment',
  POPUP_WIDTH: 'popupWidth',
  MERGE_STRATEGY: 'mergeStrategy',
  CLEANUP_FILTER: 'cleanupFilter',
  REVIEW_SESSIONS: 'reviewSessions',
  CLEANUP_HISTORY: 'cleanupHistory',
  REVIEW_REMINDER_ENABLED: 'reviewReminderEnabled',
  REVIEW_REMINDER_INTERVAL_DAYS: 'reviewReminderIntervalDays',
  REVIEW_REMINDER_LAST_REVIEW_AT: 'reviewReminderLastReviewAt',
  REVIEW_REMINDER_NEXT_AT: 'reviewReminderNextAt',
  THEME_MODE: 'themeMode',
  COLOR_PALETTE: 'colorPalette',
  PIN_ONBOARDING_VISIBLE: 'pinOnboardingVisible',
  LOCALE_PREFERENCE: 'localePreference',
  LOCALE_OVERRIDES: 'localeOverrides',
  STORAGE_SCHEMA_VERSION: 'storageSchemaVersion',
  STORAGE_SCHEMA_UPDATED_AT: 'storageSchemaUpdatedAt',
  DIAGNOSTIC_EVENTS: 'diagnosticEvents',
  HEALTH_CACHE: 'healthCache',
  HEALTH_CACHE_GENERATION: 'healthCacheGeneration',
  HEALTH_CACHE_KEY_VERSION: 'healthCacheKeyVersion',
  BG_HEALTH_SCAN_CURSOR: 'bgHealthScanCursor',
  IMPORT_JOURNAL: 'importJournal',
  SMART_VIEWS: 'smartViews',
  HEALTH_SCAN_JOB: 'healthScanJob',
  SNAPSHOT_RESTORE_JOURNAL: 'snapshotRestoreJournal',
  BG_HEALTH_SCAN_ENABLED: 'bgHealthScanEnabled',
  BG_HEALTH_SCAN_INTERVAL_DAYS: 'bgHealthScanIntervalDays',
  BG_HEALTH_SCAN_LAST_RUN_AT: 'bgHealthScanLastRunAt',
  BG_HEALTH_SCAN_LAST_BROKEN_COUNT: 'bgHealthScanLastBrokenCount',
  // Tags overlay: map of bookmarkId → array of tag strings. Tags are
  // user-defined, orthogonal to Chrome's folder hierarchy.
  TAGS_BY_BOOKMARK: 'tagsByBookmark'
};



export const DASHBOARD_STORAGE_KEYS = {
  MODE: 'dashboardMode',
  SORT: 'dashboardSort',
  DUPLICATES_ONLY: 'dashboardDuplicatesOnly',
  CLEANUP_FILTER: 'dashboardCleanupFilter',
  SIDEBAR_COLLAPSED: 'dashboardSidebarCollapsed',
  GROUP_BY: 'dashboardGroupBy',
  GROUP_SORT: 'dashboardGroupSort'
};

export const GROUP_BY_OPTIONS = {
  FLAT: 'flat',
  DOMAIN: 'domain',
  FOLDER: 'folder',
  STATUS: 'status'
};

export const GROUP_SORT_OPTIONS = {
  DEFAULT: 'default',
  SIZE_DESC: 'size-desc',
  ALPHA_ASC: 'alpha-asc'
};

export const KEYBOARD_SHORTCUTS = {
  SEARCH: '/',
  MODE_PAGE: '1',
  MODE_HOST: '2',
  MODE_DOMAIN: '3'
};


export const HEALTH_STATUSES = {
  UNKNOWN: 'unknown',
  HEALTHY: 'healthy',
  REDIRECTED: 'redirected',
  BROKEN: 'broken',
  SERVER_ERROR: 'server-error',
  UNREACHABLE: 'unreachable'
};

export const HEALTH_SCAN_TIMEOUT_MS = 8000;
export const HEALTH_SCAN_CONCURRENCY = 4;

// Health cache: persisted across dashboard sessions so long scans aren't
// thrown away when the tab closes. Capped to keep storage usage bounded
// (each record is ~150 bytes; 5000 * 150 ≈ 750KB, well within the local
// storage quota). Entries older than the TTL are treated as stale and
// re-fetched on the next inspect run.
export const HEALTH_CACHE_MAX_ENTRIES = 5000;
export const HEALTH_CACHE_EVICTION_BATCH = 500;
export const HEALTH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Background scheduled health scan: runs at a user-configurable interval
// from a chrome.alarms callback. Caps are conservative because the scan
// runs in the service worker which Chrome can terminate at any time.
export const BG_HEALTH_SCAN_MAX_PER_RUN = 250;
export const BG_HEALTH_SCAN_CONCURRENCY = 2;
export const BG_HEALTH_SCAN_DEFAULT_INTERVAL_DAYS = 7;

// Tag system: user-defined labels stored as a bookmarkId → tags[] map in
// chrome.storage.local. Limits are conservative to keep the overlay
// inside the local storage quota and avoid UI dialogs growing without
// bound. Tag strings are normalised to lowercase, trimmed, and stripped
// of whitespace/control characters at the input layer.
export const TAG_MAX_LENGTH = 32;
export const TAG_MAX_PER_BOOKMARK = 20;
export const TAG_MAX_UNIQUE_TAGS = 500;

export const SEARCH_CACHE_MAX_SIZE = 100;


export const OPTIONAL_HOST_PATTERNS = Object.freeze(['http://*/*', 'https://*/*']);
