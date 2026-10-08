/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 *
 * drag-drop-logic.js
 *
 * Pure functions for computing the destination of a drag-and-drop bookmark
 * move. Separated from the DOM event handlers so the math can be unit-
 * tested without browser plumbing.
 *
 * Chrome's bookmarks.move API takes { parentId, index }. When the dragged
 * bookmark is being moved within the same parent and to a position after
 * its current index, Chrome treats the index as if the bookmark were
 * already removed — i.e. an index of "after current" must compensate by
 * one. We bake that off-by-one into computeDropDestination so callers can
 * stay obviously correct.
 */

/**
 * Possible drop positions relative to a row in the list:
 *   'before' — insert at the target's index (target shifts down)
 *   'after'  — insert at target's index + 1
 *   'into'   — make target the new parent (only meaningful for folders)
 *
 * The 'into' value is reserved for future folder-drop support; the current
 * flat-list UI uses only 'before' and 'after'.
 */
export const DROP_POSITION = Object.freeze({
  BEFORE: 'before',
  AFTER: 'after',
  INTO: 'into'
});

/**
 * Decides whether the pointer at clientY is in the upper or lower half of
 * the rectangle. Returns 'before' for the upper half, 'after' for the
 * lower half. Used to translate a hover position into a drop intent.
 *
 * Threshold is a clean 50/50 split; we could add a "dead zone" but in
 * practice it makes the UI feel sluggish.
 */
export function positionFromPointer(rect, clientY) {
  if (!rect) return DROP_POSITION.AFTER;
  const midpoint = rect.top + rect.height / 2;
  return clientY < midpoint ? DROP_POSITION.BEFORE : DROP_POSITION.AFTER;
}

/**
 * Translates a drop intent (target bookmark + position) into the
 * { parentId, index } pair that Chrome's bookmarks.move() expects.
 *
 * - sourceBookmark: the bookmark being dragged
 * - targetBookmark: the bookmark being dropped onto (or near)
 * - position: 'before' or 'after'
 *
 * Returns null when the move is a no-op (e.g. dropping a bookmark on
 * itself, or dropping immediately after the bookmark just above its
 * current position). Returning null lets the caller skip the API call
 * entirely.
 */
export function computeDropDestination(sourceBookmark, targetBookmark, position) {
  if (!sourceBookmark || !targetBookmark) return null;
  if (sourceBookmark.id === targetBookmark.id) return null;

  const sourceParent = String(sourceBookmark.parentId || '');
  const targetParent = String(targetBookmark.parentId || '');
  const sourceIdx = Number.isInteger(sourceBookmark.index) ? sourceBookmark.index : 0;
  const targetIdx = Number.isInteger(targetBookmark.index) ? targetBookmark.index : 0;

  // Same-folder move: Chrome treats the requested index as the position
  // after removal. So moving forward by one slot is a no-op, and moving
  // backward needs no adjustment.
  if (sourceParent === targetParent) {
    let destIdx = position === DROP_POSITION.BEFORE ? targetIdx : targetIdx + 1;
    // If we'd land at the exact slot the bookmark already occupies
    // (accounting for the "after-removal" semantics), skip.
    // Example: sourceIdx=3, dropping 'after' targetIdx=2 → destIdx=3 = no-op.
    // Example: sourceIdx=3, dropping 'before' targetIdx=4 → destIdx=4
    //          → after removal, 4 becomes 3 = no-op.
    if (destIdx === sourceIdx || destIdx === sourceIdx + 1) return null;
    // Compensate the off-by-one when moving forward within the same parent:
    // removing source first shifts everything to its right down by one.
    if (destIdx > sourceIdx) destIdx -= 1;
    return { parentId: targetParent, index: destIdx };
  }

  // Cross-folder move: index is interpreted in the destination folder,
  // where source is not present, so no shift compensation needed.
  const destIdx = position === DROP_POSITION.BEFORE ? targetIdx : targetIdx + 1;
  return { parentId: targetParent, index: destIdx };
}

/**
 * Convenience: validate that a candidate move is meaningful given a list
 * of selected bookmarks. Used when the user drags a multi-selection —
 * the move should be skipped entirely if dropping on one of the moved
 * items themselves.
 */
export function isDropTargetValid(sourceIds, targetBookmark) {
  if (!targetBookmark) return false;
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) return false;
  return !sourceIds.includes(targetBookmark.id);
}

/**
 * For multi-selection drags: returns the bookmarks in the order they
 * should be moved so the final relative ordering matches the visual
 * order in the original list.
 *
 * Chrome's bookmarks.move runs operations sequentially; if we move them
 * in arbitrary order, the indices we compute become stale partway
 * through. Sorting ascending by current index for cross-folder moves and
 * descending for within-parent forward moves keeps things predictable.
 *
 * We expose just a stable sort by [parentId asc, index asc] — the caller
 * is expected to recompute the destination index for each item after the
 * previous one has moved, so global ordering is preserved.
 */
export function orderForBatchMove(bookmarks) {
  return [...(bookmarks || [])].sort((a, b) => {
    const pa = String(a?.parentId || '');
    const pb = String(b?.parentId || '');
    if (pa !== pb) return pa.localeCompare(pb);
    const ia = Number.isInteger(a?.index) ? a.index : 0;
    const ib = Number.isInteger(b?.index) ? b.index : 0;
    return ia - ib;
  });
}

