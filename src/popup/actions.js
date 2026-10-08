import { queryTabs, createTab, createBookmark, removeBookmark, getRuntimeUrl, getBookmarkTree } from '../platform/browser-api.js';
import { loadPopupPreferences, savePopupPreferences, setPinOnboardingVisible } from '../services/preferences-service.js';
import { loadTagsMap, updateTagsMap, setTagsForBookmark } from '../services/tag-service.js';
import { MATCH_MODES, SORT_OPTIONS, STORAGE_KEYS, COLOR_PALETTES, POPUP_WIDTHS, TAG_MAX_PER_BOOKMARK } from '../constants.js';

export function createPopupActions(deps) {
  const {
    state,
    getCleanupSummary,
    getNormalizedBookmarks,
    detectDuplicates,
    filterScopedBookmarks,
    searchScopedBookmarks,
    sortBookmarks,
    invalidateBookmarkCache,
    getMatchTarget,
    matchesMode,
    applyTheme,
    saveThemeMode,
    applyPalette,
    saveColorPalette,
    t,
    getParseOptions,
    getAppTitle,
    app,
    create,
    translateTree
  } = deps;

  async function savePrefs() {
    await savePopupPreferences({
      mode: state.mode,
      sort: state.sort,
      ignoreQueryString: state.ignoreQueryString,
      ignoreHashFragment: state.ignoreHashFragment
    });
  }

  async function loadPrefs() {
    const prefs = await loadPopupPreferences();
    state.mode = prefs.mode || MATCH_MODES.DOMAIN;
    state.sort = prefs.sort || SORT_OPTIONS.TITLE_ASC;
    state.ignoreQueryString = prefs.ignoreQueryString;
    state.ignoreHashFragment = prefs.ignoreHashFragment;
    state.themeMode = prefs.themeMode || state.themeMode;
    state.pinOnboardingVisible = prefs.pinOnboardingVisible;
    applyTheme(state.themeMode);
    document.documentElement.style.setProperty('--popup-width', prefs.popupWidth === POPUP_WIDTHS.COMPACT ? '380px' : '420px');
  }

  async function getActiveContext() {
    const [tab] = await queryTabs({ active: true, currentWindow: true });
    state.tab = tab || null;
    state.target = tab?.url ? getMatchTarget(tab.url, getParseOptions()) : null;
  }

  async function loadBookmarks() {
    state.allBookmarks = detectDuplicates(await getNormalizedBookmarks(getParseOptions()));
    // O(1) lookup set for "is the current tab bookmarked?" — used by the
    // header star button on every render. Cheaper than .some() across all
    // bookmarks once libraries grow past a few hundred entries.
    state.bookmarkedUrlsSet = new Set(state.allBookmarks.map((bookmark) => bookmark.url));
  }

  function recalculate() {
    if (!state.target?.valid) {
      state.scopeBookmarks = [];
      state.visibleBookmarks = [];
      state.visibleFromFuzzy = false;
      state.scopeSummary = getCleanupSummary([]);
      return;
    }
    state.scopeBookmarks = state.allBookmarks.filter((bookmark) => matchesMode(bookmark, state.target, state.mode));
    state.scopeSummary = getCleanupSummary(state.scopeBookmarks);
    // searchScopedBookmarks first tries the existing strict matcher; if it
    // returns nothing and there are no operator filters in the query, it
    // falls back to fuzzy matching against title/url/path. The `fuzzy` flag
    // tells the UI to show a "showing fuzzy matches" hint.
    const { items, fuzzy } = searchScopedBookmarks
      ? searchScopedBookmarks(state.scopeBookmarks, state.query)
      : { items: filterScopedBookmarks(state.scopeBookmarks, state.query), fuzzy: false };
    state.visibleFromFuzzy = fuzzy;
    // Skip the standard sort when the result came from fuzzy mode — the
    // matcher already ranks by relevance, and re-sorting by title would
    // throw that away.
    state.visibleBookmarks = fuzzy ? items : sortBookmarks(items, state.sort);
  }

  async function refresh() {
    await getActiveContext();
    await loadBookmarks();
    recalculate();
    deps.render();
  }

  async function updateMode(mode) {
    state.mode = mode;
    await savePrefs();
    recalculate();
    deps.render();
  }

  async function updateSort(value) {
    state.sort = value;
    await savePrefs();
    recalculate();
    deps.render();
  }

  async function updateParsePreference(key, value) {
    state[key] = value;
    await savePrefs();
    invalidateBookmarkCache();
    await refresh();
  }

  async function updateThemeMode(mode) {
    state.themeMode = mode;
    applyTheme(mode);
    await saveThemeMode(mode);
    deps.closeOverflowMenu();
  }

  async function updateColorPalette(palette) {
    state.colorPalette = palette;
    applyPalette(palette);
    await saveColorPalette(palette);
  }

  async function openDashboard() {
    state.menuOpen = false;
    await createTab({ url: getRuntimeUrl('dashboard.html'), active: true });
  }

  async function openUrl(url) {
    if (!url) return;
    await createTab({ url, active: true });
  }

  async function openFolder(parentId) {
    if (!parentId) return;
    await createTab({ url: `chrome://bookmarks/?id=${encodeURIComponent(parentId)}`, active: true });
  }

  async function deleteBookmark(bookmark) {
    const confirmed = await deps.showConfirmDialog({
      title: t('Delete bookmark?'),
      message: t('Delete "{{title}}"?', { title: bookmark.title }),
      confirmLabel: t('Delete'),
      cancelLabel: t('Keep it'),
      danger: true
    });
    if (!confirmed) return;
    return deleteBookmarks([bookmark]);
  }

  let deleteBusy = false;
  async function currentNodes() {
    const nodes = new Map();
    function visit(children) {
      for (const [index, node] of (children || []).entries()) {
        nodes.set(node.id, { ...node, index: Number.isInteger(node.index) ? node.index : index });
        visit(node.children);
      }
    }
    visit(await getBookmarkTree());
    return nodes;
  }

  async function refreshAfterDeletion() {
    invalidateBookmarkCache();
    try { await refresh(); }
    catch (error) { console.error('Popup mutation applied; view refresh failed.', error); }
  }

  function recoveryOptions(batch, error = false) {
    return {
      error, persist: batch.items.length > 0,
      action: batch.items.length ? { label: t('Undo'), handler: () => restoreDeletedBatch(batch) } : undefined
    };
  }

  async function deleteBookmarks(bookmarks) {
    if (deleteBusy) return;
    deleteBusy = true;
    try {
      const nodes = await currentNodes();
      const tags = await loadTagsMap();
      const batch = { items: [], orders: new Map(), restoredIds: new Map(), restoring: false };
      for (const node of nodes.values()) {
        const siblings = batch.orders.get(node.parentId) || [];
        siblings.push(node);
        batch.orders.set(node.parentId, siblings);
      }
      for (const siblings of batch.orders.values()) siblings.sort((a, b) => a.index - b.index);
      let failed = 0;
      const unique = [...new Map(bookmarks.map(bookmark => [bookmark.id, bookmark])).values()];
      const candidates = unique.map(bookmark => ({ expected: bookmark, node: nodes.get(bookmark.id) }))
        .sort((a, b) => String(a.node?.parentId).localeCompare(String(b.node?.parentId)) || (b.node?.index || 0) - (a.node?.index || 0));
      for (const { expected, node } of candidates) {
        try {
          if (!node?.url || node.url !== expected.url) throw new Error('Bookmark changed or is missing.');
          await removeBookmark(node.id);
          batch.items.push({ id: node.id, title: node.title, url: node.url, parentId: node.parentId, index: node.index, tags: [...(tags[node.id] || [])] });
        } catch (error) {
          failed++;
          console.error('Popup bookmark deletion failed.', error);
        }
      }
      deps.setToast(t('Deleted: {{count}}. Failed: {{failed}}.', { count: batch.items.length, failed }), recoveryOptions(batch, failed > 0));
      await refreshAfterDeletion();
      return { deleted: batch.items.length, failed };
    } finally { deleteBusy = false; }
  }

  async function restoreDeletedBatch(batch) {
    if (!batch.items.length || batch.restoring) return;
    batch.restoring = true;
    let restored = 0;
    try {
      for (const item of [...batch.items].sort((a, b) => String(a.parentId).localeCompare(String(b.parentId)) || a.index - b.index)) {
        try {
          const nodes = await currentNodes();
          if (!item.restoredId) {
            const siblings = [...nodes.values()].filter(node => node.parentId === item.parentId).sort((a, b) => a.index - b.index);
            const initial = batch.orders.get(item.parentId) || [];
            const mappedId = id => batch.restoredIds.get(id) || id;
            const following = initial.find(node => node.index > item.index && siblings.some(sibling => sibling.id === mappedId(node.id)));
            const preceding = [...initial].reverse().find(node => node.index < item.index && siblings.some(sibling => sibling.id === mappedId(node.id)));
            const index = following ? siblings.findIndex(node => node.id === mappedId(following.id))
              : preceding ? siblings.findIndex(node => node.id === mappedId(preceding.id)) + 1 : siblings.length;
            const created = await createBookmark({ parentId: item.parentId, index, title: item.title, url: item.url });
            // Keep the identity before metadata work so a retry cannot duplicate it.
            item.restoredId = created.id;
            batch.restoredIds.set(item.id, created.id);
          } else if (!nodes.get(item.restoredId)?.url) {
            throw new Error('Recovered bookmark is missing; recovery remains pending.');
          }
          if (item.tags.length) {
            await updateTagsMap(map => {
              const combined = [...new Set([...(map[item.restoredId] || []), ...item.tags])];
              if (combined.length > TAG_MAX_PER_BOOKMARK) throw new Error('Tag limit exceeded; recovery remains pending.');
              return setTagsForBookmark(map, item.restoredId, combined);
            });
          }
          batch.items.splice(batch.items.indexOf(item), 1);
          restored++;
        } catch (error) { console.error('Popup delete recovery failed.', error); }
      }
      deps.setToast(t('Restored: {{count}}. Remaining: {{failed}}.', { count: restored, failed: batch.items.length }), recoveryOptions(batch, batch.items.length > 0));
      await refreshAfterDeletion();
      return { restored, remaining: batch.items.length };
    } finally { batch.restoring = false; }
  }

  async function bookmarkCurrentPage() {
    if (!state.tab?.url || !state.target?.valid) {
      deps.setToast(t('Open a normal web page first.'), { error: true });
      return;
    }
    invalidateBookmarkCache();
    await createBookmark({ title: state.tab.title || state.target.label, url: state.tab.url });
    deps.setToast(t('Current page bookmarked.'));
    await refresh();
  }

  // Removes every bookmark whose URL matches the current tab (after parse-
  // option normalisation). Most pages have at most one matching bookmark,
  // but we handle the general case so the star reflects reality afterwards.
  // The deleted bookmarks are restorable via the toast Undo action.
  async function unbookmarkCurrentPage() {
    if (!state.tab?.url || !state.target?.valid) {
      deps.setToast(t('Open a normal web page first.'), { error: true });
      return;
    }
    const pageKey = state.target.normalizedPageKey;
    const matches = state.allBookmarks.filter((bookmark) =>
      bookmark.parsed?.valid && bookmark.parsed.normalizedPageKey === pageKey
    );
    if (!matches.length) {
      deps.setToast(t('Nothing to remove for this page.'), { error: true });
      return;
    }
    return deleteBookmarks(matches);
  }

  async function dismissPinOnboarding() {
    state.pinOnboardingVisible = false;
    await setPinOnboardingVisible(false);
    deps.render();
  }

  async function handleLocaleChange(changes, areaName) {
    if (areaName !== 'local' || !changes[STORAGE_KEYS.LOCALE_PREFERENCE]) return;
    await deps.initI18n();
    deps.render();
  }

  function renderInitError(error) {
    console.error(error);
    app.textContent = '';
    const fallback = create('div', 'shell');
    const section = create('div', 'section');
    section.append(
      create('h1', 'title', getAppTitle()),
      create('div', 'subtitle', t('Popup hit a wall')),
      create('div', 'empty-copy', error?.message || t('Unknown popup error'))
    );
    fallback.append(section);
    app.append(fallback);
    translateTree(app);
  }

  return {
    savePrefs,
    loadPrefs,
    getActiveContext,
    loadBookmarks,
    recalculate,
    refresh,
    updateMode,
    updateSort,
    updateParsePreference,
    updateThemeMode,
    updateColorPalette,
    openDashboard,
    openUrl,
    openFolder,
    deleteBookmark,
    bookmarkCurrentPage,
    unbookmarkCurrentPage,
    dismissPinOnboarding,
    handleLocaleChange,
    renderInitError
  };
}
