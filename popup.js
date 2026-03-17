import {
  MATCH_MODES,
  SORT_OPTIONS,
  STORAGE_KEYS,
  CLEANUP_FILTERS,
  OLD_BOOKMARK_DAYS,
  THEME_MODES
} from './src/constants.js';
import {
  getNormalizedBookmarks,
  detectDuplicates,
  sortBookmarks,
  groupDuplicates,
  getCleanupSummary
} from './src/bookmark-utils.js';
import { getMatchTarget, matchesMode } from './src/url-utils.js';
import { applyTheme, loadStoredTheme, saveThemeMode, watchSystemTheme } from './src/theme-utils.js';

const state = {
  mode: MATCH_MODES.DOMAIN,
  sort: SORT_OPTIONS.TITLE_ASC,
  query: '',
  ignoreQueryString: false,
  ignoreHashFragment: true,
  target: null,
  tab: null,
  allBookmarks: [],
  scopeBookmarks: [],
  visibleBookmarks: [],
  scopeSummary: getCleanupSummary([]),
  toast: null,
  footerTab: '',
  footerAutoRotate: true,
  footerHoverPaused: false,
  footerProgress: 0,
  themeMode: THEME_MODES.SYSTEM,
  menuOpen: false,
  aboutOpen: false
};

const app = document.getElementById('app');
let searchRef = null;
const footerRefs = {
  shell: null,
  panelBody: null,
  panelControls: null,
  nav: null
};

state.footerAutoRotate = getFooterConfig().autoRotate;
state.footerTab = getFooterItems()[0]?.id || '';

const DEFAULT_FOOTER_NAV_CONFIG = {
  autoRotate: true,
  rotateEveryMs: 5000,
  items: [
    {
      id: 'about',
      label: 'About',
      message: 'Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.',
      ctaLabel: 'Learn More',
      action: 'info'
    },
    {
      id: 'github',
      label: 'GitHub',
      message: 'Source code, releases, and project details live in your GitHub repo.',
      ctaLabel: 'Open GitHub',
      url: '',
      action: 'link'
    },
    {
      id: 'rate',
      label: 'Rate',
      message: 'Enjoying the extension? A good rating helps the extension build trust faster.',
      ctaLabel: 'Rate on Store',
      url: '',
      action: 'link'
    }
  ]
};

function getFooterConfig() {
  const config = window.FOOTER_NAV_CONFIG || DEFAULT_FOOTER_NAV_CONFIG;
  const items = Array.isArray(config.items) && config.items.length
    ? config.items.map((item, index) => ({
        id: item?.id || `item-${index + 1}`,
        label: item?.label || `Item ${index + 1}`,
        message: item?.message || '',
        ctaLabel: item?.ctaLabel || '',
        url: item?.url || '',
        action: item?.action || 'info'
      }))
    : DEFAULT_FOOTER_NAV_CONFIG.items;
  return {
    autoRotate: config.autoRotate !== false,
    rotateEveryMs: Number(config.rotateEveryMs) > 0 ? Number(config.rotateEveryMs) : DEFAULT_FOOTER_NAV_CONFIG.rotateEveryMs,
    items
  };
}

function getFooterItems() {
  return getFooterConfig().items;
}

function getFooterRotateMs() {
  return getFooterConfig().rotateEveryMs;
}

let footerAnimationFrame = null;
let footerCycleStartedAt = null;

function create(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}


function iconSvg(kind) {
  const icons = {
    add: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.2v9.6M3.2 8h9.6"/></svg>`,
    settings: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm5.1 2.8-.96.35a4.72 4.72 0 0 1-.33.79l.44.93-1.1 1.1-.93-.44a4.72 4.72 0 0 1-.79.33l-.35.96H6.91l-.35-.96a4.72 4.72 0 0 1-.79-.33l-.93.44-1.1-1.1.44-.93a4.72 4.72 0 0 1-.33-.79L2.9 8l.35-1.09c.07-.27.18-.53.33-.79l-.44-.93 1.1-1.1.93.44c.26-.15.52-.26.79-.33l.35-.96h2.18l.35.96c.27.07.53.18.79.33l.93-.44 1.1 1.1-.44.93c.15.26.26.52.33.79L13.1 8Z"/></svg>`,
    system: `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.2" width="11" height="7.8" rx="1.4"/><path d="M6.1 12.6h3.8M8 11v1.6"/></svg>`,
    light: `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.9"/><path d="M8 1.8v1.7M8 12.5v1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M1.8 8h1.7M12.5 8h1.7M3.6 12.4l1.2-1.2M11.2 4.8l1.2-1.2"/></svg>`,
    dark: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.9 1.9A5.7 5.7 0 1 0 14.1 12 6.1 6.1 0 0 1 10.9 1.9Z"/></svg>`,
    more: `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.25" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none"/><circle cx="12.75" cy="8" r="1.1" fill="currentColor" stroke="none"/></svg>`
  };
  return icons[kind] || icons.system;
}

