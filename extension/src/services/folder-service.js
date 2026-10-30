/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 *
 * folder-service.js
 *
 * Folder and move operations on the browser bookmark tree. Planning and
 * validation are pure functions over a flat node map; the execute functions
 * take the browser API wrappers as an argument so they can be tested without
 * a browser. Every move must go through api.moveBookmark (see
 * src/platform/browser-api.js for the index rules).
 */

export const FOLDER_TITLE_MAX_LENGTH = 200;

export const FOLDER_ERRORS = Object.freeze({
  EMPTY_TITLE: 'empty-title',
  TITLE_TOO_LONG: 'title-too-long',
  DUPLICATE_NAME: 'duplicate-name',
  NOT_FOUND: 'not-found',
  NOT_A_FOLDER: 'not-a-folder',
  PROTECTED: 'protected',
  INTO_SELF: 'into-self',
  INTO_DESCENDANT: 'into-descendant',
  NOT_EMPTY: 'not-empty'
});

/**
 * Flattens the browser tree into a map keyed by id. `order` is the
 * pre-order position, `path` is the folder path with the titles joined by
 * " / " (the invisible tree root is not part of the path), and `rootFolder`
 * is true for the browser's own top-level folders (Bookmarks bar, Other
 * bookmarks, ...), which cannot be renamed, deleted or moved.
 */
export function indexTree(tree) {
  const nodes = new Map();
  let order = 0;
  function visit(node, parentId, parentPath, depth, index, isTreeRoot) {
    const isFolder = !node.url && node.type !== 'separator';
    const own = isTreeRoot ? '' : (node.title || '');
    const path = isTreeRoot ? '' : (parentPath ? `${parentPath} / ${own}` : own);
    const entry = {
      id: node.id,
      parentId: isTreeRoot ? null : parentId,
      title: node.title || '',
      url: node.url || null,
      type: node.type || null,
      index: Number.isInteger(node.index) ? node.index : index,
      depth,
      order: order++,
      path,
      isFolder,
      treeRoot: isTreeRoot,
      rootFolder: !isTreeRoot && parentId !== null && nodes.get(parentId)?.treeRoot === true,
      unmodifiable: Boolean(node.unmodifiable),
      children: (node.children || []).map((child) => child.id)
    };
    nodes.set(node.id, entry);
    (node.children || []).forEach((child, childIndex) => visit(child, node.id, path, isTreeRoot ? 0 : depth + 1, childIndex, false));
  }
  const roots = Array.isArray(tree) ? tree : [tree];
  roots.forEach((node, index) => visit(node, null, '', 0, index, true));
  return nodes;
}

function isProtected(node) {
  return !node || node.treeRoot || node.rootFolder || node.unmodifiable;
}

/** Folders in tree order, ready for a picker. The invisible root is left out. */
export function listFolders(nodes) {
  return [...nodes.values()]
    .filter((node) => node.isFolder && !node.treeRoot)
    .sort((a, b) => a.order - b.order)
    .map((node) => ({
      id: node.id,
      title: node.title,
      parentId: node.parentId,
      depth: node.depth,
      path: node.path,
      childCount: node.children.length,
      folderCount: node.children.filter((id) => nodes.get(id)?.isFolder).length,
      protected: isProtected(node),
      writable: !node.unmodifiable
    }));
}

export function isDescendantOrSelf(nodes, candidateId, ancestorId) {
  let cursor = nodes.get(candidateId);
  const seen = new Set();
  while (cursor && !seen.has(cursor.id)) {
    if (cursor.id === ancestorId) return true;
    seen.add(cursor.id);
    cursor = cursor.parentId ? nodes.get(cursor.parentId) : null;
  }
  return false;
}

/**
 * Checks a move of `sourceIds` into the folder `destId`.
 * Returns { ok, error, moves, skipped } where `moves` are the sources that
 * really change parent, in tree order, and `skipped` lists sources that are
 * already in the destination. A hard error (`ok: false`) means nothing may
 * be moved.
 */
export function planMoveToFolder(nodes, sourceIds, destId) {
  const dest = nodes.get(destId);
  if (!dest) return { ok: false, error: FOLDER_ERRORS.NOT_FOUND, moves: [], skipped: [] };
  if (!dest.isFolder || dest.treeRoot) return { ok: false, error: FOLDER_ERRORS.NOT_A_FOLDER, moves: [], skipped: [] };
  if (dest.unmodifiable) return { ok: false, error: FOLDER_ERRORS.PROTECTED, moves: [], skipped: [] };

  const unique = [...new Set(sourceIds)];
  const sources = [];
  for (const id of unique) {
    const node = nodes.get(id);
    if (!node) return { ok: false, error: FOLDER_ERRORS.NOT_FOUND, moves: [], skipped: [] };
    if (isProtected(node)) return { ok: false, error: FOLDER_ERRORS.PROTECTED, moves: [], skipped: [] };
    if (node.type === 'separator') return { ok: false, error: FOLDER_ERRORS.NOT_FOUND, moves: [], skipped: [] };
    if (node.id === destId) return { ok: false, error: FOLDER_ERRORS.INTO_SELF, moves: [], skipped: [] };
    if (node.isFolder && isDescendantOrSelf(nodes, destId, node.id)) {
      return { ok: false, error: FOLDER_ERRORS.INTO_DESCENDANT, moves: [], skipped: [] };
    }
    sources.push(node);
  }
  sources.sort((a, b) => a.order - b.order);
  const moves = [];
  const skipped = [];
  for (const node of sources) (node.parentId === destId ? skipped : moves).push(node.id);
  return { ok: true, error: null, moves, skipped };
}

