/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 */

import {
  MATCH_MODES,
  SORT_OPTIONS,
  STORAGE_KEYS,
  KEYBOARD_SHORTCUTS,
  POPUP_WIDTHS,
  MERGE_STRATEGIES,
  CLEANUP_FILTERS,
  OLD_BOOKMARK_DAYS,
  HEALTH_STATUSES,
  HEALTH_SCAN_TIMEOUT_MS,
  HEALTH_SCAN_CONCURRENCY,
  THEME_MODES,
  COLOR_PALETTES,
  DASHBOARD_STORAGE_KEYS,
  GROUP_BY_OPTIONS,
  GROUP_SORT_OPTIONS
} from './src/constants.js';
import {
  getNormalizedBookmarks,
  detectDuplicates,
  filterScopedBookmarks,
  sortBookmarks,
  groupDuplicates,
  getCleanupSummary,
  invalidateBookmarkCache
} from './src/bookmark-utils.js';
import { getMatchTarget, matchesMode } from './src/url-utils.js';
import { applyTheme, applyPalette, loadStoredTheme, loadStoredPalette, saveThemeMode, saveColorPalette, watchSystemTheme } from './src/theme-utils.js';
import { loadDashboardPreferences, saveDashboardPreferences, saveReviewSessions, saveCleanupHistory, saveReviewReminderPreferences, setPinOnboardingVisible } from './src/services/preferences-service.js';
import { iconSvg, createIconButton, createIconElement } from './src/icon-system.js';
import { formatDateTime, formatNumber, initI18n, t, translateTree } from './src/i18n.js';
import { createFaviconNode, debounce, trapFocus, getHostnameSafe } from './src/ui-utils.js';
import { isoNow, makeStableId, now } from './src/platform/time.js';
import {
  addBookmarkEventListeners,
  addStorageChangedListener,
  createBookmark,
  getManifest,
  getRuntimeUrl,
  moveBookmark,
  queryTabs,
  removeBookmark,
  sendRuntimeMessage,
  updateBookmark
} from './src/platform/browser-api.js';
import {
  getHealthKey,
  getHealthRecord as getStoredHealthRecord,
  summarizeHealth,
  getBookmarksByHealthStatus,
  getRedirectedBookmarks,
  healthLabel,
  healthBadgeClass,
  bookmarkStatusBadgeClass,
  inspectUrlHealth as inspectUrlHealthRecord,
  runWithConcurrency
} from './src/dashboard/health.js';
import { createReviewTools } from './src/dashboard/review-tools.js';
import { createViewTools } from './src/dashboard/view-tools.js';
import { createGroupTools } from './src/dashboard/group-tools.js';
import { createOverlayTools } from './src/dashboard/overlay-tools.js';
import { createRenderTools } from './src/dashboard/render-tools.js';
import { createActionTools } from './src/dashboard/action-tools.js';
import { createSelectionTools } from './src/dashboard/selection-tools.js';
import { createInspectTools } from './src/dashboard/inspect-tools.js';
import { downloadTextFile, createCsvFile, parseImportedFilePreview } from './src/dashboard/import-export-tools.js';
import { loadImportJournal } from './src/services/import-service.js';
import { parseImportedThirdPartyFile } from './src/services/third-party-import.js';
import { createDashboardState } from './src/dashboard/state.js';
import { createFeatureTools } from './src/dashboard/feature-tools.js';
import { featureText } from './src/locales/feature-messages.js';
import { createCommandRegistry } from './src/dashboard/command-registry.js';
import { MESSAGE_TYPES, runtimeMessages } from './src/runtime/messages.js';
import { createLogger } from './src/services/diagnostics-service.js';
import { initializeStorageLayer } from './src/services/storage-service.js';
import { loadHealthCache, clearHealthCache, deleteHealthRecord, awaitPendingHealthWrites } from './src/services/health-cache-service.js';
import { loadTagsMap, updateTagsMap, summariseTags, pruneOrphanedTags } from './src/services/tag-service.js';
import { parseDashboardContextParams, CONTEXT_MENU_ACTIONS } from './src/services/context-menu-service.js';
import { createVirtualScroller } from './src/dashboard/virtual-scroller.js';

const DASHBOARD_MODE = 'library';
const state = createDashboardState(DASHBOARD_MODE);
const logger = createLogger('dashboard');

const app = document.getElementById('app');
let searchInputRef = null;
let importInputRef = null;

// Virtual scroller instance for the flat bookmark list
let _virtualScroller = null;
const virtualRowHeights = new Map(); // preserve measured offsets across list rebuilds

// Threshold: use virtual scrolling when list exceeds this count
const VIRTUAL_SCROLL_THRESHOLD = 150;

function getHealthRecord(bookmark, map = state.healthByKey) {
  return getStoredHealthRecord(bookmark, map);
}

function applyHealthRecordToBookmarks(recordKey, record) {
  const applyTo = (bookmark) => {
    if (!bookmark || getHealthKey(bookmark) !== recordKey) return;
    bookmark.healthStatus = record?.status || '';
    bookmark.healthCheckedAt = record?.checkedAt || null;
    bookmark.healthStatusCode = record?.statusCode || null;
    bookmark.healthFinalUrl = record?.finalUrl || bookmark.url || '';
    bookmark.healthError = record?.error || '';
    bookmark.healthMethod = record?.method || '';
  };

  for (const bookmark of state.allBookmarks || []) applyTo(bookmark);
  for (const bookmark of state.visibleBookmarks || []) applyTo(bookmark);
}

const groupTools = createGroupTools({
  state,
  t,
  render,
  savePreferences,
  formatNumber,
  getCleanupSummary,
  summarizeHealth,
  recalculateVisibleBookmarks,
  GROUP_BY_OPTIONS,
  GROUP_SORT_OPTIONS,
  SORT_OPTIONS
});

const {
  groupByLabel,
  updateGroupBy,
  groupSortLabel,
  updateGroupSort,
  updateSort,
  getGroupedVisibleBookmarks,
  isGroupFullySelected,
  toggleGroupSelection,
  isGroupCollapsed,
  toggleGroupCollapsed,
  setAllGroupsCollapsed,
  getGroupHealthSummary
} = groupTools;

const selectionTools = createSelectionTools({
  state,
  render
});
const {
  getSelectedBookmarks,
  getSelectedCount,
  hasSelection,
  isBookmarkSelected,
  cleanupSelection,
  clearSelection,
  setBookmarkSelection,
  toggleBookmarkSelection,
  deselectBookmarks,
  selectAllVisible,
  areBookmarksSelected,
  toggleBookmarksSelection,
  selectBookmarks
} = selectionTools;

const viewTools = createViewTools({
  state,
  t,
  formatNumber,
  render,
  savePreferences,
  recalculateVisibleBookmarks,
  summarizeHealth,
  getCleanupSummary,
  CLEANUP_FILTERS,
  OLD_BOOKMARK_DAYS,
  DASHBOARD_MODE,
  MATCH_MODES,
  getSelectedBookmarks,
  cleanupSelection,
  areBookmarksSelected,
  toggleBookmarksSelection,
  selectBookmarks
});
const {
  modeLabel,
  getInspectTargetBookmarks,
  getInspectButtonLabel,
  ensureActiveBookmark,
  getActiveBookmark,
  moveActiveBookmark,
  setActiveBookmark,
  getScopedBookmarks,
  getScopeSummary,
  getScopeHealthSummary,
  getLibrarySummary,
  getViewStats,
  cleanupFilterLabel,
  getCleanupCount,
  clearCleanupFilters,
  setCleanupFilter,
  runCleanupPreset
} = viewTools;

function getActiveScopeLabel() {
  if (getSelectedCount()) return t('selected bookmarks');
  if (state.mode === DASHBOARD_MODE) return t('Entire library');
  return state.target?.label || modeLabel(state.mode) || t('Unknown scope');
}

const inspectTools = createInspectTools({
  state,
  t,
  now,
  formatNumber,
  makeStableId,
  getHealthKey,
  summarizeHealth,
  inspectUrlHealthRecord,
  runWithConcurrency,
  sendMessage,
  render,
  renderListOnly,
  updateInspectProgress,
  rememberListScroll,
  setToast,
  pushCleanupHistory,
  applyHealthRecordToBookmarks,
  getSelectedBookmarks,
  modeLabel,
  getSelectionCount: getSelectedCount,
  getActiveScopeLabel
});
const {
  cancelHealthInspection,
  inspectBookmarksHealth,
  ensureHealthPermission,
  inspectUrlHealth
} = inspectTools;

const actionTools = createActionTools({
  state,
  t,
  formatNumber,
  sendMessage,
  // showConfirmDialog is defined by overlayTools which is initialised after
  // actionTools.  The thunk defers the reference until first call, by which
  // point overlayTools has already been created.  Do NOT replace with a direct
  // reference here — it would be undefined at module evaluation time.
  showConfirmDialog: (...args) => showConfirmDialog(...args),
  previewDuplicateMerge: () => featureTools.showDuplicatePreview(),
  setToast,
  refreshData,
  renderListOnly,
  pushCleanupHistory,
  invalidateBookmarkCache,
  createBookmark,
  updateBookmark,
  removeBookmark,
  moveBookmark,
  getHealthRecord: (bookmark, map = state.healthByKey) => getHealthRecord(bookmark, map),
  getRedirectedBookmarks,
  groupDuplicates,
  getSelectedBookmarks,
  deselectBookmarks,
  getCurrentPageBookmarkTarget: () => !!(state.tab?.url && state.target?.valid),
  getCurrentPageBookmarkPayload: () => {
    if (!state.tab?.url || !state.target?.valid) return null;
    return { title: state.tab.title || state.target.hostname, url: state.tab.url };
  }
});

const {
  handleOpen,
  handleRepairRedirects,
  handleCopySelectedUrls,
  handleDeleteMany,
  handleMergeDuplicates,
  handleSaveEdit,
  handleBookmarkCurrentPage,
  handleClearHealthData,
  handleDragDropMove,
  handleAddTag,
  handleRemoveTag
} = actionTools;

const reviewTools = createReviewTools({
  state,
  t,
  formatNumber,
  isoNow,
  now,
  makeStableId,
  saveReviewReminderPreferences,
  sendMessage,
  downloadTextFile,
  render,
  setToast,
  modeLabel,
  getScopeSummary,
  getScopeHealthSummary,
  summarizeHealth,
  getBookmarksByHealthStatus: (statuses, items = state.visibleBookmarks) => getBookmarksByHealthStatus(statuses, items, state.healthByKey),
  getRedirectedBookmarks: (items = state.visibleBookmarks) => getRedirectedBookmarks(items, state.healthByKey),
  clearCleanupFilters,
  toggleBookmarksSelection,
  areBookmarksSelected,
  handleSaveReviewSession,
  inspectBookmarksHealth,
  handleRepairRedirects,
  runCleanupPreset,
  handleMergeDuplicates,
  pushCleanupHistory
});

const overlayTools = createOverlayTools({
  state,
  t,
  render,
  renderOverlaysOnly: (...args) => renderOverlaysOnly(...args),
  create,
  createIconButton,
  createIconElement,
  trapFocus,
  sendMessage,
  setPinOnboardingVisible,
  getFixedMenuPosition,
  applyFixedMenuPosition,
  clampFixedMenuToViewport,
  createThemeControls,
  updateColorPalette: (...args) => updateColorPalette(...args),
  COLOR_PALETTES,
  getManifest,
  getRuntimeUrl
});
const {
  closeAboutModal,
  closeConfirmDialog,
  showConfirmDialog,
  renderConfirmDialog,
  renderAboutModal,
  renderPinOnboarding,
  closeHeaderMenu,
  toggleHeaderMenu,
  openSupportLink,
  closeListHeadMenu,
  toggleListHeadMenu,
  createListHeadActionsMenu,
  renderHeaderMenuOverlay,
  renderListHeadMenuOverlay
} = overlayTools;

const renderTools = createRenderTools({
  state,
  t,
  create,
  iconSvg,
  createIconButton,
  createIconElement,
  formatNumber,
  debounce,
  getManifest,
  getRuntimeUrl,
  getCleanupSummary,
  getHealthRecord,
  handleOpen,
  buildInspectButton,
  inspectBookmarksHealth,
  renderItem,
  render,
  isGroupCollapsed,
  toggleGroupCollapsed,
  isGroupFullySelected,
  toggleGroupSelection,
  getGroupHealthSummary,
  getInspectTargetBookmarks,
  getInspectButtonLabel,
  modeLabel,
  getScopedBookmarks,
  getScopeSummary,
  getCleanupCount,
  cleanupFilterLabel,
  groupByLabel,
  getGroupedVisibleBookmarks,
  setAllGroupsCollapsed,
  setCleanupFilter,
  handleCopySelectedUrls,
  handleDeleteMany,
  createListHeadActionsMenu,
  handleRepairRedirects,
  handleExport,
  openSupportLink,
  toggleHeaderMenu,
  recalculateVisibleBookmarks,
  renderListOnly,
  updateGroupBy,
  updateGroupSort,
  updateSort,
  groupSortLabel,
  searchInputRefAccessor: {
    get: () => searchInputRef,
    set: (value) => { searchInputRef = value; }
  }
});
const {
  renderHeader,
  renderToolbar,
  renderBulkBar,
  renderGroupDisplayControl,
  renderBookmarkGroup
} = renderTools;