function createIconButton(kind, title, classes = 'icon-button mono-icon-button') {
  const button = create('button', classes);
  button.type = 'button';
  button.title = title;
  button.setAttribute('aria-label', title);
  button.innerHTML = iconSvg(kind);
  return button;
}

async function updateThemeMode(mode) {
  state.menuOpen = false;
  state.themeMode = mode;
  applyTheme(mode);
  await saveThemeMode(mode);
  updateThemeControls();
}

function updateThemeControls() {
  document.querySelectorAll('[data-theme-control]').forEach((button) => {
    const active = button.dataset.themeControl === state.themeMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}


function closeAboutModal() {
  if (!state.aboutOpen) return;
  state.aboutOpen = false;
  render();
}

function createAboutModal(root) {
  if (!state.aboutOpen) return;
  const manifest = chrome.runtime.getManifest();
  const overlay = create('div', 'modal-overlay');
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeAboutModal();
  });

  const modal = create('div', 'modal-card about-modal');
  const head = create('div', 'about-head');
  const icon = create('img', 'about-icon');
  icon.src = chrome.runtime.getURL('icon.png');
  icon.alt = '';
  const meta = create('div', 'about-meta');
  meta.append(
    create('div', 'about-title', manifest.name || 'Bookmark Manager'),
    create('div', 'about-version', `Version ${manifest.version || ''}`)
  );
  const close = create('button', 'icon-button mono-icon-button modal-close', '×');
  close.type = 'button';
  close.title = 'Close';
  close.setAttribute('aria-label', 'Close about dialog');
  close.textContent = '×';
  close.addEventListener('click', closeAboutModal);
  head.append(icon, meta, close);

  const body = create('div', 'about-body');
  body.append(
    create('div', 'about-copy', 'Bookmark Manager per Domain and Page'),
    create('div', 'about-copy about-copy-muted', 'Quick scoped triage in the popup. Deep cleanup lives in the dashboard.'),
    create('div', 'about-copy about-copy-muted', 'Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.')
  );

  modal.append(head, body);
  overlay.append(modal);
  root.append(overlay);
}

function createThemeControls() {
  const wrap = create('div', 'theme-controls');
  const items = [
    { mode: THEME_MODES.SYSTEM, icon: 'system', title: 'Follow system theme' },
    { mode: THEME_MODES.LIGHT, icon: 'light', title: 'Use light theme' },
    { mode: THEME_MODES.DARK, icon: 'dark', title: 'Use dark theme' }
  ];
  for (const item of items) {
    const button = createIconButton(item.icon, item.title, 'icon-button mono-icon-button theme-button');
    button.dataset.themeControl = item.mode;
    button.addEventListener('click', () => updateThemeMode(item.mode));
    wrap.append(button);
  }
  return wrap;
}


function getHostnameSafe(url) {
  try { return new URL(url).hostname || ''; } catch { return ''; }
}

function createFaviconNode(bookmark) {
  const host = getHostnameSafe(bookmark.url);
  const wrap = create('div', 'item-favicon');
  const fallback = create('span', 'item-favicon-fallback', (host || bookmark.title || '?').trim().charAt(0).toUpperCase() || '?');
  wrap.append(fallback);
  if (host) {
    const img = create('img', 'item-favicon-img');
    img.alt = '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.src = `${new URL(bookmark.url).origin}/favicon.ico`;
    img.addEventListener('load', () => { wrap.classList.add('has-image'); });
    img.addEventListener('error', () => { img.remove(); wrap.classList.remove('has-image'); });
    wrap.prepend(img);
  }
  return wrap;
}
function modeLabel(mode) {
  switch (mode) {
    case MATCH_MODES.PAGE:
      return 'This page';
    case MATCH_MODES.HOST:
      return 'This host';
    default:
      return 'This domain';
  }
}

function getParseOptions() {
  return {
    ignoreQueryString: state.ignoreQueryString,
    ignoreHashFragment: state.ignoreHashFragment
  };
}

function setToast(message, error = false, action = null, duration = 2600) {
  state.toast = { message, error, action };
  render();
  window.clearTimeout(setToast._timer);
  setToast._timer = window.setTimeout(() => {
    state.toast = null;
    render();
  }, duration);
}

async function savePrefs() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.POPUP_MODE]: state.mode,
    [STORAGE_KEYS.POPUP_SORT]: state.sort,
    [STORAGE_KEYS.IGNORE_QUERY]: state.ignoreQueryString,
    [STORAGE_KEYS.IGNORE_HASH]: state.ignoreHashFragment
  });
}

