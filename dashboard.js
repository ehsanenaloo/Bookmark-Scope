import {
  MATCH_MODES,
  SORT_OPTIONS,
  STORAGE_KEYS,
  KEYBOARD_SHORTCUTS,
  POPUP_WIDTHS,
  MERGE_STRATEGIES,
  CLEANUP_FILTERS,
  OLD_BOOKMARK_DAYS,
  HEALTH_STATUSES,
  HEALTH_SCAN_TIMEOUT_MS,
  HEALTH_SCAN_CONCURRENCY,
  THEME_MODES
} from './src/constants.js';
import {
  getNormalizedBookmarks,
  detectDuplicates,
  filterScopedBookmarks,
  sortBookmarks,
  groupDuplicates,
  getDefaultImportParentId,
  getCleanupSummary
} from './src/bookmark-utils.js';
import { getMatchTarget, matchesMode } from './src/url-utils.js';
import { applyTheme, loadStoredTheme, saveThemeMode, watchSystemTheme } from './src/theme-utils.js';

const DASHBOARD_MODE = 'library';
const DASHBOARD_STORAGE_KEYS = {
  MODE: 'dashboardMode',
  SORT: 'dashboardSort',
  DUPLICATES_ONLY: 'dashboardDuplicatesOnly',
  CLEANUP_FILTER: 'dashboardCleanupFilter',
  SIDEBAR_COLLAPSED: 'dashboardSidebarCollapsed'
};

const state = {
  mode: DASHBOARD_MODE,
  sort: SORT_OPTIONS.TITLE_ASC,
  query: '',
  duplicatesOnly: false,
  cleanupFilter: CLEANUP_FILTERS.ALL,
  ignoreQueryString: false,
  ignoreHashFragment: true,
  popupWidth: POPUP_WIDTHS.COMFORTABLE,
  mergeStrategy: MERGE_STRATEGIES.KEEP_NEWEST,
  tab: null,
  target: null,
  allBookmarks: [],
  scopedBookmarks: [],
  visibleBookmarks: [],
  scopeSummary: null,
  visibleSummary: null,
  librarySummary: null,
  scopeFolderCount: 0,
  visibleDuplicateGroups: 0,
  newestVisibleBookmark: null,
  editingBookmarkId: null,
  selectedIds: new Set(),
  lastDeletedBatch: null,
  toast: null,
  focusSearchAfterRender: false,
  searchSelectionStart: null,
  searchSelectionEnd: null,
  activeBookmarkId: null,
  healthByKey: {},
  healthSummary: null,
  healthLastRunAt: null,
  isInspectingHealth: false,
  healthScanProgress: 0,
  reviewSessions: [],
  cleanupHistory: [],
  reminderEnabled: false,
  reminderIntervalDays: 14,
  lastReviewAt: 0,
  nextReviewAt: 0,
  sidebarTab: 'overview',
  sidebarCollapsed: false,
  themeMode: THEME_MODES.SYSTEM,
  listScrollTop: 0,
  shouldScrollActiveIntoView: false,
  aboutOpen: false,
  rowMenuBookmarkId: null,
  rowMenuPosition: null
};

const app = document.getElementById('app');
let searchInputRef = null;
let importInputRef = null;

async function sendMessage(message) {
  try {
    return await chrome.runtime.sendMessage(message);
  } catch (error) {
    console.warn('Runtime message failed.', error);
    return null;
  }
}

async function getActiveTabContext() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs?.[0] || null;
    return { tab, target: tab?.url ? getMatchTarget(tab.url, getParseOptions()) : null };
  } catch (error) {
    console.warn('Direct tab lookup failed.', error);
  }

  const response = await sendMessage({ type: 'GET_ACTIVE_TAB_CONTEXT' });
  return {
    tab: response?.tab || null,
    target: response?.tab?.url ? getMatchTarget(response.tab.url, getParseOptions()) : response?.target || null
  };
}

function getParseOptions() {
  return {
    ignoreQueryString: state.ignoreQueryString,
    ignoreHashFragment: state.ignoreHashFragment
  };
}

function applyPopupWidth() {
  const width = state.popupWidth === POPUP_WIDTHS.COMPACT ? '430px' : '500px';
  document.documentElement.style.setProperty('--popup-width', width);
}

async function loadPreferences() {
  const stored = await chrome.storage.local.get([
    DASHBOARD_STORAGE_KEYS.MODE,
    DASHBOARD_STORAGE_KEYS.SORT,
    DASHBOARD_STORAGE_KEYS.DUPLICATES_ONLY,
    STORAGE_KEYS.IGNORE_QUERY,
    STORAGE_KEYS.IGNORE_HASH,
    STORAGE_KEYS.POPUP_WIDTH,
    STORAGE_KEYS.MERGE_STRATEGY,
    DASHBOARD_STORAGE_KEYS.CLEANUP_FILTER,
    DASHBOARD_STORAGE_KEYS.SIDEBAR_COLLAPSED,
    STORAGE_KEYS.REVIEW_SESSIONS,
    STORAGE_KEYS.CLEANUP_HISTORY,
    STORAGE_KEYS.REVIEW_REMINDER_ENABLED,
    STORAGE_KEYS.REVIEW_REMINDER_INTERVAL_DAYS,
    STORAGE_KEYS.REVIEW_REMINDER_LAST_REVIEW_AT,
    STORAGE_KEYS.REVIEW_REMINDER_NEXT_AT,
    STORAGE_KEYS.THEME_MODE
  ]);

  state.mode = DASHBOARD_MODE;
  state.sort = stored[DASHBOARD_STORAGE_KEYS.SORT] || SORT_OPTIONS.TITLE_ASC;
  state.ignoreQueryString = Boolean(stored[STORAGE_KEYS.IGNORE_QUERY]);
  state.ignoreHashFragment = stored[STORAGE_KEYS.IGNORE_HASH] !== false;
  state.popupWidth = stored[STORAGE_KEYS.POPUP_WIDTH] || POPUP_WIDTHS.COMFORTABLE;
  state.mergeStrategy = stored[STORAGE_KEYS.MERGE_STRATEGY] || MERGE_STRATEGIES.KEEP_NEWEST;
  state.cleanupFilter = stored[DASHBOARD_STORAGE_KEYS.CLEANUP_FILTER] || CLEANUP_FILTERS.ALL;
  state.duplicatesOnly = state.cleanupFilter === CLEANUP_FILTERS.DUPLICATES;
  state.sidebarCollapsed = Boolean(stored[DASHBOARD_STORAGE_KEYS.SIDEBAR_COLLAPSED]);
  state.reviewSessions = Array.isArray(stored[STORAGE_KEYS.REVIEW_SESSIONS]) ? stored[STORAGE_KEYS.REVIEW_SESSIONS] : [];
  state.cleanupHistory = Array.isArray(stored[STORAGE_KEYS.CLEANUP_HISTORY]) ? stored[STORAGE_KEYS.CLEANUP_HISTORY] : [];
  state.reminderEnabled = Boolean(stored[STORAGE_KEYS.REVIEW_REMINDER_ENABLED]);
  state.reminderIntervalDays = Number(stored[STORAGE_KEYS.REVIEW_REMINDER_INTERVAL_DAYS] || 14);
  state.lastReviewAt = Number(stored[STORAGE_KEYS.REVIEW_REMINDER_LAST_REVIEW_AT] || 0);
  state.nextReviewAt = Number(stored[STORAGE_KEYS.REVIEW_REMINDER_NEXT_AT] || 0);
  state.themeMode = stored[STORAGE_KEYS.THEME_MODE] || THEME_MODES.SYSTEM;
  applyTheme(state.themeMode);
  applyPopupWidth();
}

async function savePreferences() {
  await chrome.storage.local.set({
    [DASHBOARD_STORAGE_KEYS.SORT]: state.sort,
    [DASHBOARD_STORAGE_KEYS.DUPLICATES_ONLY]: state.duplicatesOnly,
    [STORAGE_KEYS.IGNORE_QUERY]: state.ignoreQueryString,
    [STORAGE_KEYS.IGNORE_HASH]: state.ignoreHashFragment,
    [STORAGE_KEYS.POPUP_WIDTH]: state.popupWidth,
    [STORAGE_KEYS.MERGE_STRATEGY]: state.mergeStrategy,
    [DASHBOARD_STORAGE_KEYS.CLEANUP_FILTER]: state.cleanupFilter,
    [DASHBOARD_STORAGE_KEYS.SIDEBAR_COLLAPSED]: state.sidebarCollapsed
  });
}

function create(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}