const {
  formatActionType,
  getHistoryTrends,
  buildReviewReport,
  exportReviewReport,
  buildReminderState,
  getReminderState,
  computeHealthScore,
  buildSmartRecommendations,
  getReviewQueue,
  persistReminderSettings,
  handleUpdateReminderSettings,
  handleMarkReviewedNow
} = reviewTools;


function getBookmarkHostLabel(url) {
  const host = getHostnameSafe(url);
  if (!host) return t('Unknown host');
  return host.replace(/^www\./i, '') || host;
}

function formatAgeCompact(days) {
  if (!Number.isFinite(days) || days < 0) return t('Old');
  if (days >= 365) return t('~{{count}} years old', { count: formatNumber(Math.max(1, Math.round(days / 365))) });
  if (days >= 45) return t('~{{count}} months old', { count: formatNumber(Math.max(2, Math.round(days / 30))) });
  return t('{{count}} days old', { count: formatNumber(days) });
}

function formatAgeHuman(days) {
  if (!Number.isFinite(days) || days < 0) return t('Unknown');
  if (days >= 365) {
    const years = Math.max(1, Math.round(days / 365));
    return t('About {{years}} years ago', { years: formatNumber(years) });
  }
  if (days >= 45) {
    const months = Math.max(2, Math.round(days / 30));
    return t('About {{months}} months ago', { months: formatNumber(months) });
  }
  return t('{{days}} days ago', { days: formatNumber(days) });
}

function createHighlightedFragment(text, query) {
  const fragment = document.createDocumentFragment();
  const source = String(text || '');
  const needle = String(query || '').trim();
  if (!needle) {
    fragment.append(document.createTextNode(source));
    return fragment;
  }

  const lowerSource = source.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let startIndex = 0;

  while (startIndex < source.length) {
    const matchIndex = lowerSource.indexOf(lowerNeedle, startIndex);
    if (matchIndex == -1) {
      fragment.append(document.createTextNode(source.slice(startIndex)));
      break;
    }

    if (matchIndex > startIndex) {
      fragment.append(document.createTextNode(source.slice(startIndex, matchIndex)));
    }

    const mark = document.createElement('mark');
    mark.className = 'highlight-match';
    mark.textContent = source.slice(matchIndex, matchIndex + needle.length);
    fragment.append(mark);
    startIndex = matchIndex + needle.length;
  }

  return fragment;
}

let dashboardGlobalDismissAttached = false;

function attachGlobalDismissHandlers() {
  if (dashboardGlobalDismissAttached) return;
  dashboardGlobalDismissAttached = true;

  document.addEventListener('pointerdown', (event) => {
    if (!app?.childElementCount) return;

    let shouldRender = false;

    if (state.headerMenuOpen && !event.target.closest('.dashboard-header-menu-wrap, .dashboard-header-menu-portal')) {
      state.headerMenuOpen = false;
      state.headerMenuPosition = null;
      shouldRender = true;
    }

    if (state.listHeadMenuOpen && !event.target.closest('.dashboard-list-actions-menu-wrap, .dashboard-list-head-menu-portal')) {
      state.listHeadMenuOpen = false;
      state.listHeadMenuPosition = null;
      shouldRender = true;
    }

    if (state.rowMenuBookmarkId && !event.target.closest('.item-more-wrap, .item-more-menu-portal')) {
      state.rowMenuBookmarkId = null;
      state.rowMenuPosition = null;
      shouldRender = true;
    }

    if (state.sidebarOverlayOpen && isSidebarOverlayMode() && !event.target.closest('.dashboard-sidebar')) {
      clearSidebarOverlayHideTimer();
      state.sidebarOverlayOpen = false;
      shouldRender = true;
    }

    if (shouldRender) renderOverlaysOnly();
  }, true);
}

async function sendMessage(message) {
  const type = message?.type || '';
  if (!type || !Object.values(MESSAGE_TYPES).includes(type)) {
    throw new Error(t('Unknown request type.'));
  }
  try {
    return await sendRuntimeMessage(message);
  } catch (error) {
    console.warn('Runtime message failed.', error);
    throw new Error(error?.message || t('Unexpected error.'));
  }
}

// Set by applyContextMenuParams(): a context-menu or shortcut deep link names the
// page to scope to. The dashboard tab itself is never a valid scope target, so
// refreshData() must not replace it with the active (dashboard) tab.
let contextOverrideTab = null;

async function getActiveTabContext() {
  if (contextOverrideTab?.url) {
    return { tab: contextOverrideTab, target: getMatchTarget(contextOverrideTab.url, getParseOptions()) };
  }
  try {
    const tabs = await queryTabs({ active: true, currentWindow: true });
    const tab = tabs?.[0] || null;
    return { tab, target: tab?.url ? getMatchTarget(tab.url, getParseOptions()) : null };
  } catch (error) {
    console.warn('Direct tab lookup failed.', error);
  }

  const response = await sendMessage(runtimeMessages.getActiveTabContext());
  return {
    tab: response?.tab || null,
    target: response?.tab?.url ? getMatchTarget(response.tab.url, getParseOptions()) : response?.target || null
  };
}

function getParseOptions() {
  return {
    ignoreQueryString: state.ignoreQueryString,
    ignoreHashFragment: state.ignoreHashFragment
  };
}

function applyPopupWidth() {
  const width = state.popupWidth === POPUP_WIDTHS.COMPACT ? '380px' : '420px';
  document.documentElement.style.setProperty('--popup-width', width);
}

async function loadPreferences() {
  const prefs = await loadDashboardPreferences();
  await logger.debug('preferences_loaded', { groupBy: prefs.groupBy, sort: prefs.sort });

  state.mode = DASHBOARD_MODE;
  state.sort = prefs.sort;
  state.ignoreQueryString = prefs.ignoreQueryString;
  state.ignoreHashFragment = prefs.ignoreHashFragment;
  state.popupWidth = prefs.popupWidth;
  state.mergeStrategy = prefs.mergeStrategy;
  state.cleanupFilter = prefs.cleanupFilter;
  state.duplicatesOnly = prefs.duplicatesOnly;
  state.sidebarCollapsed = prefs.sidebarCollapsed;
  state.groupBy = prefs.groupBy;
  state.groupSort = prefs.groupSort;
  state.reviewSessions = prefs.reviewSessions;
  state.cleanupHistory = prefs.cleanupHistory;
  state.reminderEnabled = prefs.reminderEnabled;
  state.reminderIntervalDays = prefs.reminderIntervalDays;
  state.lastReviewAt = prefs.lastReviewAt;
  state.nextReviewAt = prefs.nextReviewAt;
  state.themeMode = prefs.themeMode;
  state.pinOnboardingVisible = prefs.pinOnboardingVisible;
  applyTheme(state.themeMode);
  applyPopupWidth();
}

async function savePreferences() {
  await saveDashboardPreferences({
    sort: state.sort,
    duplicatesOnly: state.duplicatesOnly,
    ignoreQueryString: state.ignoreQueryString,
    ignoreHashFragment: state.ignoreHashFragment,
    popupWidth: state.popupWidth,
    mergeStrategy: state.mergeStrategy,
    cleanupFilter: state.cleanupFilter,
    sidebarCollapsed: state.sidebarCollapsed,
    groupBy: state.groupBy,
    groupSort: state.groupSort
  }, () => state.inspectAbortRequested);
}

function create(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function isRtlDocument() {
  return document?.documentElement?.dir === 'rtl';
}

function getFixedMenuPosition(anchorRect, gap = 8) {
  const position = {
    top: Math.max(12, Math.round(anchorRect.bottom + gap))
  };

  if (isRtlDocument()) {
    position.left = Math.max(12, Math.round(anchorRect.left));
  } else {
    position.right = Math.max(12, Math.round(window.innerWidth - anchorRect.right));
  }

  return position;
}

function applyFixedMenuPosition(element, position) {
  if (!element || !position) return;
  element.style.position = 'fixed';
  element.style.top = `${position.top}px`;
  if (Number.isFinite(position.left)) {
    element.style.left = `${position.left}px`;
    element.style.right = 'auto';
  } else if (Number.isFinite(position.right)) {
    element.style.right = `${position.right}px`;
    element.style.left = 'auto';
  }
}

function clampFixedMenuToViewport(element, margin = 12) {
  if (!element) return;
  const rect = element.getBoundingClientRect();
  let left = rect.left;
  let top = rect.top;

  if (rect.right > window.innerWidth - margin) {
    left -= rect.right - (window.innerWidth - margin);
  }
  if (left < margin) {
    left = margin;
  }

  if (rect.bottom > window.innerHeight - margin) {
    top -= rect.bottom - (window.innerHeight - margin);
  }
  if (top < margin) {
    top = margin;
  }

  element.style.left = `${Math.round(left)}px`;
  element.style.right = 'auto';
  element.style.top = `${Math.round(top)}px`;
}


const SIDEBAR_OVERLAY_MAX_WIDTH = 1320;
const SIDEBAR_STACK_MAX_WIDTH = 860;

function isSidebarOverlayMode() {
  const width = window.innerWidth || document.documentElement.clientWidth || 0;
  return state.sidebarCollapsed || (width <= SIDEBAR_OVERLAY_MAX_WIDTH && width > SIDEBAR_STACK_MAX_WIDTH);
}

let sidebarOverlayHideTimer = 0;

function clearSidebarOverlayHideTimer() {
  if (sidebarOverlayHideTimer) {
    clearTimeout(sidebarOverlayHideTimer);
    sidebarOverlayHideTimer = 0;
  }
}

function closeSidebarOverlay() {
  clearSidebarOverlayHideTimer();
  if (!state.sidebarOverlayOpen) return;
  state.sidebarOverlayOpen = false;
  renderOverlaysOnly();
}

function scheduleSidebarOverlayClose(delay = 180) {
  clearSidebarOverlayHideTimer();
  if (!state.sidebarOverlayOpen || !isSidebarOverlayMode()) return;
  sidebarOverlayHideTimer = setTimeout(() => {
    sidebarOverlayHideTimer = 0;
    if (!state.sidebarOverlayOpen || !isSidebarOverlayMode()) return;
    state.sidebarOverlayOpen = false;
    renderOverlaysOnly();
  }, delay);
}

let resizeRaf = 0;
function handleResponsiveResize() {
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    if (!app.childElementCount) return;
    if (!isSidebarOverlayMode()) state.sidebarOverlayOpen = false;
    state.headerMenuOpen = false;
    state.headerMenuPosition = null;
    state.listHeadMenuOpen = false;
    state.listHeadMenuPosition = null;
    render();
  });
}


async function updateThemeMode(mode) {
  state.themeMode = mode;
  applyTheme(mode);
  await saveThemeMode(mode);
  updateThemeControls();
}

async function updateColorPalette(palette) {
  state.colorPalette = palette;
  applyPalette(palette);
  await saveColorPalette(palette);
  updatePaletteControls();
}