async function loadPrefs() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.POPUP_MODE,
    STORAGE_KEYS.POPUP_SORT,
    STORAGE_KEYS.IGNORE_QUERY,
    STORAGE_KEYS.IGNORE_HASH,
    STORAGE_KEYS.THEME_MODE
  ]);
  state.mode = stored[STORAGE_KEYS.POPUP_MODE] || MATCH_MODES.DOMAIN;
  state.sort = stored[STORAGE_KEYS.POPUP_SORT] || SORT_OPTIONS.TITLE_ASC;
  state.ignoreQueryString = Boolean(stored[STORAGE_KEYS.IGNORE_QUERY]);
  state.ignoreHashFragment = stored[STORAGE_KEYS.IGNORE_HASH] !== false;
  state.themeMode = stored[STORAGE_KEYS.THEME_MODE] || THEME_MODES.SYSTEM;
  applyTheme(state.themeMode);
}

async function getActiveContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tab = tab || null;
  state.target = tab?.url ? getMatchTarget(tab.url, getParseOptions()) : null;
}

async function loadBookmarks() {
  state.allBookmarks = detectDuplicates(await getNormalizedBookmarks(getParseOptions()));
}

function duplicateGroupsCount(items) {
  return groupDuplicates(items).size;
}

function matchesQuery(bookmark, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return true;
  const text = `${bookmark.title} ${bookmark.url} ${bookmark.path}`.toLowerCase();
  return text.includes(needle);
}

function recalculate() {
  if (!state.target?.valid) {
    state.scopeBookmarks = [];
    state.visibleBookmarks = [];
    state.scopeSummary = getCleanupSummary([]);
    return;
  }
  state.scopeBookmarks = state.allBookmarks.filter((bookmark) => matchesMode(bookmark, state.target, state.mode));
  state.scopeSummary = getCleanupSummary(state.scopeBookmarks);
  state.visibleBookmarks = sortBookmarks(
    state.scopeBookmarks.filter((bookmark) => matchesQuery(bookmark, state.query)),
    state.sort
  );
}

async function refresh() {
  await getActiveContext();
  await loadBookmarks();
  recalculate();
  render();
}

async function updateMode(mode) {
  state.mode = mode;
  await savePrefs();
  recalculate();
  render();
}

async function updateSort(value) {
  state.sort = value;
  await savePrefs();
  recalculate();
  render();
}

async function updateParsePreference(key, value) {
  state[key] = value;
  await savePrefs();
  await refresh();
}

async function openDashboard() {
  state.menuOpen = false;
  await chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html'), active: true });
}

async function openUrl(url) {
  if (!url) return;
  await chrome.tabs.create({ url, active: true });
}

async function openFolder(parentId) {
  if (!parentId) return;
  await chrome.tabs.create({ url: `chrome://bookmarks/?id=${encodeURIComponent(parentId)}`, active: true });
}

async function deleteBookmark(bookmark) {
  const confirmed = window.confirm(`Delete "${bookmark.title}"?`);
  if (!confirmed) return;
  const undoPayload = {
    title: bookmark.title,
    url: bookmark.url,
    parentId: bookmark.parentId,
    index: Number.isInteger(bookmark.index) ? bookmark.index : undefined
  };
  await chrome.bookmarks.remove(bookmark.id);
  setToast(
    'Bookmark deleted. Tiny act of order restored.',
    false,
    {
      label: 'Undo',
      handler: async () => {
        try {
          await chrome.bookmarks.create(undoPayload);
          state.toast = null;
          render();
          setToast('Bookmark restored. Entropy retreats.', false, null, 2200);
          await refresh();
        } catch (error) {
          console.error(error);
          setToast('Could not restore that bookmark.', true, null, 2600);
        }
      }
    },
    5200
  );
  await refresh();
}

async function bookmarkCurrentPage() {
  if (!state.tab?.url || !state.target?.valid) {
    setToast('Open a normal web page first.', true);
    return;
  }
  await chrome.bookmarks.create({ title: state.tab.title || state.target.label, url: state.tab.url });
  setToast('Current page bookmarked.');
  await refresh();
}