function iconSvg(kind) {
  const icons = {
    bookmarks: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h8a1 1 0 0 1 1 1v9.2l-5-2.5-5 2.5V3.5a1 1 0 0 1 1-1Z"/></svg>`,
    settings: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm5.1 2.8-.96.35a4.72 4.72 0 0 1-.33.79l.44.93-1.1 1.1-.93-.44a4.72 4.72 0 0 1-.79.33l-.35.96H6.91l-.35-.96a4.72 4.72 0 0 1-.79-.33l-.93.44-1.1-1.1.44-.93a4.72 4.72 0 0 1-.33-.79L2.9 8l.35-1.09c.07-.27.18-.53.33-.79l-.44-.93 1.1-1.1.93.44c.26-.15.52-.26.79-.33l.35-.96h2.18l.35.96c.27.07.53.18.79.33l.93-.44 1.1 1.1-.44.93c.15.26.26.52.33.79L13.1 8Z"/></svg>`,
    system: `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.2" width="11" height="7.8" rx="1.4"/><path d="M6.1 12.6h3.8M8 11v1.6"/></svg>`,
    light: `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.9"/><path d="M8 1.8v1.7M8 12.5v1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M1.8 8h1.7M12.5 8h1.7M3.6 12.4l1.2-1.2M11.2 4.8l1.2-1.2"/></svg>`,
    dark: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.9 1.9A5.7 5.7 0 1 0 14.1 12 6.1 6.1 0 0 1 10.9 1.9Z"/></svg>`,
    overview: `<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3" width="4.2" height="4.2" rx="1"/><rect x="9.3" y="3" width="4.2" height="2.8" rx="1"/><rect x="9.3" y="7.2" width="4.2" height="5.8" rx="1"/><rect x="2.5" y="8.6" width="4.2" height="4.4" rx="1"/></svg>`,
    cleanup: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 5.2h10"/><path d="M6.1 2.8h3.8"/><path d="M5 5.2l.6 7.3h4.8l.6-7.3"/></svg>`,
    health: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13.3s-4.7-2.8-4.7-6.5A2.6 2.6 0 0 1 8 5.3a2.6 2.6 0 0 1 4.7 1.5c0 3.7-4.7 6.5-4.7 6.5Z"/><path d="M6.3 8h3.4"/><path d="M8 6.3v3.4"/></svg>`,
    history: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.1A4.9 4.9 0 1 1 3.6 6"/><path d="M2.8 2.8v3.1h3.1"/><path d="M8 5.5v2.8l1.9 1.1"/></svg>`,
    chevronLeft: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m9.8 3.2-4.3 4.8 4.3 4.8"/></svg>`,
    chevronRight: `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6.2 3.2 4.3 4.8-4.3 4.8"/></svg>`,
    info: `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.8"/><path d="M8 7.1v3.2"/><circle cx="8" cy="4.9" r=".8" fill="currentColor" stroke="none"/></svg>`
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

function createThemeControls() {
  const wrap = create('div', 'theme-controls dashboard-theme-controls');
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
    case MATCH_MODES.DOMAIN:
      return 'This domain';
    case DASHBOARD_MODE:
      return 'Entire library';
    default:
      return 'This domain';
  }
}

function selectedBookmarks() {
  return state.visibleBookmarks.filter((bookmark) => state.selectedIds.has(bookmark.id));
}

function cleanupSelection() {
  const validIds = new Set(state.visibleBookmarks.map((item) => item.id));
  state.selectedIds = new Set([...state.selectedIds].filter((id) => validIds.has(id)));
}

function ensureActiveBookmark() {
  const validIds = new Set(state.visibleBookmarks.map((item) => item.id));
  if (state.activeBookmarkId && validIds.has(state.activeBookmarkId)) return;
  state.activeBookmarkId = state.visibleBookmarks[0]?.id || null;
}

function getActiveBookmark() {
  return state.visibleBookmarks.find((bookmark) => bookmark.id === state.activeBookmarkId) || null;
}

function moveActiveBookmark(direction) {
  if (!state.visibleBookmarks.length) {
    state.activeBookmarkId = null;
    return;
  }
  const currentIndex = state.visibleBookmarks.findIndex((bookmark) => bookmark.id === state.activeBookmarkId);
  const baseIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = Math.max(0, Math.min(state.visibleBookmarks.length - 1, baseIndex + direction));
  state.activeBookmarkId = state.visibleBookmarks[nextIndex]?.id || state.visibleBookmarks[0]?.id || null;
  state.shouldScrollActiveIntoView = true;
}

function rememberListScroll() {
  const listScroll = app?.querySelector('.list-scroll');
  if (listScroll) state.listScrollTop = listScroll.scrollTop;
}

function setActiveBookmark(bookmarkId) {
  state.activeBookmarkId = bookmarkId;
}

function getScopedBookmarks() {
  return state.scopedBookmarks || [];
}

function getScopeSummary() {
  return state.scopeSummary || getCleanupSummary(getScopedBookmarks());
}

function getLibrarySummary() {
  return state.librarySummary || getCleanupSummary(state.allBookmarks || []);
}

function getViewStats() {
  const scoped = getScopedBookmarks();
  const visible = state.visibleBookmarks || [];
  return {
    scopedCount: scoped.length,
    visibleCount: visible.length,
    selectedCount: state.selectedIds?.size || 0,
    duplicateCount: state.visibleSummary?.duplicateCount || 0,
    duplicateGroupCount: state.visibleDuplicateGroups || 0,
    folderCount: state.scopeFolderCount || 0
  };
}

function getHealthKey(bookmark) {
  return bookmark?.parsed?.normalizedPageKey || bookmark?.url || '';
}

function getHealthRecord(bookmark) {
  const key = getHealthKey(bookmark);
  return key ? state.healthByKey[key] || null : null;
}

function summarizeHealth(items) {
  const summary = {
    checked: 0,
    healthy: 0,
    redirected: 0,
    broken: 0,
    serverError: 0,
    unreachable: 0,
    unknown: 0
  };
  const seen = new Set();
  for (const item of items || []) {
    const key = getHealthKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const record = state.healthByKey[key];
    if (!record) {
      summary.unknown += 1;
      continue;
    }
    summary.checked += 1;
    switch (record.status) {
      case HEALTH_STATUSES.HEALTHY:
        summary.healthy += 1;
        break;
      case HEALTH_STATUSES.REDIRECTED:
        summary.redirected += 1;
        break;
      case HEALTH_STATUSES.BROKEN:
        summary.broken += 1;
        break;
      case HEALTH_STATUSES.SERVER_ERROR:
        summary.serverError += 1;
        break;
      case HEALTH_STATUSES.UNREACHABLE:
        summary.unreachable += 1;
        break;
      case HEALTH_STATUSES.UNKNOWN:
      default:
        summary.unknown += 1;
        break;
    }
  }
  return summary;
}


function getBookmarksByHealthStatus(statuses, items = state.visibleBookmarks) {
  const wanted = new Set(statuses);
  return (items || []).filter((bookmark) => {
    const record = getHealthRecord(bookmark);
    return record && wanted.has(record.status);
  });
}

function getRedirectedBookmarks(items = state.visibleBookmarks) {
  return (items || []).filter((bookmark) => {
    const record = getHealthRecord(bookmark);
    return record && record.status === HEALTH_STATUSES.REDIRECTED && record.finalUrl && record.finalUrl !== bookmark.url;
  });
}

function getReviewQueue() {
  const scopeSummary = getScopeSummary();
  const health = state.healthSummary || summarizeHealth(state.visibleBookmarks);
  const unhealthyBookmarks = getBookmarksByHealthStatus([
    HEALTH_STATUSES.BROKEN,
    HEALTH_STATUSES.SERVER_ERROR,
    HEALTH_STATUSES.UNREACHABLE
  ]);
  const redirectedBookmarks = getRedirectedBookmarks();
  const cards = [];

  if (unhealthyBookmarks.length) {
    cards.push({
      id: 'unhealthy',
      tone: 'danger',
      title: 'Unhealthy links need triage',
      body: `${unhealthyBookmarks.length} visible bookmark${unhealthyBookmarks.length === 1 ? '' : 's'} failed health checks. Broken junk should not squat in your library.`,
      actions: [
        { label: 'Select unhealthy', run: () => selectBookmarks(unhealthyBookmarks) },
        { label: 'Review unhealthy', run: () => { clearCleanupFilters(); state.query = ''; render(); } }
      ]
    });
  }

  if (redirectedBookmarks.length) {
    cards.push({
      id: 'redirects',
      tone: 'warning',
      title: 'Redirected URLs can be repaired',
      body: `${redirectedBookmarks.length} visible bookmark${redirectedBookmarks.length === 1 ? '' : 's'} point to a redirect. Update them to the final destination and cut the detour.`,
      actions: [
        { label: 'Select redirected', run: () => selectBookmarks(redirectedBookmarks) },
        { label: 'Repair redirected', run: () => handleRepairRedirects(redirectedBookmarks) }
      ]
    });
  }

  if (scopeSummary.oldCount) {
    cards.push({
      id: 'stale',
      tone: 'muted',
      title: 'Stale bookmarks deserve review',
      body: `${scopeSummary.oldCount} bookmark${scopeSummary.oldCount === 1 ? '' : 's'} in this scope are older than ${OLD_BOOKMARK_DAYS} days. Old is not always bad, but it is where dead knowledge likes to hide.`,
      actions: [
        { label: 'Review stale', run: () => runCleanupPreset(CLEANUP_FILTERS.OLD, 'age:old') }
      ]
    });
  }

  if (scopeSummary.duplicateGroupCount) {
    cards.push({
      id: 'duplicates',
      tone: 'muted',
      title: 'Duplicate groups are wasting oxygen',
      body: `${scopeSummary.duplicateGroupCount} duplicate group${scopeSummary.duplicateGroupCount === 1 ? '' : 's'} found in this scope. Same URL, multiple corpses.`,
      actions: [
        { label: 'Review duplicates', run: () => runCleanupPreset(CLEANUP_FILTERS.DUPLICATES, 'is:duplicate') },
        { label: 'Merge visible duplicates', run: () => handleMergeDuplicates() }
      ]
    });
  }

  if (scopeSummary.untitledCount || scopeSummary.titleCollisionCount) {
    cards.push({
      id: 'metadata',
      tone: 'muted',
      title: 'Metadata cleanup is still cleanup',
      body: `${scopeSummary.untitledCount} untitled and ${scopeSummary.titleCollisionCount} title-collision bookmark${scopeSummary.titleCollisionCount === 1 ? '' : 's'} are muddying the water.`,
      actions: [
        { label: 'Review untitled', run: () => runCleanupPreset(CLEANUP_FILTERS.UNTITLED, 'is:untitled') },
        { label: 'Review collisions', run: () => runCleanupPreset(CLEANUP_FILTERS.TITLE_COLLISIONS, 'is:title-collision') }
      ]
    });
  }

  if (!cards.length) {
    cards.push({
      id: 'healthy',
      tone: 'success',
      title: 'Review queue is clear',
      body: health.checked ? 'Nothing obvious is screaming for attention in this visible scope. Miracles happen.' : 'No obvious cleanup priority yet. Run a health scan if you want the queue to get pickier.',
      actions: []
    });
  }

  return cards;
}

function healthLabel(record) {
  if (!record) return 'Unchecked';
  switch (record.status) {
    case HEALTH_STATUSES.HEALTHY:
      return record.statusCode ? `Healthy ${record.statusCode}` : 'Healthy';
    case HEALTH_STATUSES.REDIRECTED:
      return record.statusCode ? `Redirected ${record.statusCode}` : 'Redirected';
    case HEALTH_STATUSES.BROKEN:
      return record.statusCode ? `Broken ${record.statusCode}` : 'Broken';
    case HEALTH_STATUSES.SERVER_ERROR:
      return record.statusCode ? `Server ${record.statusCode}` : 'Server error';
    case HEALTH_STATUSES.UNREACHABLE:
      return 'Unreachable';
    case HEALTH_STATUSES.UNKNOWN:
    default:
      return 'Unchecked';
  }
}

function healthBadgeClass(record) {
  if (!record) return 'duplicate-badge';
  switch (record.status) {
    case HEALTH_STATUSES.HEALTHY:
      return 'duplicate-badge health-healthy';
    case HEALTH_STATUSES.REDIRECTED:
      return 'duplicate-badge health-redirected';
    case HEALTH_STATUSES.BROKEN:
      return 'duplicate-badge health-broken';
    case HEALTH_STATUSES.SERVER_ERROR:
      return 'duplicate-badge health-server-error';
    case HEALTH_STATUSES.UNREACHABLE:
      return 'duplicate-badge health-unreachable';
    default:
      return 'duplicate-badge';
  }
}

function bookmarkStatusBadgeClass(label) {
  const normalized = String(label || '').toLowerCase();
  if (normalized.startsWith('old ')) return 'duplicate-badge status-old';
  if (normalized.includes('duplicate')) return 'duplicate-badge status-duplicate';
  if (normalized.includes('untitled')) return 'duplicate-badge status-untitled';
  if (normalized.includes('collision')) return 'duplicate-badge status-collision';
  return 'duplicate-badge';
}

function buildInspectButton(label, totalCount, className = 'ghost-button') {
  const text = state.isInspectingHealth ? `Inspecting ${state.healthScanProgress}/${Math.max(totalCount, 0)}` : label;
  const button = create('button', `${className}${state.isInspectingHealth ? ' inspect-progress-button is-running' : ''}`, text);
  button.type = 'button';
  if (state.isInspectingHealth) {
    const progress = totalCount > 0 ? Math.min(1, state.healthScanProgress / totalCount) : 0;
    button.style.setProperty('--inspect-progress', `${progress * 100}%`);
    button.setAttribute('aria-busy', 'true');
  } else {
    button.style.removeProperty('--inspect-progress');
    button.removeAttribute('aria-busy');
  }
  button.disabled = state.isInspectingHealth || totalCount === 0;
  return button;
}

async function inspectUrlHealth(url) {
  const methods = ['HEAD', 'GET'];
  for (const method of methods) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), HEALTH_SCAN_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method,
        redirect: 'follow',
        cache: 'no-store',
        signal: controller.signal
      });
      window.clearTimeout(timeoutId);
      const finalUrl = response.url || url;
      const sameUrl = finalUrl === url;
      if (response.status >= 500) {
        return { status: HEALTH_STATUSES.SERVER_ERROR, statusCode: response.status, checkedAt: Date.now(), finalUrl, method };
      }
      if (response.status >= 400) {
        return { status: HEALTH_STATUSES.BROKEN, statusCode: response.status, checkedAt: Date.now(), finalUrl, method };
      }
      if (response.redirected || !sameUrl) {
        return { status: HEALTH_STATUSES.REDIRECTED, statusCode: response.status, checkedAt: Date.now(), finalUrl, method };
      }
      return { status: HEALTH_STATUSES.HEALTHY, statusCode: response.status, checkedAt: Date.now(), finalUrl, method };
    } catch (error) {
      window.clearTimeout(timeoutId);
      const message = String(error?.message || error || '').toLowerCase();
      if (method === 'HEAD' && (message.includes('405') || message.includes('method') || message.includes('not allowed'))) {
        continue;
      }
      if (method === 'HEAD') continue;
      return { status: HEALTH_STATUSES.UNREACHABLE, error: error?.message || 'Network failure', checkedAt: Date.now(), finalUrl: url, method };
    }
  }
  return { status: HEALTH_STATUSES.UNKNOWN, checkedAt: Date.now(), finalUrl: url };
}