function updatePaletteControls() {
  document.querySelectorAll('[data-palette-control]').forEach((button) => {
    const active = button.dataset.paletteControl === state.colorPalette;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function updateThemeControls() {
  document.querySelectorAll('[data-theme-control]').forEach((button) => {
    const active = button.dataset.themeControl === state.themeMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function createThemeControls() {
  const wrap = create('div', 'theme-controls dashboard-theme-controls');
  const items = [
    { mode: THEME_MODES.SYSTEM, icon: 'system', title: t('Follow system theme') },
    { mode: THEME_MODES.LIGHT, icon: 'light', title: t('Use light theme') },
    { mode: THEME_MODES.DARK, icon: 'dark', title: t('Use dark theme') }
  ];
  for (const item of items) {
    const button = createIconButton(item.icon, item.title, 'icon-button mono-icon-button theme-button');
    button.dataset.themeControl = item.mode;
    button.addEventListener('click', () => updateThemeMode(item.mode));
    wrap.append(button);
  }
  return wrap;
}



function recalculateVisibleBookmarks() {
  if (state.mode !== DASHBOARD_MODE && !state.target?.valid) {
    state.scopedBookmarks = [];
    state.scopeSummary = getCleanupSummary([]);
    state.visibleSummary = getCleanupSummary([]);
    state.scopeFolderCount = 0;
    state.visibleDuplicateGroups = 0;
    state.newestVisibleBookmark = null;
    state.visibleBookmarks = [];
    clearSelection();
    return;
  }

  state.scopedBookmarks = state.mode === DASHBOARD_MODE
    ? [...state.allBookmarks]
    : state.allBookmarks.filter((bookmark) => matchesMode(bookmark, state.target, state.mode));
  state.scopeSummary = getCleanupSummary(state.scopedBookmarks);
  state.scopeFolderCount = new Set(state.scopedBookmarks.map((bookmark) => bookmark.path || 'Root')).size;

  const filtered = filterScopedBookmarks(
    state.scopedBookmarks,
    state.query,
    {
      duplicatesOnly: state.duplicatesOnly,
      cleanupFilter: state.cleanupFilter,
      tagsByBookmark: state.tagsByBookmark,
      requiredTags: state.activeTagFilter
    }
  );

  state.visibleBookmarks = sortBookmarks(filtered, state.sort);
  state.visibleSummary = getCleanupSummary(state.visibleBookmarks);
  state.healthSummary = summarizeHealth(state.visibleBookmarks, state.healthByKey);
  state.visibleDuplicateGroups = state.visibleSummary.duplicateGroupCount;
  state.newestVisibleBookmark = state.visibleBookmarks.reduce((best, bookmark) => {
    if (!best) return bookmark;
    return (bookmark.dateAdded || 0) > (best.dateAdded || 0) ? bookmark : best;
  }, null);
  cleanupSelection();
  ensureActiveBookmark();
}

async function refreshData() {
  const context = await getActiveTabContext();
  state.tab = context?.tab || null;
  state.target = context?.target || (state.tab?.url ? getMatchTarget(state.tab.url, getParseOptions()) : null);
  state.allBookmarks = detectDuplicates(await getNormalizedBookmarks(getParseOptions()));
  state.librarySummary = getCleanupSummary(state.allBookmarks);
  recalculateVisibleBookmarks();
  await logger.debug('data_refreshed', { totalBookmarks: state.allBookmarks.length, visibleBookmarks: state.visibleBookmarks.length });
}

function setToast(message, options = {}) {
  window.clearTimeout(setToast.timeoutId);
  state.toast = {
    message,
    error: Boolean(options.error),
    actionLabel: options.actionLabel || '',
    action: typeof options.action === 'function' ? options.action : null,
    persist: Boolean(options.persist)
  };
  // Use targeted toast-only render to avoid rebuilding the entire panel
  renderToastOnly();
  if (!state.toast.persist) {
    setToast.timeoutId = window.setTimeout(() => {
      state.toast = null;
      renderToastOnly();
    }, options.duration ?? 2600);
  }
}

function clearToast() {
  window.clearTimeout(setToast.timeoutId);
  state.toast = null;
}

async function persistReviewSessions() {
  await saveReviewSessions(state.reviewSessions, 20);
}

async function persistCleanupHistory() {
  await saveCleanupHistory(state.cleanupHistory, 60);
}

function buildSessionSnapshot() {
  return {
    id: makeStableId('review-session'),
    createdAt: now(),
    mode: state.mode,
    query: state.query,
    cleanupFilter: state.cleanupFilter,
    duplicatesOnly: state.duplicatesOnly,
    targetLabel: state.target?.label || t('Unknown scope'),
    targetSubtitle: state.target?.subtitle || '',
    targetValue: state.target?.modeValue || state.target?.hostname || state.target?.domain || state.target?.normalizedPageKey || '',
    summary: {
      scopedCount: state.scopedBookmarks.length,
      visibleCount: state.visibleBookmarks.length,
      duplicateCount: state.scopeSummary?.duplicateCount || 0,
      oldCount: state.scopeSummary?.oldCount || 0,
      untitledCount: state.scopeSummary?.untitledCount || 0,
      titleCollisionCount: state.scopeSummary?.titleCollisionCount || 0,
      unhealthyCount: (state.healthSummary?.broken || 0) + (state.healthSummary?.serverError || 0) + (state.healthSummary?.unreachable || 0)
    },
    selectedIds: [...state.selectedIds]
  };
}

async function handleSaveReviewSession() {
  if (state.mode !== DASHBOARD_MODE && !state.target?.valid) {
    setToast(t('Cannot save a session for a page the extension cannot parse.'), { error: true });
    return;
  }
  const session = buildSessionSnapshot();
  state.reviewSessions = [session, ...state.reviewSessions.filter((item) => item.id !== session.id)].slice(0, 20);
  await persistReviewSessions();
  setToast(t('Saved review session for {{scope}}. Future-you now has breadcrumbs.', { scope: modeLabel(state.mode).toLowerCase() }));
  render();
}

async function handleRestoreReviewSession(sessionId) {
  const session = state.reviewSessions.find((item) => item.id === sessionId);
  if (!session) {
    setToast(t('That saved session evaporated.'), { error: true });
    return;
  }
  state.mode = session.mode || MATCH_MODES.DOMAIN;
  state.query = session.query || '';
  state.cleanupFilter = session.cleanupFilter || CLEANUP_FILTERS.ALL;
  state.duplicatesOnly = Boolean(session.duplicatesOnly);
  state.selectedIds = new Set(session.selectedIds || []);
  await savePreferences();
  recalculateVisibleBookmarks();
  state.focusSearchAfterRender = true;
  setToast(t('Restored session from {{datetime}}.', {
    datetime: formatDateTime(session.createdAt, { dateStyle: 'medium', timeStyle: 'short' })
  }));
  render();
}

async function handleDeleteReviewSession(sessionId) {
  state.reviewSessions = state.reviewSessions.filter((item) => item.id !== sessionId);
  await persistReviewSessions();
  setToast(t('Saved session deleted. Memory is now slightly more selective.'));
  render();
}

async function pushCleanupHistory(entry) {
  const next = {
    id: makeStableId('cleanup-history'),
    at: now(),
    mode: state.mode,
    targetLabel: state.target?.label || t('Unknown scope'),
    ...entry
  };
  state.cleanupHistory = [next, ...(state.cleanupHistory || [])].slice(0, 60);
  await persistCleanupHistory();
}


function renderFatal(message, error) {
  app.textContent = '';
  const panel = create('div', 'panel');
  const section = create('div', 'section');
  section.append(
    create('h1', 'title', t('Bookmark Scope')),
    create('div', 'subtitle', message),
    create('div', 'context-text', error?.message || t('No extra diagnostics available.'))
  );
  panel.append(section);
  app.append(panel);
}

let stopWatchingTheme = null;
const _dashboardLifecycle = new AbortController();

async function init() {
  try {
    const storage = await initializeStorageLayer();
    await initI18n();
    await logger.info('init_started', { storageMigrated: storage.migrated, previousVersion: storage.previousVersion });
    state.themeMode = await loadStoredTheme();
    applyTheme(state.themeMode);
    state.colorPalette = await loadStoredPalette();
    applyPalette(state.colorPalette);
    stopWatchingTheme = watchSystemTheme(() => {
      if (state.themeMode === THEME_MODES.SYSTEM) applyTheme(state.themeMode);
    });
    await loadPreferences();

    // Apply context-menu deep-link params BEFORE the first data refresh.
    // The dashboard's preference loader has already set defaults; we
    // override mode / cleanupFilter so the right scope is in effect by
    // the time the list renders. Done synchronously so refreshData picks
    // up the changed state.
    applyContextMenuParams();

    // FIX: show skeleton immediately so the dashboard isn't blank during async load
    renderDashboardSkeleton();

    // Restore previously persisted health-check results so a closed-and-
    // reopened dashboard doesn't lose minutes of scan work. Expired entries
    // (past HEALTH_CACHE_TTL_MS) are dropped automatically.
    try {
      state.healthByKey = await loadHealthCache();
    } catch (error) {
      await logger.warn('health_cache_load_failed', { message: error?.message || String(error) });
      state.healthByKey = {};
    }

    // Load the tag overlay. Tags are stored in chrome.storage.local as a
    // bookmarkId → tags[] map. We load before refreshData so the very
    // first render sees the right pills on each row; pruneOrphanedTags
    // runs after refresh when we know which bookmark ids still exist.
    try {
      state.tagsByBookmark = await loadTagsMap();
    const importJournal = await loadImportJournal();
    const unfinishedImports = Object.values(importJournal).filter(operation => operation.status !== 'completed');
    if (unfinishedImports.length) {
      setToast(t('Import recovery'), { error: true, persist: true, actionLabel: t('JSON'), action: () => downloadTextFile('bookmark-scope-import-recovery.json', JSON.stringify(unfinishedImports, null, 2), 'application/json') });
    }
    } catch (error) {
      await logger.warn('tags_load_failed', { message: error?.message || String(error) });
      state.tagsByBookmark = {};
    }

    await refreshData();

    // Sync edge cases (extension disabled during a bulk delete, profile
    // imports, etc.) can leave tag entries pointing at bookmarks that
    // no longer exist. Background's onRemoved hook catches the live
    // path; this is the cold-start backstop.
    try {
      const pruned = pruneOrphanedTags(state.tagsByBookmark, state.allBookmarks);
      if (pruned.removed > 0) {
        state.tagsByBookmark = pruned.map;
        state.tagsByBookmark = await updateTagsMap(map => map);
        await logger.info('tags_pruned_orphans', { removed: pruned.removed });
      }
    } catch (error) {
      await logger.warn('tags_prune_failed', { message: error?.message || String(error) });
    }

    attachKeyboardShortcuts();
    attachGlobalDismissHandlers();
    window.addEventListener('resize', handleResponsiveResize, { passive: true, signal: _dashboardLifecycle.signal });
    window.addEventListener('pagehide', () => {
      _dashboardLifecycle.abort();
      if (typeof stopWatchingTheme === 'function') stopWatchingTheme();
      // Best-effort: flush any pending health writes before the tab closes.
      // Fire-and-forget; we cannot block pagehide.
      awaitPendingHealthWrites().catch(() => {});
    }, { once: true });
    render();
  } catch (error) {
    await logger.error('init_failed', { message: error?.message || String(error) });
    console.error(error);
    renderFatal(t('The popup face-planted during startup.'), error);
  }
}

/**
 * Applies context-menu deep-link parameters from the dashboard URL.
 *
 * - action=show-domain → switch mode to DOMAIN; pre-populate target from
 *   the right-clicked URL so the domain scope resolves immediately.
 * - action=find-duplicates → switch mode to PAGE, cleanup filter to
 *   DUPLICATES, and pre-populate target with the URL.
 *
 * Silent no-op when no params are present.
 */
function applyContextMenuParams() {
  const params = parseDashboardContextParams(window.location.search);
  if (!params || !params.url) return;
  const target = getMatchTarget(params.url, getParseOptions());
  if (!target.valid) return;
  state.target = target;
  // Synthesise a tab-like object so the rest of the dashboard (which
  // expects state.tab.url for several UI bits) doesn't see undefined.
  state.tab = { url: params.url, title: target.label || params.url };
  contextOverrideTab = state.tab;
  if (params.action === CONTEXT_MENU_ACTIONS.SHOW_DOMAIN) {
    state.mode = MATCH_MODES.DOMAIN;
  } else if (params.action === CONTEXT_MENU_ACTIONS.FIND_DUPLICATES) {
    state.mode = MATCH_MODES.PAGE;
    state.cleanupFilter = CLEANUP_FILTERS.DUPLICATES;
    state.duplicatesOnly = true;
  }
}

function renderDashboardSkeleton() {
  app.textContent = '';
  const panel = create('div', 'panel');
  const placeholder = create('div', 'skeleton-loading dashboard-skeleton');
  placeholder.setAttribute('aria-label', t('Loading library…'));
  placeholder.setAttribute('aria-busy', 'true');
  panel.append(placeholder);
  app.append(panel);
}

function isEditableTarget(element) {
  if (!element) return false;
  const tag = element.tagName;
  return element.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function getExportItems(scope = 'selected') {
  const items = scope === 'visible' ? state.visibleBookmarks : getSelectedBookmarks();
  return items.map((item) => ({
    title: item.title,
    url: item.url,
    path: item.path,
    dateAdded: item.dateAdded,
    tags: [...(state.tagsByBookmark?.[item.id] || [])]
  }));
}

async function handleExport(format, scope = 'selected') {
  const items = getExportItems(scope);
  if (!items.length) {
    setToast(t('Nothing to export from {{scope}}. Empty pockets, empty file.', { scope }), { error: true });
    return;
  }
  const stamp = isoNow().replace(/[:.]/g, '-');
  if (format === 'json') {
    downloadTextFile(`bookmark-manager-${scope}-${stamp}.json`, JSON.stringify(items, null, 2), 'application/json');
  } else {
    downloadTextFile(`bookmark-manager-${scope}-${stamp}.csv`, createCsvFile(items), 'text/csv;charset=utf-8');
  }
  setToast(t('Exported {{count}} bookmarks as {{format}}.', { count: formatNumber(items.length), format: format.toUpperCase() }));
}

const IMPORT_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Opens a file picker for the user to choose a bookmark export to import.
 * A single hidden <input type="file"> is created lazily on first use and
 * reused thereafter — the alternative of creating a fresh input per
 * call leaves dangling DOM nodes if the user cancels the dialog.
 *
 * Accept attribute lists the formats we recognise (Pocket HTML, Pinboard
 * JSON, Raindrop CSV, plus our own .json/.csv/.txt exports). The picker
 * itself doesn't enforce this — it's a suggestion — and the parser auto-
 * detects so a renamed file still works.
 */
function triggerImportPicker() {
  if (!importInputRef) {
    importInputRef = document.createElement('input');
    importInputRef.type = 'file';
    importInputRef.accept = '.html,.json,.csv,.txt';
    importInputRef.style.display = 'none';
    importInputRef.addEventListener('change', async () => {
      const file = importInputRef.files?.[0];
      // Reset value so picking the same file again later re-fires change.
      importInputRef.value = '';
      if (file) await handleImportFile(file);
    });
    document.body.append(importInputRef);
  }
  importInputRef.click();
}

async function handleImportFile(file) {
  if (!file) return;
  try {
    if (file.size > IMPORT_MAX_FILE_SIZE) {
      setToast(t('Import file is too large (max 10 MB). Split it into smaller files.'), { error: true });
      return;
    }
    const text = await file.text();

    // Try third-party formats first (Pocket HTML, Pinboard JSON, Raindrop
    // CSV). Each parser returns the same { bookmarks, errors } shape, so
    // the rest of the flow doesn't care which one matched. When detection
    // returns null we fall back to the built-in parseImportedText, which
    // covers our own JSON/CSV exports and the plain-URLs-per-line case.
    const thirdParty = parseImportedThirdPartyFile(file.name, text);
    let rawItems;
    let detectedFormat = '';
    let parserWarnings = [];
    let parserExcluded = 0;
    if (thirdParty) {
      rawItems = thirdParty.bookmarks;
      detectedFormat = thirdParty.format;
      // Surface non-fatal warnings (skipped unsafe URLs etc.) but keep
      // going — those are info, not failures.
      for (const warn of thirdParty.errors || []) {
        await logger.warn('import_warning', { format: detectedFormat, message: warn.message });
      }
    } else {
      const parsed = parseImportedFilePreview(text, file.name);
      rawItems = parsed.items; parserWarnings = parsed.warnings; parserExcluded = parsed.excluded;
    }

    await featureTools.showImportPreview(rawItems, thirdParty?.errors || parserWarnings, parserExcluded);

  } catch (error) {
    console.error(error);
    await logger.error('import_failed', { message: error?.message || String(error) });
    setToast(t('Import failed. The file fought back and won.'), { error: true });
  }
}

function attachKeyboardShortcuts() {
  document.addEventListener('keydown', async (event) => {
    if (event.defaultPrevented) return;
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p' && !event.altKey) {
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault(); featureTools.showPalette(); return;
    }
    if (featureTools.isDialogOpen() || document.querySelector('[role="dialog"]')) return;

    if (event.key === 'Escape' && state.headerMenuOpen) {
      state.headerMenuOpen = false;
      render();
      return;
    }

    if (event.key === 'Escape' && state.listHeadMenuOpen) {
      state.listHeadMenuOpen = false;
      render();
      return;
    }

    // Preserve the focused control's own activation and navigation behavior.
    if (!isEditableTarget(event.target) && event.target?.closest?.('button, a[href], summary, label, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="menuitem"], [role="tab"], [role="switch"], [role="slider"], [role="combobox"]')) return;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a' && !isEditableTarget(event.target)) {
      event.preventDefault();
      selectAllVisible({ renderAfter: true });
      return;
    }

    if (event.key === KEYBOARD_SHORTCUTS.SEARCH && !isEditableTarget(event.target)) {
      event.preventDefault();
      state.focusSearchAfterRender = true;
      render();
      return;
    }

    if (isEditableTarget(event.target)) {
      if (event.key === 'Escape' && state.editingBookmarkId) {
        state.editingBookmarkId = null;
        render();
      }
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    if (event.key === KEYBOARD_SHORTCUTS.MODE_PAGE) {
      state.mode = MATCH_MODES.PAGE;
      await savePreferences();
      recalculateVisibleBookmarks();
      render();
      return;
    }
    if (event.key === KEYBOARD_SHORTCUTS.MODE_HOST) {
      state.mode = MATCH_MODES.HOST;
      await savePreferences();
      recalculateVisibleBookmarks();
      render();
      return;
    }
    if (event.key === KEYBOARD_SHORTCUTS.MODE_DOMAIN) {
      state.mode = MATCH_MODES.DOMAIN;
      await savePreferences();
      recalculateVisibleBookmarks();
      render();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      state.scrollActiveBookmark = true;
      moveActiveBookmark(1);
      render();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      state.scrollActiveBookmark = true;
      moveActiveBookmark(-1);
      render();
      return;
    }

    if (event.key === 'Enter') {
      const active = getActiveBookmark();
      if (active) {
        event.preventDefault();
        await handleOpen(active.url);
      }
      return;
    }

    if (event.key.toLowerCase() === 'e') {
      const active = getActiveBookmark();
      if (active) {
        event.preventDefault();
        state.editingBookmarkId = active.id;
        render();
      }
      return;
    }

    if (event.key.toLowerCase() === ' ') {
      const active = getActiveBookmark();
      if (active) {
        event.preventDefault();
        toggleBookmarkSelection(active.id, { renderAfter: true });
      }
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selected = getSelectedBookmarks();
      if (selected.length) {
        event.preventDefault();
        await handleDeleteMany(selected);
      }
      return;
    }

    if (event.key === 'Escape') {
      if (state.editingBookmarkId) {
        state.editingBookmarkId = null;
      } else if (state.query) {
        state.query = '';
        recalculateVisibleBookmarks();
      } else if (state.cleanupFilter !== CLEANUP_FILTERS.ALL || state.duplicatesOnly) {
        clearCleanupFilters();
        savePreferences();
        recalculateVisibleBookmarks();
      } else if (state.selectedIds.size) {
        state.selectedIds.clear();
      } else {
        clearToast();
      }
      render();
    }
  });
}

const commands = createCommandRegistry({
  snapshotExport: { label:'Export snapshot', run:()=>featureTools.exportSnapshot() },
  snapshotRestore: { label:'Restore snapshot', run:()=>featureTools.pickSnapshot() },
  duplicatePreview: { label:'Duplicate preview', run:()=>featureTools.showDuplicatePreview() },
  savedViews: { label:'Saved views', run:()=>featureTools.showSavedViews() },
  bulkTags: { label:'Bulk tags', run:()=>featureTools.showBulkTags() },
  resumableScan: { label:'Resumable scan', run:()=>featureTools.showScan() },
  importPreview: { label:'Import bookmarks…', run:()=>triggerImportPicker() },
  exportCsv: { label:'Export visible as CSV', run:()=>handleExport('csv','visible') },
  diagnosticExport: { label:'Diagnostic export', run:()=>featureTools.showDiagnostics() },
  inspectVisible: { label:'Inspect visible', run:()=>inspectBookmarksHealth(getInspectTargetBookmarks()) },
  deleteSelected: { label:'Delete selected', run:()=>handleDeleteMany(getSelectedBookmarks()) },
  repairRedirects: { label:'Repair redirected', run:()=>handleRepairRedirects() },
  clearHealth: { label:'Clear cached health data', run:()=>handleClearHealthData() },
  async updateMode(mode) {
    state.mode = mode;
    await savePreferences();
    recalculateVisibleBookmarks();
    await logger.info('mode_updated', { mode: state.mode });
    render();
  },
  async toggleSidebarCollapsed() {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    await savePreferences();
    await logger.info('sidebar_toggled', { collapsed: state.sidebarCollapsed });
    render();
  },
  async updatePreference(name, value, needsReload = false) {
    state[name] = value;
    await savePreferences();
    if (name === 'popupWidth') applyPopupWidth();
    if (needsReload) {
      invalidateBookmarkCache();
      await refreshData();
    } else {
      recalculateVisibleBookmarks();
    }
    await logger.debug('preference_updated', { name, needsReload });
    render();
  }
});

const featureTools = createFeatureTools({state,create,trapFocus,t,setToast,downloadTextFile,refreshData,render,savePreferences,recalculateVisibleBookmarks,getSelectedBookmarks,handleDeleteMany,ensureHealthPermission,inspectUrlHealth,sendMessage,commands:()=>commands,logger});

function createMetricCard(label, value, helperText = '') {

  const card = create('div', 'metric-card');
  const valueEl = create('div', 'metric-value', value);
  const labelEl = create('div', 'metric-label', label);
  card.append(valueEl, labelEl);
  if (helperText) {
    card.append(create('div', 'helper-text metric-helper', helperText));
  }
  return card;
}

function createCompactStat(label, value, helperText = '') {
  const stat = create('div', 'compact-stat');
  stat.append(create('div', 'compact-stat-value', value), create('div', 'compact-stat-label', label));
  if (helperText) {
    stat.append(create('div', 'compact-stat-helper', helperText));
  }
  return stat;
}


function createSummaryRow(label, value, tone = '') {
  const row = create('div', `compact-summary-row${tone ? ` ${tone}` : ''}`.trim());
  row.append(create('div', 'compact-summary-label', label), create('div', 'compact-summary-value', value));
  return row;
}

function getBookmarkById(bookmarkId) {
  return state.visibleBookmarks.find((bookmark) => bookmark.id === bookmarkId) || null;
}

// Updates every running inspect button's progress bar and counter without
// rebuilding the DOM, so a Stop press is never lost to a re-render.
function updateInspectProgress() {
  const total = Math.max(0, Number(state.healthScanTotal || 0));
  const done = Math.max(0, Number(state.healthScanProgress || 0));
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const counter = t('{{done}} / {{total}}', { done: formatNumber(done), total: formatNumber(total) });
  document.querySelectorAll('.dashboard-inspect-button[data-inspecting="true"]').forEach((button) => {
    const bar = button.querySelector('.dashboard-inspect-button-progress-bg');
    if (bar) bar.style.width = percent + '%';
    const label = button.querySelector('.dashboard-inspect-progress');
    if (label) label.textContent = counter;
  });
}

function buildInspectButton(label, count = 0, className = 'ghost-button') {
  const classes = [className, 'dashboard-inspect-button'].filter(Boolean).join(' ');
  const button = create('button', classes);
  button.type = 'button';
  // Stop on pointer press (not release): the list can still be refreshed between
  // press and release, which would otherwise swallow the click.
  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || !state.isInspectingHealth) return;
    event.preventDefault();
    state.inspectStopPressedAt = Date.now();
    cancelHealthInspection();
  });

  const inspecting = !!state.isInspectingHealth;
  const stopping = !!state.inspectStopPending;
  const effectiveCount = Number.isFinite(count) ? count : 0;
  const total = Math.max(0, Number(state.healthScanTotal || 0));
  const done = Math.max(0, Number(state.healthScanProgress || 0));
  const progressPercent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  button.disabled = (!inspecting && effectiveCount <= 0) || stopping;
  button.setAttribute('aria-busy', inspecting ? 'true' : 'false');
  button.dataset.inspecting = inspecting ? 'true' : 'false';
  if (stopping) button.dataset.stopPending = 'true';

  if (inspecting) {
    const progressBg = create('span', 'dashboard-inspect-button-progress-bg');
    progressBg.setAttribute('aria-hidden', 'true');
    progressBg.style.width = `${progressPercent}%`;
    button.append(progressBg);
  }

  const content = create('span', 'dashboard-inspect-button-content');
  const text = create('span', 'dashboard-inspect-button-text', stopping ? t('Stopping…') : (inspecting ? t('Stop inspect') : label));
  content.append(text);

  if (inspecting && total > 0) {
    const progress = create('span', 'dashboard-inspect-progress', t('{{done}} / {{total}}', {
      done: formatNumber(done),
      total: formatNumber(total)
    }));
    content.append(progress);
  }

  button.append(content);
  return button;
}

function rememberListScroll() {
  const listScroll = app?.querySelector?.('.list-scroll');
  if (listScroll) state.listScrollTop = listScroll.scrollTop;
}

/**
 * Adds or removes a tag from the active tag filter. The dashboard
 * recalculates the visible list and re-renders. Tags in the filter
 * use AND semantics — adding more narrows the result set.
 */
function toggleTagFilter(tag) {
  const current = Array.isArray(state.activeTagFilter) ? state.activeTagFilter : [];
  const idx = current.indexOf(tag);
  state.activeTagFilter = idx >= 0
    ? current.filter((t) => t !== tag)
    : [...current, tag];
  recalculateVisibleBookmarks();
  render();
}

/**
 * Clears the active tag filter entirely. Bound to a "clear" affordance
 * in the filter chip strip.
 */
function clearTagFilter() {
  if (!state.activeTagFilter?.length) return;
  state.activeTagFilter = [];
  recalculateVisibleBookmarks();
  render();
}

/**
 * Builds the tag filter strip that sits above the list. Returns null when
 * there are no tags anywhere in the library — no point in showing the
 * bar when the user hasn't started tagging yet.
 *
 * Layout: a "Tags:" label, up to 12 top-used tag chips (most-used first,
 * via summariseTags), and a clear-all button when any filter is active.
 * Clicking a chip toggles it in the active filter.
 */
function renderTagFilterStrip() {
  const summary = summariseTags(state.tagsByBookmark);
  if (!summary.length) return null;

  const strip = create('div', 'tag-filter-strip');
  strip.append(create('span', 'tag-filter-label', t('Tags:')));

  const active = new Set(state.activeTagFilter || []);

  // Always include any active filter tags first so the user can see and
  // un-toggle them even if they're not in the top 12. Then fill the rest
  // with the most-used tags not already shown.
  const visibleTags = [];
  const seen = new Set();
  for (const tag of active) {
    visibleTags.push({ tag, count: summary.find((s) => s.tag === tag)?.count ?? 0 });
    seen.add(tag);
  }
  for (const entry of summary) {
    if (seen.has(entry.tag)) continue;
    visibleTags.push(entry);
    seen.add(entry.tag);
    if (visibleTags.length >= 12) break;
  }

  for (const { tag, count } of visibleTags) {
    const isActive = active.has(tag);
    const chip = create('button', `tag-filter-chip${isActive ? ' is-active' : ''}`);
    chip.type = 'button';
    chip.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    chip.append(create('span', 'tag-filter-chip-label', tag));
    chip.append(create('span', 'tag-filter-chip-count', String(count)));
    chip.addEventListener('click', () => toggleTagFilter(tag));
    strip.append(chip);
  }

  if (active.size) {
    const clear = create('button', 'tag-filter-clear');
    clear.type = 'button';
    clear.textContent = t('Clear');
    clear.title = t('Clear tag filter');
    clear.addEventListener('click', clearTagFilter);
    strip.append(clear);
  }

  return strip;
}

// ─── Drag-and-drop ─────────────────────────────────────────────────────────
// Lightweight session state. Holds the set of bookmark IDs being dragged
// (could be a single item or, when the user drags a row that's already
// part of a multi-selection, the entire selection). Cleared on drop or
// dragend so subsequent unrelated drags can't accidentally see stale data.
const _dragSession = {
  sourceIds: [],
  // Stored at dragstart so the drop handler doesn't need to re-resolve
  // bookmark objects (they might have moved out of the visible window
  // due to scroll, and visibleBookmarks is the only thing scoped to
  // the current view).
  sourceBookmarks: []
};

function resetDragSession() {
  _dragSession.sourceIds = [];
  _dragSession.sourceBookmarks = [];
}

function findBookmarksByIds(ids) {
  const idSet = new Set(ids);
  // Drag sources can be anywhere in the library, not just the current
  // visible window. Look in allBookmarks so multi-selection that spans
  // pages doesn't lose items.
  return (state.allBookmarks || []).filter((b) => idSet.has(b.id));
}

function attachDragHandlers(itemEl, bookmark) {
  itemEl.addEventListener('dragstart', (event) => {
    // If the dragged row is part of a multi-selection, move all selected
    // bookmarks. Otherwise move just this one.
    const selected = getSelectedBookmarks();
    const isPartOfSelection = selected.some((b) => b.id === bookmark.id);
    const sources = isPartOfSelection && selected.length > 1 ? selected : [bookmark];
    _dragSession.sourceIds = sources.map((b) => b.id);
    _dragSession.sourceBookmarks = sources;
    // We don't actually use the payload — handlers read _dragSession —
    // but the API requires *some* data for the drag to "take" in Chrome.
    try { event.dataTransfer?.setData('text/plain', sources[0].url || ''); } catch {}
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    itemEl.classList.add('dragging');
  });

  itemEl.addEventListener('dragend', () => {
    itemEl.classList.remove('dragging');
    clearAllDropIndicators();
    resetDragSession();
  });

  itemEl.addEventListener('dragover', (event) => {
    if (!_dragSession.sourceIds.length) return;
    if (_dragSession.sourceIds.includes(bookmark.id)) return; // can't drop on self
    event.preventDefault(); // required to allow drop
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    const rect = itemEl.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropIndicator(itemEl, position);
  });

  itemEl.addEventListener('dragleave', (event) => {
    // dragleave fires when entering a child element too — only clear the
    // indicator when the pointer actually leaves the row bounds.
    if (!itemEl.contains(event.relatedTarget)) {
      clearDropIndicator(itemEl);
    }
  });

  itemEl.addEventListener('drop', async (event) => {
    event.preventDefault();
    if (!_dragSession.sourceIds.length) return;
    if (_dragSession.sourceIds.includes(bookmark.id)) return;
    const rect = itemEl.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    const sourceBookmarks = _dragSession.sourceBookmarks.slice();
    clearAllDropIndicators();
    resetDragSession();
    await handleDragDropMove(sourceBookmarks, bookmark, position);
  });
}

function setDropIndicator(itemEl, position) {
  // Reuse the same indicator across rows — visually it's just one bar at
  // a time, so clear any previous mark first.
  clearAllDropIndicators();
  itemEl.classList.add(position === 'before' ? 'drop-target-before' : 'drop-target-after');
}

function clearDropIndicator(itemEl) {
  itemEl.classList.remove('drop-target-before', 'drop-target-after');
}

function clearAllDropIndicators() {
  app?.querySelectorAll?.('.drop-target-before, .drop-target-after')
    .forEach((el) => { el.classList.remove('drop-target-before', 'drop-target-after'); });
}

function renderItem(bookmark) {
  const item = create('div', `item${state.activeBookmarkId === bookmark.id ? ' active-item' : ''}${state.compactMode ? ' item-compact' : ''}`);
  const top = create('div', 'item-top');
  item.dataset.bookmarkId = bookmark.id;
  item.tabIndex = -1;
  item.draggable = true;
  attachDragHandlers(item, bookmark);
  item.addEventListener('mousedown', (event) => {
    if (event.target.closest('button, input, select, a, label')) return;
    if (state.activeBookmarkId === bookmark.id) return;
    rememberListScroll();
    setActiveBookmark(bookmark.id);
    render();
  });

  const leading = create('div', 'item-leading');
  const selector = create('input', 'item-checkbox');
  selector.type = 'checkbox';
  selector.setAttribute('aria-label', `${featureText('Select bookmark')}: ${bookmark.title || bookmark.url}${bookmark.title ? ` — ${bookmark.url}` : ''}`);
  selector.checked = isBookmarkSelected(bookmark.id);
  selector.addEventListener('change', (event) => {
    setBookmarkSelection(bookmark.id, event.target.checked, { renderAfter: true });
  });
  leading.append(selector);

  const body = create('div', 'item-body');

  if (state.editingBookmarkId === bookmark.id) {
    const titleInput = create('input', 'edit-input');
    titleInput.value = bookmark.title;
    titleInput.placeholder = 'Bookmark title';

    const urlInput = create('input', 'edit-input');
    urlInput.value = bookmark.url;
    urlInput.placeholder = 'Bookmark URL';
    urlInput.style.marginTop = '8px';

    const actions = create('div', 'item-actions');
    const save = createIconButton('save', t('Save changes'), 'icon-button success');
    save.addEventListener('click', () => handleSaveEdit(bookmark.id, titleInput.value, urlInput.value));

    const cancel = createIconButton('close', t('Cancel editing'), 'icon-button');
    cancel.addEventListener('click', () => {
      state.editingBookmarkId = null;
      render();
    });

    [titleInput, urlInput].forEach((input) => {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          handleSaveEdit(bookmark.id, titleInput.value, urlInput.value);
        }
      });
    });

    body.append(titleInput, urlInput);
    top.append(leading, body, actions);
    actions.append(save, cancel);
    item.append(top);
    return item;
  }

  const headline = create('div', 'item-headline');
  const favicon = createFaviconNode(bookmark, create);
  const title = create('h2', 'item-title');
  title.dir = 'auto';
  title.title = bookmark.title || '';
  title.append(createHighlightedFragment(bookmark.title, state.query));
  headline.append(favicon, title);
  const metaRow = create('div', 'item-meta-row');
  const hostChip = create('div', 'item-host-pill', getBookmarkHostLabel(bookmark.url));
  hostChip.title = getBookmarkHostLabel(bookmark.url);
  metaRow.append(hostChip);
  if (bookmark.path && bookmark.path !== 'Bookmarks bar' && bookmark.path !== 'Root') {
    const pathInline = create('div', 'item-path-inline');
    pathInline.dir = 'auto';
    pathInline.title = bookmark.path;
    pathInline.append(createHighlightedFragment(bookmark.path, state.query));
    metaRow.append(pathInline);
  }
  const meta = create('div', 'item-url');
  meta.dir = 'auto';
  meta.title = bookmark.url;
  meta.append(createHighlightedFragment(bookmark.url, state.query));

  // Folder path and URL share one line; badges and tags share another.
  const subline = create('div', 'item-sub');
  subline.append(metaRow, meta);
  const chips = create('div', 'item-chips');
  body.append(headline, subline);
  const badges = [];
  if (bookmark.isDuplicate) badges.push(t('Duplicate URL'));
  if (bookmark.isUntitled) badges.push(t('Untitled'));
  if (bookmark.isOld) badges.push(t('Old · {{age}}', { age: formatAgeCompact(bookmark.ageDays) }));
  if (bookmark.hasTitleCollision) badges.push(t('Title collision'));
  const healthRecord = getHealthRecord(bookmark);
  if (badges.length || healthRecord) {
    const badgeRow = create('div', 'badge-row');
    badges.forEach((label) => badgeRow.append(create('div', bookmarkStatusBadgeClass(label), label)));
    if (healthRecord) {
      const badge = create('div', healthBadgeClass(healthRecord), healthLabel(healthRecord, t));
      if (healthRecord.finalUrl && healthRecord.finalUrl !== bookmark.url) badge.title = `${t('Redirects to')}: ${healthRecord.finalUrl}`;
      if (healthRecord.error) badge.title = healthRecord.error;
      badgeRow.append(badge);
    }
    chips.append(badgeRow);
  }

  // Tag row: pills for each tag + a small "+ tag" input. Rendered only
  // when there are tags OR the active bookmark is this row (to keep the
  // list visually quiet for the long tail of untagged bookmarks).
  const bookmarkTags = state.tagsByBookmark?.[bookmark.id] || [];
  const isActiveRow = state.activeBookmarkId === bookmark.id;
  if (bookmarkTags.length || isActiveRow) {
    const tagRow = create('div', 'tag-row');
    for (const tag of bookmarkTags) {
      const pill = create('span', 'tag-pill');
      pill.append(create('span', 'tag-pill-label', tag));
      const removeBtn = create('button', 'tag-pill-remove');
      removeBtn.type = 'button';
      removeBtn.title = t('Remove tag');
      removeBtn.setAttribute('aria-label', t('Remove tag {{tag}}', { tag }));
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        handleRemoveTag(bookmark.id, tag);
      });
      pill.append(removeBtn);
      // Clicking the label adds this tag to the active filter so users
      // can pivot to "show me everything also tagged X" with one click.
      pill.addEventListener('click', (event) => {
        // Don't fire when the click was on the × — that already had its
        // own handler with stopPropagation.
        if (event.target.closest('.tag-pill-remove')) return;
        toggleTagFilter(tag);
      });
      tagRow.append(pill);
    }
    // Inline add-tag input shows only on the active row to avoid 1000s
    // of inputs in a large library. Pressing Enter or comma commits.
    if (isActiveRow) {
      const input = create('input', 'tag-add-input');
      input.type = 'text';
      input.placeholder = t('+ add tag');
      input.maxLength = 48; // gentle: actual cap is enforced in normaliseTag
      input.addEventListener('click', (event) => event.stopPropagation());
      input.addEventListener('mousedown', (event) => event.stopPropagation());
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ',') {
          event.preventDefault();
          const value = input.value.trim();
          if (!value) return;
          handleAddTag(bookmark.id, value);
          input.value = '';
        } else if (event.key === 'Escape') {
          input.value = '';
          input.blur();
        }
      });
      tagRow.append(input);
    }
    chips.append(tagRow);
  }
  if (chips.childNodes.length) body.append(chips);

  const actions = create('div', 'item-actions');
  const open = createIconButton('open', t('Open bookmark'), 'icon-button primary-row-action row-icon-button');
  open.addEventListener('click', () => handleOpen(bookmark.url));

  const folder = createIconButton('folderOpen', t('Show in bookmarks'), 'icon-button folder-row-action row-icon-button');
  folder.addEventListener('click', async () => {
    await sendMessage(runtimeMessages.openBookmarkFolder(bookmark.parentId));
  });

  const redirectRecord = getHealthRecord(bookmark);
  const canRepair = !!(redirectRecord && redirectRecord.status === HEALTH_STATUSES.REDIRECTED && redirectRecord.finalUrl && redirectRecord.finalUrl !== bookmark.url);
  const moreWrap = create('div', 'item-more-wrap');
  const more = createIconButton('more', t('More actions'), `icon-button item-more-button more-row-action row-icon-button${state.rowMenuBookmarkId === bookmark.id ? ' active' : ''}`);
  more.dataset.bookmarkId = bookmark.id;
  more.addEventListener('click', (event) => {
    event.stopPropagation();
    rememberListScroll();
    if (state.rowMenuBookmarkId === bookmark.id) {
      state.rowMenuBookmarkId = null;
      state.rowMenuPosition = null;
      renderOverlaysOnly();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    state.rowMenuBookmarkId = bookmark.id;
    state.rowMenuPosition = getFixedMenuPosition(rect, 6);
    renderOverlaysOnly();
  });
  moreWrap.append(more);

  actions.append(open, folder, moreWrap);
  top.append(leading, body, actions);
  item.append(top);
  return item;
}

