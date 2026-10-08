export function createSelectionTools(deps) {
  const { state, render } = deps;

  function normalizeBookmarkIds(bookmarks) {
    return [...new Set((bookmarks || []).map((bookmark) => bookmark?.id).filter(Boolean))];
  }

  function getSelectedBookmarks(items = state.visibleBookmarks) {
    return (items || []).filter((bookmark) => state.selectedIds.has(bookmark.id));
  }

  function getSelectedCount() {
    return state.selectedIds?.size || 0;
  }

  function hasSelection() {
    return getSelectedCount() > 0;
  }

  function isBookmarkSelected(bookmarkOrId) {
    const id = typeof bookmarkOrId === 'string' ? bookmarkOrId : bookmarkOrId?.id;
    return !!id && state.selectedIds.has(id);
  }

  function cleanupSelection(validBookmarks = state.visibleBookmarks) {
    const validIds = new Set((validBookmarks || []).map((item) => item.id));
    state.selectedIds = new Set([...state.selectedIds].filter((id) => validIds.has(id)));
  }

  function clearSelection(options = {}) {
    state.selectedIds.clear();
    if (options.renderAfter) render();
  }

  function setBookmarkSelection(bookmarkId, isSelected, options = {}) {
    if (!bookmarkId) return;
    if (isSelected) state.selectedIds.add(bookmarkId);
    else state.selectedIds.delete(bookmarkId);
    if (options.renderAfter) render();
  }

  function toggleBookmarkSelection(bookmarkId, options = {}) {
    if (!bookmarkId) return;
    setBookmarkSelection(bookmarkId, !state.selectedIds.has(bookmarkId), options);
  }

  function deselectBookmarks(bookmarks) {
    normalizeBookmarkIds(bookmarks).forEach((id) => state.selectedIds.delete(id));
  }

  function selectAllVisible(options = {}) {
    (state.visibleBookmarks || []).forEach((bookmark) => state.selectedIds.add(bookmark.id));
    if (options.renderAfter) render();
  }

  function areBookmarksSelected(bookmarks) {
    const ids = normalizeBookmarkIds(bookmarks);
    return ids.length > 0 && ids.every((id) => state.selectedIds.has(id));
  }

  function toggleBookmarksSelection(bookmarks, options = {}) {
    const ids = normalizeBookmarkIds(bookmarks);
    if (!ids.length) return;
    const allSelected = ids.every((id) => state.selectedIds.has(id));
    ids.forEach((id) => {
      if (allSelected) state.selectedIds.delete(id);
      else state.selectedIds.add(id);
    });
    if (options.renderAfter !== false) render();
  }

  function selectBookmarks(bookmarks, options = {}) {
    normalizeBookmarkIds(bookmarks).forEach((id) => state.selectedIds.add(id));
    if (options.renderAfter !== false) render();
  }

  return {
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
  };
}
