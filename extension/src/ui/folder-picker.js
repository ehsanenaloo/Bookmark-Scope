/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 *
 * folder-picker.js
 *
 * Modal that asks for one bookmark folder: a tree with search, keyboard
 * control and an inline "new folder" field. It owns its own overlay on
 * document.body, so a page re-render does not remove it. All text comes in
 * through `labels`; folder titles are set as text nodes only.
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
 * Opens the picker and resolves with the chosen folder id, or null when the
 * dialog is cancelled.
 *
 * - loadFolders(): async, returns the folder list of folder-service.listFolders.
 * - isDisabled(folder): returns a reason string for a folder that cannot be
 *   chosen (shown as a tooltip), or '' when it can.
 * - onCreate(parentId, title): async, creates a folder and returns its id.
 *   It throws an error with a `code` when the title is refused.
 * - errorMessage(error): turns that error into text for the user.
 */
export function openFolderPicker(options) {
  const {
    labels, loadFolders, isDisabled = () => '', onCreate = null, errorMessage = (error) => error?.message || '',
    initialId = null
  } = options;

  return new Promise((resolve) => {
    let folders = [];
    let selectedId = initialId;
    let query = '';
    let busy = false;
    let finished = false;

    const previousFocus = document.activeElement;
    const overlay = el('div', 'modal-overlay folder-picker-overlay');
    const modal = el('div', 'modal-card folder-picker');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', labels.title);

    const head = el('div', 'folder-picker-head');
    const titleNode = el('div', 'folder-picker-title', labels.title);
    const close = createIconButton('close', labels.cancel, 'icon-button mono-icon-button modal-close');
    head.append(titleNode, close);

    const description = labels.description ? el('div', 'folder-picker-description', labels.description) : null;

    const search = el('input', 'input folder-picker-search');
    search.type = 'search';
    search.placeholder = labels.search;
    search.setAttribute('aria-label', labels.search);
    search.autocomplete = 'off';

    const list = el('div', 'folder-picker-list');
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', labels.title);

    const status = el('div', 'folder-picker-status');
    status.setAttribute('role', 'alert');

    const createRow = el('div', 'folder-picker-create');
    const createInput = el('input', 'input folder-picker-create-input');
    createInput.type = 'text';
    createInput.maxLength = 200;
    createInput.placeholder = labels.newFolderName;
    createInput.setAttribute('aria-label', labels.newFolderName);
    createInput.autocomplete = 'off';
    const createButton = el('button', 'ghost-button folder-picker-create-button', labels.newFolder);
    createButton.type = 'button';
    createRow.append(createInput, createButton);

    const actions = el('div', 'folder-picker-actions');
    const cancel = el('button', 'ghost-button', labels.cancel);
    cancel.type = 'button';
    const confirm = el('button', 'primary-button', labels.confirm);
    confirm.type = 'button';
    actions.append(cancel, confirm);

    modal.append(head);
    if (description) modal.append(description);
    modal.append(search, list, status);
    if (onCreate) modal.append(createRow);
    modal.append(actions);
    overlay.append(modal);

    function visibleFolders() {
      const needle = query.trim().toLocaleLowerCase();
      if (!needle) return folders;
      return folders.filter((folder) => folder.path.toLocaleLowerCase().includes(needle));
    }

    function setStatus(message) {
      status.textContent = message || '';
    }

    function renderList() {
      const rows = visibleFolders();
      list.textContent = '';
      if (!rows.length) {
        list.append(el('div', 'folder-picker-empty', labels.noFolders));
      }
      const searching = Boolean(query.trim());
      for (const folder of rows) {
        const reason = isDisabled(folder);
        const row = el('div', 'folder-picker-row');
        row.setAttribute('role', 'option');
        row.dataset.id = folder.id;
        row.id = `folder-picker-${folder.id}`;
        row.setAttribute('aria-selected', folder.id === selectedId ? 'true' : 'false');
        if (reason) {
          row.setAttribute('aria-disabled', 'true');
          row.classList.add('disabled');
          row.title = reason;
        }
        if (folder.id === selectedId) row.classList.add('selected');
        row.style.paddingInlineStart = `${8 + (searching ? 0 : folder.depth) * 16}px`;
        row.append(createIconElement('folder'));
        const name = el('span', 'folder-picker-name', searching ? folder.path : (folder.title || labels.untitled));
        name.dir = 'auto';
        row.append(name);
        const count = el('span', 'folder-picker-count', String(folder.childCount));
        row.append(count);
        if (!reason) {
          row.addEventListener('click', () => select(folder.id));
          row.addEventListener('dblclick', () => { select(folder.id); submit(); });
        }
        list.append(row);
      }
      const active = selectedId ? list.querySelector(`[data-id="${CSS.escape(selectedId)}"]`) : null;
      if (active) list.setAttribute('aria-activedescendant', active.id);
      else list.removeAttribute('aria-activedescendant');
      confirm.disabled = !active || busy;
    }

    function select(id, { scroll = false } = {}) {
      selectedId = id;
      for (const row of list.children) {
        const on = row.dataset?.id === id;
        row.classList.toggle('selected', on);
        row.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on && scroll) row.scrollIntoView({ block: 'nearest' });
      }
      const active = list.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (active) list.setAttribute('aria-activedescendant', active.id);
      confirm.disabled = !active || busy;
      setStatus('');
    }

    function moveSelection(step) {
      const enabled = visibleFolders().filter((folder) => !isDisabled(folder));
      if (!enabled.length) return;
      const at = enabled.findIndex((folder) => folder.id === selectedId);
      const next = at === -1 ? (step > 0 ? 0 : enabled.length - 1) : Math.max(0, Math.min(enabled.length - 1, at + step));
      select(enabled[next].id, { scroll: true });
    }

    function finish(value) {
      if (finished) return;
      finished = true;
      releaseTrap();
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus({ preventScroll: true });
      resolve(value);
    }

    function submit() {
      if (busy || !selectedId) return;
      if (list.querySelector(`[data-id="${CSS.escape(selectedId)}"]`) === null) return;
      finish(selectedId);
    }

    async function reload(preferId) {
      folders = await loadFolders();
      if (preferId) selectedId = preferId;
      if (selectedId && !folders.some((folder) => folder.id === selectedId && !isDisabled(folder))) selectedId = null;
      renderList();
    }

    async function create() {
      if (!onCreate || busy) return;
      const parentId = selectedId;
      if (!parentId) { setStatus(labels.chooseParent); return; }
      busy = true;
      createButton.disabled = true;
      confirm.disabled = true;
      try {
        const createdId = await onCreate(parentId, createInput.value);
        createInput.value = '';
        query = '';
        search.value = '';
        busy = false;
        await reload(createdId);
        select(createdId, { scroll: true });
        setStatus(labels.created);
      } catch (error) {
        busy = false;
        setStatus(errorMessage(error));
      } finally {
        busy = false;
        createButton.disabled = false;
        confirm.disabled = !selectedId;
      }
    }

    function onKey(event) {
      if (!overlay.isConnected) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); finish(null); return; }
      if (event.target === createInput) {
        if (event.key === 'Enter') { event.preventDefault(); create(); }
        return;
      }
      if (event.key === 'ArrowDown') { event.preventDefault(); moveSelection(1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); moveSelection(-1); }
      else if (event.key === 'Enter' && event.target !== cancel && event.target !== close && event.target !== createButton) {
        event.preventDefault();
        submit();
      }
    }

    search.addEventListener('input', () => { query = search.value; renderList(); });
    createButton.addEventListener('click', create);
    confirm.addEventListener('click', submit);
    cancel.addEventListener('click', () => finish(null));
    close.addEventListener('click', () => finish(null));
    overlay.addEventListener('mousedown', (event) => { if (event.target === overlay) finish(null); });

    document.body.append(overlay);
    const releaseTrap = trapFocus(modal);
    document.addEventListener('keydown', onKey, true);

    confirm.disabled = true;
    loadFolders().then((loaded) => {
      folders = loaded;
      if (selectedId && !folders.some((folder) => folder.id === selectedId && !isDisabled(folder))) selectedId = null;
      renderList();
      const active = selectedId ? list.querySelector(`[data-id="${CSS.escape(selectedId)}"]`) : null;
      if (active) active.scrollIntoView({ block: 'nearest' });
      search.focus({ preventScroll: true });
    }).catch((error) => {
      setStatus(errorMessage(error));
    });
  });
}
