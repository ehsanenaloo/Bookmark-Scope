/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 *
 * Side panel (Chromium sidePanel, Firefox sidebar_action). It reuses the popup
 * state, actions and list renderer. "This site" shows the bookmarks of the
 * active tab; "All" shows the whole library and can be limited to one folder.
 */

import { THEME_MODES } from '../../src/core/constants.js';
import {
  getNormalizedBookmarks,
  detectDuplicates,
  filterScopedBookmarks,
  searchScopedBookmarks,
  sortBookmarks,
  groupDuplicates,
  getCleanupSummary,
  invalidateBookmarkCache
} from '../../src/core/bookmark-utils.js';
import { getMatchTarget, matchesMode } from '../../src/core/url-utils.js';
import { applyTheme, applyPalette, loadStoredTheme, loadStoredPalette, saveThemeMode, saveColorPalette, watchSystemTheme } from '../../src/ui/theme-utils.js';
import { createIconButton, iconSvg, createIconElement } from '../../src/ui/icon-system.js';
import { formatNumber, initI18n, t, translateTree } from '../../src/locales/i18n.js';
import { featureText } from '../../src/locales/feature-messages.js';
import { createFaviconNode, debounce, trapFocus } from '../../src/ui/ui-utils.js';
import { createPopupActions } from '../../src/popup/actions.js';
import { createPopupHeaderOverlays } from '../../src/popup/header-overlays.js';
import { createPopupMatchesToast } from '../../src/popup/matches-toast.js';
import { createPopupState } from '../../src/popup/state.js';
import {
  addBookmarkEventListeners,
  addStorageChangedListener,
  addTabActivatedListener,
  addTabUpdatedListener,
  addWindowFocusListener,
  createBookmark,
  getBookmarkTree,
  getRuntimeUrl,
  moveBookmark,
  removeBookmark,
  updateBookmark
} from '../../src/platform/browser-api.js';
import { createLogger } from '../../src/services/diagnostics-service.js';
import { loadSidePanelPreferences, saveSidePanelPreferences } from '../../src/services/preferences-service.js';
import { initializeStorageLayer } from '../../src/services/storage-service.js';
import { createFolderTools } from '../../src/dashboard/folder-tools.js';
import { indexTree, listFolders, planMoveToFolder } from '../../src/services/folder-service.js';
import { openFolderPicker } from '../../src/ui/folder-picker.js';
import { openFolderManager } from '../../src/ui/folder-manager.js';

const logger = createLogger('sidepanel');
const state = createPopupState();
const app = document.getElementById('app');

let searchRef = null;
let stopWatchingTheme = null;
let folderFilterId = '';
let folderOptions = [];
let folderNodes = new Map();
const expandedFolders = new Set();
const closedFolders = new Set();
// A folder row that had focus when the tree was drawn again gets it back, so keyboard use is not interrupted.
let focusFolderId = '';
const folderLimits = new Map();
let rootsExpanded = false;
const FOLDER_PAGE = 100;
const setToastTimerRef = { current: null };