async function runWithConcurrency(items, limit, worker) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(limit, Math.max(1, queue.length)) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (next) await worker(next);
    }
  });
  await Promise.all(workers);
}

async function inspectBookmarksHealth(bookmarks) {
  const unique = [];
  const seen = new Set();
  for (const bookmark of bookmarks || []) {
    const key = getHealthKey(bookmark);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(bookmark);
  }

  if (!unique.length) {
    setToast('No visible links to inspect. Empty battlefield.', { error: true });
    return;
  }

  state.isInspectingHealth = true;
  state.healthScanProgress = 0;
  render();

  await runWithConcurrency(unique, HEALTH_SCAN_CONCURRENCY, async (bookmark) => {
    const record = await inspectUrlHealth(bookmark.url);
    state.healthByKey[getHealthKey(bookmark)] = record;
    state.healthScanProgress += 1;
    state.healthSummary = summarizeHealth(state.visibleBookmarks);
    render();
  });

  state.isInspectingHealth = false;
  state.healthLastRunAt = Date.now();
  state.healthSummary = summarizeHealth(state.visibleBookmarks);
  await pushCleanupHistory({
    type: 'health-scan',
    count: unique.length,
    metrics: {
      healthy: state.healthSummary?.healthy || 0,
      redirected: state.healthSummary?.redirected || 0,
      broken: state.healthSummary?.broken || 0,
      serverError: state.healthSummary?.serverError || 0,
      unreachable: state.healthSummary?.unreachable || 0
    },
    note: `Health scan finished for ${modeLabel(state.mode).toLowerCase()} visible scope.`
  });
  render();
  const summary = state.healthSummary;
  setToast(`Health scan finished: ${summary.healthy} healthy · ${summary.redirected} redirected · ${summary.broken} broken · ${summary.serverError} server · ${summary.unreachable} unreachable.`);
}

function createHighlightedFragment(text, query) {
  const fragment = document.createDocumentFragment();
  const source = String(text || '');
  const needle = String(query || '').trim();
  if (!needle) {
    fragment.append(document.createTextNode(source));
    return fragment;
  }

  const lowerSource = source.toLowerCase();
  const lowerNeedle = needle.toLowerCase();
  let startIndex = 0;

  while (startIndex < source.length) {
    const matchIndex = lowerSource.indexOf(lowerNeedle, startIndex);
    if (matchIndex === -1) {
      fragment.append(document.createTextNode(source.slice(startIndex)));
      break;
    }

    if (matchIndex > startIndex) {
      fragment.append(document.createTextNode(source.slice(startIndex, matchIndex)));
    }

    const mark = create('mark', 'highlight-match');
    mark.textContent = source.slice(matchIndex, matchIndex + needle.length);
    fragment.append(mark);
    startIndex = matchIndex + needle.length;
  }

  return fragment;
}

function cleanupFilterLabel(filter) {
  switch (filter) {
    case CLEANUP_FILTERS.DUPLICATES:
      return 'Duplicate URLs';
    case CLEANUP_FILTERS.UNTITLED:
      return 'Untitled';
    case CLEANUP_FILTERS.OLD:
      return `Old (${OLD_BOOKMARK_DAYS}+ days)`;
    case CLEANUP_FILTERS.TITLE_COLLISIONS:
      return 'Title collisions';
    case CLEANUP_FILTERS.ALL:
    default:
      return 'All items';
  }
}

function getCleanupCount(filter) {
  const summary = getScopeSummary();
  switch (filter) {
    case CLEANUP_FILTERS.DUPLICATES:
      return summary.duplicateCount;
    case CLEANUP_FILTERS.UNTITLED:
      return summary.untitledCount;
    case CLEANUP_FILTERS.OLD:
      return summary.oldCount;
    case CLEANUP_FILTERS.TITLE_COLLISIONS:
      return summary.titleCollisionCount;
    case CLEANUP_FILTERS.ALL:
    default:
      return summary.total;
  }
}

async function setCleanupFilter(filter) {
  state.cleanupFilter = filter;
  state.duplicatesOnly = filter === CLEANUP_FILTERS.DUPLICATES;
  await savePreferences();
  recalculateVisibleBookmarks();
  render();
}

function clearCleanupFilters() {
  state.cleanupFilter = CLEANUP_FILTERS.ALL;
  state.duplicatesOnly = false;
}

function runCleanupPreset(filter, query = '') {
  state.cleanupFilter = filter;
  state.duplicatesOnly = filter === CLEANUP_FILTERS.DUPLICATES;
  state.query = query;
  state.focusSearchAfterRender = true;
  savePreferences();
  recalculateVisibleBookmarks();
  render();
}

function recalculateVisibleBookmarks() {
  if (state.mode !== DASHBOARD_MODE && !state.target?.valid) {
    state.scopedBookmarks = [];
    state.scopeSummary = getCleanupSummary([]);
    state.visibleSummary = getCleanupSummary([]);
    state.scopeFolderCount = 0;
    state.visibleDuplicateGroups = 0;
    state.newestVisibleBookmark = null;
    state.visibleBookmarks = [];
    state.selectedIds.clear();
    return;
  }

  state.scopedBookmarks = state.mode === DASHBOARD_MODE
    ? [...state.allBookmarks]
    : state.allBookmarks.filter((bookmark) => matchesMode(bookmark, state.target, state.mode));
  state.scopeSummary = getCleanupSummary(state.scopedBookmarks);
  state.scopeFolderCount = new Set(state.scopedBookmarks.map((bookmark) => bookmark.path || 'Root')).size;

  const filtered = filterScopedBookmarks(
    state.scopedBookmarks,
    state.query,
    {
      duplicatesOnly: state.duplicatesOnly,
      cleanupFilter: state.cleanupFilter
    }
  );

  state.visibleBookmarks = sortBookmarks(filtered, state.sort);
  state.visibleSummary = getCleanupSummary(state.visibleBookmarks);
  state.healthSummary = summarizeHealth(state.visibleBookmarks);
  state.visibleDuplicateGroups = state.visibleSummary.duplicateGroupCount;
  state.newestVisibleBookmark = state.visibleBookmarks.reduce((best, bookmark) => {
    if (!best) return bookmark;
    return (bookmark.dateAdded || 0) > (best.dateAdded || 0) ? bookmark : best;
  }, null);
  cleanupSelection();
  ensureActiveBookmark();
}

async function refreshData() {
  const context = await getActiveTabContext();
  state.tab = context?.tab || null;
  state.target = context?.target || (state.tab?.url ? getMatchTarget(state.tab.url, getParseOptions()) : null);
  state.allBookmarks = detectDuplicates(await getNormalizedBookmarks(getParseOptions()));
  state.librarySummary = getCleanupSummary(state.allBookmarks);
  recalculateVisibleBookmarks();
}

function setToast(message, options = {}) {
  window.clearTimeout(setToast.timeoutId);
  state.toast = {
    message,
    error: Boolean(options.error),
    actionLabel: options.actionLabel || '',
    action: typeof options.action === 'function' ? options.action : null,
    persist: Boolean(options.persist)
  };
  render();
  if (!state.toast.persist) {
    setToast.timeoutId = window.setTimeout(() => {
      state.toast = null;
      render();
    }, options.duration ?? 2600);
  }
}

function clearToast() {
  window.clearTimeout(setToast.timeoutId);
  state.toast = null;
}

async function persistReviewSessions() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.REVIEW_SESSIONS]: state.reviewSessions.slice(0, 20)
  });
}

async function persistCleanupHistory() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.CLEANUP_HISTORY]: state.cleanupHistory.slice(0, 60)
  });
}

function buildSessionSnapshot() {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    mode: state.mode,
    query: state.query,
    cleanupFilter: state.cleanupFilter,
    duplicatesOnly: state.duplicatesOnly,
    targetLabel: state.target?.label || 'Unknown scope',
    targetSubtitle: state.target?.subtitle || '',
    targetValue: state.target?.modeValue || state.target?.hostname || state.target?.domain || state.target?.normalizedPageKey || '',
    summary: {
      scopedCount: state.scopedBookmarks.length,
      visibleCount: state.visibleBookmarks.length,
      duplicateCount: state.scopeSummary?.duplicateCount || 0,
      oldCount: state.scopeSummary?.oldCount || 0,
      untitledCount: state.scopeSummary?.untitledCount || 0,
      titleCollisionCount: state.scopeSummary?.titleCollisionCount || 0,
      unhealthyCount: (state.healthSummary?.broken || 0) + (state.healthSummary?.serverError || 0) + (state.healthSummary?.unreachable || 0)
    },
    selectedIds: [...state.selectedIds]
  };
}

async function handleSaveReviewSession() {
  if (state.mode !== DASHBOARD_MODE && !state.target?.valid) {
    setToast('Cannot save a session for a page the extension cannot parse.', { error: true });
    return;
  }
  const session = buildSessionSnapshot();
  state.reviewSessions = [session, ...state.reviewSessions.filter((item) => item.id !== session.id)].slice(0, 20);
  await persistReviewSessions();
  setToast(`Saved review session for ${modeLabel(state.mode).toLowerCase()}. Future-you now has breadcrumbs.`);
  render();
}

async function handleRestoreReviewSession(sessionId) {
  const session = state.reviewSessions.find((item) => item.id === sessionId);
  if (!session) {
    setToast('That saved session evaporated.', { error: true });
    return;
  }
  state.mode = session.mode || MATCH_MODES.DOMAIN;
  state.query = session.query || '';
  state.cleanupFilter = session.cleanupFilter || CLEANUP_FILTERS.ALL;
  state.duplicatesOnly = Boolean(session.duplicatesOnly);
  state.selectedIds = new Set(session.selectedIds || []);
  await savePreferences();
  recalculateVisibleBookmarks();
  state.focusSearchAfterRender = true;
  setToast(`Restored session from ${new Date(session.createdAt).toLocaleString()}.`);
  render();
}

async function handleDeleteReviewSession(sessionId) {
  state.reviewSessions = state.reviewSessions.filter((item) => item.id !== sessionId);
  await persistReviewSessions();
  setToast('Saved session deleted. Memory is now slightly more selective.');
  render();
}

async function pushCleanupHistory(entry) {
  const next = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
    mode: state.mode,
    targetLabel: state.target?.label || 'Unknown scope',
    ...entry
  };
  state.cleanupHistory = [next, ...(state.cleanupHistory || [])].slice(0, 60);
  await persistCleanupHistory();
}


function formatActionType(type) {
  return String(type || 'action')
    .split('-')
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : '')
    .join(' ');
}

function getHistoryTrends() {
  const entries = Array.isArray(state.cleanupHistory) ? state.cleanupHistory : [];
  const byType = new Map();
  let totalTouched = 0;
  let recentTouched = 0;
  let redirectsFixed = 0;
  let imports = 0;
  let deletes = 0;
  let latestHealthMetrics = null;
  const now = Date.now();
  const recentCutoff = now - (7 * 24 * 60 * 60 * 1000);

  entries.forEach((entry) => {
    const key = entry?.type || 'action';
    byType.set(key, (byType.get(key) || 0) + 1);
    totalTouched += Number(entry?.count || 0);
    if (Number(entry?.at || 0) >= recentCutoff) {
      recentTouched += Number(entry?.count || 0);
    }
    if (key === 'repair-redirects') redirectsFixed += Number(entry?.count || 0);
    if (key === 'import') imports += Number(entry?.count || 0);
    if (key === 'delete') deletes += Number(entry?.count || 0);
    if (!latestHealthMetrics && key === 'health-scan' && entry?.metrics) {
      latestHealthMetrics = entry.metrics;
    }
  });

  const topTypes = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([type, count]) => ({ type, count, label: formatActionType(type) }));

  return {
    totalActions: entries.length,
    totalTouched,
    recentTouched,
    redirectsFixed,
    imports,
    deletes,
    latestHealthMetrics,
    topTypes
  };
}