/**
 * Applies a move plan one node at a time, appending each node at the end of
 * the destination. A failed move does not stop the others; the result lists
 * the applied moves (with the position they came from, for Undo) and the
 * failed ones separately. There is no rollback.
 */
export async function executeMoves(api, nodes, moveIds, destId) {
  const applied = [];
  const failed = [];
  for (const id of moveIds) {
    const before = nodes.get(id);
    try {
      await api.moveBookmark(id, { parentId: destId });
      applied.push({ id, fromParentId: before.parentId, fromIndex: before.index });
    } catch (error) {
      failed.push({ id, error: error?.message || String(error) });
    }
  }
  return { applied, failed };
}

/**
 * Puts applied moves back where they came from. Items return in ascending
 * order of their old position so earlier slots are refilled first. If the
 * old folder changed in the meantime an item returns to the closest slot
 * (clamped to the end). Moves that fail stay in `remaining` for a retry.
 */
export async function undoMoves(api, readNodes, applied) {
  const remaining = [];
  const ordered = [...applied].sort((a, b) => String(a.fromParentId).localeCompare(String(b.fromParentId)) || a.fromIndex - b.fromIndex);
  for (const entry of ordered) {
    try {
      const nodes = await readNodes();
      const current = nodes.get(entry.id);
      const parent = nodes.get(entry.fromParentId);
      if (!current || !parent || !parent.isFolder) throw new Error('Original folder is gone.');
      const siblings = parent.children.filter((id) => id !== entry.id).length;
      await api.moveBookmark(entry.id, { parentId: entry.fromParentId, index: Math.min(entry.fromIndex, siblings) });
    } catch (error) {
      remaining.push(entry);
    }
  }
  return { remaining };
}

export function normalizeFolderTitle(raw) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim();
}

function validateTitle(nodes, parentId, rawTitle, ignoreId = null) {
  const title = normalizeFolderTitle(rawTitle);
  if (!title) return { error: FOLDER_ERRORS.EMPTY_TITLE };
  if (title.length > FOLDER_TITLE_MAX_LENGTH) return { error: FOLDER_ERRORS.TITLE_TOO_LONG };
  const parent = nodes.get(parentId);
  const lower = title.toLocaleLowerCase();
  const clash = (parent?.children || []).some((id) => {
    const sibling = nodes.get(id);
    return sibling && sibling.isFolder && sibling.id !== ignoreId && sibling.title.toLocaleLowerCase() === lower;
  });
  if (clash) return { error: FOLDER_ERRORS.DUPLICATE_NAME };
  return { title };
}

/** Checks a new folder. Returns { ok, error, title } with the cleaned title. */
export function planCreateFolder(nodes, parentId, rawTitle) {
  const parent = nodes.get(parentId);
  if (!parent) return { ok: false, error: FOLDER_ERRORS.NOT_FOUND };
  if (!parent.isFolder || parent.treeRoot) return { ok: false, error: FOLDER_ERRORS.NOT_A_FOLDER };
  if (parent.unmodifiable) return { ok: false, error: FOLDER_ERRORS.PROTECTED };
  const checked = validateTitle(nodes, parentId, rawTitle);
  return checked.error ? { ok: false, error: checked.error } : { ok: true, error: null, title: checked.title };
}

export function planRenameFolder(nodes, id, rawTitle) {
  const node = nodes.get(id);
  if (!node) return { ok: false, error: FOLDER_ERRORS.NOT_FOUND };
  if (!node.isFolder) return { ok: false, error: FOLDER_ERRORS.NOT_A_FOLDER };
  if (isProtected(node)) return { ok: false, error: FOLDER_ERRORS.PROTECTED };
  const checked = validateTitle(nodes, node.parentId, rawTitle, id);
  return checked.error ? { ok: false, error: checked.error } : { ok: true, error: null, title: checked.title, unchanged: checked.title === node.title };
}

export function planDeleteFolder(nodes, id) {
  const node = nodes.get(id);
  if (!node) return { ok: false, error: FOLDER_ERRORS.NOT_FOUND };
  if (!node.isFolder) return { ok: false, error: FOLDER_ERRORS.NOT_A_FOLDER };
  if (isProtected(node)) return { ok: false, error: FOLDER_ERRORS.PROTECTED };
  if (node.children.length) return { ok: false, error: FOLDER_ERRORS.NOT_EMPTY };
  return { ok: true, error: null, parentId: node.parentId, index: node.index, title: node.title };
}

/** Creates the folder at the end of its parent. Throws if the plan is invalid. */
export async function createFolder(api, nodes, parentId, rawTitle) {
  const plan = planCreateFolder(nodes, parentId, rawTitle);
  if (!plan.ok) throw Object.assign(new Error(plan.error), { code: plan.error });
  return api.createBookmark({ parentId, title: plan.title });
}

export async function renameFolder(api, nodes, id, rawTitle) {
  const plan = planRenameFolder(nodes, id, rawTitle);
  if (!plan.ok) throw Object.assign(new Error(plan.error), { code: plan.error });
  if (plan.unchanged) return null;
  return api.updateBookmark(id, { title: plan.title });
}

/**
 * Removes an empty folder. The check runs on a fresh tree read by the
 * caller; the browser also refuses to remove a non-empty folder with
 * bookmarks.remove, which is the last safety net.
 */
export async function deleteEmptyFolder(api, nodes, id) {
  const plan = planDeleteFolder(nodes, id);
  if (!plan.ok) throw Object.assign(new Error(plan.error), { code: plan.error });
  await api.removeBookmark(id);
  return { parentId: plan.parentId, index: plan.index, title: plan.title };
}

/** Recreates a deleted empty folder at its old slot (new id). */
export async function restoreFolder(api, snapshot) {
  return api.createBookmark({ parentId: snapshot.parentId, index: snapshot.index, title: snapshot.title });
}