function create(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function getParseOptions() {
  return {
    ignoreQueryString: state.ignoreQueryString,
    ignoreHashFragment: state.ignoreHashFragment
  };
}

const deps = {
  state,
  app,
  getCleanupSummary,
  getNormalizedBookmarks,
  detectDuplicates,
  filterScopedBookmarks,
  searchScopedBookmarks,
  sortBookmarks,
  groupDuplicates,
  invalidateBookmarkCache,
  getMatchTarget,
  matchesMode,
  applyTheme,
  applyPalette,
  loadStoredTheme,
  saveThemeMode,
  saveColorPalette,
  watchSystemTheme,
  formatNumber,
  initI18n,
  t,
  translateTree,
  createFaviconNode,
  debounce,
  trapFocus,
  createIconButton,
  iconSvg,
  createIconElement,
  create,
  getParseOptions,
  getAppTitle: () => t('Bookmark Scope'),
  setSearchRef(value) { searchRef = value; },
  setToastTimerRef
};

const actions = createPopupActions(deps);
deps.actions = actions;
const headerOverlays = createPopupHeaderOverlays(deps);
actions.showConfirmDialog = headerOverlays.showConfirmDialog;
deps.showConfirmDialog = headerOverlays.showConfirmDialog;

function setToast(message, options = {}) {
  const opts = options || {};
  window.clearTimeout(setToastTimerRef.current);
  state.toast = { message, error: Boolean(opts.error), action: opts.action || null };
  render();
  if (!opts.persist) {
    setToastTimerRef.current = window.setTimeout(() => {
      state.toast = null;
      render();
    }, opts.duration ?? 2600);
  }
}
deps.setToast = setToast;

// The dashboard folder tools report with { actionLabel, action }; the popup
// toast wants { action: { label, handler } }.
const folderTools = createFolderTools({
  t,
  formatNumber,
  setToast(message, options = {}) {
    setToast(message, {
      error: options.error,
      persist: options.persist,
      action: typeof options.action === 'function' ? { label: options.actionLabel, handler: options.action } : null
    });
  },
  refreshData: () => refresh(),
  pushCleanupHistory: async () => {},
  invalidateBookmarkCache,
  showConfirmDialog: headerOverlays.showConfirmDialog,
  openFolderPicker,
  openFolderManager,
  api: { getBookmarkTree, moveBookmark, createBookmark, updateBookmark, removeBookmark }
});

deps.render = (...args) => render(...args);
deps.onMoveBookmark = (bookmark) => folderTools.moveBookmarksToFolder([bookmark]);
// Drag and drop in the grouped list: drag a bookmark or a folder, drop it on a
// folder (or on a bookmark, which means its folder). The move goes through
// folderTools.moveIdsIntoFolder, so protected folders, drops into a folder's own
// subtree and Undo follow the same rules as Move to folder. The custom MIME type
// keeps drags from other pages or files from being taken for a move.
const DRAG_TYPE = 'application/x-bookmark-scope-id';
const OPEN_ON_HOVER_MS = 700;
let dragIds = [];

function clearDrag() {
  dragIds = [];
  document.querySelectorAll('.drop-into').forEach((node) => node.classList.remove('drop-into'));
  document.querySelectorAll('.dragging').forEach((node) => node.classList.remove('dragging'));
}

function isOurDrag(event) {
  return dragIds.length > 0 && Array.from(event.dataTransfer?.types || []).includes(DRAG_TYPE);
}

function canDropInto(folderId) {
  const plan = planMoveToFolder(folderNodes, dragIds, folderId);
  return plan.ok && plan.moves.length > 0;
}

function makeDraggable(element, id, label) {
  element.draggable = true;
  element.addEventListener('dragstart', (event) => {
    dragIds = [id];
    try {
      event.dataTransfer?.setData(DRAG_TYPE, id);
      event.dataTransfer?.setData('text/plain', label || '');
    } catch { /* some engines refuse setData on synthetic events */ }
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    element.classList.add('dragging');
  });
  element.addEventListener('dragend', clearDrag);
}

function makeDropTarget(element, folderId, onHoverOpen = null) {
  let timer = 0;
  const stopTimer = () => { window.clearTimeout(timer); timer = 0; };
  element.addEventListener('dragover', (event) => {
    if (!isOurDrag(event) || !canDropInto(folderId)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    element.classList.add('drop-into');
    if (onHoverOpen && !timer) timer = window.setTimeout(() => { timer = 0; onHoverOpen(); }, OPEN_ON_HOVER_MS);
  });
  element.addEventListener('dragleave', (event) => {
    if (element.contains(event.relatedTarget)) return;
    element.classList.remove('drop-into');
    stopTimer();
  });
  element.addEventListener('drop', (event) => {
    stopTimer();
    if (!isOurDrag(event)) return;
    event.preventDefault();
    const ids = dragIds.slice();
    clearDrag();
    if (ids.length) folderTools.moveIdsIntoFolder(ids, folderId);
  });
}

// "Group by folder": the visible bookmarks as a folder tree in the browser's own
// order. Only folders that hold a visible bookmark are listed, except for the
// plain All view (no search, no folder filter), which also shows empty folders.
// Open folders show their bookmarks in pages of FOLDER_PAGE rows.
function renderFolderTree(list) {
  const visible = new Set(state.visibleBookmarks.map((bookmark) => bookmark.id));
  const byId = new Map(state.visibleBookmarks.map((bookmark) => [bookmark.id, bookmark]));
  const showEmpty = state.view === 'all' && !state.query.trim() && !folderFilterId;
  const autoOpen = !showEmpty;
  const totals = new Map();
  const total = (id) => {
    if (totals.has(id)) return totals.get(id);
    const node = folderNodes.get(id);
    const value = (node?.children || []).reduce((sum, childId) => sum + (visible.has(childId) ? 1 : (folderNodes.get(childId)?.isFolder ? total(childId) : 0)), 0);
    totals.set(id, value);
    return value;
  };
  const roots = [...folderNodes.values()].filter((node) => node.rootFolder && (showEmpty || total(node.id) > 0));
  if (!roots.length) return false;
  if (!rootsExpanded) {
    roots.forEach((node) => expandedFolders.add(node.id));
    rootsExpanded = true;
  }
  const isOpen = (id) => (autoOpen ? !closedFolders.has(id) : expandedFolders.has(id));

  const tree = create('div', 'folder-tree');

  const addFolder = (node, depth, parent) => {
    const open = isOpen(node.id);
    const row = create('div', 'folder-tree-row');
    row.tabIndex = 0;
    // A folder row is a disclosure button: Tab reaches it, Enter and Space open or close it.
    row.setAttribute('role', 'button');
    row.dataset.folderId = node.id;
    row.setAttribute('aria-expanded', open ? 'true' : 'false');
    row.style.paddingInlineStart = `${8 + depth * 14}px`;
    row.append(createIconElement('chevronRight', 'icon-svg folder-tree-chevron'), createIconElement(open ? 'folderOpen' : 'folder', 'icon-svg folder-tree-icon'));
    const name = create('span', 'folder-tree-name', node.title || featureText('Untitled folder'));
    name.dir = 'auto';
    name.title = node.path;
    row.append(name, create('span', 'folder-tree-count', formatNumber(total(node.id))));
    const toggleFolder = () => {
      const set = autoOpen ? closedFolders : expandedFolders;
      // For the auto-open list the set holds closed folders, otherwise open ones.
      if (set.has(node.id)) set.delete(node.id); else set.add(node.id);
      focusFolderId = node.id;
      render();
    };
    row.addEventListener('click', toggleFolder);
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleFolder(); }
    });
    makeDropTarget(row, node.id, open ? null : () => {
      if (autoOpen) closedFolders.delete(node.id); else expandedFolders.add(node.id);
      render();
    });
    if (!node.rootFolder && !node.unmodifiable) makeDraggable(row, node.id, node.title);
    parent.append(row);
    if (!open) return;
    const kids = create('div', 'folder-tree-children');
    const limit = folderLimits.get(node.id) || FOLDER_PAGE;
    let shownBookmarks = 0;
    let hidden = 0;
    for (const childId of node.children) {
      const child = folderNodes.get(childId);
      if (!child) continue;
      if (child.isFolder) {
        if (showEmpty || total(childId) > 0) addFolder(child, depth + 1, kids);
        continue;
      }
      const bookmark = byId.get(childId);
      if (!bookmark) continue;
      if (shownBookmarks >= limit) { hidden += 1; continue; }
      const item = matchesToast.renderItem(bookmark);
      item.querySelector('a')?.setAttribute('draggable', 'false');
      makeDraggable(item, childId, bookmark.title);
      makeDropTarget(item, node.id);
      item.style.marginInlineStart = `${8 + (depth + 1) * 14}px`;
      kids.append(item);
      shownBookmarks += 1;
    }
    if (hidden) {
      const more = create('button', 'ghost-button folder-tree-more', featureText('Show more ({{count}})', { count: formatNumber(hidden) }));
      more.type = 'button';
      more.addEventListener('click', () => { folderLimits.set(node.id, limit + FOLDER_PAGE); render(); });
      kids.append(more);
    }
    if (!kids.childNodes.length) kids.append(create('div', 'folder-tree-empty', featureText('This folder is empty')));
    parent.append(kids);
  };
  roots.forEach((node) => addFolder(node, 0, tree));
  list.classList.add('folder-tree-list');
  list.addEventListener('dragover', (event) => {
    if (!isOurDrag(event)) return;
    const box = list.getBoundingClientRect();
    if (event.clientY < box.top + 36) list.scrollTop -= 14;
    else if (event.clientY > box.bottom - 36) list.scrollTop += 14;
  });
  list.append(tree);
  return true;
}
deps.renderFolderTree = renderFolderTree;
const matchesToast = createPopupMatchesToast(deps);
deps.modeLabel = matchesToast.modeLabel;