function buildReviewReport() {
  return {
    generatedAt: new Date().toISOString(),
    scope: {
      mode: state.mode,
      label: state.target?.label || '',
      subtitle: state.target?.subtitle || ''
    },
    preferences: {
      sort: state.sort,
      cleanupFilter: state.cleanupFilter,
      duplicatesOnly: state.duplicatesOnly,
      ignoreQueryString: state.ignoreQueryString,
      ignoreHashFragment: state.ignoreHashFragment,
      reminderEnabled: state.reminderEnabled,
      reminderIntervalDays: state.reminderIntervalDays,
      nextReviewAt: state.nextReviewAt
    },
    summary: {
      scope: state.scopeSummary,
      visible: state.visibleSummary,
      library: state.librarySummary,
      health: state.healthSummary,
      healthScore: computeHealthScore()
    },
    reviewQueue: getReviewQueue().map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      tone: item.tone || 'neutral'
    })),
    recentHistory: (state.cleanupHistory || []).slice(0, 20),
    savedSessions: (state.reviewSessions || []).slice(0, 10)
  };
}

function exportReviewReport() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  downloadTextFile(`bookmark-manager-review-report-${stamp}.json`, JSON.stringify(buildReviewReport(), null, 2), 'application/json');
  setToast('Exported review report JSON. Tiny audit trail, less amnesia.');
}


function getScopeHealthSummary() {
  return summarizeHealth(state.scopedBookmarks || []);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatRelativeDays(timestamp) {
  if (!timestamp) return 'not scheduled';
  const diff = timestamp - Date.now();
  const days = Math.ceil(Math.abs(diff) / (24 * 60 * 60 * 1000));
  if (days <= 1) return diff >= 0 ? 'within 24h' : 'overdue by <1 day';
  return diff >= 0 ? `in ${days} days` : `overdue by ${days} days`;
}

function buildReminderState() {
  return getReminderState();
}

function getReminderState() {
  const nextAt = Number(state.nextReviewAt || 0);
  const due = Boolean(state.reminderEnabled && nextAt && nextAt <= Date.now());
  return {
    enabled: Boolean(state.reminderEnabled),
    intervalDays: Number(state.reminderIntervalDays || 14),
    lastReviewAt: Number(state.lastReviewAt || 0),
    nextReviewAt: nextAt,
    due,
    statusLabel: !state.reminderEnabled
      ? 'Reminders are off'
      : nextAt
        ? (due ? `Review due — ${formatRelativeDays(nextAt)}` : `Next review ${formatRelativeDays(nextAt)}`)
        : 'Reminder schedule has no next date yet'
  };
}

function computeHealthScore() {
  const total = Math.max(1, state.scopedBookmarks.length || 0);
  const scopeSummary = getScopeSummary();
  const health = getScopeHealthSummary();
  const inspected = Math.max(1, health.checked || 0);
  let score = 100;
  score -= Math.min(35, ((health.broken + health.serverError + health.unreachable) / inspected) * 55);
  score -= Math.min(12, (health.redirected / inspected) * 16);
  score -= Math.min(18, (scopeSummary.duplicateGroupCount / total) * 40);
  score -= Math.min(16, (scopeSummary.oldCount / total) * 24);
  score -= Math.min(10, (scopeSummary.untitledCount / total) * 28);
  score -= Math.min(9, (scopeSummary.titleCollisionCount / total) * 22);
  const rounded = Math.round(clamp(score, 0, 100));
  const grade = rounded >= 90 ? 'A' : rounded >= 80 ? 'B' : rounded >= 70 ? 'C' : rounded >= 55 ? 'D' : 'F';
  const confidence = health.checked ? `Includes link-health data for ${health.checked} checked bookmark${health.checked === 1 ? '' : 's'}.` : 'Metadata-only score until you run a health scan.';
  return { score: rounded, grade, confidence, health };
}

function buildSmartRecommendations() {
  const recommendations = [];
  const scopeSummary = getScopeSummary();
  const health = state.healthSummary || summarizeHealth(state.visibleBookmarks);
  const reminder = getReminderState();
  const score = computeHealthScore();

  if (reminder.enabled && reminder.due) {
    recommendations.push({
      id: 'due-review',
      tone: 'warning',
      title: 'Scheduled review is due',
      body: `Your ${reminder.intervalDays}-day review cadence is overdue. Open the mess now before it ferments.`,
      actions: [
        { label: 'Mark reviewed now', run: handleMarkReviewedNow },
        { label: 'Save review session', run: handleSaveReviewSession }
      ]
    });
  }

  if (!getScopeHealthSummary().checked && state.visibleBookmarks.length) {
    recommendations.push({
      id: 'scan-health',
      tone: 'muted',
      title: 'Run a health scan on this scope',
      body: 'Your health score is partly blind because no visible links have been inspected yet.',
      actions: [
        { label: 'Inspect visible links', run: () => inspectBookmarksHealth(state.visibleBookmarks) }
      ]
    });
  }

  if ((health.broken + health.serverError + health.unreachable) > 0) {
    recommendations.push({
      id: 'unhealthy-links',
      tone: 'danger',
      title: 'Cull or repair unhealthy links',
      body: `${health.broken + health.serverError + health.unreachable} visible bookmark${(health.broken + health.serverError + health.unreachable) === 1 ? '' : 's'} failed health checks. Dead links are pure entropy.`,
      actions: [
        { label: 'Select unhealthy', run: () => {
          state.visibleBookmarks.forEach((bookmark) => {
            const record = getHealthRecord(bookmark);
            if (record && [HEALTH_STATUSES.BROKEN, HEALTH_STATUSES.SERVER_ERROR, HEALTH_STATUSES.UNREACHABLE].includes(record.status)) state.selectedIds.add(bookmark.id);
          });
          render();
        } },
        { label: 'Review unhealthy', run: () => { clearCleanupFilters(); state.query = ''; render(); } }
      ]
    });
  }

  if (health.redirected > 0) {
    recommendations.push({
      id: 'redirect-cleanup',
      tone: 'warning',
      title: 'Repair redirected bookmarks',
      body: `${health.redirected} visible bookmark${health.redirected === 1 ? '' : 's'} could be updated to their final URL and lose the redirect detour.`,
      actions: [
        { label: 'Repair redirected', run: () => handleRepairRedirects(getRedirectedBookmarks()) }
      ]
    });
  }

  if (scopeSummary.duplicateGroupCount > 0) {
    recommendations.push({
      id: 'merge-dupes',
      tone: 'muted',
      title: 'Merge duplicate groups',
      body: `${scopeSummary.duplicateGroupCount} duplicate group${scopeSummary.duplicateGroupCount === 1 ? '' : 's'} are wasting slots in this scope.`,
      actions: [
        { label: 'Review duplicates', run: () => runCleanupPreset(CLEANUP_FILTERS.DUPLICATES, 'is:duplicate') },
        { label: 'Merge visible duplicates', run: handleMergeDuplicates }
      ]
    });
  }

  if (scopeSummary.oldCount > 0 && (scopeSummary.oldCount >= 10 || (scopeSummary.oldCount / Math.max(1, scopeSummary.total)) > 0.25)) {
    recommendations.push({
      id: 'stale-review',
      tone: 'muted',
      title: 'Review stale bookmarks',
      body: `${scopeSummary.oldCount} bookmark${scopeSummary.oldCount === 1 ? '' : 's'} in this scope are old enough to vote twice.`,
      actions: [
        { label: 'Review old', run: () => runCleanupPreset(CLEANUP_FILTERS.OLD, 'age:old') }
      ]
    });
  }

  if ((scopeSummary.untitledCount + scopeSummary.titleCollisionCount) > 0) {
    recommendations.push({
      id: 'metadata',
      tone: 'muted',
      title: 'Fix muddy metadata',
      body: `${scopeSummary.untitledCount} untitled and ${scopeSummary.titleCollisionCount} title-collision bookmark${scopeSummary.titleCollisionCount === 1 ? '' : 's'} are making search dumber than it needs to be.`,
      actions: [
        { label: 'Review untitled', run: () => runCleanupPreset(CLEANUP_FILTERS.UNTITLED, 'is:untitled') },
        { label: 'Review collisions', run: () => runCleanupPreset(CLEANUP_FILTERS.TITLE_COLLISIONS, 'is:title-collision') }
      ]
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      id: 'steady-state',
      tone: 'success',
      title: score.score >= 90 ? 'Library health looks strong' : 'No urgent cleanup recommendation',
      body: score.score >= 90 ? `Health score ${score.score}/${100} (${score.grade}). Nothing obvious is rotting in this scope right now.` : 'Nothing acute is screaming for action. Keep the cadence and the swamp stays shallow.',
      actions: reminder.enabled ? [{ label: 'Mark reviewed now', run: handleMarkReviewedNow }] : []
    });
  }

  return recommendations.slice(0, 4);
}

async function persistReminderSettings() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.REVIEW_REMINDER_ENABLED]: state.reminderEnabled,
    [STORAGE_KEYS.REVIEW_REMINDER_INTERVAL_DAYS]: state.reminderIntervalDays,
    [STORAGE_KEYS.REVIEW_REMINDER_LAST_REVIEW_AT]: state.lastReviewAt,
    [STORAGE_KEYS.REVIEW_REMINDER_NEXT_AT]: state.nextReviewAt
  });
  await sendMessage({ type: 'SYNC_REVIEW_REMINDER' });
}

async function handleUpdateReminderSettings(partial = {}) {
  state.reminderEnabled = partial.enabled ?? state.reminderEnabled;
  state.reminderIntervalDays = Number(partial.intervalDays || state.reminderIntervalDays || 14);
  if (partial.lastReviewAt !== undefined) state.lastReviewAt = Number(partial.lastReviewAt || 0);
  if (partial.nextReviewAt !== undefined) state.nextReviewAt = Number(partial.nextReviewAt || 0);
  if (state.reminderEnabled && !state.nextReviewAt) {
    const anchor = state.lastReviewAt || Date.now();
    state.nextReviewAt = anchor + (state.reminderIntervalDays * 24 * 60 * 60 * 1000);
  }
  if (!state.reminderEnabled) {
    state.nextReviewAt = 0;
  }
  await persistReminderSettings();
  render();
}

async function handleMarkReviewedNow() {
  const now = Date.now();
  state.lastReviewAt = now;
  state.nextReviewAt = now + (state.reminderIntervalDays * 24 * 60 * 60 * 1000);
  if (!state.reminderEnabled) state.reminderEnabled = true;
  await persistReminderSettings();
  await pushCleanupHistory({
    type: 'mark-reviewed',
    count: state.visibleBookmarks.length,
    note: `Marked ${modeLabel(state.mode).toLowerCase()} as reviewed and scheduled the next reminder.`
  });
  setToast(`Review marked complete. Next reminder ${formatRelativeDays(state.nextReviewAt)}.`);
  render();
}

function renderFatal(message, error) {
  app.textContent = '';
  const panel = create('div', 'panel');
  const section = create('div', 'section');
  section.append(
    create('h1', 'title', 'Bookmark Manager'),
    create('div', 'subtitle', message),
    create('div', 'context-text', error?.message || 'No extra diagnostics available.')
  );
  panel.append(section);
  app.append(panel);
}

let stopWatchingTheme = null;

async function init() {
  try {
    state.themeMode = await loadStoredTheme();
    applyTheme(state.themeMode);
    stopWatchingTheme = watchSystemTheme(() => {
      if (state.themeMode === THEME_MODES.SYSTEM) applyTheme(state.themeMode);
    });
    await loadPreferences();
    await refreshData();
    attachKeyboardShortcuts();
    render();
  } catch (error) {
    console.error(error);
    renderFatal('The popup face-planted during startup.', error);
  }
}

