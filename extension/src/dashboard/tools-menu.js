/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 *
 * tools-menu.js
 *
 * The dashboard "Tools" menu: every library command in five groups, with a
 * short hint and a live status on each row. It replaces the former Library
 * tools dialog and runs the same dashboard commands (the registry is the
 * single list, so the command palette and this menu cannot drift apart).
 * The menu owns a popover on document.body, so a page re-render does not
 * remove it. Text comes from the caller's `l`; nothing is set as HTML.
 */

import { createIconElement } from '../ui/icon-system.js';

/**
 * Menu layout. `command` is a registry name. `status(ctx)` returns
 * { text, blocked } where `blocked` is a hint that disables the row (the
 * hint replaces the usual one so the reason is always visible).
 */
export const TOOL_GROUPS = Object.freeze([
  { title: 'Organize', items: [
    { command: 'savedViews', icon: 'bookmarks', hint: 'Save a filter and open it again later' },
    { command: 'bulkTags', icon: 'tag', hint: 'Add, remove, rename or merge tags' },
    { command: 'duplicatePreview', icon: 'layers', hint: 'Choose which copy to keep',
      status: (ctx) => ({ text: ctx.duplicateGroups ? ctx.format('Groups: {{count}}', { count: ctx.duplicateGroups }) : ctx.format('None found', {}) }) },
    { command: 'deleteSelected', icon: 'trash', danger: true, hint: 'Delete the selected bookmarks',
      status: (ctx) => (ctx.selected ? { text: ctx.format('Selected: {{count}}', { count: ctx.selected }) } : { blocked: 'Select bookmarks first' }) }
  ] },
  { title: 'Folders', items: [
    { command: 'manageFolders', icon: 'folderPlus', hint: 'Create, rename, move and delete empty folders' },
    { command: 'moveSelected', icon: 'folderInput', hint: 'Move the selected bookmarks into a folder',
      status: (ctx) => (ctx.selected ? { text: ctx.format('Selected: {{count}}', { count: ctx.selected }) } : { blocked: 'Select bookmarks first' }) }
  ] },
  { title: 'Check links', items: [
    { command: 'resumableScan', icon: 'health', hint: 'Check many links and keep the progress',
      status: (ctx) => (ctx.scan ? { text: ctx.format('{{done}} of {{total}} checked', { done: ctx.scan.completed, total: ctx.scan.total }) } : {}) },
    { command: 'inspectVisible', icon: 'inspect', hint: 'Check the links in the list once',
      status: (ctx) => (ctx.visible ? { text: ctx.format('Links: {{count}}', { count: ctx.visible }) } : { blocked: 'The list is empty' }) },
    { command: 'repairRedirects', icon: 'repair', hint: 'Replace redirected addresses with the new ones',
      status: (ctx) => (ctx.redirected ? { text: ctx.format('Redirected: {{count}}', { count: ctx.redirected }) } : { blocked: 'No redirected links found' }) }
  ] },
  { title: 'Backup and import', items: [
    { command: 'snapshotExport', icon: 'download', hint: 'Save bookmarks, folders and tags to a file. The file holds your addresses and titles, so review it before sharing.' },
    { command: 'snapshotRestore', icon: 'upload', hint: 'Restore a saved snapshot into a new folder' },
    { command: 'importPreview', icon: 'import', hint: 'Add bookmarks from a file' },
    { command: 'exportCsv', icon: 'save', hint: 'Save the list as a spreadsheet file',
      status: (ctx) => (ctx.visible ? { text: ctx.format('Rows: {{count}}', { count: ctx.visible }) } : { blocked: 'The list is empty' }) }
  ] },
  { title: 'Troubleshoot', items: [
    { command: 'diagnosticExport', icon: 'info', hint: 'Save technical counts for a bug report' },
    { command: 'clearHealth', icon: 'trash', danger: true, hint: 'Forget saved link check results. Bookmarks stay.',
      status: (ctx) => (ctx.healthEntries ? { text: ctx.format('Saved: {{count}}', { count: ctx.healthEntries }) } : { blocked: 'Nothing saved' }) }
  ] }
]);

/**
 * Builds the rows for a context. Pure: used by the menu and by tests.
 * Commands missing from the registry are left out.
 */
export function buildToolRows(registryNames, ctx) {
  const available = new Set(registryNames);
  return TOOL_GROUPS.map((group) => ({
    title: group.title,
    items: group.items.filter((item) => available.has(item.command)).map((item) => {
      const status = item.status ? item.status(ctx) : {};
      return { command: item.command, icon: item.icon, danger: Boolean(item.danger), hint: item.hint, text: status.text || '', blocked: status.blocked || '' };
    })
  })).filter((group) => group.items.length);
}