async function loadFolderState() {
  const nodes = indexTree(await getBookmarkTree());
  folderNodes = nodes;
  folderOptions = listFolders(nodes);
  if (folderFilterId && !nodes.has(folderFilterId)) folderFilterId = '';
  if (!folderFilterId) {
    state.folderIds = null;
    return;
  }
  const ids = new Set();
  const visit = (id) => {
    const node = nodes.get(id);
    if (!node || !node.isFolder) return;
    ids.add(id);
    node.children.forEach(visit);
  };
  visit(folderFilterId);
  state.folderIds = ids;
}

async function refresh() {
  await loadFolderState();
  await actions.refresh();
}

function savePanelPrefs() {
  saveSidePanelPreferences({ view: state.view, folderId: folderFilterId, groupByFolder: state.groupByFolder }).catch((error) => console.warn('Side panel choice was not saved.', error));
}

function setGroupByFolder(value) {
  state.groupByFolder = value;
  savePanelPrefs();
  render();
}

async function setView(view) {
  if (state.view === view) return;
  state.view = view;
  state.query = '';
  savePanelPrefs();
  actions.recalculate();
  render();
}

async function setFolderFilter(id) {
  folderFilterId = id;
  state.query = '';
  savePanelPrefs();
  await loadFolderState();
  actions.recalculate();
  render();
}