function isEditableTarget(element) {
  if (!element) return false;
  const tag = element.tagName;
  return element.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function createCsv(items) {
  const rows = [['title', 'url', 'path', 'dateAdded']];
  for (const item of items) {
    rows.push([item.title, item.url, item.path || '', String(item.dateAdded || 0)]);
  }
  return rows
    .map((row) => row.map((value) => `"${String(value || '').replaceAll('\"', '\"\"')}"`).join(','))
    .join('\n');
}

function getExportItems(scope = 'selected') {
  const items = scope === 'visible' ? state.visibleBookmarks : selectedBookmarks();
  return items.map((item) => ({
    title: item.title,
    url: item.url,
    path: item.path,
    dateAdded: item.dateAdded
  }));
}

async function handleExport(format, scope = 'selected') {
  const items = getExportItems(scope);
  if (!items.length) {
    setToast(`Nothing to export from ${scope}. Empty pockets, empty file.`, { error: true });
    return;
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (format === 'json') {
    downloadTextFile(`bookmark-manager-${scope}-${stamp}.json`, JSON.stringify(items, null, 2), 'application/json');
  } else {
    downloadTextFile(`bookmark-manager-${scope}-${stamp}.csv`, createCsv(items), 'text/csv;charset=utf-8');
  }
  setToast(`Exported ${items.length} bookmark${items.length === 1 ? '' : 's'} as ${format.toUpperCase()}.`);
}

function parseImportedText(text, fileName = '') {
  const name = fileName.toLowerCase();
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (name.endsWith('.json')) {
    const data = JSON.parse(trimmed);
    const items = Array.isArray(data) ? data : [];
    return items
      .map((item) => {
        if (typeof item === 'string') return { title: item, url: item };
        return { title: item.title || item.url || '(Imported bookmark)', url: item.url };
      })
      .filter((item) => item.url);
  }

  const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const looksCsv = name.endsWith('.csv') || (lines[0] && /(^|,)url(,|$)/i.test(lines[0]));
  if (looksCsv) {
    const result = [];
    for (let index = 1; index < lines.length; index += 1) {
      const match = lines[index].match(/^\s*"?(.*?)"?\s*,\s*"?(https?:\/\/.*?)"?(?:,|$)/i);
      if (match?.[2]) {
        result.push({ title: match[1] || match[2], url: match[2] });
      }
    }
    return result;
  }

  return lines
    .map((line) => ({ title: line, url: line }))
    .filter((item) => /^https?:\/\//i.test(item.url));
}

async function handleImportFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const rawItems = parseImportedText(text, file.name);
    const items = rawItems.filter((item) => {
      try {
        const url = new URL(item.url);
        return ['http:', 'https:'].includes(url.protocol);
      } catch {
        return false;
      }
    });

    if (!items.length) {
      setToast('Import found no usable http/https URLs. That file was decorative, not useful.', { error: true });
      return;
    }

    const parentId = await getDefaultImportParentId();
    for (const item of items) {
      await chrome.bookmarks.create({
        parentId,
        title: item.title || item.url,
        url: item.url
      });
    }
    await sendMessage({ type: 'REFRESH_BADGE' });
    await refreshData();
    setToast(`Imported ${items.length} bookmark${items.length === 1 ? '' : 's'} into your bookmarks.`);
  } catch (error) {
    console.error(error);
    setToast('Import failed. The file fought back and won.', { error: true });
  }
}

function attachKeyboardShortcuts() {
  document.addEventListener('keydown', async (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a' && !isEditableTarget(event.target)) {
      event.preventDefault();
      state.visibleBookmarks.forEach((bookmark) => state.selectedIds.add(bookmark.id));
      render();
      return;
    }

    if (event.key === KEYBOARD_SHORTCUTS.SEARCH && !isEditableTarget(event.target)) {
      event.preventDefault();
      state.focusSearchAfterRender = true;
      render();
      return;
    }

    if (isEditableTarget(event.target)) {
      if (event.key === 'Escape' && state.editingBookmarkId) {
        state.editingBookmarkId = null;
        render();
      }
      return;
    }

    if (event.key === KEYBOARD_SHORTCUTS.MODE_PAGE) {
      state.mode = MATCH_MODES.PAGE;
      await savePreferences();
      recalculateVisibleBookmarks();
      render();
      return;
    }
    if (event.key === KEYBOARD_SHORTCUTS.MODE_HOST) {
      state.mode = MATCH_MODES.HOST;
      await savePreferences();
      recalculateVisibleBookmarks();
      render();
      return;
    }
    if (event.key === KEYBOARD_SHORTCUTS.MODE_DOMAIN) {
      state.mode = MATCH_MODES.DOMAIN;
      await savePreferences();
      recalculateVisibleBookmarks();
      render();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActiveBookmark(1);
      render();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActiveBookmark(-1);
      render();
      return;
    }

    if (event.key === 'Enter') {
      const active = getActiveBookmark();
      if (active) {
        event.preventDefault();
        await handleOpen(active.url);
      }
      return;
    }

    if (event.key.toLowerCase() === 'e') {
      const active = getActiveBookmark();
      if (active) {
        event.preventDefault();
        state.editingBookmarkId = active.id;
        render();
      }
      return;
    }

    if (event.key.toLowerCase() === ' ') {
      const active = getActiveBookmark();
      if (active) {
        event.preventDefault();
        if (state.selectedIds.has(active.id)) {
          state.selectedIds.delete(active.id);
        } else {
          state.selectedIds.add(active.id);
        }
        render();
      }
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      const selected = selectedBookmarks();
      if (selected.length) {
        event.preventDefault();
        await handleDeleteMany(selected);
      }
      return;
    }

    if (event.key === 'Escape') {
      if (state.editingBookmarkId) {
        state.editingBookmarkId = null;
      } else if (state.query) {
        state.query = '';
        recalculateVisibleBookmarks();
      } else if (state.cleanupFilter !== CLEANUP_FILTERS.ALL || state.duplicatesOnly) {
        clearCleanupFilters();
        savePreferences();
        recalculateVisibleBookmarks();
      } else if (state.selectedIds.size) {
        state.selectedIds.clear();
      } else {
        clearToast();
      }
      render();
    }
  });
}

async function updateMode(mode) {
  state.mode = DASHBOARD_MODE;
  await savePreferences();
  recalculateVisibleBookmarks();
  render();
}

async function toggleSidebarCollapsed() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  await savePreferences();
  render();
}

async function updatePreference(name, value, needsReload = false) {
  state[name] = value;
  await savePreferences();
  if (name === 'popupWidth') applyPopupWidth();
  if (needsReload) {
    await refreshData();
  } else {
    recalculateVisibleBookmarks();
  }
  render();
}

async function handleOpen(url) {
  await sendMessage({ type: 'OPEN_URL', url });
}


function selectBookmarks(bookmarks) {
  for (const bookmark of bookmarks || []) {
    state.selectedIds.add(bookmark.id);
  }
  render();
}

async function handleRepairRedirects(bookmarks = getRedirectedBookmarks()) {
  const repairs = (bookmarks || []).filter((bookmark) => {
    const record = getHealthRecord(bookmark);
    return record && record.status === HEALTH_STATUSES.REDIRECTED && record.finalUrl && record.finalUrl !== bookmark.url;
  });

  if (!repairs.length) {
    setToast('No redirected bookmarks with a usable final URL. Nothing to repair.', { error: true });
    return;
  }

  const confirmed = window.confirm(`Update ${repairs.length} redirected bookmark${repairs.length === 1 ? '' : 's'} to their final URL?`);
  if (!confirmed) return;

  for (const bookmark of repairs) {
    const record = getHealthRecord(bookmark);
    await chrome.bookmarks.update(bookmark.id, { url: record.finalUrl });
  }

  state.healthByKey = {};
  state.healthSummary = null;
  state.healthLastRunAt = null;
  await sendMessage({ type: 'REFRESH_BADGE' });
  await refreshData();
  await pushCleanupHistory({
    type: 'repair-redirects',
    count: repairs.length,
    note: `Updated redirected bookmarks to their final URL.`
  });
  setToast(`Repaired ${repairs.length} redirected bookmark${repairs.length === 1 ? '' : 's'}. Less detour, more signal.`);
}

async function handleCopySelectedUrls() {
  const selected = selectedBookmarks();
  if (!selected.length) {
    setToast('Select something first. Telepathy is not implemented.', { error: true });
    return;
  }
  const text = selected.map((item) => item.url).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    setToast(`Copied ${selected.length} URL${selected.length === 1 ? '' : 's'}.`);
  } catch (error) {
    console.error(error);
    setToast('Clipboard failed. Browser goblins remain undefeated.', { error: true });
  }
}

async function restoreDeletedBatch() {
  if (!state.lastDeletedBatch?.items?.length) return;
  const items = [...state.lastDeletedBatch.items].sort((a, b) => (a.index || 0) - (b.index || 0));
  for (const item of items) {
    await chrome.bookmarks.create({
      parentId: item.parentId || undefined,
      index: Number.isInteger(item.index) ? item.index : undefined,
      title: item.title,
      url: item.url
    });
  }
  state.lastDeletedBatch = null;
  await sendMessage({ type: 'REFRESH_BADGE' });
  await refreshData();
  await pushCleanupHistory({ type: 'undo-delete', count: items.length, note: 'Restored the last deleted batch.' });
  setToast('Delete undone. Entropy delayed.', { duration: 2800 });
}

async function handleDeleteMany(bookmarks, options = {}) {
  if (!bookmarks.length) return;
  const confirmed = options.skipConfirm ? true : window.confirm(`Delete ${bookmarks.length} bookmark${bookmarks.length === 1 ? '' : 's'}?`);
  if (!confirmed) return;

  state.lastDeletedBatch = {
    items: bookmarks.map((bookmark) => ({
      parentId: bookmark.parentId,
      index: bookmark.index,
      title: bookmark.title,
      url: bookmark.url
    }))
  };

  for (const bookmark of bookmarks) {
    await chrome.bookmarks.remove(bookmark.id);
    state.selectedIds.delete(bookmark.id);
  }

  state.editingBookmarkId = null;
  await sendMessage({ type: 'REFRESH_BADGE' });
  await refreshData();
  await pushCleanupHistory({
    type: 'delete',
    count: bookmarks.length,
    note: options.message || 'Deleted bookmarks from the current review scope.'
  });
  setToast(
    options.message || `${bookmarks.length} bookmark${bookmarks.length === 1 ? '' : 's'} deleted.`,
    { actionLabel: 'Undo', action: restoreDeletedBatch, persist: true }
  );
}

async function handleMergeDuplicates() {
  const groups = groupDuplicates(state.visibleBookmarks);
  if (!groups.size) {
    setToast('No duplicate groups in this view. The merge cannon has no target.', { error: true });
    return;
  }

  const toDelete = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => (a.dateAdded || 0) - (b.dateAdded || 0));
    if (state.mergeStrategy === MERGE_STRATEGIES.KEEP_NEWEST) {
      sorted.pop();
    } else {
      sorted.shift();
    }
    toDelete.push(...sorted);
  }

  if (!toDelete.length) {
    setToast('Duplicate groups exist, but there was nothing disposable after strategy rules.', { error: true });
    return;
  }

  const label = state.mergeStrategy === MERGE_STRATEGIES.KEEP_NEWEST ? 'newest' : 'oldest';
  const confirmed = window.confirm(`Merge duplicate URLs in this view by keeping the ${label} bookmark and deleting ${toDelete.length} duplicate${toDelete.length === 1 ? '' : 's'}?`);
  if (!confirmed) return;

  await handleDeleteMany(toDelete, {
    skipConfirm: true,
    message: `Merged duplicate URLs. Kept the ${label} bookmark in each group and deleted ${toDelete.length}.`
  });
}