function buildSidebarPanel(titleText, helperText) {
  const panel = create('div', 'sidebar-panel');
  if (titleText) panel.append(create('div', 'review-card-title', titleText));
  if (helperText) panel.append(create('div', 'helper-text', helperText));
  return panel;
}

function createDetailsField(label, value, title = '') {
  const field = create('div', 'detail-field');
  field.append(create('div', 'detail-label', label));
  const valueEl = create('div', 'detail-value', value || t('—'));
  if (title) valueEl.title = title;
  field.append(valueEl);
  return field;
}

function renderDetailsDrawer(root) {
  const drawer = create('aside', 'dashboard-drawer');
  const active = getActiveBookmark();
  if (!active) {
    const empty = create('div', 'drawer-empty');
    empty.append(
      create('div', 'review-card-title', t('No bookmark selected')),
      create('div', 'helper-text', t('Select a bookmark to see the full URL, status, and actions.'))
    );
    drawer.append(empty);
    root.append(drawer);
    return;
  }

  const head = create('div', 'drawer-head');
  const titleRow = create('div', 'drawer-title-row');
  titleRow.append(createFaviconNode(active, create));
  const titleWrap = create('div', 'drawer-title-wrap');
  titleWrap.append(create('div', 'review-card-title drawer-title', active.title || t('(Untitled bookmark)')));
  titleWrap.append(create('div', 'helper-text', active.path || t('Root')));
  titleRow.append(titleWrap);
  head.append(titleRow);

  const actions = create('div', 'footer-actions wrap drawer-actions');
  const open = create('button', 'ghost-button drawer-primary-action', t('Open'));
  open.type = 'button';
  open.addEventListener('click', () => handleOpen(active.url));
  const edit = create('button', 'ghost-button drawer-tertiary-action', t('Edit'));
  edit.type = 'button';
  edit.addEventListener('click', () => { state.editingBookmarkId = active.id; render(); });
  const folder = create('button', 'ghost-button drawer-secondary-action', t('Show folder'));
  folder.type = 'button';
  folder.addEventListener('click', () => sendMessage(runtimeMessages.openBookmarkFolder(active.parentId)));
  const remove = create('button', 'ghost-button danger-button', t('Delete'));
  remove.type = 'button';
  remove.addEventListener('click', () => handleDeleteMany([active]));
  actions.append(open, edit, folder, remove);
  head.append(actions);

  const badgeRow = create('div', 'badge-row drawer-badges');
  if (active.isDuplicate) badgeRow.append(create('div', 'badge status-duplicate', t('Duplicate URL')));
  if (active.isOld) {
    const oldBadge = create('div', 'badge status-old', t('Old · {{age}}', { age: formatAgeCompact(active.ageDays) }));
    oldBadge.title = t('{{count}} days old', { count: formatNumber(active.ageDays) });
    badgeRow.append(oldBadge);
  }
  if (active.isUntitled) badgeRow.append(create('div', 'badge status-untitled', t('Untitled')));
  if (active.hasTitleCollision) badgeRow.append(create('div', 'badge status-collision', t('Title collision')));
  const healthRecord = getHealthRecord(active);
  if (healthRecord) {
    const healthBadge = create('div', healthBadgeClass(healthRecord), healthLabel(healthRecord, t));
    badgeRow.append(healthBadge);
  }
  if (badgeRow.childNodes.length) head.append(badgeRow);
  drawer.append(head);

  const body = create('div', 'drawer-body');
  const urlField = create('div', 'detail-field drawer-url-field');
  urlField.append(create('div', 'detail-label', t('URL')));
  const urlRow = create('div', 'drawer-url-row');
  const urlLink = create('a', 'detail-value drawer-url-link', active.url);
  urlLink.href = active.url;
  urlLink.title = active.url;
  urlLink.addEventListener('click', (event) => {
    event.preventDefault();
    handleOpen(active.url);
  });
  const copyUrlBtn = create('button', 'ghost-button drawer-copy-url-btn', t('Copy'));
  copyUrlBtn.type = 'button';
  copyUrlBtn.title = t('Copy URL to clipboard');
  copyUrlBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(active.url);
      copyUrlBtn.textContent = t('Copied!');
      setTimeout(() => { copyUrlBtn.textContent = t('Copy'); }, 1800);
    } catch {
      setToast(t('Clipboard failed.'), { error: true });
    }
  });
  urlRow.append(urlLink, copyUrlBtn);
  urlField.append(urlRow);

  body.append(
    urlField,
    createDetailsField(t('Folder'), active.path || t('Root'), active.path || t('Root')),
    createDetailsField(t('Added'), active.dateAdded ? formatDateTime(active.dateAdded) : t('Unknown')),
    createDetailsField(t('Age'), Number.isFinite(active.ageDays) ? formatAgeHuman(active.ageDays) : t('Unknown'))
  );
  if (healthRecord?.finalUrl && healthRecord.finalUrl !== active.url) {
    body.append(createDetailsField(t('Redirects to'), healthRecord.finalUrl, healthRecord.finalUrl));
  }
  if (healthRecord?.error) {
    body.append(createDetailsField(t('Health note'), healthRecord.error, healthRecord.error));
  }
  drawer.append(body);
  root.append(drawer);
}