function renderHeader(root) {
  const header = create('div', 'side-header');
  const row = create('div', 'side-header-row');
  const badge = create('div', 'brand-badge brand-badge-logo');
  const logo = create('img', 'brand-logo-img');
  logo.src = getRuntimeUrl('icons/icon-32.png');
  logo.alt = '';
  badge.append(logo);
  row.append(badge, create('h1', 'title title-single-line', t('Bookmark Scope')));

  const isPageBookmarked = Boolean(state.target?.valid && state.tab?.url && state.bookmarkedUrlsSet?.has(state.tab.url));
  const star = create('button', `icon-button mono-icon-button bookmark-star-btn${isPageBookmarked ? ' is-bookmarked' : ''}`);
  star.type = 'button';
  const starLabel = isPageBookmarked ? t('Remove bookmark') : t('Bookmark current page');
  star.title = starLabel;
  star.setAttribute('aria-label', starLabel);
  star.setAttribute('aria-pressed', isPageBookmarked ? 'true' : 'false');
  star.innerHTML = iconSvg('star');
  if (state.target?.valid) {
    star.addEventListener('click', () => (isPageBookmarked ? actions.unbookmarkCurrentPage() : actions.bookmarkCurrentPage()));
  } else {
    star.disabled = true;
  }
  const dashboard = createIconButton('overview', t('Open Dashboard'), 'icon-button mono-icon-button');
  dashboard.addEventListener('click', actions.openDashboard);
  row.append(star, dashboard);

  const page = create('div', 'side-page', state.target?.valid ? state.target.label : t('Unsupported page'));
  page.title = page.textContent;

  const switcher = create('div', 'side-view-switch');
  switcher.setAttribute('role', 'group');
  switcher.setAttribute('aria-label', featureText('Show'));
  for (const [view, label] of [['site', featureText('This site')], ['all', featureText('All')]]) {
    const button = create('button', '', label);
    button.type = 'button';
    button.setAttribute('aria-pressed', state.view === view ? 'true' : 'false');
    button.addEventListener('click', () => setView(view));
    switcher.append(button);
  }
  header.append(row, page, switcher);
  root.append(header);
}

