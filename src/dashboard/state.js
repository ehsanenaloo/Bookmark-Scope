import {
  CLEANUP_FILTERS,
  GROUP_BY_OPTIONS,
  GROUP_SORT_OPTIONS,
  HEALTH_STATUSES,
  MERGE_STRATEGIES,
  POPUP_WIDTHS,
  SORT_OPTIONS,
  THEME_MODES
} from '../constants.js';

function createPreferencesSlice(mode) {
  return {
    mode,
    sort: SORT_OPTIONS.TITLE_ASC,
    groupBy: GROUP_BY_OPTIONS.FLAT,
    groupSort: GROUP_SORT_OPTIONS.DEFAULT,
    query: '',
    duplicatesOnly: false,
    cleanupFilter: CLEANUP_FILTERS.ALL,
    ignoreQueryString: false,
    ignoreHashFragment: true,
    popupWidth: POPUP_WIDTHS.COMFORTABLE,
    mergeStrategy: MERGE_STRATEGIES.KEEP_NEWEST,
    sidebarTab: 'overview',
    sidebarCollapsed: true,
    compactMode: false,
    themeMode: THEME_MODES.SYSTEM,
    colorPalette: 'teal',
    pinOnboardingVisible: false,
    healthPermissionState: HEALTH_STATUSES.UNKNOWN
  };
}

function createBookmarkDataSlice() {
  return {
    tab: null,
    target: null,
    allBookmarks: [],
    scopedBookmarks: [],
    visibleBookmarks: [],
    scopeSummary: null,
    visibleSummary: null,
    librarySummary: null,
    scopeFolderCount: 0,
    visibleDuplicateGroups: 0,
    newestVisibleBookmark: null,
    activeBookmarkId: null,
    scrollActiveBookmark: false,
    selectedIds: new Set(),
    lastDeletedBatch: null,
    collapsedGroupKeys: new Set(),
    healthByKey: {},
    healthSummary: null,
    healthLastRunAt: null,
    reviewSessions: [],
    cleanupHistory: [],
    // Tag overlay: bookmarkId → tags[]. Populated at init from
    // chrome.storage.local; mutated in-memory by addTag/removeTag actions
    // with debounced persistence. The dashboard filter UI reads this
    // alongside the normal cleanup-filter chain.
    tagsByBookmark: {},
    // Active tag filter — bookmarks must have ALL these tags to be shown.
    // Empty array means "no tag filter applied".
    activeTagFilter: []
  };
}

function createInspectionSlice() {
  return {
    isInspectingHealth: false,
    resumableScanRunning: false,
    inspectStopPending: false,
    inspectLaunchPending: false,
    healthScanProgress: 0,
    healthScanTotal: 0,
    inspectAbortRequested: false,
    inspectControllers: new Set(),
    inspectSessionId: 0
  };
}

function createReminderSlice() {
  return {
    reminderEnabled: false,
    reminderIntervalDays: 14,
    lastReviewAt: 0,
    nextReviewAt: 0
  };
}

function createUiSlice() {
  return {
    editingBookmarkId: null,
    toast: null,
    focusSearchAfterRender: false,
    searchSelectionStart: null,
    searchSelectionEnd: null,
    lastListScrollAt: 0,
    listScrollTop: 0,
    shouldScrollActiveIntoView: false,
    aboutOpen: false,
    rowMenuBookmarkId: null,
    rowMenuPosition: null,
    sidebarOverlayOpen: false,
    headerMenuOpen: false,
    headerMenuPosition: null,
    listHeadMenuOpen: false,
    listHeadMenuPosition: null,
    confirmDialog: null
  };
}

export function createDashboardState(mode) {
  return {
    ...createPreferencesSlice(mode),
    ...createBookmarkDataSlice(),
    ...createInspectionSlice(),
    ...createReminderSlice(),
    ...createUiSlice()
  };
}
