/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 *
 * folder-tools.js
 *
 * Dashboard handlers for folder management and "Move to folder". The rules
 * live in src/services/folder-service.js; the dialogs in src/ui/folder-picker.js
 * and src/ui/folder-manager.js. This module reads a fresh tree before every
 * write, reports applied and failed moves separately and offers Undo.
 */

import {
  FOLDER_ERRORS, indexTree, listFolders, planMoveToFolder, planDeleteFolder, executeMoves, undoMoves,
  createFolder, renameFolder, deleteEmptyFolder, restoreFolder
} from '../services/folder-service.js';
import { featureText as l } from '../locales/feature-messages.js';

const ERROR_TEXT = {
  [FOLDER_ERRORS.EMPTY_TITLE]: 'Enter a folder name.',
  [FOLDER_ERRORS.TITLE_TOO_LONG]: 'The name is too long (200 characters at most).',
  [FOLDER_ERRORS.DUPLICATE_NAME]: 'A folder with this name already exists here.',
  [FOLDER_ERRORS.NOT_FOUND]: 'The folder no longer exists. Reopen this dialog.',
  [FOLDER_ERRORS.NOT_A_FOLDER]: 'This item is not a folder.',
  [FOLDER_ERRORS.PROTECTED]: 'The browser protects this folder.',
  [FOLDER_ERRORS.INTO_SELF]: 'A folder cannot be moved into itself.',
  [FOLDER_ERRORS.INTO_DESCENDANT]: 'A folder cannot be moved into its own subfolder.',
  [FOLDER_ERRORS.NOT_EMPTY]: 'Only empty folders can be deleted.'
};