function appendSidebarPanelContent(scroll) {
  const scopedBookmarks = getScopedBookmarks();
  const scopeCleanup = getScopeSummary();
  const health = state.healthSummary || summarizeHealth(state.visibleBookmarks, state.healthByKey);
  const scopeHealth = getScopeHealthSummary();
  const reminder = buildReminderState();
  const score = computeHealthScore();

  if (state.sidebarTab === 'overview') {
    const panel = buildSidebarPanel(t('Overview'), t('Library snapshot · {{count}} bookmarks in scope.', { count: formatNumber(scopedBookmarks.length) }));
    const stats = create('div', 'compact-summary-list overview-summary-list');
    const priorityCount = scopeHealth.broken + scopeHealth.serverError + scopeHealth.unreachable + scopeHealth.redirected;
    [
      createSummaryRow(t('Library'), formatNumber(scopedBookmarks.length)),
      createSummaryRow(t('Health'), score.isMetadataOnly ? t('{{score}} · metadata-only', { score: formatNumber(score.score) }) : t('{{score}} · grade {{grade}}', { score: formatNumber(score.score), grade: score.grade })),
      createSummaryRow(t('Checked'), formatNumber(scopeHealth.checked)),
      createSummaryRow(t('Priority'), formatNumber(priorityCount))
    ].forEach((row) => stats.append(row));
    panel.append(stats);
    const recommendations = getReviewQueue().filter((entry) => entry.id !== 'healthy').slice(0, 2);
    if (recommendations.length) {
      const queue = create('div', 'review-queue compact-review-queue overview-review-queue');
      recommendations.forEach((entry) => {
        const card = create('div', `review-card sidebar-review-card compact ${entry.tone || ''}`.trim());
        const titleWrap = create('div', 'review-card-compact-copy');
        titleWrap.append(create('div', 'review-card-title', entry.title));
        card.append(titleWrap);
        if (entry.actions?.[0]) {
          const action = create('button', 'ghost-button review-card-cta', entry.actions[0].label);
          action.type = 'button';
          action.addEventListener('click', entry.actions[0].run);
          card.append(action);
        }
        queue.append(card);
      });
      panel.append(queue);
    }
    scroll.append(panel);
  }

  if (state.sidebarTab === 'cleanup') {
    const cleanupPanel = buildSidebarPanel(t('Cleanup'), t('{{duplicates}} duplicate URLs · {{old}} old · {{untitled}} untitled.', { duplicates: formatNumber(scopeCleanup.duplicateCount), old: formatNumber(scopeCleanup.oldCount), untitled: formatNumber(scopeCleanup.untitledCount) }));
    const presets = create('div', 'footer-actions wrap');
    [
      [CLEANUP_FILTERS.DUPLICATES, t('Duplicates')],
      [CLEANUP_FILTERS.OLD, t('Old')],
      [CLEANUP_FILTERS.UNTITLED, t('Untitled')],
      [CLEANUP_FILTERS.TITLE_COLLISIONS, t('Collisions')]
    ].forEach(([filter, label]) => {
      const button = create('button', 'ghost-button', label);
      button.type = 'button';
      button.addEventListener('click', () => setCleanupFilter(filter));
      presets.append(button);
    });
    cleanupPanel.append(presets);
    scroll.append(cleanupPanel);
  }

  if (state.sidebarTab === 'health') {
    const totalUniqueVisible = new Set(state.visibleBookmarks.map((bookmark) => getHealthKey(bookmark))).size;
    const healthPanel = buildSidebarPanel(t('Health'), t('{{checked}}/{{total}} checked · {{redirected}} redirected · {{unhealthy}} unhealthy.', { checked: formatNumber(health.checked), total: formatNumber(totalUniqueVisible), redirected: formatNumber(health.redirected), unhealthy: formatNumber(health.broken + health.serverError + health.unreachable) }));
    const actions = create('div', 'footer-actions wrap');
    const inspectButton = buildInspectButton(getInspectButtonLabel(), getInspectTargetBookmarks().length || totalUniqueVisible, 'ghost-button');
    inspectButton.addEventListener('click', () => inspectBookmarksHealth(getInspectTargetBookmarks()));
    const markReviewed = create('button', 'ghost-button', t('Mark reviewed now'));
    markReviewed.type = 'button';
    markReviewed.addEventListener('click', handleMarkReviewedNow);
    actions.append(inspectButton, markReviewed);
    healthPanel.append(actions);
    const stats = create('div', 'compact-summary-list');
    [
      createSummaryRow(t('Healthy'), formatNumber(health.healthy)),
      createSummaryRow(t('Redirected'), formatNumber(health.redirected)),
      createSummaryRow(t('Unhealthy'), formatNumber(health.broken + health.serverError + health.unreachable), 'warning'),
      createSummaryRow(t('Next review'), reminder.enabled ? reminder.statusLabel : t('Manual'))
    ].forEach((row) => stats.append(row));
    healthPanel.append(stats);
    scroll.append(healthPanel);
  }

  if (state.sidebarTab === 'history') {
    const trends = getHistoryTrends();
    const hasActivity = trends.totalActions > 0 || state.reviewSessions.length > 0;
    const historyPanel = buildSidebarPanel(
      t('Activity'),
      hasActivity
        ? t('{{actions}} logged actions · {{sessions}} saved sessions.', { actions: formatNumber(state.cleanupHistory.length), sessions: formatNumber(state.reviewSessions.length) })
        : t('No cleanup history yet. Run inspect, delete, import, or repair actions to build activity history.')
    );

    if (hasActivity) {
      const stats = create('div', 'compact-summary-list');
      [
        createSummaryRow(t('Actions'), formatNumber(trends.totalActions)),
        createSummaryRow(t('Redirects fixed'), formatNumber(trends.redirectsFixed)),
        createSummaryRow(t('Imports'), formatNumber(trends.imports)),
        createSummaryRow(t('Deletes'), formatNumber(trends.deletes))
      ].forEach((row) => stats.append(row));
      historyPanel.append(stats);

      const latest = create('div', 'history-list slim-history-list');
      if (state.cleanupHistory.length) {
        state.cleanupHistory.slice(0, 5).forEach((entry) => {
          const item = create('div', 'history-item compact-history-item');
          item.append(
            create('div', 'review-card-title', t('{{type}} · {{count}}', { type: formatActionType(entry.type) || t('action'), count: formatNumber(entry.count || 0) })),
            create('div', 'helper-text', `${formatDateTime(entry.at)}${entry.note ? ` · ${entry.note}` : ''}`)
          );
          latest.append(item);
        });
      } else {
        latest.append(create('div', 'helper-text', t('No cleanup history yet.')));
      }
      historyPanel.append(latest);
    } else {
      const empty = create('div', 'sidebar-panel-empty');
      empty.append(
        create('div', 'review-card-title', t('Nothing has happened yet')),
        create('div', 'helper-text', t('This panel will wake up after you inspect links, repair redirects, import, or delete bookmarks.'))
      );
      historyPanel.append(empty);
    }

    scroll.append(historyPanel);
  }
}

