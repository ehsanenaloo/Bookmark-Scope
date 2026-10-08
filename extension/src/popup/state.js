import { MATCH_MODES, SORT_OPTIONS, THEME_MODES } from '../core/constants.js';
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
    scopeSummary: getCleanupSummary([])
  };
}

function createUiSlice() {
  return {
    query: '',
    toast: null,
    footerTab: '',
    footerAutoRotate: true,
    footerHoverPaused: false,
    footerProgress: 0,
    menuOpen: false,
    aboutOpen: false,
    pinOnboardingVisible: false,
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