function createOverflowMenu() {
  const wrap = create('div', 'header-overflow');
  const trigger = create('button', 'icon-button mono-icon-button overflow-trigger overflow-trigger-dots');
  trigger.type = 'button';
  trigger.title = 'More controls';
  trigger.setAttribute('aria-label', 'More controls');
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', state.menuOpen ? 'true' : 'false');
  const dots = create('span', 'overflow-dots', '⋯');
  dots.setAttribute('aria-hidden', 'true');
  trigger.append(dots);

  const menu = create('div', `overflow-menu${state.menuOpen ? ' is-open' : ''}`);
  menu.setAttribute('role', 'menu');

  const closeMenu = () => {
    state.menuOpen = false;
    render();
  };

  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    state.menuOpen = !state.menuOpen;
    render();
  });

  const bookmarkAction = create('button', 'overflow-item', 'Bookmark current page');
  bookmarkAction.type = 'button';
  bookmarkAction.addEventListener('click', async (event) => {
    event.stopPropagation();
    closeMenu();
    await bookmarkCurrentPage();
  });

  const settingsAction = create('button', 'overflow-item', 'Open settings');
  settingsAction.type = 'button';
  settingsAction.addEventListener('click', (event) => {
    event.stopPropagation();
    closeMenu();
    chrome.tabs.create({ url: chrome.runtime.getURL('options.html'), active: true });
  });

  const chromeAction = create('button', 'overflow-item', 'Open Chrome bookmarks');
  chromeAction.type = 'button';
  chromeAction.addEventListener('click', (event) => {
    event.stopPropagation();
    closeMenu();
    chrome.tabs.create({ url: 'chrome://bookmarks/', active: true });
  });

  const aboutAction = create('button', 'overflow-item', 'About');
  aboutAction.type = 'button';
  aboutAction.addEventListener('click', (event) => {
    event.stopPropagation();
    state.menuOpen = false;
    state.aboutOpen = true;
    render();
  });

  const themeBlock = create('div', 'overflow-theme-block');
  themeBlock.append(create('div', 'overflow-label', 'Theme'));
  themeBlock.append(createThemeControls());

  menu.append(bookmarkAction, settingsAction, chromeAction, aboutAction, themeBlock);
  wrap.append(trigger, menu);

  if (state.menuOpen) {
    window.setTimeout(() => {
      const onDocClick = (event) => {
        if (!wrap.contains(event.target)) {
          document.removeEventListener('click', onDocClick, true);
          state.menuOpen = false;
          render();
        }
      };
      document.addEventListener('click', onDocClick, true);
    }, 0);
  }

  return wrap;
}

function renderHeader(root) {
  const header = create('div', 'section header header-minimal');

  const topRow = create('div', 'header-top-row header-top-row-minimal');
  const left = create('div', 'header-main');
  const brand = create('div', 'brand-row brand-row-minimal');
  brand.append(create('div', 'brand-badge', '★'));
  const titleWrap = create('div', 'title-wrap title-wrap-minimal');
  titleWrap.append(
    create('h1', 'title title-single-line', 'Bookmark Manager'),
    create('div', 'subtitle subtitle-single-line', state.target?.valid ? modeLabel(state.mode) : 'Unsupported page')
  );
  brand.append(titleWrap);
  left.append(brand);

  const actions = create('div', 'header-actions header-actions-minimal');
  const dashBtn = create('button', 'button primary compact-dashboard-button compact-dashboard-button-minimal', 'Dashboard');
  dashBtn.type = 'button';
  dashBtn.title = 'Open Library Dashboard';
  dashBtn.addEventListener('click', openDashboard);
  actions.append(dashBtn, createOverflowMenu());
  topRow.append(left, actions);

  const targetRow = create('div', 'target-row target-row-full target-row-minimal');
  targetRow.append(
    create('span', 'context-label inline', 'Target'),
    create('div', 'context target-inline', state.target?.valid ? state.target.label : 'Open an http or https page to inspect matching bookmarks.')
  );

  const strip = create('div', 'status-strip compact single-line-summary full-width-strip summary-strip-minimal');
  const scopePill = create('div', 'mini-pill', `${state.scopeBookmarks.length} in scope`);
  scopePill.title = 'Bookmarks in the current page, host, or domain scope.';
  const oldPill = create('div', 'mini-pill', `${state.scopeSummary.oldCount} old`);
  oldPill.title = `Bookmarks older than ${OLD_BOOKMARK_DAYS} days in this scope.`;
  const dupPill = create('div', 'mini-pill', `${duplicateGroupsCount(state.scopeBookmarks)} duplicate`);
  dupPill.title = 'Duplicate URL groups in this scope.';
  strip.append(scopePill, oldPill, dupPill);

  header.append(topRow, targetRow, strip);
  root.append(header);
}