function createSidebarFlyout() {
  if (!isSidebarOverlayMode() || !state.sidebarOverlayOpen) return null;

  const flyout = create('div', 'sidebar-flyout-panel');
  flyout.addEventListener('mouseenter', clearSidebarOverlayHideTimer);
  flyout.addEventListener('mouseleave', () => scheduleSidebarOverlayClose(220));

  const head = create('div', 'sidebar-flyout-head');
  const meta = create('div', 'about-meta');
  meta.append(
    create('div', 'about-title', t(tabsMeta[state.sidebarTab]?.title || 'Details')),
    create('div', 'about-copy-muted', t(tabsMeta[state.sidebarTab]?.hint || 'Quick panel'))
  );
  const close = createIconButton('close', t('Close sidebar panel'), 'icon-button mono-icon-button sidebar-flyout-close');
  close.addEventListener('click', closeSidebarOverlay);
  head.append(meta, close);
  flyout.append(head);

  const scroll = create('div', 'sidebar-scroll sidebar-flyout-scroll');
  appendSidebarPanelContent(scroll);
  flyout.append(scroll);
  return flyout;
}

const tabsMeta = {
  overview: { title: 'Overview', hint: 'Library snapshot and review highlights.' },
  cleanup: { title: 'Cleanup', hint: 'Quick filters for stale, duplicate, and collision cleanup.' },
  health: { title: 'Health', hint: 'Inspect link health and review timing.' },
  history: { title: 'Activity', hint: 'Recent actions, sessions, and cleanup history.' }
};

