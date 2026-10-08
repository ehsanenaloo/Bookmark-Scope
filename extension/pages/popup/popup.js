/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 */

import { STORAGE_KEYS, THEME_MODES, COLOR_PALETTES } from '../../src/core/constants.js';
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
import { formatNumber, hasSourceMessage, initI18n, t, translateTree } from '../../src/locales/i18n.js';
import { createFaviconNode, debounce, trapFocus } from '../../src/ui/ui-utils.js';
import { createPopupActions } from '../../src/popup/actions.js';
import { createPopupFooter } from '../../src/popup/footer.js';
import { createPopupHeaderOverlays } from '../../src/popup/header-overlays.js';
import { createPopupMatchesToast } from '../../src/popup/matches-toast.js';
import { createPopupState } from '../../src/popup/state.js';
import { addBookmarkEventListeners, addStorageChangedListener } from '../../src/platform/browser-api.js';
import { createLogger } from '../../src/services/diagnostics-service.js';
import { initializeStorageLayer } from '../../src/services/storage-service.js';

const logger = createLogger('popup');

const state = createPopupState();

const app = document.getElementById('app');
const footerRefs = {
  shell: null,
  panelBody: null,
  panelControls: null,
  nav: null
};

let searchRef = null;
let stopWatchingTheme = null;
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

function getAppTitle() {
  return t('Bookmark Scope');
}

const deps = {
  state,
  app,
  footerRefs,
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
  hasSourceMessage,
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
  getAppTitle,
  setSearchRef(value) {
    searchRef = value;
  },
  setToastTimerRef
};

const actions = createPopupActions(deps);
deps.actions = actions;

const footer = createPopupFooter({
  ...deps,
  createFooterActionButton(item) {
    if (!item?.ctaLabel || item?.showCtaButton === false) return null;
    const actionButton = create('button', 'footer-link-button', item.ctaLabel);
    actionButton.type = 'button';
    const actionHandler = footer.resolveFooterAction(item);
    if (actionHandler) actionButton.addEventListener('click', actionHandler);
    return actionButton;
  }
});
deps.footer = footer;

const headerOverlays = createPopupHeaderOverlays(deps);
deps.closeOverflowMenu = headerOverlays.closeOverflowMenu;
deps.showConfirmDialog = headerOverlays.showConfirmDialog;

const matchesToast = createPopupMatchesToast(deps);
deps.modeLabel = matchesToast.modeLabel;
deps.duplicateGroupsCount = matchesToast.duplicateGroupsCount;

actions.showConfirmDialog = headerOverlays.showConfirmDialog;
footer.initializeFooterState();

function setToast(message, options = {}) {
  // Normalise: accept (msg, true) legacy calls from older internal code.
  const opts = (options === true || options === false)
    ? { error: Boolean(options) }
    : (options || {});
  window.clearTimeout(setToastTimerRef.current);
  state.toast = {
    message,
    error: Boolean(opts.error),
    action: opts.action || null
  };
  render();
  if (!opts.persist) {
    setToastTimerRef.current = window.setTimeout(() => {
      state.toast = null;
      render();
    }, opts.duration ?? 2600);
  }
}

function render(options = {}) {
  document.title = getAppTitle();
  const shouldRestoreSearchFocus = options.preserveSearchFocus === true;
  const selectionStart = Number.isInteger(options.selectionStart) ? options.selectionStart : null;
  const selectionEnd = Number.isInteger(options.selectionEnd) ? options.selectionEnd : selectionStart;

  headerOverlays.detachPopupMenuDismissHandlers();
  app.textContent = '';
  footerRefs.shell = null;
  footerRefs.panelBody = null;
  footerRefs.panelControls = null;
  footerRefs.nav = null;

  const shell = create('div', 'shell');
  headerOverlays.renderHeader(shell);
  const content = create('div', 'content');
  matchesToast.renderMatches(content);
  shell.append(content);
  footer.renderFooter(shell);
  app.append(shell);
  headerOverlays.createAboutModal(app);
  headerOverlays.createPinOnboardingModal(app);
  headerOverlays.createConfirmDialog(app);
  matchesToast.renderToast(app);
  headerOverlays.updateThemeControls();
  footer.ensureFooterAutoRotate();
  translateTree(app);
  headerOverlays.syncPopupMenuGlobalHandlers();

  if (shouldRestoreSearchFocus && searchRef) {
    searchRef.focus({ preventScroll: true });
    if (typeof searchRef.setSelectionRange === 'function') {
      const safeStart = Math.max(0, Math.min(searchRef.value.length, selectionStart ?? searchRef.value.length));
      const safeEnd = Math.max(safeStart, Math.min(searchRef.value.length, selectionEnd ?? safeStart));
      searchRef.setSelectionRange(safeStart, safeEnd);
    }
  }
}

