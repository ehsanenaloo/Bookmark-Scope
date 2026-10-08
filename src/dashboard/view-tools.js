export function createViewTools(deps) {
  const {
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
  } = deps;

  function modeLabel(mode) {
    switch (mode) {
      case MATCH_MODES.PAGE:
        return t('This page');
      case MATCH_MODES.HOST:
        return t('This host');
      case MATCH_MODES.DOMAIN:
        return t('This domain');
      case DASHBOARD_MODE:
        return t('Entire library');
      default:
        return t('This domain');
    }
  }


  function getInspectTargetBookmarks() {
    const selected = getSelectedBookmarks();
    return selected.length ? selected : state.visibleBookmarks;
  }

  function getInspectButtonLabel() {
    if (state.inspectStopPending) return t('Stopping…');
    if (state.isInspectingHealth) {
      const total = Math.max(state.healthScanTotal, 0);
      return t('Stop inspect {{done}}/{{total}}', { done: formatNumber(state.healthScanProgress), total: formatNumber(total) });
    }
    return getSelectedBookmarks().length ? t('Inspect selected') : t('Inspect visible');
  }


  function ensureActiveBookmark() {
    const validIds = new Set(state.visibleBookmarks.map((item) => item.id));
    if (state.activeBookmarkId && validIds.has(state.activeBookmarkId)) return;
    state.activeBookmarkId = state.visibleBookmarks[0]?.id || null;
  }

  function getActiveBookmark() {
    return state.visibleBookmarks.find((bookmark) => bookmark.id === state.activeBookmarkId) || null;
  }

  function moveActiveBookmark(direction) {
    if (!state.visibleBookmarks.length) {
      state.activeBookmarkId = null;
      return;
    }
    const currentIndex = state.visibleBookmarks.findIndex((bookmark) => bookmark.id === state.activeBookmarkId);
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = Math.max(0, Math.min(state.visibleBookmarks.length - 1, baseIndex + direction));
    state.activeBookmarkId = state.visibleBookmarks[nextIndex]?.id || state.visibleBookmarks[0]?.id || null;
    state.shouldScrollActiveIntoView = true;
  }

  function setActiveBookmark(bookmarkId) {
    state.activeBookmarkId = bookmarkId;
  }

  function getScopedBookmarks() {
    return state.scopedBookmarks || [];
  }

  function getScopeSummary() {
    return state.scopeSummary || getCleanupSummary(getScopedBookmarks());
  }

  function getScopeHealthSummary() {
    return summarizeHealth(getScopedBookmarks(), state.healthByKey);
  }

  function getLibrarySummary() {
    return state.librarySummary || getCleanupSummary(state.allBookmarks || []);
  }

  function getViewStats() {
    const scoped = getScopedBookmarks();
    const visible = state.visibleBookmarks || [];
    return {
      scopedCount: scoped.length,
      visibleCount: visible.length,
      selectedCount: state.selectedIds?.size || 0,
      duplicateCount: state.visibleSummary?.duplicateCount || 0,
      duplicateGroupCount: state.visibleDuplicateGroups || 0,
      folderCount: state.scopeFolderCount || 0
    };
  }

  function cleanupFilterLabel(filter) {
    switch (filter) {
      case CLEANUP_FILTERS.DUPLICATES:
        return t('Duplicate URLs');
      case CLEANUP_FILTERS.UNTITLED:
        return t('Untitled');
      case CLEANUP_FILTERS.OLD:
        return t('Old ({{days}}+ days)', { days: formatNumber(OLD_BOOKMARK_DAYS) });
      case CLEANUP_FILTERS.TITLE_COLLISIONS:
        return t('Title collisions');
      case CLEANUP_FILTERS.ALL:
      default:
        return t('All items');
    }
  }

  function getCleanupCount(filter) {
    const summary = getScopeSummary();
    switch (filter) {
      case CLEANUP_FILTERS.DUPLICATES:
        return summary.duplicateCount;
      case CLEANUP_FILTERS.UNTITLED:
        return summary.untitledCount;
      case CLEANUP_FILTERS.OLD:
        return summary.oldCount;
      case CLEANUP_FILTERS.TITLE_COLLISIONS:
        return summary.titleCollisionCount;
      case CLEANUP_FILTERS.ALL:
      default:
        return summary.total;
    }
  }

  function clearCleanupFilters() {
    state.cleanupFilter = CLEANUP_FILTERS.ALL;
    state.duplicatesOnly = false;
  }

  function setCleanupFilter(filter) {
    const nextFilter = filter || CLEANUP_FILTERS.ALL;
    state.cleanupFilter = nextFilter;
    state.duplicatesOnly = nextFilter === CLEANUP_FILTERS.DUPLICATES;
    savePreferences();
    recalculateVisibleBookmarks();
    render();
  }

  function runCleanupPreset(filter, query = '') {
    state.cleanupFilter = filter;
    state.duplicatesOnly = filter === CLEANUP_FILTERS.DUPLICATES;
    state.query = query;
    state.focusSearchAfterRender = true;
    savePreferences();
    recalculateVisibleBookmarks();
    render();
  }


  return {
    modeLabel,
    getInspectTargetBookmarks,
    getInspectButtonLabel,
    cleanupSelection,
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
    runCleanupPreset,
    areBookmarksSelected,
    toggleBookmarksSelection,
    selectBookmarks
  };
}