function renderCompactReview() {
  const dupGroups = duplicateGroupsCount(state.scopeBookmarks);
  const issues = [];
  if (dupGroups) issues.push(`${dupGroups} dup`);
  if (state.scopeSummary.oldCount) issues.push(`${state.scopeSummary.oldCount} old`);
  if (state.scopeSummary.untitledCount) issues.push(`${state.scopeSummary.untitledCount} untitled`);
  if (state.scopeSummary.titleCollisionCount) issues.push(`${state.scopeSummary.titleCollisionCount} collisions`);
  if (!issues.length) return null;
  const line = create('div', 'compact-review-line compact-review-line-inline');
  line.append(create('span', 'review-dot', '•'));
  line.append(create('div', 'helper', `Needs review: ${issues.join(' · ')}`));
  return line;
}

function renderMatches(root) {
  const section = create('div', 'section popup-home');

  if (!state.target?.valid) {
    const empty = create('div', 'empty');
    empty.append(
      create('div', 'metric-value', 'No scope'),
      create('div', 'empty-copy', 'Chrome internal pages are goblins. Use a normal site.'),
    );
    section.append(empty);
    root.append(section);
    return;
  }

  const controlStrip = create('div', 'control-strip-inline');

  const searchWrap = create('div', 'search-wrap search-wrap-inline-compact');
  const search = create('input', 'input input-compact input-inline-search');
  search.type = 'search';
  search.placeholder = 'Search bookmarks';
  search.value = state.query;
  search.title = 'Filter visible bookmarks in this scope';
  search.addEventListener('input', (event) => {
    state.query = event.target.value;
    recalculate();
    render();
  });
  searchRef = search;
  searchWrap.append(search);

  const scopeWrap = create('div', 'scope-menu-wrap');
  const scopeSelect = create('select', 'select select-compact select-inline select-scope-inline');
  [
    [MATCH_MODES.PAGE, 'Page'],
    [MATCH_MODES.HOST, 'Host'],
    [MATCH_MODES.DOMAIN, 'Domain']
  ].forEach(([value, label]) => {
    const option = create('option', '', label);
    option.value = value;
    option.selected = state.mode === value;
    scopeSelect.append(option);
  });
  scopeSelect.title = 'Choose current bookmark scope';
  scopeSelect.setAttribute('aria-label', 'Choose current bookmark scope');
  scopeSelect.addEventListener('change', (event) => updateMode(event.target.value));
  scopeWrap.append(scopeSelect);

  const sortWrap = create('div', 'sort-wrap sort-wrap-inline sort-wrap-inline-compact');
  const sort = create('select', 'select select-compact select-inline select-sort-inline');
  [
    [SORT_OPTIONS.TITLE_ASC, 'Title'],
    [SORT_OPTIONS.URL_ASC, 'URL'],
    [SORT_OPTIONS.NEWEST, 'Newest'],
    [SORT_OPTIONS.OLDEST, 'Oldest']
  ].forEach(([value, label]) => {
    const option = create('option', '', label);
    option.value = value;
    option.selected = state.sort === value;
    sort.append(option);
  });
  sort.title = 'Sort visible bookmarks';
  sort.setAttribute('aria-label', 'Sort visible bookmarks');
  sort.addEventListener('change', (event) => updateSort(event.target.value));
  sortWrap.append(sort);

  controlStrip.append(searchWrap, scopeWrap, sortWrap);
  section.append(controlStrip);
  const reviewLine = renderCompactReview();
  if (reviewLine) section.append(reviewLine);

  const list = create('div', 'list');
  if (!state.visibleBookmarks.length) {
    const empty = create('div', 'empty');
    empty.append(
      create('div', 'metric-value', '0'),
      create('div', 'empty-copy', `No bookmarks for ${modeLabel(state.mode).toLowerCase()} after this filter.`)
    );
    list.append(empty);
  } else {
    state.visibleBookmarks.slice(0, 8).forEach((bookmark) => list.append(renderItem(bookmark)));
    if (state.visibleBookmarks.length > 8) {
      const more = create('div', 'helper', `Showing 8 of ${state.visibleBookmarks.length}. Open the dashboard for the full library console.`);
      list.append(more);
    }
  }

  section.append(list);
  root.append(section);
}

function metricCard(value, label) {
  const card = create('div', 'metric');
  card.append(create('div', 'metric-value', value), create('div', 'metric-label', label));
  return card;
}