function renderSidebar(root) {
  root.classList.toggle('collapsed', state.sidebarCollapsed);
  root.classList.toggle('overlay-mode', isSidebarOverlayMode());
  root.classList.toggle('overlay-open', isSidebarOverlayMode() && state.sidebarOverlayOpen);

  const shell = create('div', `dashboard-sidebar-shell${isSidebarOverlayMode() ? ' has-flyout-mode' : ''}`);
  if (isSidebarOverlayMode()) {
    shell.addEventListener('mouseenter', clearSidebarOverlayHideTimer);
    shell.addEventListener('mouseleave', () => scheduleSidebarOverlayClose(220));
  }
  const rail = create('div', 'dashboard-side-nav dashboard-side-rail');
  const collapseButton = createIconButton(state.sidebarCollapsed ? (isRtlDocument() ? 'chevronLeft' : 'chevronRight') : (isRtlDocument() ? 'chevronRight' : 'chevronLeft'), state.sidebarCollapsed ? t('Expand sidebar') : t('Collapse sidebar'), 'icon-button mono-icon-button sidebar-rail-toggle');
  collapseButton.addEventListener('click', () => { commands.run('toggleSidebarCollapsed').catch(console.error); });
  rail.append(collapseButton);

  const tabs = [
    ['overview', t('Overview'), 'overview', t('Stats')],
    ['cleanup', t('Cleanup'), 'cleanup', t('Clean')],
    ['health', t('Health'), 'health', t('Health')],
    ['history', t('Activity'), 'history', t('Activity')]
  ];
  tabs.forEach(([value, label, icon, shortLabel]) => {
    const button = create('button', `sidebar-tab sidebar-rail-tab${state.sidebarTab === value ? ' active' : ''}`);
    button.type = 'button';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = `<span class="sidebar-tab-icon">${iconSvg(icon)}</span><span class="sidebar-tab-label">${shortLabel}</span>`;
    button.addEventListener('click', () => {
      if (isSidebarOverlayMode()) {
        const isSameTab = state.sidebarTab === value;
        state.sidebarTab = value;
        state.sidebarOverlayOpen = !(isSameTab && state.sidebarOverlayOpen);
      } else {
        state.sidebarTab = value;
        state.sidebarOverlayOpen = false;
      }
      render();
    });
    rail.append(button);
  });
  shell.append(rail);

  if (!state.sidebarCollapsed && !isSidebarOverlayMode()) {
    const panelWrap = create('div', 'dashboard-sidebar-panel-wrap');
    const scroll = create('div', 'sidebar-scroll');
    appendSidebarPanelContent(scroll);
    panelWrap.append(scroll);
    shell.append(panelWrap);
  }

  if (isSidebarOverlayMode() && state.sidebarOverlayOpen) {
    const flyout = createSidebarFlyout();
    if (flyout) shell.append(flyout);
  }

  root.append(shell);
}

function renderListPane(listPane) {
  if (state.mode !== DASHBOARD_MODE && !state.target?.valid) {
    const empty = create('div', 'empty-state');
    empty.append(
      create('h2', 'empty-title', t('This page is not supported')),
      create('div', 'empty-copy', t('Open a normal http or https page. Chrome internal pages are weird little goblins.'))
    );
    listPane.append(empty);
    return;
  }

  const mainHead = create('div', 'dashboard-main-head dashboard-list-head');
  const scopedBookmarks = getScopedBookmarks();
  const scopeCleanup = getScopeSummary();
  const visibleCleanup = state.visibleSummary || getCleanupSummary(state.visibleBookmarks);
  const headCopy = create('div', 'dashboard-list-head-copy');
  const summary = create('div', 'summary-line', t('{{shown}} shown · {{total}} total', { shown: formatNumber(state.visibleBookmarks.length), total: formatNumber(scopedBookmarks.length) }));
  const helper = create('div', 'helper-text', t('{{duplicates}} duplicate groups · {{old}} old · {{untitled}} untitled · {{collisions}} title collisions{{grouping}}.', { duplicates: formatNumber(scopeCleanup.duplicateGroupCount), old: formatNumber(scopeCleanup.oldCount), untitled: formatNumber(visibleCleanup.untitledCount), collisions: formatNumber(visibleCleanup.titleCollisionCount), grouping: state.groupBy !== GROUP_BY_OPTIONS.FLAT ? t(' · {{grouping}}', { grouping: groupByLabel(state.groupBy).toLowerCase() }) : '' }));
  headCopy.append(summary, helper);

  const headActions = create('div', 'dashboard-list-head-actions');
  const primaryActions = create('div', 'dashboard-head-action-group dashboard-list-primary-actions');
  const selectAll = create('button', 'ghost-button compact-list-button', state.visibleBookmarks.length && getSelectedCount() === state.visibleBookmarks.length ? t('Clear all') : t('Select all'));
  selectAll.type = 'button';
  selectAll.disabled = state.visibleBookmarks.length === 0;
  selectAll.addEventListener('click', () => {
    if (getSelectedCount() === state.visibleBookmarks.length) {
      clearSelection({ renderAfter: true });
    } else {
      selectAllVisible({ renderAfter: true });
    }
  });

  const inspectVisibleHead = buildInspectButton(getInspectButtonLabel(), getInspectTargetBookmarks().length, 'ghost-button compact-list-button dashboard-list-inspect-button');
  inspectVisibleHead.addEventListener('click', () => inspectBookmarksHealth(getInspectTargetBookmarks()));

  const selected = getSelectedBookmarks();
  if (hasSelection()) {
    const selBar = create('div', 'gm-selection-bar');

    const selLeft = create('div', 'gm-sel-left');
    const selCb = create('button', 'gm-sel-checkbox');
    selCb.type = 'button';
    selCb.title = t('Clear all');
    selCb.setAttribute('aria-label', t('Clear all'));
    selCb.addEventListener('click', () => clearSelection({ renderAfter: true }));
    const selCount = create('span', 'gm-sel-count', t('{{count}} selected', { count: formatNumber(getSelectedCount()) }));
    selLeft.append(selCb, selCount);

    const selActions = create('div', 'gm-sel-actions');

    const makeIconBtn = (icon, label, danger = false) => {
      const btn = create('button', `gm-icon-btn${danger ? ' danger' : ''}`);
      btn.type = 'button';
      btn.title = label;
      btn.setAttribute('aria-label', label);
      btn.innerHTML = icon;
      return btn;
    };

    const openBtn = makeIconBtn(iconSvg('open'), t('Open selected'));
    openBtn.addEventListener('click', async () => { for (const b of getSelectedBookmarks()) await handleOpen(b.url); });

    const inspectBtn = makeIconBtn(iconSvg('inspect'), getInspectButtonLabel());
    inspectBtn.addEventListener('click', () => inspectBookmarksHealth(getInspectTargetBookmarks()));

    const copyBtn = makeIconBtn(iconSvg('copy'), t('Copy URLs'));
    copyBtn.addEventListener('click', handleCopySelectedUrls);

    const redirectedSelected = selected.filter((bookmark) => {
      const record = getHealthRecord(bookmark, state.healthByKey);
      return record && record.status === HEALTH_STATUSES.REDIRECTED && record.finalUrl && record.finalUrl !== bookmark.url;
    });
    const repairBtn = makeIconBtn(iconSvg('repair'), t('Repair redirected'));
    repairBtn.disabled = redirectedSelected.length === 0;
    repairBtn.addEventListener('click', () => handleRepairRedirects(redirectedSelected));

    const selDivider = create('div', 'gm-sel-divider');

    const deleteBtn = makeIconBtn(iconSvg('trash'), t('Delete'), true);
    deleteBtn.addEventListener('click', () => handleDeleteMany(selected));

    selActions.append(openBtn, inspectBtn, copyBtn, repairBtn, selDivider, deleteBtn);
    selBar.append(selLeft, selActions);

    mainHead.append(selBar, headActions);
  } else {
    primaryActions.append(selectAll, inspectVisibleHead);
    if (state.groupBy !== GROUP_BY_OPTIONS.FLAT) {
      const groupDisplay = renderGroupDisplayControl();
      if (groupDisplay) primaryActions.prepend(groupDisplay);
    }
    headActions.append(primaryActions, createListHeadActionsMenu({
      items: [
        { icon: 'save', label: t('Export visible'), handler: async () => handleExport('json', 'visible'), disabled: state.visibleBookmarks.length === 0 },
        { icon: 'save', label: featureText('Export visible as CSV'), handler: async () => handleExport('csv', 'visible'), disabled: state.visibleBookmarks.length === 0 },
        {
          icon: 'import',
          label: t('Import bookmarks…'),
          handler: async () => triggerImportPicker()
        },
        ...(state.groupBy !== GROUP_BY_OPTIONS.FLAT ? [
          'divider',
          { icon: 'folderOpen', label: t('Expand all groups'), handler: async () => setAllGroupsCollapsed(false) },
          { icon: 'folder', label: t('Collapse all groups'), handler: async () => setAllGroupsCollapsed(true) }
        ] : []),
        'divider',
        {
          icon: 'health',
          label: t('Clear cached health data'),
          handler: async () => handleClearHealthData(),
          disabled: Object.keys(state.healthByKey || {}).length === 0,
          danger: true
        }
      ]
    }));
    mainHead.append(headCopy, headActions);
  }

  const libraryToolsButton=create('button','ghost-button compact-list-button',featureText('Library tools'));
  libraryToolsButton.type='button';libraryToolsButton.dataset.libraryTools='true';
  libraryToolsButton.addEventListener('click',()=>featureTools.showLibraryTools());
  headActions.append(libraryToolsButton);
  featureTools.appendScanSummary(headActions).catch(error=>logger.warn('scan_progress_failed',{error:error.message}));
  listPane.append(mainHead);

  // Tag filter strip: shows the top tags as clickable chips. Chips for
  // currently-active filter tags are highlighted; clicking toggles.
  // Rendered only when at least one tag exists in the library so empty
  // installations don't get an empty bar of dead space.
  const tagStrip = renderTagFilterStrip();
  if (tagStrip) listPane.append(tagStrip);

  const listScroll = create('div', 'list-scroll');
  listScroll.scrollTop = state.listScrollTop || 0;
  listScroll.addEventListener('scroll', () => { state.listScrollTop = listScroll.scrollTop; state.lastListScrollAt = performance.now(); }, { passive: true });
  if (!state.visibleBookmarks.length) {
    const empty = create('div', 'empty-state');
    const emptyTitle = state.cleanupFilter !== CLEANUP_FILTERS.ALL
      ? t('No {{filter}} bookmarks', { filter: cleanupFilterLabel(state.cleanupFilter).toLowerCase() })
      : (state.mode === DASHBOARD_MODE ? t('No bookmarks in this library view') : t('No bookmarks for {{mode}}', { mode: modeLabel(state.mode).toLowerCase() }));
    const emptyCopy = state.cleanupFilter !== CLEANUP_FILTERS.ALL
      ? t('This filter came up empty. Try switching back to All or running a different cleanup pass.')
      : t('That is either clean organization or neglected chaos. Hard to tell from here.');
    empty.append(
      create('h2', 'empty-title', emptyTitle),
      create('div', 'empty-copy', emptyCopy)
    );
    listScroll.append(empty);
  } else {
    if (state.groupBy === GROUP_BY_OPTIONS.FLAT) {
      const list = create('div', 'list');
      // Always append list first so it is in the DOM before scroller mounts
      listScroll.append(list);

      if (state.visibleBookmarks.length > VIRTUAL_SCROLL_THRESHOLD) {
        // Destroy previous scroller if it exists
        if (_virtualScroller) { _virtualScroller.destroy(); _virtualScroller = null; }
        // Virtual scroller manages children of .list (spacers + rendered items)
        _virtualScroller = createVirtualScroller({
          container: list,
          viewport: listScroll,
          rowHeights: virtualRowHeights,
          items: state.visibleBookmarks,
          renderItem,
        });
        _virtualScroller.mount();
      } else {
        // Small list: destroy any lingering scroller and render directly
        if (_virtualScroller) { _virtualScroller.destroy(); _virtualScroller = null; }
        state.visibleBookmarks.forEach((bookmark) => list.append(renderItem(bookmark)));
      }
    } else {
      // Grouped view: destroy virtual scroller (groups handle their own rendering)
      if (_virtualScroller) { _virtualScroller.destroy(); _virtualScroller = null; }
      const grouped = create('div', 'grouped-list');
      getGroupedVisibleBookmarks().forEach((group) => grouped.append(renderBookmarkGroup(group)));
      listScroll.append(grouped);
    }
  }
  listPane.append(listScroll);
}

