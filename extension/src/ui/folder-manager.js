/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 *
 * folder-manager.js
 *
 * Modal that lists every bookmark folder as a tree and offers New subfolder,
 * Rename, Move and Delete on each row. The dialog changes nothing itself: the
 * four actions come in through `actions` and may throw an error with a `code`
 * (shown through `errorMessage`). Folder titles are set as text only.
 */

import { createIconButton, createIconElement } from './icon-system.js';
import { trapFocus } from './ui-utils.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * - loadFolders(): async, folder-service.listFolders output.
 * - actions.create(parentId, title), actions.rename(id, title),
 *   actions.move(id) and actions.remove(id): async. move and remove ask the
 *   user themselves (picker, confirmation) and resolve false when cancelled.
 * - deleteBlockedReason(folder): '' or the reason a folder cannot be deleted.
 * - isProtected(folder) is read from folder.protected.
 * Resolves when the dialog is closed.
 */
export function openFolderManager({ labels, loadFolders, actions, deleteBlockedReason, errorMessage }) {
  return new Promise((resolve) => {
    let folders = [];
    let query = '';
    let editingId = null;
    let addingUnder = null;
    let busy = false;
    let finished = false;

    const previousFocus = document.activeElement;
    const overlay = el('div', 'modal-overlay folder-picker-overlay folder-manager-overlay');
    const modal = el('div', 'modal-card folder-picker folder-manager');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', labels.title);

    const head = el('div', 'folder-picker-head');
    const close = createIconButton('close', labels.close, 'icon-button mono-icon-button modal-close');
    head.append(el('div', 'folder-picker-title', labels.title), close);

    const toolbar = el('div', 'folder-manager-toolbar');
    const search = el('input', 'input folder-picker-search');
    search.type = 'search';
    search.placeholder = labels.search;
    search.setAttribute('aria-label', labels.search);
    search.autocomplete = 'off';
    const addTop = el('button', 'ghost-button', labels.newFolder);
    addTop.type = 'button';
    toolbar.append(search, addTop);

    const list = el('div', 'folder-picker-list folder-manager-list');
    const status = el('div', 'folder-picker-status');
    status.setAttribute('role', 'alert');
    const note = el('div', 'folder-picker-description', labels.note);

    modal.append(head, toolbar, list, status, note);
    overlay.append(modal);

    function setStatus(message) { status.textContent = message || ''; }

    function inputRow(depth, placeholder, initial, onSubmit, onCancel) {
      const row = el('div', 'folder-picker-row folder-manager-edit');
      row.style.paddingInlineStart = `${8 + depth * 16}px`;
      row.append(createIconElement('folder'));
      const input = el('input', 'input folder-manager-input');
      input.type = 'text';
      input.maxLength = 200;
      input.value = initial;
      input.placeholder = placeholder;
      input.setAttribute('aria-label', placeholder);
      input.autocomplete = 'off';
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); onSubmit(input.value); }
        else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel(); }
      });
      const ok = createIconButton('check', labels.save, 'icon-button mono-icon-button');
      ok.addEventListener('click', () => onSubmit(input.value));
      const no = createIconButton('close', labels.cancel, 'icon-button mono-icon-button');
      no.addEventListener('click', onCancel);
      row.append(input, ok, no);
      queueMicrotask(() => { input.focus(); input.select(); });
      return row;
    }

    function actionButton(kind, label, handler, disabledReason = '') {
      const button = createIconButton(kind, disabledReason ? `${label}: ${disabledReason}` : label, 'icon-button mono-icon-button folder-manager-action');
      if (disabledReason) button.disabled = true;
      else button.addEventListener('click', handler);
      return button;
    }

    async function run(task, { reload = true } = {}) {
      if (busy) return;
      busy = true;
      setStatus('');
      try {
        await task();
        if (reload) folders = await loadFolders();
      } catch (error) {
        setStatus(errorMessage(error));
      } finally {
        busy = false;
        render();
      }
    }

    function render() {
      list.textContent = '';
      const needle = query.trim().toLocaleLowerCase();
      const rows = needle ? folders.filter((folder) => folder.path.toLocaleLowerCase().includes(needle)) : folders;
      if (!rows.length) list.append(el('div', 'folder-picker-empty', labels.noFolders));
      for (const folder of rows) {
        const depth = needle ? 0 : folder.depth;
        if (editingId === folder.id) {
          list.append(inputRow(depth, labels.rename, folder.title, (value) => submitRename(folder, value), () => { editingId = null; render(); }));
        } else {
          const row = el('div', 'folder-picker-row folder-manager-row');
          row.style.paddingInlineStart = `${8 + depth * 16}px`;
          row.append(createIconElement('folder'));
          const name = el('span', 'folder-picker-name', needle ? folder.path : (folder.title || labels.untitled));
          name.dir = 'auto';
          name.title = folder.path;
          row.append(name, el('span', 'folder-picker-count', String(folder.childCount)));
          const tools = el('span', 'folder-manager-tools');
          const blocked = folder.protected ? labels.protectedFolder : '';
          if (folder.writable) tools.append(actionButton('folderPlus', labels.newSubfolder, () => { addingUnder = folder.id; editingId = null; render(); }));
          tools.append(
            actionButton('edit', labels.rename, () => { editingId = folder.id; addingUnder = null; render(); }, blocked),
            actionButton('folderInput', labels.move, () => run(() => actions.move(folder.id)), blocked),
            actionButton('trash', labels.remove, () => run(() => actions.remove(folder.id)), blocked || deleteBlockedReason(folder))
          );
          row.append(tools);
          list.append(row);
        }
        if (addingUnder === folder.id) {
          list.append(inputRow(depth + 1, labels.newFolderName, '', (value) => submitCreate(folder.id, value), () => { addingUnder = null; render(); }));
        }
      }
    }

    function submitCreate(parentId, value) {
      return run(async () => { await actions.create(parentId, value); addingUnder = null; });
    }

    function submitRename(folder, value) {
      return run(async () => { await actions.rename(folder.id, value); editingId = null; });
    }

    function finish() {
      if (finished) return;
      finished = true;
      releaseTrap();
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
      resolve();
    }

    function onKey(event) {
      if (!overlay.isConnected || event.key !== 'Escape') return;
      if (editingId !== null || addingUnder !== null) return;
      const overlays = document.querySelectorAll('.folder-picker-overlay');
      if (overlays[overlays.length - 1] !== overlay) return;
      event.preventDefault();
      event.stopPropagation();
      finish();
    }

    search.addEventListener('input', () => { query = search.value; render(); });
    addTop.addEventListener('click', () => {
      const root = folders.find((folder) => folder.writable && folder.protected);
      if (!root) return;
      query = '';
      search.value = '';
      addingUnder = root.id;
      editingId = null;
      render();
    });
    close.addEventListener('click', finish);
    overlay.addEventListener('mousedown', (event) => { if (event.target === overlay) finish(); });

    document.body.append(overlay);
    const releaseTrap = trapFocus(modal);
    document.addEventListener('keydown', onKey, true);

    loadFolders().then((loaded) => { folders = loaded; render(); search.focus({ preventScroll: true }); })
      .catch((error) => setStatus(errorMessage(error)));
  });
}