/**
 * Incremental render: replaces only the .content pane and the toast overlay
 * without wiping the entire shell/header/footer. Used by search and minor
 * state changes to avoid a full layout/paint cycle on every keystroke or
 * toggle action.
 * Falls back to full render() if the expected containers are not found.
 */
function renderContentOnly(options = {}) {
  const contentEl = app.querySelector('.content');
  if (!contentEl) { render(options); return; }

  try {
    contentEl.textContent = '';
    matchesToast.renderMatches(contentEl);

    // Replace toast (appended directly to app, outside shell)
    const existingToast = app.querySelector('.toast');
    if (existingToast) existingToast.remove();
    matchesToast.renderToast(app);

    translateTree(app);

    const { preserveSearchFocus, selectionStart, selectionEnd } = options;
    if (preserveSearchFocus && searchRef) {
      searchRef.focus({ preventScroll: true });
      if (typeof searchRef.setSelectionRange === 'function') {
        const len = searchRef.value.length;
        const safeStart = Math.max(0, Math.min(len, selectionStart ?? len));
        const safeEnd = Math.max(safeStart, Math.min(len, selectionEnd ?? safeStart));
        searchRef.setSelectionRange(safeStart, safeEnd);
      }
    }
  } catch {
    render(options);
  }
}

function renderSkeleton() {
  app.textContent = '';
  const shell = create('div', 'shell');
  const header = create('div', 'section header header-minimal');
  const placeholder = create('div', 'skeleton-loading');
  placeholder.setAttribute('aria-label', t('Loading bookmarks…'));
  placeholder.setAttribute('aria-busy', 'true');
  header.append(placeholder);
  shell.append(header);
  app.append(shell);
}

deps.render = render;
deps.renderContentOnly = renderContentOnly;
deps.setToast = setToast;

async function init() {
  try {
    const storage = await initializeStorageLayer();
    await initI18n();
    await logger.info('init_started', { storageMigrated: storage.migrated, previousVersion: storage.previousVersion });
    state.themeMode = await loadStoredTheme();
    applyTheme(state.themeMode);
    const storedPalette = await loadStoredPalette();
    state.colorPalette = storedPalette;
    applyPalette(storedPalette);
    stopWatchingTheme = watchSystemTheme(() => {
      if (state.themeMode === THEME_MODES.SYSTEM) applyTheme(state.themeMode);
    });
    await actions.loadPrefs();
    renderSkeleton();
    await actions.refresh();
  } catch (error) {
    await logger.error('init_failed', { message: error?.message || String(error) });
    actions.renderInitError(error);
  }
}

addStorageChangedListener((changes, areaName) => {
  actions.handleLocaleChange(changes, areaName).catch(console.error);
  if (areaName === 'local' && changes[STORAGE_KEYS.PIN_ONBOARDING_VISIBLE]) {
    const newValue = changes[STORAGE_KEYS.PIN_ONBOARDING_VISIBLE].newValue;
    if (newValue === true && !state.pinOnboardingVisible) {
      state.pinOnboardingVisible = true;
      render();
    }
  }
  if (areaName === 'local' && changes[STORAGE_KEYS.COLOR_PALETTE]) {
    const newPalette = changes[STORAGE_KEYS.COLOR_PALETTE].newValue;
    if (newPalette && newPalette !== state.colorPalette) {
      state.colorPalette = newPalette;
      applyPalette(newPalette);
    }
  }
});

// React to bookmark changes made elsewhere (Chrome native UI, another window,
// or Chrome sync). bookmark-utils.js invalidates its own cache automatically;
// this listener also re-runs the popup's data pipeline and re-renders.
// Debounced because bulk imports can fire dozens of events in a single tick.
const refreshOnBookmarkChange = debounce(() => {
  // Avoid running while the popup is mid-init or already refreshing — actions
  // serialises its own state, so a redundant call here is harmless but wasteful.
  actions.refresh().catch((error) => {
    console.warn('Bookmark-event refresh failed.', error);
  });
}, 200);
addBookmarkEventListeners({
  created: refreshOnBookmarkChange,
  removed: refreshOnBookmarkChange,
  changed: refreshOnBookmarkChange,
  moved: refreshOnBookmarkChange,
  importEnded: refreshOnBookmarkChange
});

window.addEventListener('pagehide', () => {
  headerOverlays.hardCloseOverflowMenu();
  footer.stopFooterAutoRotate();
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