async function handleSaveEdit(bookmarkId, titleValue, urlValue) {
  const title = String(titleValue || '').trim() || '(Untitled bookmark)';
  const url = String(urlValue || '').trim();

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported');
  } catch {
    setToast('That URL is broken. Feed it something valid.', { error: true });
    return;
  }

  await chrome.bookmarks.update(bookmarkId, { title, url });
  state.editingBookmarkId = null;
  await sendMessage({ type: 'REFRESH_BADGE' });
  await refreshData();
  setToast('Bookmark updated. Less chaos, more order.');
}

async function handleBookmarkCurrentPage() {
  if (!state.tab?.url || !state.target?.valid) {
    setToast('This page cannot be bookmarked from here.', { error: true });
    return;
  }

  await chrome.bookmarks.create({
    title: state.tab.title || state.target.hostname,
    url: state.tab.url
  });

  await sendMessage({ type: 'REFRESH_BADGE' });
  await refreshData();
  await pushCleanupHistory({ type: 'bookmark-current-page', count: 1, note: 'Bookmarked the current page from the popup.' });
  setToast('Current page bookmarked. A rare victory.');
}



function closeAboutModal() {
  if (!state.aboutOpen) return;
  state.aboutOpen = false;
  render();
}

function renderAboutModal(root) {
  if (!state.aboutOpen) return;
  const manifest = chrome.runtime.getManifest();
  const overlay = create('div', 'modal-overlay');
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeAboutModal();
  });

  const modal = create('div', 'modal-card about-modal dashboard-about-modal');
  const head = create('div', 'about-head');
  const icon = create('img', 'about-icon');
  icon.alt = '';
  icon.src = chrome.runtime.getURL('icon.png');
  const meta = create('div', 'about-meta');
  meta.append(
    create('div', 'about-title', manifest.name || 'Bookmark Manager'),
    create('div', 'about-version', `Version ${manifest.version || ''}`)
  );
  const close = create('button', 'icon-button mono-icon-button modal-close', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close about dialog');
  close.addEventListener('click', closeAboutModal);
  head.append(icon, meta, close);

  const body = create('div', 'about-body');
  body.append(
    create('div', 'about-copy', 'Bookmark Manager per Domain and Page'),
    create('div', 'about-copy about-copy-muted', 'Popup for quick scoped triage. Dashboard for full library maintenance.'),
    create('div', 'about-copy about-copy-muted', 'Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.')
  );

  modal.append(head, body);
  overlay.append(modal);
  root.append(overlay);
}

function createMetricCard(label, value, helperText = '') {
  const card = create('div', 'metric-card');
  const valueEl = create('div', 'metric-value', value);
  const labelEl = create('div', 'metric-label', label);
  card.append(valueEl, labelEl);
  if (helperText) {
    card.append(create('div', 'helper-text metric-helper', helperText));
  }
  return card;
}

function createCompactStat(label, value, helperText = '') {
  const stat = create('div', 'compact-stat');
  stat.append(create('div', 'compact-stat-value', value), create('div', 'compact-stat-label', label));
  if (helperText) {
    stat.append(create('div', 'compact-stat-helper', helperText));
  }
  return stat;
}


function createSummaryRow(label, value, tone = '') {
  const row = create('div', `compact-summary-row${tone ? ` ${tone}` : ''}`.trim());
  row.append(create('div', 'compact-summary-label', label), create('div', 'compact-summary-value', value));
  return row;
}

function getBookmarkById(bookmarkId) {
  return state.visibleBookmarks.find((bookmark) => bookmark.id === bookmarkId) || null;
}

function renderHeader(root) {
  const header = create('div', 'section header dashboard-header-v2');
  const left = create('div', 'dashboard-header-left');
  const brand = create('div', 'dashboard-brand-row');
  const brandIcon = create('img', 'dashboard-brand-icon');
  brandIcon.alt = '';
  brandIcon.src = chrome.runtime.getURL('icon.png');
  const brandText = create('div', 'dashboard-brand-text');
  const eyebrow = create('div', 'dashboard-eyebrow', 'Library dashboard');
  const title = create('h1', 'title dashboard-title', 'Bookmark Manager');
  const context = create('div', 'context-text dashboard-context', `${state.allBookmarks.length} total bookmarks in the library.`);
  brandText.append(eyebrow, title, context);
  brand.append(brandIcon, brandText);
  left.append(brand);

  const right = create('div', 'dashboard-header-right');
  const actionRow = create('div', 'dashboard-header-actions');
  const aboutButton = createIconButton('info', 'About extension');
  aboutButton.addEventListener('click', () => {
    state.aboutOpen = true;
    render();
  });
  const chromeBookmarks = createIconButton('bookmarks', 'Open Chrome bookmarks');
  chromeBookmarks.addEventListener('click', () => sendMessage({ type: 'OPEN_URL', url: 'chrome://bookmarks/' }));
  const optionsButton = createIconButton('settings', 'Settings');
  optionsButton.addEventListener('click', () => sendMessage({ type: 'OPEN_URL', url: chrome.runtime.getURL('options.html') }));
  const themeControls = createThemeControls();
  actionRow.append(aboutButton, chromeBookmarks, optionsButton, themeControls);
  right.append(actionRow);

  header.append(left, right);
  root.append(header);
}

function renderToolbar(root) {
  const toolbar = create('div', 'section toolbar dashboard-toolbar-v2');

  const controls = create('div', 'dashboard-control-strip');
  const search = create('input', 'search-input dashboard-search-input');
  search.type = 'search';
  search.placeholder = 'Search bookmarks';
  search.value = state.query;
  search.addEventListener('input', (event) => {
    state.query = event.target.value;
    state.focusSearchAfterRender = true;
    state.searchSelectionStart = event.target.selectionStart;
    state.searchSelectionEnd = event.target.selectionEnd;
    recalculateVisibleBookmarks();
    render();
  });
  searchInputRef = search;

  controls.append(search);

  const filters = create('div', 'cleanup-chip-row dashboard-filter-strip');
  [
    [CLEANUP_FILTERS.ALL, 'All'],
    [CLEANUP_FILTERS.DUPLICATES, 'Duplicates'],
    [CLEANUP_FILTERS.UNTITLED, 'Untitled'],
    [CLEANUP_FILTERS.OLD, 'Old'],
    [CLEANUP_FILTERS.TITLE_COLLISIONS, 'Collisions']
  ].forEach(([value, label]) => {
    const button = create('button', `filter-chip dashboard-filter-chip${state.cleanupFilter === value ? ' active' : ''}`);
    button.type = 'button';
    button.title = `${label}: ${getCleanupCount(value)}`;
    button.append(
      create('span', 'filter-chip-label', label),
      create('span', 'filter-chip-count', String(getCleanupCount(value)))
    );
    button.addEventListener('click', () => setCleanupFilter(value));
    filters.append(button);
  });

  toolbar.append(controls, filters);
  root.append(toolbar);
}

function renderBulkBar(root) {
  if (!state.selectedIds.size && !state.isInspectingHealth) return;

  const bar = create('div', 'section bulk-bar dashboard-bulk-bar');
  const duplicateGroupCount = state.visibleDuplicateGroups;
  const text = create('div', 'summary-line compact-bulk-summary', `${state.selectedIds.size} selected · ${state.visibleBookmarks.length} shown · ${cleanupFilterLabel(state.cleanupFilter)}`);

  const actions = create('div', 'footer-actions wrap');
  const clear = create('button', 'ghost-button', 'Clear');
  clear.type = 'button';
  clear.addEventListener('click', () => { state.selectedIds.clear(); render(); });
  const selectDupes = create('button', 'ghost-button', 'Select duplicates');
  selectDupes.type = 'button';
  selectDupes.disabled = duplicateGroupCount === 0;
  selectDupes.addEventListener('click', () => { state.visibleBookmarks.filter((item) => item.isDuplicate).forEach((bookmark) => state.selectedIds.add(bookmark.id)); render(); });
  const inspectVisible = buildInspectButton('Inspect visible', state.visibleBookmarks.length, 'ghost-button');
  inspectVisible.addEventListener('click', () => inspectBookmarksHealth(state.visibleBookmarks));
  const openSelected = create('button', 'ghost-button', 'Open');
  openSelected.type = 'button';
  openSelected.disabled = state.selectedIds.size === 0;
  openSelected.addEventListener('click', async () => { for (const bookmark of selectedBookmarks()) await handleOpen(bookmark.url); });
  const deleteSelected = create('button', 'ghost-button danger-button', 'Delete');
  deleteSelected.type = 'button';
  deleteSelected.disabled = state.selectedIds.size === 0;
  deleteSelected.addEventListener('click', () => handleDeleteMany(selectedBookmarks()));
  actions.append(clear, selectDupes, inspectVisible, openSelected, deleteSelected);
  bar.append(text, actions);
  root.append(bar);
}

function renderItem(bookmark) {
  const item = create('div', `item${state.activeBookmarkId === bookmark.id ? ' active-item' : ''}`);
  const top = create('div', 'item-top');
  item.dataset.bookmarkId = bookmark.id;
  item.tabIndex = -1;
  item.addEventListener('mousedown', (event) => {
    if (event.target.closest('button, input, select, a, label')) return;
    if (state.activeBookmarkId === bookmark.id) return;
    rememberListScroll();
    setActiveBookmark(bookmark.id);
    render();
  });

  const leading = create('div', 'item-leading');
  const selector = create('input', 'item-checkbox');
  selector.type = 'checkbox';
  selector.checked = state.selectedIds.has(bookmark.id);
  selector.addEventListener('change', (event) => {
    if (event.target.checked) {
      state.selectedIds.add(bookmark.id);
    } else {
      state.selectedIds.delete(bookmark.id);
    }
    render();
  });
  leading.append(selector);

  const body = create('div', 'item-body');

  if (state.editingBookmarkId === bookmark.id) {
    const titleInput = create('input', 'edit-input');
    titleInput.value = bookmark.title;
    titleInput.placeholder = 'Bookmark title';

    const urlInput = create('input', 'edit-input');
    urlInput.value = bookmark.url;
    urlInput.placeholder = 'Bookmark URL';
    urlInput.style.marginTop = '8px';

    const actions = create('div', 'item-actions');
    const save = create('button', 'icon-button success', '✓');
    save.title = 'Save changes';
    save.type = 'button';
    save.addEventListener('click', () => handleSaveEdit(bookmark.id, titleInput.value, urlInput.value));

    const cancel = create('button', 'icon-button', '✕');
    cancel.title = 'Cancel editing';
    cancel.type = 'button';
    cancel.addEventListener('click', () => {
      state.editingBookmarkId = null;
      render();
    });

    [titleInput, urlInput].forEach((input) => {
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          handleSaveEdit(bookmark.id, titleInput.value, urlInput.value);
        }
      });
    });

    body.append(titleInput, urlInput);
    top.append(leading, body, actions);
    actions.append(save, cancel);
    item.append(top);
    return item;
  }

  const headline = create('div', 'item-headline');
  const favicon = createFaviconNode(bookmark);
  const title = create('h2', 'item-title');
  title.append(createHighlightedFragment(bookmark.title, state.query));
  headline.append(favicon, title);
  const meta = create('div', 'item-url');
  meta.title = bookmark.url;
  meta.append(createHighlightedFragment(bookmark.url, state.query));
  const path = create('div', 'item-path');
  path.title = bookmark.path || 'Root';
  path.append(createHighlightedFragment(bookmark.path || 'Root', state.query));

  body.append(headline, meta, path);
  const badges = [];
  if (bookmark.isDuplicate) badges.push('Duplicate URL');
  if (bookmark.isUntitled) badges.push('Untitled');
  if (bookmark.isOld) badges.push(`Old ${bookmark.ageDays}d`);
  if (bookmark.hasTitleCollision) badges.push('Title collision');
  const healthRecord = getHealthRecord(bookmark);
  if (badges.length || healthRecord) {
    const badgeRow = create('div', 'badge-row');
    badges.forEach((label) => badgeRow.append(create('div', bookmarkStatusBadgeClass(label), label)));
    if (healthRecord) {
      const badge = create('div', healthBadgeClass(healthRecord), healthLabel(healthRecord));
      if (healthRecord.finalUrl && healthRecord.finalUrl !== bookmark.url) badge.title = `Final URL: ${healthRecord.finalUrl}`;
      if (healthRecord.error) badge.title = healthRecord.error;
      badgeRow.append(badge);
    }
    body.append(badgeRow);
  }

  const actions = create('div', 'item-actions');
  const open = create('button', 'icon-button primary-row-action', '↗');
  open.type = 'button';
  open.title = 'Open bookmark';
  open.addEventListener('click', () => handleOpen(bookmark.url));

  const folder = create('button', 'icon-button folder-row-action', '▣');
  folder.type = 'button';
  folder.title = 'Show in bookmarks';
  folder.addEventListener('click', async () => {
    await sendMessage({ type: 'OPEN_BOOKMARK_FOLDER', parentId: bookmark.parentId });
  });

  const redirectRecord = getHealthRecord(bookmark);
  const canRepair = !!(redirectRecord && redirectRecord.status === HEALTH_STATUSES.REDIRECTED && redirectRecord.finalUrl && redirectRecord.finalUrl !== bookmark.url);
  const moreWrap = create('div', 'item-more-wrap');
  const more = create('button', `icon-button item-more-button more-row-action${state.rowMenuBookmarkId === bookmark.id ? ' active' : ''}`, '⋯');
  more.type = 'button';
  more.title = 'More actions';
  more.dataset.bookmarkId = bookmark.id;
  more.addEventListener('click', (event) => {
    event.stopPropagation();
    rememberListScroll();
    if (state.rowMenuBookmarkId === bookmark.id) {
      state.rowMenuBookmarkId = null;
      state.rowMenuPosition = null;
      render();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    state.rowMenuBookmarkId = bookmark.id;
    state.rowMenuPosition = { top: rect.bottom + 6, right: Math.max(12, window.innerWidth - rect.right) };
    render();
  });
  moreWrap.append(more);

  actions.append(open, folder, moreWrap);
  top.append(leading, body, actions);
  item.append(top);
  return item;
}