export function createFolderTools(deps) {
  const {
    t, formatNumber, setToast, refreshData, pushCleanupHistory, invalidateBookmarkCache,
    showConfirmDialog, openFolderPicker, openFolderManager, api
  } = deps;

  async function readNodes() {
    return indexTree(await api.getBookmarkTree());
  }

  function errorText(error) {
    const known = error?.code && ERROR_TEXT[error.code];
    return known ? l(known) : (error?.message || l('Something went wrong.'));
  }

  async function refreshAfterMutation() {
    invalidateBookmarkCache();
    await refreshData();
  }

  function pickerLabels(title, description) {
    return {
      title,
      description,
      search: l('Search folders'),
      confirm: l('Move here'),
      cancel: l('Cancel'),
      newFolder: l('New folder'),
      newFolderName: l('New folder name'),
      untitled: l('Untitled folder'),
      noFolders: l('No folders found'),
      chooseParent: l('Choose where to create the folder first.'),
      created: l('Folder created.')
    };
  }

  /**
   * Asks for a destination folder and moves the given bookmark or folder ids
   * into it. Returns true when at least one item moved.
   */
  async function moveItemsToFolder(ids, { title, description }) {
    const sourceIds = [...new Set(ids)];
    if (!sourceIds.length) return false;
    let current = await readNodes();
    const destinationId = await openFolderPicker({
      labels: pickerLabels(title, description),
      async loadFolders() {
        current = await readNodes();
        return listFolders(current);
      },
      isDisabled(folder) {
        const plan = planMoveToFolder(current, sourceIds, folder.id);
        return plan.ok ? '' : l(ERROR_TEXT[plan.error]);
      },
      async onCreate(parentId, name) {
        const created = await createFolder(api, await readNodes(), parentId, name);
        invalidateBookmarkCache();
        return created.id;
      },
      errorMessage: errorText
    });
    if (!destinationId) return false;
    return moveIdsIntoFolder(sourceIds, destinationId);
  }

  /** Moves the ids into a known folder (picker result or drop on a folder group). */
  async function moveIdsIntoFolder(sourceIds, destinationId) {
    const nodes = await readNodes();
    const plan = planMoveToFolder(nodes, sourceIds, destinationId);
    if (!plan.ok) { setToast(errorText({ code: plan.error }), { error: true }); return false; }
    if (!plan.moves.length) { setToast(l('Nothing to move: already in this folder.')); return false; }

    invalidateBookmarkCache();
    const result = await executeMoves(api, nodes, plan.moves, destinationId);
    if (!result.applied.length) {
      setToast(l('Could not move the selected items.'), { error: true });
      return false;
    }
    const folderTitle = nodes.get(destinationId)?.title || l('Untitled folder');
    let applied = result.applied;
    let undoBusy = false;
    const undo = async () => {
      if (undoBusy || !applied.length) return;
      undoBusy = true;
      try {
        const outcome = await undoMoves(api, readNodes, applied);
        applied = outcome.remaining;
        await refreshAfterMutation();
        setToast(applied.length ? t('Could not undo the move.') : t('Move undone.'), {
          error: applied.length > 0, persist: applied.length > 0,
          actionLabel: applied.length ? t('Undo') : '', action: applied.length ? undo : null
        });
      } finally { undoBusy = false; }
    };
    await refreshAfterMutation();
    const failed = result.failed.length;
    setToast(failed
      ? t('Moved: {{count}}. Failed / not attempted: {{failed}}.', { count: formatNumber(result.applied.length), failed: formatNumber(failed) })
      : l('Moved {{count}} to {{folder}}.', { count: formatNumber(result.applied.length), folder: folderTitle }), {
      error: failed > 0, actionLabel: t('Undo'), action: undo, persist: true
    });
    await pushCleanupHistory({ type: 'move-to-folder', count: result.applied.length, note: `Moved: ${result.applied.length}; failed: ${failed}` });
    return true;
  }

  function moveBookmarksToFolder(bookmarks) {
    const list = (bookmarks || []).filter(Boolean);
    if (!list.length) return false;
    return moveItemsToFolder(list.map((bookmark) => bookmark.id), {
      title: l('Move to folder'),
      description: list.length === 1 ? (list[0].title || list[0].url || '') : l('{{count}} items selected', { count: formatNumber(list.length) })
    });
  }

  async function deleteFolder(id) {
    const nodes = await readNodes();
    const plan = planDeleteFolder(nodes, id);
    if (!plan.ok) throw Object.assign(new Error(plan.error), { code: plan.error });
    const confirmed = await showConfirmDialog({
      title: l('Delete folder?'),
      message: l('Delete the empty folder "{{title}}"?', { title: plan.title || l('Untitled folder') }),
      confirmLabel: t('Delete'),
      cancelLabel: t('Keep it'),
      danger: true
    });
    if (!confirmed) return false;
    const snapshot = await deleteEmptyFolder(api, await readNodes(), id);
    invalidateBookmarkCache();
    let restored = false;
    setToast(l('Folder deleted: {{title}}', { title: snapshot.title }), {
      actionLabel: t('Undo'), persist: true,
      async action() {
        if (restored) return;
        restored = true;
        try {
          await restoreFolder(api, snapshot);
          setToast(l('Folder restored.'));
        } catch (error) {
          restored = false;
          setToast(errorText(error), { error: true });
        }
      }
    });
    await pushCleanupHistory({ type: 'delete-folder', count: 1, note: 'Deleted an empty folder' });
    return true;
  }

  function managerLabels() {
    return {
      title: l('Manage folders'),
      close: l('Close'),
      search: l('Search folders'),
      newFolder: l('New folder'),
      newSubfolder: l('New subfolder'),
      newFolderName: l('New folder name'),
      rename: l('Rename'),
      move: l('Move to folder'),
      remove: t('Delete'),
      save: l('Save'),
      cancel: l('Cancel'),
      untitled: l('Untitled folder'),
      noFolders: l('No folders found'),
      protectedFolder: l('Protected by the browser'),
      note: l('Only empty folders can be deleted. Moving or renaming a folder keeps everything inside it.')
    };
  }

  function openFolders() {
    return openFolderManager({
      labels: managerLabels(),
      async loadFolders() { return listFolders(await readNodes()); },
      deleteBlockedReason: (folder) => (folder.childCount ? l('Only empty folders can be deleted.') : ''),
      errorMessage: errorText,
      actions: {
        async create(parentId, name) {
          const created = await createFolder(api, await readNodes(), parentId, name);
          invalidateBookmarkCache();
          setToast(l('Folder created: {{title}}', { title: created.title }));
        },
        async rename(id, name) {
          await renameFolder(api, await readNodes(), id, name);
          await refreshAfterMutation();
        },
        async move(id) {
          const node = (await readNodes()).get(id);
          return moveItemsToFolder([id], { title: l('Move folder'), description: node?.path || node?.title || '' });
        },
        remove: deleteFolder
      }
    });
  }

  return { moveBookmarksToFolder, moveItemsToFolder, moveIdsIntoFolder, openFolders, deleteFolder, errorText };
}
