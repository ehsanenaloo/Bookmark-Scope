import { MATCH_MODES, POPUP_MAX_ROWS, SORT_OPTIONS, THEME_MODES } from '../core/constants.js';
import { getCleanupSummary } from '../core/bookmark-utils.js';

function createPreferencesSlice() {
  return {
    mode: MATCH_MODES.DOMAIN,
    sort: SORT_OPTIONS.TITLE_ASC,
    ignoreQueryString: false,
    ignoreHashFragment: true,
    themeMode: THEME_MODES.SYSTEM
  };
}

function createBookmarkDataSlice() {
  return {
    target: null,
    tab: null,
    allBookmarks: [],
    bookmarkedUrlsSet: new Set(),
    scopeBookmarks: [],
    visibleBookmarks: [],
    visibleFromFuzzy: false,
    rowLimit: POPUP_MAX_ROWS,
    lazyLoad: true,
    scopeSummary: getCleanupSummary([])
  };
}

function createUiSlice() {
  return {
    query: '',
    // 'site' lists the bookmarks of the active tab's scope (popup and side panel);
    // 'all' lists the whole library (side panel only). folderIds, when set,
    // limits 'all' to those folder ids. groupByFolder shows either list as a
    // folder tree (side panel only).
    view: 'site',
    folderIds: null,
    groupByFolder: false,
    toast: null,
    footerTab: '',
    footerAutoRotate: true,
    footerHoverPaused: false,
    footerProgress: 0,
    menuOpen: false,
    aboutOpen: false,
    pinOnboardingVisible: false,
    supportNudgeVisible: false,
    confirmDialog: null
  };
}

export function createPopupState() {
  return {
    ...createPreferencesSlice(),
    ...createBookmarkDataSlice(),
    ...createUiSlice()
  };
}