function buildSidebarPanel(titleText, helperText) {
  const panel = create('div', 'sidebar-panel');
  if (titleText) panel.append(create('div', 'review-card-title', titleText));
  if (helperText) panel.append(create('div', 'helper-text', helperText));
  return panel;
}

function createDetailsField(label, value, title = '') {
  const field = create('div', 'detail-field');
  field.append(create('div', 'detail-label', label));
  const valueEl = create('div', 'detail-value', value || '—');
  if (title) valueEl.title = title;
  field.append(valueEl);
  return field;
}

function renderDetailsDrawer(root) {
  const drawer = create('aside', 'dashboard-drawer');
  const active = getActiveBookmark();
  if (!active) {
    const empty = create('div', 'drawer-empty');
    empty.append(
      create('div', 'review-card-title', 'No bookmark selected'),
      create('div', 'helper-text', 'Pick a bookmark from the list to inspect the full URL, status, and quick actions.')
    );
    drawer.append(empty);
    root.append(drawer);
    return;
  }

  const head = create('div', 'drawer-head');
  const titleRow = create('div', 'drawer-title-row');
  titleRow.append(createFaviconNode(active));
  const titleWrap = create('div', 'drawer-title-wrap');
  titleWrap.append(create('div', 'review-card-title drawer-title', active.title || '(Untitled bookmark)'));
  titleWrap.append(create('div', 'helper-text', modeLabel(state.mode)));
  titleRow.append(titleWrap);
  head.append(titleRow);

  const actions = create('div', 'footer-actions wrap drawer-actions');
  const open = create('button', 'ghost-button drawer-primary-action', 'Open');
  open.type = 'button';
  open.addEventListener('click', () => handleOpen(active.url));
  const edit = create('button', 'ghost-button drawer-tertiary-action', 'Edit');
  edit.type = 'button';
  edit.addEventListener('click', () => { state.editingBookmarkId = active.id; render(); });
  const folder = create('button', 'ghost-button drawer-secondary-action', 'Show folder');
  folder.type = 'button';
  folder.addEventListener('click', () => sendMessage({ type: 'OPEN_BOOKMARK_FOLDER', parentId: active.parentId }));
  const remove = create('button', 'ghost-button danger-button', 'Delete');
  remove.type = 'button';
  remove.addEventListener('click', () => handleDeleteMany([active]));
  actions.append(open, edit, folder, remove);
  head.append(actions);

  const badgeRow = create('div', 'badge-row drawer-badges');
  if (active.isDuplicate) badgeRow.append(create('div', 'badge warning', 'Duplicate URL'));
  if (active.isOld) badgeRow.append(create('div', 'badge warning', `Old ${active.ageDays}d`));
  if (active.isUntitled) badgeRow.append(create('div', 'badge', 'Untitled'));
  if (active.hasTitleCollision) badgeRow.append(create('div', 'badge', 'Title collision'));
  const healthRecord = getHealthRecord(active);
  if (healthRecord) {
    const healthBadge = create('div', healthBadgeClass(healthRecord), healthLabel(healthRecord));
    badgeRow.append(healthBadge);
  }
  if (badgeRow.childNodes.length) head.append(badgeRow);
  drawer.append(head);

  const body = create('div', 'drawer-body');
  body.append(
    createDetailsField('URL', active.url, active.url),
    createDetailsField('Folder', active.path || 'Root', active.path || 'Root'),
    createDetailsField('Added', active.dateAdded ? new Date(active.dateAdded).toLocaleString() : 'Unknown'),
    createDetailsField('Age', Number.isFinite(active.ageDays) ? `${active.ageDays} days` : 'Unknown')
  );
  if (healthRecord?.finalUrl && healthRecord.finalUrl !== active.url) {
    body.append(createDetailsField('Redirects to', healthRecord.finalUrl, healthRecord.finalUrl));
  }
  if (healthRecord?.error) {
    body.append(createDetailsField('Health note', healthRecord.error, healthRecord.error));
  }
  drawer.append(body);
  root.append(drawer);
}