function reviewAction(label, onClick) {
  const button = create('button', 'button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

function renderReview(root) {
  const section = create('div', 'section');
  const dupGroups = duplicateGroupsCount(state.scopeBookmarks);
  const cards = [
    {
      tone: dupGroups ? 'danger' : '',
      title: `${dupGroups} duplicate group${dupGroups === 1 ? '' : 's'}`,
      body: 'Same URL, multiple copies. Classic bookmark sludge.',
      actions: [reviewAction('Open dashboard cleanup', openDashboard)]
    },
    {
      tone: state.scopeSummary.oldCount ? 'danger' : '',
      title: `${state.scopeSummary.oldCount} old bookmark${state.scopeSummary.oldCount === 1 ? '' : 's'}`,
      body: `Older than ${OLD_BOOKMARK_DAYS} days in this scope. Age is not guilt, but it is suspicious.`,
      actions: [reviewAction('Inspect in dashboard', openDashboard)]
    },
    {
      tone: state.scopeSummary.untitledCount || state.scopeSummary.titleCollisionCount ? 'danger' : '',
      title: `${state.scopeSummary.untitledCount} untitled · ${state.scopeSummary.titleCollisionCount} title collisions`,
      body: 'Metadata mess hides intent faster than most people admit.',
      actions: [reviewAction('Fix in dashboard', openDashboard)]
    }
  ];

  cards.forEach((entry) => {
    const card = create('div', `review-card${entry.tone ? ` ${entry.tone}` : ''}`);
    card.append(create('div', 'metric-label', entry.title), create('div', 'empty-copy', entry.body));
    const actions = create('div', 'footer-actions');
    entry.actions.forEach((action) => actions.append(action));
    card.append(actions);
    section.append(card);
  });

  const footer = create('div', 'footer-note');
  footer.append(
    create('div', 'helper', 'The popup stays scoped and fast on purpose. Library-wide trends, sessions, health scans, and mass cleanup belong in the dashboard.')
  );
  section.append(footer);
  root.append(section);
}

function renderActions(root) {
  const section = create('div', 'section');
  const grid = create('div', 'actions-grid');

  const bookmarkButton = create('button', 'button primary', 'Bookmark current page');
  bookmarkButton.type = 'button';
  bookmarkButton.addEventListener('click', bookmarkCurrentPage);

  const dashboardButton = create('button', 'button', 'Open Library Dashboard');
  dashboardButton.type = 'button';
  dashboardButton.addEventListener('click', openDashboard);

  const chromeButton = create('button', 'button', 'Open Chrome bookmarks');
  chromeButton.type = 'button';
  chromeButton.addEventListener('click', () => chrome.tabs.create({ url: 'chrome://bookmarks/', active: true }));

  const settingsButton = create('button', 'button', 'Open settings');
  settingsButton.type = 'button';
  settingsButton.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('options.html'), active: true }));

  grid.append(bookmarkButton, dashboardButton, chromeButton, settingsButton);

  const toggles = create('div', 'footer-note');
  const queryButton = create('button', `chip${state.ignoreQueryString ? ' active' : ''}`, `Ignore query ${state.ignoreQueryString ? 'on' : 'off'}`);
  queryButton.type = 'button';
  queryButton.addEventListener('click', () => updateParsePreference('ignoreQueryString', !state.ignoreQueryString));
  const hashButton = create('button', `chip${state.ignoreHashFragment ? ' active' : ''}`, `Ignore hash ${state.ignoreHashFragment ? 'on' : 'off'}`);
  hashButton.type = 'button';
  hashButton.addEventListener('click', () => updateParsePreference('ignoreHashFragment', !state.ignoreHashFragment));
  toggles.append(create('div', 'helper', 'Matching rules for page scope:'), create('div', 'footer-actions', undefined));
  toggles.lastChild.append(queryButton, hashButton);

  section.append(grid, toggles);
  root.append(section);
}

function renderItem(bookmark) {
  const item = create('div', 'item');
  const top = create('div', 'item-top');
  const main = create('div', 'item-main');
  const favicon = createFaviconNode(bookmark);
  const body = create('div');
  body.append(create('h3', 'item-title', bookmark.title));
  body.append(create('div', 'item-url', bookmark.url));
  body.append(create('div', 'item-path', bookmark.path || 'Root'));

  const actions = create('div', 'item-actions');
  const open = create('button', 'icon-button');
  open.type = 'button';
  open.title = 'Open';
  open.textContent = '↗';
  open.addEventListener('click', () => openUrl(bookmark.url));

  const folder = create('button', 'icon-button');
  folder.type = 'button';
  folder.title = 'Show in bookmarks';
  folder.textContent = '📁';
  folder.addEventListener('click', () => openFolder(bookmark.parentId));

  const remove = create('button', 'icon-button');
  remove.type = 'button';
  remove.title = 'Delete';
  remove.textContent = '🗑';
  remove.addEventListener('click', () => deleteBookmark(bookmark));

  actions.append(open, folder, remove);
  main.append(favicon, body);
  top.append(main, actions);
  item.append(top);

  const badges = create('div', 'badges');
  if (bookmark.isDuplicate) badges.append(chip('Duplicate', 'danger'));
  if (bookmark.isOld) badges.append(chip(`Old ${bookmark.ageDays}d`, 'warning'));
  if (bookmark.isUntitled) badges.append(chip('Untitled', 'danger'));
  if (bookmark.hasTitleCollision) badges.append(chip('Title collision', 'warning'));
  if (badges.childNodes.length) item.append(badges);
  return item;
}