export function createToolsMenu({ create, t, l, commands, getContext, setToast, formatNumber }) {
  let open = null;

  function format(template, values) {
    return l(template, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, formatNumber(value)])));
  }

  function close({ restoreFocus = true } = {}) {
    if (!open) return;
    const { popover, trigger, onKey, onDown } = open;
    open = null;
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('mousedown', onDown, true);
    popover.remove();
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }

  function position(popover, trigger) {
    const rect = trigger.getBoundingClientRect();
    const rtl = document.documentElement.dir === 'rtl';
    const width = Math.min(360, window.innerWidth - 16);
    popover.style.width = `${width}px`;
    const left = rtl ? rect.left : rect.right - width;
    popover.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, left))}px`;
    popover.style.top = `${rect.bottom + 6}px`;
    popover.style.maxHeight = `${Math.max(200, window.innerHeight - rect.bottom - 16)}px`;
  }

  async function run(name) {
    try {
      await commands().run(name);
    } catch (error) {
      setToast(error?.message || String(error), { error: true });
    }
  }

  async function toggle(trigger) {
    if (open) { close(); return; }
    const ctx = { ...(await getContext()), format };
    const groups = buildToolRows(commands().list().map((entry) => entry.name), ctx);
    const labels = new Map(commands().list().map((entry) => [entry.name, entry.label]));

    const popover = create('div', 'tools-menu');
    popover.setAttribute('role', 'menu');
    popover.setAttribute('aria-label', l('Tools'));
    for (const group of groups) {
      const section = create('div', 'tools-menu-group');
      section.setAttribute('role', 'group');
      const heading = create('div', 'tools-menu-heading', l(group.title));
      heading.id = `tools-menu-${group.title.replace(/\W+/g, '-').toLowerCase()}`;
      section.setAttribute('aria-labelledby', heading.id);
      section.append(heading);
      for (const item of group.items) {
        const label = labels.get(item.command);
        const row = create('button', `tools-menu-item${item.danger ? ' danger' : ''}`);
        row.type = 'button';
        row.setAttribute('role', 'menuitem');
        row.dataset.featureAction = label;
        row.dataset.command = item.command;
        if (item.blocked) { row.setAttribute('aria-disabled', 'true'); row.classList.add('blocked'); }
        row.append(createIconElement(item.icon, 'icon-svg tools-menu-icon'));
        const copy = create('span', 'tools-menu-copy');
        copy.append(create('span', 'tools-menu-label', l(label)));
        copy.append(create('span', 'tools-menu-hint', l(item.blocked || item.hint)));
        row.append(copy);
        if (item.text) row.append(create('span', 'tools-menu-status', item.text));
        row.addEventListener('click', () => {
          if (item.blocked) return;
          close({ restoreFocus: false });
          run(item.command);
        });
        section.append(row);
      }
      popover.append(section);
    }
    document.body.append(popover);
    position(popover, trigger);
    trigger.setAttribute('aria-expanded', 'true');

    const items = () => [...popover.querySelectorAll('.tools-menu-item')];
    const onKey = (event) => {
      if (!open) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (event.key === 'Tab') { close({ restoreFocus: false }); return; }
      const list = items();
      const at = list.indexOf(document.activeElement);
      let next = -1;
      if (event.key === 'ArrowDown') next = at < 0 ? 0 : (at + 1) % list.length;
      else if (event.key === 'ArrowUp') next = at < 0 ? list.length - 1 : (at - 1 + list.length) % list.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = list.length - 1;
      if (next >= 0) { event.preventDefault(); list[next].focus(); }
    };
    const onDown = (event) => {
      if (!popover.contains(event.target) && !trigger.contains(event.target)) close({ restoreFocus: false });
    };
    open = { popover, trigger, onKey, onDown };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown, true);
    items().find((item) => item.getAttribute('aria-disabled') !== 'true')?.focus({ preventScroll: true });
  }

  /** Builds the trigger button. `data-library-tools` is kept for the acceptance scripts. */
  function createTrigger() {
    const button = create('button', 'ghost-button compact-list-button tools-menu-trigger');
    button.type = 'button';
    button.dataset.libraryTools = 'true';
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');
    button.append(create('span', '', l('Tools')), createIconElement('chevronDown', 'icon-svg tools-menu-caret'));
    button.addEventListener('click', () => toggle(button));
    return button;
  }

  window.addEventListener('resize', () => { if (open) position(open.popover, open.trigger); });
  return { createTrigger, close, isOpen: () => Boolean(open) };
}