/**
 * Plans a sequence of `chrome.bookmarks.move()` operations for a
 * multi-selection drag, returning [{ id, parentId, index }] entries in
 * the order they must be executed for the relative ordering of the
 * dragged batch to be preserved at the destination.
 *
 * Why this exists
 * ───────────────
 * Naively computing one destination per source and incrementing the
 * index for each subsequent item only works when sources are NOT
 * present in the destination folder — i.e. cross-folder moves. For
 * within-folder moves the indices shift as soon as the first item
 * leaves its position, and a naive plan lands subsequent items at
 * stale slots. The fix is to simulate the moves one at a time on a
 * model of the target folder's index space, updating after each step.
 *
 * Algorithm
 * ─────────
 * 1. Build a "shadow" array of bookmark ids representing the current
 *    state of the destination folder (just the ids in order — that's
 *    all we need to compute correct insertion indices).
 * 2. For each source in turn:
 *      a. Determine where the bookmark logically lands relative to the
 *         current target's id position in the shadow array.
 *      b. Remove the source from its old position in the shadow array,
 *         if it was a same-folder move.
 *      c. Insert the source at the new position. Record the index that
 *         Chrome's API needs (i.e. the post-removal-aware index).
 *      d. The next iteration sees the updated shadow.
 *
 * Inputs
 * ──────
 * - sources:       Array of bookmark objects { id, parentId, index } in
 *                  the order the user wants them placed.
 * - target:        Bookmark object being dropped onto.
 * - position:      'before' or 'after'.
 * - allBookmarks:  All bookmarks in the library, used to derive the
 *                  shadow of the destination folder.
 *
 * Returns
 * ───────
 * An array of move operations [{ id, parentId, index }]. Empty array
 * when the move is a no-op (e.g. every source already in the target slot).
 *
 * The same off-by-one rule Chrome applies (when moving within a parent,
 * the requested index is interpreted as "after removal") is honoured
 * for every same-folder step — meaning callers can pass the returned
 * { parentId, index } pair straight to chrome.bookmarks.move() without
 * any further compensation.
 */
export function planBatchMove(sources, target, position, allBookmarks) {
  if (!Array.isArray(sources) || !sources.length) return [];
  if (!target || sources.some((s) => s?.id === target.id)) return [];

  const targetParent = String(target.parentId || '');
  const targetId = target.id;

  // Build the shadow array: bookmark ids in the destination folder,
  // ordered by current index. This is the world the moves operate in.
  // We include the sources that are in the destination folder, because
  // we'll remove each one from the shadow as we move it.
  const shadow = (allBookmarks || [])
    .filter((b) => String(b?.parentId || '') === targetParent)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((b) => b.id);

  const ops = [];
  // After the first source lands, subsequent sources must land
  // immediately after it so the batch stays contiguous and in user-
  // selected order. We track the last id inserted; the next source
  // anchors to "after lastInsertedId" rather than re-evaluating
  // against the original target. Without this, two sources both
  // requesting "after target" race to the same slot and end up in
  // reverse order.
  let lastInsertedId = null;

  for (const source of sources) {
    const sourceParent = String(source?.parentId || '');
    const sameFolder = sourceParent === targetParent;

    // Pick the anchor for this source's insertion:
    //   - the first source anchors to the user's chosen target
    //   - subsequent sources anchor to the previously-inserted source
    //     so the batch stays a contiguous, ordered group at the drop
    //     point
    const anchorId = lastInsertedId ?? targetId;
    const anchorPos = shadow.indexOf(anchorId);
    if (anchorPos < 0) {
      // Should never happen; fail safe by skipping.
      continue;
    }

    // Logical insertion index in the shadow (BEFORE same-folder
    // removal). 'before' targets the anchor's slot; 'after' targets
    // anchor+1. Once we've inserted the first source, the anchor is
    // that source — subsequent sources should always land *after* it
    // regardless of the original position argument, otherwise we'd
    // re-insert ahead of it and reverse the batch order.
    const effectivePosition = lastInsertedId === null ? position : DROP_POSITION.AFTER;
    let insertAt = effectivePosition === DROP_POSITION.BEFORE ? anchorPos : anchorPos + 1;

    // Same-folder: remove the source from its current position first.
    // This mirrors Chrome's "after removal" index semantics.
    if (sameFolder) {
      const sourcePos = shadow.indexOf(source.id);
      if (sourcePos >= 0) {
        // Detect no-op: dropping at the source's own slot, or the slot
        // immediately after it (which after removal lands back at the
        // same spot). Skip without recording an op or mutating the
        // shadow — but DO advance lastInsertedId so subsequent sources
        // still anchor to this position in the user's mental model.
        if (insertAt === sourcePos || insertAt === sourcePos + 1) {
          lastInsertedId = source.id;
          continue;
        }
        shadow.splice(sourcePos, 1);
        // Adjust insertion target if the removal shifted things to its
        // left. (sourcePos < insertAt → everything past sourcePos slides
        // down by one, including our intended insertion point.)
        if (sourcePos < insertAt) insertAt -= 1;
      }
    }

    // Clamp into valid range. shadow.length is the "append" position.
    if (insertAt < 0) insertAt = 0;
    if (insertAt > shadow.length) insertAt = shadow.length;

    // Insert into the shadow so subsequent sources see the new state.
    shadow.splice(insertAt, 0, source.id);
    lastInsertedId = source.id;

    ops.push({
      id: source.id,
      parentId: targetParent,
      index: insertAt
    });
  }

  return ops;
}