// Options row under the view switch. "Group by folder" works in both views;
// the folder filter and Manage folders belong to the All view.
function renderToolRow(root) {
  const strip = create('div', 'side-filter');
  if (state.view === 'all') {
    const select = create('select', 'select');
    select.setAttribute('aria-label', featureText('Show bookmarks from folder'));
    const all = create('option', '', featureText('All folders'));
    all.value = '';
    select.append(all);
    for (const folder of folderOptions) {
      const option = create('option', '', `${'\u00a0\u00a0'.repeat(folder.depth)}${folder.title || featureText('Untitled folder')}`);
      option.value = folder.id;
      select.append(option);
    }
    select.value = folderFilterId;
    select.addEventListener('change', () => setFolderFilter(select.value));
    strip.append(select);
  } else {
    strip.classList.add('side-filter-end');
  }
  const group = create('button', 'ghost-button side-group-toggle');
  group.type = 'button';
  group.setAttribute('aria-pressed', state.groupByFolder ? 'true' : 'false');
  group.title = featureText('Group by folder. Drag a bookmark onto a folder to move it.');
  group.append(createIconElement(state.groupByFolder ? 'folderOpen' : 'folder', 'icon-svg'), create('span', '', featureText('By folder')));
  group.addEventListener('click', () => setGroupByFolder(!state.groupByFolder));
  strip.append(group);
  if (state.view === 'all') {
    const manage = createIconButton('folderPlus', featureText('Manage folders'), 'icon-button mono-icon-button');
    manage.addEventListener('click', () => folderTools.openFolders());
    strip.append(manage);
  }
  root.append(strip);
}

function render(options = {}) {
  document.title = t('Bookmark Scope');
  const restoreFocus = options.preserveSearchFocus === true;
  const selectionStart = Number.isInteger(options.selectionStart) ? options.selectionStart : null;
  const selectionEnd = Number.isInteger(options.selectionEnd) ? options.selectionEnd : selectionStart;

  app.textContent = '';
  const shell = create('div', 'shell');
  renderHeader(shell);
  const content = create('div', 'content side-content');
  renderToolRow(content);
  if (state.view === 'all') {
    content.append(create('div', 'side-meta', featureText('{{count}} bookmarks', { count: formatNumber(state.scopeBookmarks.length) })));
  }
  matchesToast.renderMatches(content);
  shell.append(content);
  app.append(shell);
  headerOverlays.createConfirmDialog(app);
  matchesToast.renderToast(app);
  translateTree(app);

  if (focusFolderId) {
    const wanted = focusFolderId;
    focusFolderId = '';
    const row = [...app.querySelectorAll('.folder-tree-row')].find((candidate) => candidate.dataset.folderId === wanted);
    row?.focus({ preventScroll: true });
  }

  if (restoreFocus && searchRef) {
    searchRef.focus({ preventScroll: true });
    if (typeof searchRef.setSelectionRange === 'function') {
      const start = Math.max(0, Math.min(searchRef.value.length, selectionStart ?? searchRef.value.length));
      const end = Math.max(start, Math.min(searchRef.value.length, selectionEnd ?? start));
      searchRef.setSelectionRange(start, end);
    }
  }
}
deps.renderContentOnly = render;

async function init() {
  try {
    const storage = await initializeStorageLayer();
    await initI18n();
    await logger.info('init_started', { storageMigrated: storage.migrated, previousVersion: storage.previousVersion });
    state.themeMode = await loadStoredTheme();
    applyTheme(state.themeMode);
    applyPalette(await loadStoredPalette());
    stopWatchingTheme = watchSystemTheme(() => {
      if (state.themeMode === THEME_MODES.SYSTEM) applyTheme(state.themeMode);
    });
    await actions.loadPrefs();
    const panelPrefs = await loadSidePanelPreferences();
    state.view = panelPrefs.view;
    folderFilterId = panelPrefs.folderId;
    state.groupByFolder = panelPrefs.groupByFolder;
    await refresh();
  } catch (error) {
    await logger.error('init_failed', { message: error?.message || String(error) });
    actions.renderInitError(error);
  }
}

const refreshSoon = debounce(() => {
  refresh().catch((error) => console.warn('Side panel refresh failed.', error));
}, 200);

addStorageChangedListener((changes, areaName) => {
  actions.handleLocaleChange(changes, areaName).catch(console.error);
});
addBookmarkEventListeners({
  created: refreshSoon,
  removed: refreshSoon,
  changed: refreshSoon,
  moved: refreshSoon,
  importEnded: refreshSoon
});
addTabActivatedListener(refreshSoon);
addTabUpdatedListener((_tabId, changeInfo, tab) => {
  if (tab?.active && (changeInfo.url || changeInfo.status === 'complete')) refreshSoon();
});
addWindowFocusListener(refreshSoon);

window.addEventListener('pagehide', () => {
  if (typeof stopWatchingTheme === 'function') {
    stopWatchingTheme();
    stopWatchingTheme = null;
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