function chip(label, tone = '') {
  return create('div', `chip${tone ? ` ${tone}` : ''}`, label);
}


function updateFooterUI() {
  if (!footerRefs.shell || !footerRefs.panelBody || !footerRefs.panelControls || !footerRefs.nav) return;
  const activeTab = getFooterTab();
  footerRefs.panelBody.textContent = activeTab?.message || '';
  footerRefs.panelControls.textContent = '';
  const actionHandler = resolveFooterAction(activeTab);
  if (activeTab?.ctaLabel) {
    const actionButton = create('button', 'footer-link-button', activeTab.ctaLabel);
    actionButton.type = 'button';
    if (actionHandler) actionButton.addEventListener('click', actionHandler);
    else actionButton.disabled = true;
    footerRefs.panelControls.append(actionButton);
  }
  footerRefs.nav.querySelectorAll('.footer-nav-item').forEach((item) => {
    const isActive = item.dataset.footerId === activeTab?.id;
    item.classList.toggle('active', isActive);
    item.dataset.active = isActive ? 'true' : 'false';
  });
  requestAnimationFrame(() => {
    positionFooterIndicator(footerRefs.nav);
    updateFooterIndicatorProgress();
  });
}

function getFooterTab() {
  const items = getFooterItems();
  return items.find((tab) => tab.id === state.footerTab) || items[0];
}

function positionFooterIndicator(nav) {
  if (!nav) return;
  const activeItem = nav.querySelector('.footer-nav-item.active');
  const activeLine = nav.querySelector('.footer-nav-active-line');
  const progressLine = nav.querySelector('.footer-nav-progress');
  if (!activeItem || !activeLine || !progressLine) return;
  const navRect = nav.getBoundingClientRect();
  const itemRect = activeItem.getBoundingClientRect();
  const left = Math.max(0, itemRect.left - navRect.left + 8);
  const width = Math.max(18, itemRect.width - 16);
  activeLine.style.left = `${left}px`;
  activeLine.style.width = `${width}px`;
  progressLine.style.left = `${left}px`;
  progressLine.style.width = `${width}px`;
  progressLine.style.transform = `scaleX(${activeItem.dataset.active === 'true' ? state.footerProgress : 0})`;
}


function updateFooterIndicatorProgress() {
  const indicator = document.querySelector('.footer-nav-progress');
  if (indicator) indicator.style.transform = `scaleX(${state.footerProgress})`;
}

function stopFooterAutoRotate(resetProgress = true) {
  if (footerAnimationFrame) {
    cancelAnimationFrame(footerAnimationFrame);
    footerAnimationFrame = null;
  }
  footerCycleStartedAt = null;
  if (resetProgress) state.footerProgress = 0;
}

function pauseFooterAutoRotate() {
  state.footerHoverPaused = true;
  if (footerAnimationFrame) {
    cancelAnimationFrame(footerAnimationFrame);
    footerAnimationFrame = null;
  }
}

function resumeFooterAutoRotate() {
  state.footerHoverPaused = false;
  footerCycleStartedAt = performance.now() - (state.footerProgress * getFooterRotateMs());
  ensureFooterAutoRotate();
}

function ensureFooterAutoRotate() {
  if (!state.footerAutoRotate || state.footerHoverPaused) {
    if (footerAnimationFrame) {
      cancelAnimationFrame(footerAnimationFrame);
      footerAnimationFrame = null;
    }
    return;
  }
  if (!footerCycleStartedAt) footerCycleStartedAt = performance.now();
  if (footerAnimationFrame) cancelAnimationFrame(footerAnimationFrame);
  const tick = (now) => {
    if (!state.footerAutoRotate || state.footerHoverPaused) return;
    const elapsed = now - footerCycleStartedAt;
    const progress = Math.max(0, Math.min(1, elapsed / getFooterRotateMs()));
    state.footerProgress = progress;
    updateFooterIndicatorProgress();
    if (progress >= 1) {
      const items = getFooterItems();
      const currentIndex = items.findIndex((tab) => tab.id === state.footerTab);
      const nextIndex = (currentIndex + 1) % items.length;
      state.footerTab = items[nextIndex].id;
      footerCycleStartedAt = now;
      state.footerProgress = 0;
      updateFooterUI();
      footerAnimationFrame = requestAnimationFrame(tick);
      return;
    }
    footerAnimationFrame = requestAnimationFrame(tick);
  };
  footerAnimationFrame = requestAnimationFrame(tick);
}