function renderSidebar(root) {
  root.classList.toggle('collapsed', state.sidebarCollapsed);

  const shell = create('div', 'dashboard-sidebar-shell');
  const rail = create('div', 'dashboard-side-nav dashboard-side-rail');
  const collapseButton = createIconButton(state.sidebarCollapsed ? 'chevronRight' : 'chevronLeft', state.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar', 'icon-button mono-icon-button sidebar-rail-toggle');
  collapseButton.addEventListener('click', toggleSidebarCollapsed);
  rail.append(collapseButton);

  const tabs = [
    ['overview', 'Overview', 'overview', 'Stats'],
    ['cleanup', 'Cleanup', 'cleanup', 'Clean'],
    ['health', 'Health', 'health', 'Health'],
    ['history', 'Activity', 'history', 'Activity']
  ];
  tabs.forEach(([value, label, icon, shortLabel]) => {
    const button = create('button', `sidebar-tab sidebar-rail-tab${state.sidebarTab === value ? ' active' : ''}`);
    button.type = 'button';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = `<span class="sidebar-tab-icon">${iconSvg(icon)}</span><span class="sidebar-tab-label">${shortLabel}</span>`;
    button.addEventListener('click', () => {
      state.sidebarTab = value;
      render();
    });
    rail.append(button);
  });
  shell.append(rail);

  if (!state.sidebarCollapsed) {
    const panelWrap = create('div', 'dashboard-sidebar-panel-wrap');
    const scroll = create('div', 'sidebar-scroll');
    const scopedBookmarks = getScopedBookmarks();
    const scopeCleanup = getScopeSummary();
    const health = state.healthSummary || summarizeHealth(state.visibleBookmarks);
    const scopeHealth = getScopeHealthSummary();
    const reminder = buildReminderState();
    const score = computeHealthScore();

    if (state.sidebarTab === 'overview') {
      const panel = buildSidebarPanel('Overview', `${scopedBookmarks.length} bookmarks in the library · health ${score.score}${score.isMetadataOnly ? ' metadata-only' : ''}.`);
      const stats = create('div', 'compact-summary-list');
      [
        createSummaryRow('Total', `${scopedBookmarks.length}`),
        createSummaryRow('Health', `${score.score}${score.isMetadataOnly ? ' · metadata-only' : ` · grade ${score.grade}`}`),
        createSummaryRow('Checked', `${scopeHealth.checked}`),
        createSummaryRow('Unhealthy', `${scopeHealth.broken + scopeHealth.serverError + scopeHealth.unreachable}`)
      ].forEach((row) => stats.append(row));
      panel.append(stats);
      const recommendations = getReviewQueue().slice(0, 2);
      if (recommendations.length) {
        const queue = create('div', 'review-queue compact-review-queue');
        recommendations.forEach((entry) => {
          const card = create('div', `review-card sidebar-review-card ${entry.tone || ''}`.trim());
          card.append(create('div', 'review-card-title', entry.title), create('div', 'helper-text', entry.body));
          queue.append(card);
        });
        panel.append(queue);
      }
      scroll.append(panel);
    }

    if (state.sidebarTab === 'cleanup') {
      const cleanupPanel = buildSidebarPanel('Cleanup', `${scopeCleanup.duplicateCount} duplicate URLs · ${scopeCleanup.oldCount} old · ${scopeCleanup.untitledCount} untitled.`);
      const presets = create('div', 'footer-actions wrap');
      [
        [CLEANUP_FILTERS.DUPLICATES, 'Duplicates'],
        [CLEANUP_FILTERS.OLD, 'Old'],
        [CLEANUP_FILTERS.UNTITLED, 'Untitled'],
        [CLEANUP_FILTERS.TITLE_COLLISIONS, 'Collisions']
      ].forEach(([filter, label]) => {
        const button = create('button', 'ghost-button', label);
        button.type = 'button';
        button.addEventListener('click', () => setCleanupFilter(filter));
        presets.append(button);
      });
      cleanupPanel.append(presets);
      scroll.append(cleanupPanel);
    }

    if (state.sidebarTab === 'health') {
      const totalUniqueVisible = new Set(state.visibleBookmarks.map((bookmark) => getHealthKey(bookmark))).size;
      const healthPanel = buildSidebarPanel('Health', `${health.checked}/${totalUniqueVisible} checked · ${health.redirected} redirected · ${health.broken + health.serverError + health.unreachable} unhealthy.`);
      const actions = create('div', 'footer-actions wrap');
      const inspectButton = buildInspectButton('Inspect visible', totalUniqueVisible, 'ghost-button');
      inspectButton.addEventListener('click', () => inspectBookmarksHealth(state.visibleBookmarks));
      const markReviewed = create('button', 'ghost-button', 'Mark reviewed now');
      markReviewed.type = 'button';
      markReviewed.addEventListener('click', handleMarkReviewedNow);
      actions.append(inspectButton, markReviewed);
      healthPanel.append(actions);
      const stats = create('div', 'compact-summary-list');
      [
        createSummaryRow('Healthy', String(health.healthy)),
        createSummaryRow('Redirected', String(health.redirected)),
        createSummaryRow('Unhealthy', String(health.broken + health.serverError + health.unreachable), 'warning'),
        createSummaryRow('Next review', reminder.enabled ? reminder.statusLabel : 'Manual')
      ].forEach((row) => stats.append(row));
      healthPanel.append(stats);
      scroll.append(healthPanel);
    }

    if (state.sidebarTab === 'history') {
      const trends = getHistoryTrends();
      const hasActivity = trends.totalActions > 0 || state.reviewSessions.length > 0;
      const historyPanel = buildSidebarPanel(
        'Activity',
        hasActivity
          ? `${state.cleanupHistory.length} logged actions · ${state.reviewSessions.length} saved sessions.`
          : 'No cleanup history yet. Run inspect, delete, import, or repair actions to build activity history.'
      );

      if (hasActivity) {
        const stats = create('div', 'compact-summary-list');
        [
          createSummaryRow('Actions', String(trends.totalActions)),
          createSummaryRow('Redirects fixed', String(trends.redirectsFixed)),
          createSummaryRow('Imports', String(trends.imports)),
          createSummaryRow('Deletes', String(trends.deletes))
        ].forEach((row) => stats.append(row));
        historyPanel.append(stats);

        const latest = create('div', 'history-list slim-history-list');
        if (state.cleanupHistory.length) {
          state.cleanupHistory.slice(0, 5).forEach((entry) => {
            const item = create('div', 'history-item compact-history-item');
            item.append(
              create('div', 'review-card-title', `${entry.type || 'action'} · ${entry.count || 0}`),
              create('div', 'helper-text', `${new Date(entry.at).toLocaleString()}${entry.note ? ` · ${entry.note}` : ''}`)
            );
            latest.append(item);
          });
        } else {
          latest.append(create('div', 'helper-text', 'No cleanup history yet.'));
        }
        historyPanel.append(latest);
      } else {
        const empty = create('div', 'sidebar-panel-empty');
        empty.append(
          create('div', 'review-card-title', 'Nothing has happened yet'),
          create('div', 'helper-text', 'This panel will wake up after you inspect links, repair redirects, import, or delete bookmarks.')
        );
        historyPanel.append(empty);
      }

      scroll.append(historyPanel);
    }

    panelWrap.append(scroll);
    shell.append(panelWrap);
  }

  root.append(shell);
}

function renderList(root) {
  const workspace = create('div', `dashboard-body${state.sidebarCollapsed ? ' sidebar-collapsed' : ''}`);
  const sidebar = create('aside', 'dashboard-sidebar');
  const content = create('section', 'dashboard-content');
  const listPane = create('div', 'dashboard-list-pane');

  if (state.mode !== DASHBOARD_MODE && !state.target?.valid) {
    renderSidebar(sidebar);
    const empty = create('div', 'empty-state');
    empty.append(
      create('h2', 'empty-title', 'This page is not supported'),
      create('div', 'empty-copy', 'Open a normal http or https page. Chrome internal pages are weird little goblins.')
    );
    content.append(empty);
    workspace.append(sidebar, content);
    root.append(workspace);
    return;
  }

  renderSidebar(sidebar);

  const mainHead = create('div', 'dashboard-main-head dashboard-list-head');
  const scopedBookmarks = getScopedBookmarks();
  const scopeCleanup = getScopeSummary();
  const visibleCleanup = state.visibleSummary || getCleanupSummary(state.visibleBookmarks);
  const headCopy = create('div', 'dashboard-list-head-copy');
  const summary = create('div', 'summary-line', `${state.visibleBookmarks.length} shown · ${scopedBookmarks.length} total`);
  const helper = create('div', 'helper-text', `${scopeCleanup.duplicateGroupCount} duplicate groups · ${scopeCleanup.oldCount} old · ${visibleCleanup.untitledCount} untitled · ${visibleCleanup.titleCollisionCount} title collisions.`);
  headCopy.append(summary, helper);

  const headActions = create('div', 'dashboard-list-head-actions');
  const generalActions = create('div', 'dashboard-head-action-group');
  const selectAll = create('button', 'ghost-button compact-list-button', state.visibleBookmarks.length && state.selectedIds.size === state.visibleBookmarks.length ? 'Clear all' : 'Select all');
  selectAll.type = 'button';
  selectAll.disabled = state.visibleBookmarks.length === 0;
  selectAll.addEventListener('click', () => {
    if (state.selectedIds.size === state.visibleBookmarks.length) {
      state.selectedIds.clear();
    } else {
      state.visibleBookmarks.forEach((bookmark) => state.selectedIds.add(bookmark.id));
    }
    render();
  });
  const inspectVisibleHead = buildInspectButton('Inspect visible', state.visibleBookmarks.length, 'ghost-button compact-list-button');
  inspectVisibleHead.addEventListener('click', () => inspectBookmarksHealth(state.visibleBookmarks));
  const exportVisible = create('button', 'ghost-button compact-list-button', 'Export');
  exportVisible.type = 'button';
  exportVisible.disabled = state.visibleBookmarks.length === 0;
  exportVisible.addEventListener('click', () => handleExport('json', 'visible'));
  generalActions.append(selectAll, inspectVisibleHead, exportVisible);
  headActions.append(generalActions);

  if (state.selectedIds.size) {
    const selectionActions = create('div', 'dashboard-head-action-group selection-actions');
    const selectedMeta = create('div', 'mini-pill dashboard-selection-pill', `${state.selectedIds.size} selected`);
    const copySelected = create('button', 'ghost-button compact-list-button', 'Copy URLs');
    copySelected.type = 'button';
    copySelected.addEventListener('click', handleCopySelectedUrls);
    const openSelected = create('button', 'ghost-button compact-list-button', 'Open');
    openSelected.type = 'button';
    openSelected.addEventListener('click', async () => { for (const bookmark of selectedBookmarks()) await handleOpen(bookmark.url); });
    const repairSelected = create('button', 'ghost-button compact-list-button', 'Repair');
    repairSelected.type = 'button';
    const redirectedSelected = selectedBookmarks().filter((bookmark) => {
      const record = getHealthRecord(bookmark);
      return record && record.status === HEALTH_STATUSES.REDIRECTED && record.finalUrl && record.finalUrl !== bookmark.url;
    });
    repairSelected.disabled = redirectedSelected.length === 0;
    repairSelected.addEventListener('click', () => handleRepairRedirects(redirectedSelected));
    const deleteSelected = create('button', 'ghost-button compact-list-button danger-button', 'Delete');
    deleteSelected.type = 'button';
    deleteSelected.addEventListener('click', () => handleDeleteMany(selectedBookmarks()));
    selectionActions.append(selectedMeta, copySelected, openSelected, repairSelected, deleteSelected);
    headActions.append(selectionActions);
  }

  mainHead.append(headCopy, headActions);
  listPane.append(mainHead);

  const listScroll = create('div', 'list-scroll');
  listScroll.scrollTop = state.listScrollTop || 0;
  listScroll.addEventListener('scroll', () => { state.listScrollTop = listScroll.scrollTop; }, { passive: true });
  if (!state.visibleBookmarks.length) {
    const empty = create('div', 'empty-state');
    const emptyTitle = state.cleanupFilter !== CLEANUP_FILTERS.ALL
      ? `No ${cleanupFilterLabel(state.cleanupFilter).toLowerCase()} bookmarks`
      : (state.mode === DASHBOARD_MODE ? 'No bookmarks in this library view' : `No bookmarks for ${modeLabel(state.mode).toLowerCase()}`);
    const emptyCopy = state.cleanupFilter !== CLEANUP_FILTERS.ALL
      ? 'This filter came up empty. Try switching back to All or running a different cleanup pass.'
      : 'That is either clean organization or neglected chaos. Hard to tell from here.';
    empty.append(
      create('h2', 'empty-title', emptyTitle),
      create('div', 'empty-copy', emptyCopy)
    );
    listScroll.append(empty);
  } else {
    const list = create('div', 'list');
    state.visibleBookmarks.forEach((bookmark) => list.append(renderItem(bookmark)));
    listScroll.append(list);
  }
  listPane.append(listScroll);
  content.append(listPane);
  renderDetailsDrawer(content);

  workspace.append(sidebar, content);
  root.append(workspace);
}


function renderRowMenuOverlay(root) {
  if (!state.rowMenuBookmarkId || !state.rowMenuPosition) return;
  const bookmark = getBookmarkById(state.rowMenuBookmarkId);
  if (!bookmark) return;
  const redirectRecord = getHealthRecord(bookmark);
  const canRepair = !!(redirectRecord && redirectRecord.status === HEALTH_STATUSES.REDIRECTED && redirectRecord.finalUrl && redirectRecord.finalUrl !== bookmark.url);

  const menu = create('div', 'item-more-menu item-more-menu-portal');
  menu.style.position = 'fixed';
  menu.style.top = `${state.rowMenuPosition.top}px`;
  menu.style.right = `${state.rowMenuPosition.right}px`;

  const editAction = create('button', 'row-menu-item', 'Edit');
  editAction.type = 'button';
  editAction.addEventListener('click', () => {
    state.rowMenuBookmarkId = null;
    state.rowMenuPosition = null;
    state.editingBookmarkId = bookmark.id;
    render();
  });
  const repairAction = create('button', 'row-menu-item');
  repairAction.type = 'button';
  repairAction.textContent = 'Repair redirect';
  repairAction.disabled = !canRepair;
  repairAction.addEventListener('click', () => {
    state.rowMenuBookmarkId = null;
    state.rowMenuPosition = null;
    handleRepairRedirects([bookmark]);
  });
  const deleteAction = create('button', 'row-menu-item danger', 'Delete');
  deleteAction.type = 'button';
  deleteAction.addEventListener('click', () => {
    state.rowMenuBookmarkId = null;
    state.rowMenuPosition = null;
    handleDeleteMany([bookmark]);
  });
  menu.append(editAction, repairAction, deleteAction);
  root.append(menu);
}

function renderFooter(root) {
  const footer = create('div', 'section dashboard-footer');
  const reminder = getReminderState();
  const score = computeHealthScore();
  const left = create('div', 'summary-line', reminder.enabled
    ? `Library · Health ${score.score}${score.isMetadataOnly ? ' metadata-only' : ''} · ${reminder.statusLabel}`
    : `Library · Health ${score.score}${score.isMetadataOnly ? ' metadata-only' : ''} · reminders off`);
  const right = create('div', 'dashboard-footer-copy', 'Copyright (c) 2026 Ehsan Enaloo');
  footer.append(left, right);
  root.append(footer);
}

function renderToast(root) {
  if (!state.toast) return;
  const toast = create('div', `toast${state.toast.error ? ' error-copy' : ''}`);
  const message = create('div', 'toast-message', state.toast.message);
  toast.append(message);

  if (state.toast.actionLabel && state.toast.action) {
    const action = create('button', 'toast-action', state.toast.actionLabel);
    action.type = 'button';
    action.addEventListener('click', async () => {
      const fn = state.toast?.action;
      clearToast();
      render();
      if (fn) await fn();
    });
    toast.append(action);
  }

  root.append(toast);
}

function render() {
  try {
    app.textContent = '';
    searchInputRef = null;

    const panel = create('div', 'panel');
    renderHeader(panel);
    renderToolbar(panel);
    renderList(panel);
    renderFooter(panel);
    app.append(panel);
    panel.addEventListener('mousedown', (event) => {
      if (state.rowMenuBookmarkId && !event.target.closest('.item-more-wrap, .item-more-menu-portal')) {
        state.rowMenuBookmarkId = null;
        state.rowMenuPosition = null;
        render();
      }
    });
    renderRowMenuOverlay(app);
    renderAboutModal(app);
    renderToast(app);

    updateThemeControls();
  if (state.focusSearchAfterRender && searchInputRef) {
      searchInputRef.focus();
      const start = Number.isInteger(state.searchSelectionStart) ? state.searchSelectionStart : state.query.length;
      const end = Number.isInteger(state.searchSelectionEnd) ? state.searchSelectionEnd : state.query.length;
      try {
        searchInputRef.setSelectionRange(start, end);
      } catch {
        // Ignore browsers that get weird about selection ranges on search inputs.
      }
      state.focusSearchAfterRender = false;
      state.searchSelectionStart = null;
      state.searchSelectionEnd = null;
    }

    const listScroll = app.querySelector('.list-scroll');
    if (listScroll && Number.isFinite(state.listScrollTop)) {
      listScroll.scrollTop = state.listScrollTop;
    }

    if (state.shouldScrollActiveIntoView) {
      const activeItem = state.activeBookmarkId ? app.querySelector(`[data-bookmark-id="${CSS.escape(state.activeBookmarkId)}"]`) : null;
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
      state.shouldScrollActiveIntoView = false;
    }
  } catch (error) {
    console.error(error);
    renderFatal('The dashboard rendered itself into a ditch.', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