function renderList(root) {
  const workspace = create('div', `dashboard-body${state.sidebarCollapsed ? ' sidebar-collapsed' : ''}`);
  const sidebar = create('aside', 'dashboard-sidebar');
  const content = create('section', 'dashboard-content');
  const listPane = create('div', 'dashboard-list-pane');

  if (state.mode !== DASHBOARD_MODE && !state.target?.valid) {
    renderSidebar(sidebar);
    const empty = create('div', 'empty-state');
    empty.append(
      create('h2', 'empty-title', t('This page is not supported')),
      create('div', 'empty-copy', t('Open a normal http or https page. Chrome internal pages are weird little goblins.'))
    );
    content.append(empty);
    workspace.append(sidebar, content);
    root.append(workspace);
    return;
  }

  renderSidebar(sidebar);
  renderListPane(listPane);
  content.append(listPane);
  renderDetailsDrawer(content);

  workspace.append(sidebar, content);
  root.append(workspace);
}


function renderRowMenuOverlay(root) {
  if (!state.rowMenuBookmarkId || !state.rowMenuPosition) return;
  const bookmark = getBookmarkById(state.rowMenuBookmarkId);
  if (!bookmark) return;
  const redirectRecord = getHealthRecord(bookmark);
  const canRepair = !!(redirectRecord && redirectRecord.status === HEALTH_STATUSES.REDIRECTED && redirectRecord.finalUrl && redirectRecord.finalUrl !== bookmark.url);

  const menu = create('div', 'item-more-menu item-more-menu-portal');
  applyFixedMenuPosition(menu, state.rowMenuPosition);

  const editAction = create('button', 'row-menu-item', t('Edit'));
  editAction.type = 'button';
  editAction.addEventListener('click', () => {
    state.rowMenuBookmarkId = null;
    state.rowMenuPosition = null;
    state.editingBookmarkId = bookmark.id;
    // Edit mode requires list re-render to show inline editor; use full render
    render();
  });
  const repairAction = create('button', 'row-menu-item');
  repairAction.type = 'button';
  repairAction.textContent = t('Repair redirect');
  repairAction.disabled = !canRepair;
  repairAction.addEventListener('click', () => {
    state.rowMenuBookmarkId = null;
    state.rowMenuPosition = null;
    handleRepairRedirects([bookmark]);
  });
  const deleteAction = create('button', 'row-menu-item danger', t('Delete'));
  deleteAction.type = 'button';
  deleteAction.addEventListener('click', () => {
    state.rowMenuBookmarkId = null;
    state.rowMenuPosition = null;
    handleDeleteMany([bookmark]);
  });
  menu.append(editAction, repairAction, deleteAction);
  root.append(menu);
  clampFixedMenuToViewport(menu);
}

function renderFooter(root) {
  const footer = create('div', 'section dashboard-footer');
  const reminder = getReminderState();
  const score = computeHealthScore();
  const left = create('div', 'summary-line', reminder.enabled
    ? t('Library · Health {{score}}{{metadata}} · {{status}}', { score: formatNumber(score.score), metadata: score.isMetadataOnly ? t(' metadata-only') : '', status: reminder.statusLabel })
    : t('Library · Health {{score}}{{metadata}} · reminders off', { score: formatNumber(score.score), metadata: score.isMetadataOnly ? t(' metadata-only') : '' }));

  const shortcuts = create('div', 'dashboard-kbd-hints');
  [
    ['/', t('Search')],
    ['1', t('Page')],
    ['2', t('Host')],
    ['3', t('Domain')],
    ['↑↓', t('Navigate')],
    ['⌫', t('Delete')]
  ].forEach(([key, label]) => {
    const hint = create('span', 'dashboard-kbd-hint');
    hint.append(create('kbd', 'dashboard-kbd', key), create('span', 'dashboard-kbd-label', label));
    shortcuts.append(hint);
  });

  const right = create('div', 'dashboard-footer-copy', t('Copyright (c) 2026 Ehsan Enaloo'));
  footer.append(left, shortcuts, right);
  root.append(footer);
}

function renderToast(root) {
  if (!state.toast) return;
  const toast = create('div', `toast${state.toast.error ? ' error-copy' : ''}`);
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  const message = create('div', 'toast-message', state.toast.message);
  toast.append(message);

  if (state.toast.actionLabel && state.toast.action) {
    const action = create('button', 'toast-action', state.toast.actionLabel);
    action.type = 'button';
    action.addEventListener('click', async () => {
      const fn = state.toast?.action;
      clearToast();
      render();
      if (fn) await fn();
    });
    toast.append(action);
  }

  root.append(toast);
}

const DASHBOARD_LIST_PANE_SELECTOR = '.dashboard-list-pane';
const DASHBOARD_LIST_HEAD_SELECTOR = '.dashboard-main-head';
const SIDEBAR_SELECTOR = '.dashboard-sidebar';

/**
 * Incremental render: replaces only the list pane and sidebar contents
 * without wiping the entire panel DOM. Used by search debounce to avoid
 * a full layout/paint cycle on every keystroke.
 * Falls back to full render() if the expected containers are not found.
 */
function renderListOnly() {
  try {
    rememberListScroll();
    const listPane = app.querySelector(DASHBOARD_LIST_PANE_SELECTOR);
    const sidebar = app.querySelector(SIDEBAR_SELECTOR);
    if (!listPane || !sidebar) { render(); return; }

    sidebar.textContent = '';
    renderSidebar(sidebar);

    listPane.textContent = '';
    renderListPane(listPane);

    translateTree(app);
    _restoreScrollAndFocus();
  } catch {
    render();
  }
}

// ─── Targeted overlay-only update ────────────────────────────────────────────
// Re-renders only the floating portal elements (menus, toast, modals) that sit
// outside the main panel. Called when only overlay state changes so the entire
// panel (header, toolbar, list) is not rebuilt unnecessarily.
const PORTAL_SELECTORS = [
  '.dashboard-header-menu-portal',
  '.dashboard-list-head-menu-portal',
  '.item-more-menu-portal',
  '.modal-overlay',
  '.toast'
];

function renderOverlaysOnly() {
  try {
    if (!app.childElementCount) { render(); return; }
    // Remove all existing portal/overlay nodes
    PORTAL_SELECTORS.forEach((sel) => {
      app.querySelectorAll(sel).forEach((el) => el.remove());
    });
    const panel = app.querySelector('.panel');
    const listHeadMenuItems = panel?.querySelector('.dashboard-list-actions-menu-wrap')?._menuItems || [];
    renderHeaderMenuOverlay(app);
    renderListHeadMenuOverlay(app, listHeadMenuItems);
    renderRowMenuOverlay(app);
    renderAboutModal(app);
    renderConfirmDialog(app);
    renderToast(app);
  } catch {
    render();
  }
}

function renderToastOnly() {
  try {
    if (!app.childElementCount) { render(); return; }
    app.querySelectorAll('.toast').forEach((el) => el.remove());
    renderToast(app);
  } catch {
    render();
  }
}

function _restoreScrollAndFocus() {
  if (state.focusSearchAfterRender && searchInputRef) {
    searchInputRef.focus({ preventScroll: true });
    const start = Number.isInteger(state.searchSelectionStart) ? state.searchSelectionStart : state.query.length;
    const end = Number.isInteger(state.searchSelectionEnd) ? state.searchSelectionEnd : state.query.length;
    try { searchInputRef.setSelectionRange(start, end); } catch {}
    state.focusSearchAfterRender = false;
    state.searchSelectionStart = null;
    state.searchSelectionEnd = null;
  }

  const listScroll = app.querySelector('.list-scroll');
  if (listScroll && Number.isFinite(state.listScrollTop)) {
    listScroll.scrollTop = state.listScrollTop;
  }

  if (state.shouldScrollActiveIntoView) {
    if (_virtualScroller && state.activeBookmarkId && state.scrollActiveBookmark) {
      _virtualScroller.scrollToItem(state.activeBookmarkId);
      state.scrollActiveBookmark = false;
    } else {
      const activeItem = state.activeBookmarkId
        ? app.querySelector(`[data-bookmark-id="${CSS.escape(state.activeBookmarkId)}"]`)
        : null;
      if (activeItem) activeItem.scrollIntoView({ block: 'nearest' });
    }
    state.shouldScrollActiveIntoView = false;
  }
}

function render() {
  document.title = t('Bookmark Scope — Library Dashboard');
  try {
    app.textContent = '';
    searchInputRef = null;

    if (!isSidebarOverlayMode()) state.sidebarOverlayOpen = false;

    const panel = create('div', 'panel');
    renderHeader(panel);
    renderPinOnboarding(panel);
    renderToolbar(panel);
    renderList(panel);
    renderFooter(panel);
    app.append(panel);
    renderHeaderMenuOverlay(app);
    const listHeadMenuItems = panel.querySelector('.dashboard-list-actions-menu-wrap')?._menuItems || [];
    renderListHeadMenuOverlay(app, listHeadMenuItems);
    renderRowMenuOverlay(app);
    renderAboutModal(app);
    renderConfirmDialog(app);
    renderToast(app);

    updateThemeControls();
    translateTree(app);
    _restoreScrollAndFocus();
  } catch (error) {
    logger.error('render_failed', { message: error?.message || String(error) });
    console.error(error);
    renderFatal(t('The dashboard rendered itself into a ditch.'), error);
  }
}


addStorageChangedListener(async (changes, areaName) => {
  if (areaName !== 'local') return;
  if (changes[STORAGE_KEYS.TAGS_BY_BOOKMARK] || changes[STORAGE_KEYS.HEALTH_CACHE] || changes[STORAGE_KEYS.HEALTH_CACHE_GENERATION]) {
    state.tagsByBookmark = await loadTagsMap();
    state.healthByKey = await loadHealthCache();
    recalculateVisibleBookmarks();
    renderListOnly();
  }
  if (changes[STORAGE_KEYS.LOCALE_PREFERENCE]) {
    await initI18n();
    render();
  }
  if (changes[STORAGE_KEYS.COLOR_PALETTE]) {
    const newPalette = changes[STORAGE_KEYS.COLOR_PALETTE].newValue;
    if (newPalette && newPalette !== state.colorPalette) {
      state.colorPalette = newPalette;
      applyPalette(newPalette);
      updatePaletteControls();
    }
  }
});

// React to bookmark changes made outside the dashboard (Chrome native UI,
// the popup, another window, or Chrome sync). bookmark-utils.js invalidates
// its own cache automatically; this handler runs the dashboard's data
// pipeline and re-renders.
//
// Debounced for two reasons:
//   1. Bulk imports / Chrome sync can fire hundreds of events per second.
//   2. The dashboard's own write actions (delete, repair, merge) already
//      call refreshData() explicitly, then trigger the same events
//      asynchronously a moment later — debouncing folds those duplicates.
//
// 250ms is long enough to coalesce a bulk-import burst yet still feels
// instant for single-bookmark changes.
const refreshDashboardOnBookmarkChange = debounce(async () => {
  try {
    await refreshData();
    render();
  } catch (error) {
    await logger.warn('bookmark_event_refresh_failed', { message: error?.message || String(error) });
  }
}, 250);
addBookmarkEventListeners({
  created: refreshDashboardOnBookmarkChange,
  removed: refreshDashboardOnBookmarkChange,
  changed: refreshDashboardOnBookmarkChange,
  moved: refreshDashboardOnBookmarkChange,
  importEnded: refreshDashboardOnBookmarkChange
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