function resolveFooterAction(item) {
  if (!item) return null;
  if (item.action === 'link') {
    return () => {
      if (item.url) {
        chrome.tabs.create({ url: item.url, active: true });
      } else {
        setToast(`Set the URL for ${item.label} in footerConfig.js.`, false, null, 2200);
      }
    };
  }
  if (item.action === 'info') {
    if (item.url) return () => chrome.tabs.create({ url: item.url, active: true });
    return () => openDashboard();
  }
  return null;
}

function renderFooter(root) {
  const items = getFooterItems();
  if (!items.length) return;

  const footerShell = create('div', 'footer-shell');
  const activeTab = getFooterTab();
  if (!state.footerTab) state.footerTab = activeTab.id;

  const panel = create('div', 'footer-panel');
  const panelTop = create('div', 'footer-panel-top');
  const copy = create('div', 'footer-panel-copy');
  copy.append(create('div', 'footer-panel-body', activeTab.message || ''));

  const controls = create('div', 'footer-panel-controls');
  const actionHandler = resolveFooterAction(activeTab);
  if (activeTab.ctaLabel) {
    const actionButton = create('button', 'footer-link-button', activeTab.ctaLabel);
    actionButton.type = 'button';
    if (actionHandler) actionButton.addEventListener('click', actionHandler);
    else actionButton.disabled = true;
    controls.append(actionButton);
  }

  panelTop.append(copy, controls);
  panel.append(panelTop);

  const nav = create('div', 'footer-nav');
  nav.style.gridTemplateColumns = `repeat(${Math.max(1, items.length)}, minmax(0, 1fr))`;
  nav.append(create('div', 'footer-nav-track'));
  nav.append(create('div', 'footer-nav-active-line'));
  nav.append(create('div', 'footer-nav-progress'));
  items.forEach((tab) => {
    const item = create('button', `footer-nav-item${tab.id === activeTab.id ? ' active' : ''}`);
    item.type = 'button';
    item.title = tab.label;
    item.dataset.footerId = tab.id;
    item.dataset.active = tab.id === activeTab.id ? 'true' : 'false';
    item.append(create('span', 'footer-nav-label', tab.label));
    item.addEventListener('click', () => {
      state.footerTab = tab.id;
      footerCycleStartedAt = performance.now();
      state.footerProgress = 0;
      updateFooterUI();
      ensureFooterAutoRotate();
    });
    nav.append(item);
  });

  footerShell.addEventListener('mouseenter', pauseFooterAutoRotate);
  footerShell.addEventListener('mouseleave', resumeFooterAutoRotate);
  footerShell.append(panel, nav);
  root.append(footerShell);
  footerRefs.shell = footerShell;
  footerRefs.panelBody = copy.firstChild;
  footerRefs.panelControls = controls;
  footerRefs.nav = nav;
  updateFooterUI();
}

function renderToast(root) {
  if (!state.toast) return;
  const toast = create('div', `toast${state.toast.error ? ' error' : ''}`);
  toast.append(create('div', 'toast-copy', state.toast.message));
  if (state.toast.action?.label && typeof state.toast.action.handler === 'function') {
    const action = create('button', 'button toast-action-button');
    action.type = 'button';
    action.textContent = state.toast.action.label;
    action.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.clearTimeout(setToast._timer);
      await state.toast.action.handler();
    });
    toast.append(action);
  }
  root.append(toast);
}

function render() {
  app.textContent = '';
  footerRefs.shell = null;
  footerRefs.panelBody = null;
  footerRefs.panelControls = null;
  footerRefs.nav = null;
  const shell = create('div', 'shell');
  renderHeader(shell);
  const content = create('div', 'content');
  renderMatches(content);
  shell.append(content);
  renderFooter(shell);
  app.append(shell);
  createAboutModal(app);
  renderToast(app);
  updateThemeControls();
  ensureFooterAutoRotate();
}

let stopWatchingTheme = null;

async function init() {
  try {
    state.themeMode = await loadStoredTheme();
    applyTheme(state.themeMode);
    stopWatchingTheme = watchSystemTheme(() => {
      if (state.themeMode === THEME_MODES.SYSTEM) applyTheme(state.themeMode);
    });
    await loadPrefs();
    await refresh();
  } catch (error) {
    console.error(error);
    app.textContent = '';
    const fallback = create('div', 'shell');
    const section = create('div', 'section');
    section.append(
      create('h1', 'title', 'Bookmark Manager'),
      create('div', 'subtitle', 'Popup hit a wall'),
      create('div', 'empty-copy', error?.message || 'Unknown popup error')
    );
    fallback.append(section);
    app.append(fallback);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
