/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 */

import { getBookmarkTree } from '../platform/browser-api.js';
import { runtimeMessages } from '../runtime/messages.js';
import { HEALTH_STATUSES } from '../core/constants.js';
import { clearHealthCache, deleteHealthRecord } from '../services/health-cache-service.js';
import { computeDropDestination, isDropTargetValid, planBatchMove } from './drag-drop-logic.js';
import {
  addTagToBookmark,
  removeTagFromBookmark,
  updateTagsMap,
  loadTagsMap,
  setTagsForBookmark,
  normaliseTag
} from '../services/tag-service.js';

export function createActionTools(deps) {
  const {
    state,
    t,
    formatNumber,
    sendMessage,
    showConfirmDialog,
    setToast,
    refreshData,
    renderListOnly,
    pushCleanupHistory,
    invalidateBookmarkCache,
    createBookmark,
    updateBookmark,
    removeBookmark,
    moveBookmark,
    getHealthRecord,
    getRedirectedBookmarks,
    groupDuplicates,
    getSelectedBookmarks,
    selectedBookmarks,
    deselectBookmarks,
    getCurrentPageBookmarkTarget,
    getCurrentPageBookmarkPayload,
  } = deps;

  const resolveSelectedBookmarks = getSelectedBookmarks || selectedBookmarks || (() => []);

  async function handleOpen(url) {
    await sendMessage(runtimeMessages.openUrl(url));
  }

  async function handleRepairRedirects(bookmarks = getRedirectedBookmarks(state.visibleBookmarks, state.healthByKey)) {
    const repairs = (bookmarks || []).filter((bookmark) => {
      const record = getHealthRecord(bookmark, state.healthByKey);
      return record && record.status === HEALTH_STATUSES.REDIRECTED && record.finalUrl && record.finalUrl !== bookmark.url;
    });

    if (!repairs.length) {
      setToast(t('No redirected bookmarks with a usable final URL. Nothing to repair.'), { error: true });
      return;
    }

    const confirmed = await showConfirmDialog({
      title: t('Repair redirected bookmarks?'),
      message: t('Update {{count}} redirected bookmarks to their final URL?', { count: formatNumber(repairs.length) }),
      confirmLabel: t('Update bookmarks'),
      cancelLabel: t('Cancel')
    });
    if (!confirmed) return;

    invalidateBookmarkCache();
    // Capture each repaired bookmark's old key so we can invalidate just
    // those entries — both in-memory and in persistent storage — rather
    // than throwing away every health record we've ever collected.
    const repairedKeys = [];
    await Promise.all(repairs.map((bookmark) => {
      const record = getHealthRecord(bookmark, state.healthByKey);
      const oldKey = bookmark?.parsed?.normalizedPageKey || bookmark?.url || '';
      if (oldKey) repairedKeys.push(oldKey);
      return updateBookmark(bookmark.id, { url: record.finalUrl });
    }));

    for (const key of repairedKeys) {
      delete state.healthByKey[key];
      await deleteHealthRecord(key);
    }
    state.healthSummary = null;
    state.healthLastRunAt = null;
    await sendMessage(runtimeMessages.refreshBadge());
    await refreshData();
    await pushCleanupHistory({
      type: 'repair-redirects',
      count: repairs.length,
      note: t('Updated redirected bookmarks to their final URL.')
    });
    setToast(t('Repaired {{count}} redirected bookmarks. Less detour, more signal.', { count: formatNumber(repairs.length) }));
  }

  async function handleCopySelectedUrls() {
    const selected = resolveSelectedBookmarks();
    if (!selected.length) {
      setToast(t('Select something first. Telepathy is not implemented.'), { error: true });
      return;
    }
    const text = selected.map((item) => item.url).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setToast(t('Copied {{count}} URLs.', { count: formatNumber(selected.length) }));
    } catch (error) {
      console.error(error);
      setToast(t('Clipboard failed. Browser goblins remain undefeated.'), { error: true });
    }
  }


  let deleteBusy = false;
  function deletionToast(batch, failures = 0) {
    setToast(t('Deleted: {{count}}. Failed: {{failed}}.', { count: formatNumber(batch.items.length), failed: formatNumber(failures) }), {
      error: failures > 0, actionLabel: batch.items.length ? t('Undo') : '',
      action: batch.items.length ? () => restoreDeletedBatch(batch) : null, persist: batch.items.length > 0
    });
  }
  async function refreshAfterMutation() {
    invalidateBookmarkCache();
    try { await sendMessage(runtimeMessages.refreshBadge()); await refreshData(); renderListOnly(); }
    catch (error) { console.error('Mutation applied; view refresh failed.', error); }
  }
  async function restoreDeletedBatch(batch = state.lastDeletedBatch) {
    if (!batch?.items?.length || batch.restoring) return;
    batch.restoring = true;
    let restored = 0;
    try {
      for (const item of [...batch.items].sort((a,b) => String(a.parentId).localeCompare(String(b.parentId)) || a.index - b.index)) {
        try {
          // Retain a recreated ID if tag persistence fails; a retry must not
          // create a second bookmark for that same recovered item.
          if (!item.restoredId) {
            const nodes = await readCurrentNodes();
            const siblings = [...nodes.values()].filter(node => node.parentId === item.parentId).sort((a,b) => a.index - b.index);
            const initial = batch.orders.get(String(item.parentId)) || [];
            const mappedId = id => batch.restoredIds.get(id) || id;
            const following = initial.find(node => node.index > item.index && siblings.some(sibling => sibling.id === mappedId(node.id)));
            const preceding = [...initial].reverse().find(node => node.index < item.index && siblings.some(sibling => sibling.id === mappedId(node.id)));
            const index = following ? siblings.findIndex(node => node.id === mappedId(following.id))
              : preceding ? siblings.findIndex(node => node.id === mappedId(preceding.id)) + 1 : siblings.length;
            const created = await createBookmark({ parentId: item.parentId || undefined, index, title: item.title, url: item.url });
            item.restoredId = created.id;
            batch.restoredIds.set(item.id,created.id);
          }
          if (item.tags.length) state.tagsByBookmark = await updateTagsMap(map => setTagsForBookmark(map, item.restoredId, item.tags));
          batch.items.splice(batch.items.indexOf(item), 1);
          restored++;
        } catch (error) { console.error('Delete recovery failed.', error); }
      }
      if (!batch.items.length && state.lastDeletedBatch === batch) state.lastDeletedBatch = null;
      await refreshAfterMutation();
      setToast(t('Restored: {{count}}. Remaining: {{failed}}.', { count: formatNumber(restored), failed: formatNumber(batch.items.length) }), {
        error: batch.items.length > 0, persist: batch.items.length > 0,
        actionLabel: batch.items.length ? t('Undo') : '', action: batch.items.length ? () => restoreDeletedBatch(batch) : null
      });
      await pushCleanupHistory({ type: 'undo-delete', count: restored, note: 'Restored completed deletions; browser IDs and dates are newly assigned.' });
    } finally { batch.restoring = false; }
  }

  async function handleDeleteMany(bookmarks, options = {}) {
    if (!bookmarks.length || deleteBusy) return;
    deleteBusy = true;
    try {
      const confirmed = options.skipConfirm || await showConfirmDialog({ title: t('Delete bookmarks?'), message: t('Delete {{count}} bookmarks?', { count: formatNumber(bookmarks.length) }), confirmLabel: t('Delete'), cancelLabel: t('Keep them'), danger: true });
      if (!confirmed) return;
      const tags = await loadTagsMap();
      const nodes = await readCurrentNodes();
      const batch = { items: [], orders: new Map(), restoredIds: new Map() };
      for (const node of nodes.values()) {
        const parent = String(node.parentId || '');
        const siblings = batch.orders.get(parent) || [];
        siblings.push(node); batch.orders.set(parent,siblings);
      }
      for (const siblings of batch.orders.values()) siblings.sort((a,b) => a.index - b.index);
      let failures = 0;
      const unique = [...new Map(bookmarks.map(b => [b.id,b])).values()];
      const snapshots = unique.map(b => nodes.get(b.id)).filter(Boolean).sort((a,b) => String(a.parentId).localeCompare(String(b.parentId)) || b.index - a.index);
      failures += unique.length - snapshots.length;
      for (const bookmark of snapshots) {
        try {
          const expected = options.expectedNodes?.get(bookmark.id);
          if (expected && (expected.url !== bookmark.url || expected.title !== bookmark.title || expected.parentId && expected.parentId !== bookmark.parentId)) throw new Error('Bookmark changed after preview.');
          await removeBookmark(bookmark.id);
          batch.items.push({ id: bookmark.id, parentId: bookmark.parentId, index: bookmark.index, title: bookmark.title, url: bookmark.url, tags: [...(tags[bookmark.id] || [])] });
          deselectBookmarks([bookmark]);
        } catch (error) { failures++; console.error('Bookmark deletion failed.', error); }
      }
      if (batch.items.length) state.lastDeletedBatch = batch;
      state.editingBookmarkId = null;
      // Refresh first: a full re-render after the toast appears would rebuild the Undo button under the pointer.
      await refreshAfterMutation();
      deletionToast(batch, failures);
      await pushCleanupHistory({ type: 'delete', count: batch.items.length, note: 'Completed deletions: ' + batch.items.length + '; failed: ' + failures });
      return { deleted: batch.items.length, failed: failures };
    } finally { deleteBusy = false; }
  }

  async function readCurrentNodes() {
    const tree = await getBookmarkTree();
    const nodes = new Map();
    const visit = children => { for (const [index,node] of (children || []).entries()) { nodes.set(node.id, { ...node, index: Number.isInteger(node.index) ? node.index : index }); visit(node.children); } };
    visit(tree);
    return nodes;
  }

  async function handleMergeDuplicates() {
    if (deps.previewDuplicateMerge) return deps.previewDuplicateMerge();
    const groups = groupDuplicates(state.visibleBookmarks);
    if (!groups.size) {
      setToast(t('No duplicate groups in this view. The merge cannon has no target.'), { error: true });
      return;
    }

    const toDelete = [];
    for (const list of groups.values()) {
      const sorted = [...list].sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0));
      if (state.mergeStrategy === 'keep-newest') {
        sorted.pop();
      } else {
        sorted.shift();
      }
      toDelete.push(...sorted);
    }

    if (!toDelete.length) {
      setToast(t('Duplicate groups exist, but there was nothing disposable after strategy rules.'), { error: true });
      return;
    }

    const label = t(state.mergeStrategy === 'keep-newest' ? 'newest' : 'oldest');
    const confirmed = await showConfirmDialog({
      title: t('Merge duplicate URLs?'),
      message: t('Merge duplicate URLs in this view by keeping the {{label}} bookmark and deleting {{count}} duplicates?', { label, count: formatNumber(toDelete.length) }),
      confirmLabel: t('Merge duplicates'),
      cancelLabel: t('Cancel'),
      danger: true
    });
    if (!confirmed) return;

    await handleDeleteMany(toDelete, {
      skipConfirm: true,
      message: t('Merged duplicate URLs. Kept the {{label}} bookmark in each group and deleted {{count}}.', { label, count: formatNumber(toDelete.length) })
    });
  }

  async function handleSaveEdit(bookmarkId, titleValue, urlValue) {
    const title = String(titleValue || '').trim() || '(Untitled bookmark)';
    const url = String(urlValue || '').trim();

    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported');
    } catch {
      setToast(t('That URL is broken. Feed it something valid.'), { error: true });
      return;
    }

    invalidateBookmarkCache();
    await updateBookmark(bookmarkId, { title, url });
    state.editingBookmarkId = null;
    await sendMessage(runtimeMessages.refreshBadge());
    await refreshData();
    setToast(t('Bookmark updated. Less chaos, more order.'));
  }

  async function handleBookmarkCurrentPage() {
    if (!getCurrentPageBookmarkTarget()) {
      setToast(t('This page cannot be bookmarked from here.'), { error: true });
      return;
    }

    const payload = getCurrentPageBookmarkPayload();
    if (!payload) {
      setToast(t('This page cannot be bookmarked from here.'), { error: true });
      return;
    }

    invalidateBookmarkCache();
    await createBookmark(payload);

    await sendMessage(runtimeMessages.refreshBadge());
    await refreshData();
    await pushCleanupHistory({ type: 'bookmark-current-page', count: 1, note: t('Bookmarked the current page from the popup.') });
    setToast(t('Current page bookmarked. A rare victory.'));
  }

  // Wipes both the in-memory and persistent health-check caches.
  // The bookmarks themselves are untouched — only their cached status info
  // (healthy / redirected / broken / etc.) is forgotten. Useful when the
  // cached data feels stale after a long break or when storage feels
  // bloated.
  async function handleClearHealthData() {
    const cachedCount = Object.keys(state.healthByKey || {}).length;
    if (!cachedCount) {
      setToast(t('No cached health data to clear.'), { error: true });
      return;
    }
    const confirmed = await showConfirmDialog({
      title: t('Clear cached health data?'),
      message: t('Forget all {{count}} cached link-health results? Your bookmarks are not affected; the next inspect will rebuild the cache.', { count: formatNumber(cachedCount) }),
      confirmLabel: t('Clear cache'),
      cancelLabel: t('Keep cache'),
      danger: true
    });
    if (!confirmed) return;
    state.healthByKey = {};
    state.healthSummary = null;
    state.healthLastRunAt = null;
    // Clear per-bookmark in-memory health fields too so the UI updates.
    for (const bookmark of state.allBookmarks || []) {
      delete bookmark.healthStatus;
      delete bookmark.healthCheckedAt;
      delete bookmark.healthStatusCode;
      delete bookmark.healthFinalUrl;
      delete bookmark.healthError;
      delete bookmark.healthMethod;
    }
    await clearHealthCache();
    await pushCleanupHistory({
      type: 'clear-health-cache',
      count: cachedCount,
      note: t('Cleared cached link-health results.')
    });
    renderListOnly();
    setToast(t('Cleared {{count}} cached health results.', { count: formatNumber(cachedCount) }));
  }

  /**
   * Moves one or more bookmarks to a new position via drag-and-drop.
   *
   * For multi-selection drags, all selected bookmarks are moved
   * sequentially via planBatchMove, which simulates each move against
   * a shadow of the destination folder. This is what fixes the same-
   * folder multi-source case where the naive "firstDest.index + i"
   * approach previously landed off-by-one — see drag-drop-logic.js's
   * planBatchMove for the algorithm.
   *
   * The previous parentId + index of each moved bookmark is captured so
   * the toast Undo handler can restore the exact prior arrangement,
   * using original sibling anchors so partial recovery can be retried
   * without disturbing already-restored bookmarks.
   *
   * Returns true when at least one move was applied, false otherwise.
   */
  async function handleDragDropMove(sourceBookmarks, targetBookmark, position) {
    if (typeof moveBookmark !== 'function') return false;
    if (!Array.isArray(sourceBookmarks) || sourceBookmarks.length === 0) return false;
    if (!targetBookmark) return false;

    // Reject drops onto items being moved.
    const sourceIds = sourceBookmarks.map((b) => b.id);
    if (!isDropTargetValid(sourceIds, targetBookmark)) {
      setToast(t('Cannot drop here.'), { error: true });
      return false;
    }

    // Plan the entire batch up front. planBatchMove returns one op per
    // source that actually moves; no-ops (e.g. dropping a source on its
    // own current slot) are filtered out. An empty result means the
    // user-requested move is a complete no-op — no toast, no undo.
    const nodes = await readCurrentNodes();
    const sources = sourceBookmarks.map(b => nodes.get(b.id)).filter(Boolean);
    const target = nodes.get(targetBookmark.id);
    if (!target || sources.length !== sourceBookmarks.length) { setToast(t('Cannot drop here.'), { error: true }); return false; }
    const ops = planBatchMove(sources, target, position, [...nodes.values()]);
    if (!ops.length) return false;
    const undoPayload = [];
    const originalOrders = new Map();
    for (const node of nodes.values()) {
      const parent = String(node.parentId || '');
      const siblings = originalOrders.get(parent) || [];
      siblings.push(node); originalOrders.set(parent, siblings);
    }
    for (const siblings of originalOrders.values()) siblings.sort((a,b) => a.index - b.index);
    invalidateBookmarkCache();
    let movedCount = 0;
    let moveFailed = false;
    for (const op of ops) {
      try {
        const original = (await readCurrentNodes()).get(op.id);
        if (!original) throw new Error('Bookmark no longer exists.');
        await moveBookmark(op.id, { parentId: op.parentId, index: op.index });
        undoPayload.push({ id: op.id, parentId: nodes.get(op.id).parentId, index: nodes.get(op.id).index });
        movedCount++;
      } catch (error) { moveFailed = true; console.warn('Drag-drop move failed midway.', error); break; }
    }

    if (movedCount === 0) { setToast(t('Cannot drop here.'), { error: true }); return false; }

    let undoBusy = false;
    const undoMove = async () => {
      if (undoBusy || !undoPayload.length) return;
      undoBusy = true;
      try {
        const ordered = [...undoPayload].sort((a,b) => String(a.parentId).localeCompare(String(b.parentId)) || a.index - b.index);
        for (const original of ordered) {
          try {
            const currentNodes = await readCurrentNodes();
            const siblings = [...currentNodes.values()].filter(node => node.parentId === original.parentId && node.id !== original.id).sort((a,b) => a.index - b.index);
            const pending = new Set(undoPayload.map(item => item.id));
            const initial = originalOrders.get(String(original.parentId)) || [];
            const following = initial.find(node => node.index > original.index && !pending.has(node.id) && siblings.some(sibling => sibling.id === node.id));
            const preceding = [...initial].reverse().find(node => node.index < original.index && !pending.has(node.id) && siblings.some(sibling => sibling.id === node.id));
            const index = following ? siblings.findIndex(node => node.id === following.id)
              : preceding ? siblings.findIndex(node => node.id === preceding.id) + 1 : siblings.length;
            await moveBookmark(original.id, { parentId: original.parentId, index });
            undoPayload.splice(undoPayload.indexOf(original), 1);
          } catch (error) { console.error('Move recovery failed.', error); }
        }
        setToast(undoPayload.length ? t('Could not undo the move.') : t('Move undone.'), {
          error: undoPayload.length > 0, persist: undoPayload.length > 0,
          actionLabel: undoPayload.length ? t('Undo') : '', action: undoPayload.length ? undoMove : null
        });
        await refreshAfterMutation();
      } finally { undoBusy = false; }
    };
    setToast(t('Moved: {{count}}. Failed / not attempted: {{failed}}.', { count: formatNumber(movedCount), failed: formatNumber(ops.length - movedCount) }), {
      error: moveFailed, actionLabel: t('Undo'), action: undoMove, persist: true
    });
    await refreshAfterMutation();
    await pushCleanupHistory({ type: 'drag-drop-move', count: movedCount, note: 'Completed moves: ' + movedCount + '; failed/unattempted: ' + (ops.length - movedCount) });
    return true;
  }

  /**
   * Adds a tag to a bookmark. Returns true on success, false on no-op
   * (duplicate, invalid input, or per-bookmark cap reached). The pure
   * tag-service handles input validation; this handler is just storage
   * I/O plus toast feedback.
   */
  async function handleAddTag(bookmarkId, rawTag) {
    const norm = normaliseTag(rawTag);
    if (!norm) {
      setToast(t('Tag is empty or too long.'), { error: true });
      return false;
    }
    let added = false;
    state.tagsByBookmark = await updateTagsMap(map => { const result = addTagToBookmark(map, bookmarkId, norm); added = result.added; return result.map; });
    if (!added) return false;
    renderListOnly();
    return true;
  }

  /**
   * Removes a tag from a bookmark. Returns true on success, false when
   * the tag wasn't there to begin with.
   */
  async function handleRemoveTag(bookmarkId, rawTag) {
    let removed = false;
    state.tagsByBookmark = await updateTagsMap(map => { const result = removeTagFromBookmark(map, bookmarkId, rawTag); removed = result.removed; return result.map; });
    if (!removed) return false;
    renderListOnly();
    return true;
  }

  return {
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
    handleRemoveTag,
  };
}
