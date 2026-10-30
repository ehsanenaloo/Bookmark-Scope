import { MATCH_MODES, POPUP_MAX_ROWS, POPUP_ROW_LIMIT_UNLIMITED } from '../core/constants.js';
import { getBookmarksManagerUrl } from '../platform/browser-api.js';
import { describeBookmarkUrl } from './url-label.js';
import { featureText } from '../locales/feature-messages.js';

const SCROLL_LOAD_MARGIN_PX = 240;

export function createPopupMatchesToast(deps) {
  const {
    state,
    formatNumber,
    createFaviconNode,
    debounce,
    createIconButton,
    t,
    create,
    setSearchRef,
    groupDuplicates,
    actions,
    onMoveBookmark = null
  } = deps;

  function isLibraryView() {
    return state.view === 'all';
  }

  function modeLabel(mode) {
    switch (mode) {
      case MATCH_MODES.PAGE:
        return t('This page');
      case MATCH_MODES.HOST:
        return t('This host');
      default:
        return t('This domain');
    }
  }

  function duplicateGroupsCount(items) {
    return groupDuplicates(items).size;
  }

  function renderCompactReview() {
    const dupGroups = duplicateGroupsCount(state.scopeBookmarks);
    const issues = [];
    if (dupGroups) issues.push(t('{{count}} dup', { count: formatNumber(dupGroups) }));
    if (state.scopeSummary.oldCount) issues.push(t('{{count}} old', { count: formatNumber(state.scopeSummary.oldCount) }));
    if (state.scopeSummary.untitledCount) issues.push(t('{{count}} untitled', { count: formatNumber(state.scopeSummary.untitledCount) }));
    if (state.scopeSummary.titleCollisionCount) issues.push(t('{{count}} collisions', { count: formatNumber(state.scopeSummary.titleCollisionCount) }));
    if (!issues.length) return null;
    const line = create('div', 'compact-review-line compact-review-line-inline');
    line.append(create('span', 'review-dot', '•'));
    line.append(create('div', 'helper', t('Needs review: {{issues}}', { issues: issues.join(' · ') })));
    return line;
  }

  function formatAgeBadge(days) {
    if (!Number.isFinite(days) || days < 0) return t('Old');
    if (days >= 365) return t('Old · ~{{count}}y', { count: formatNumber(Math.max(1, Math.round(days / 365))) });
    if (days >= 45) return t('Old · ~{{count}}mo', { count: formatNumber(Math.max(2, Math.round(days / 30))) });
    return t('Old · {{count}}d', { count: formatNumber(days) });
  }

  function chip(label, tone = '') {
    return create('div', `chip${tone ? ` ${tone}` : ''}`, label);
  }

  function renderItem(bookmark) {
    const item = create('div', 'item');
    const top = create('div', 'item-top');
    const main = create('div', 'item-main');
    const favicon = createFaviconNode(bookmark, create);
    const body = create('div');
    const title = create('h3', 'item-title');
    const link = create('a', 'item-link', bookmark.title);
    link.href = bookmark.url;
    link.dir = 'auto';
    link.title = bookmark.url || '';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      actions.openUrl(bookmark.url, { background: event.ctrlKey || event.metaKey });
    });
    link.addEventListener('auxclick', (event) => {
      if (event.button !== 1) return;
      event.preventDefault();
      actions.openUrl(bookmark.url, { background: true });
    });
    title.append(link);
    body.append(title);

    const urlLabel = describeBookmarkUrl(bookmark, isLibraryView() ? null : state.target);
    if (urlLabel) {
      const url = create('div', 'item-url', urlLabel);
      url.dir = 'auto';
      url.title = bookmark.url || '';
      body.append(url);
    }
    const path = create('div', 'item-path', bookmark.path || t('Root'));
    path.dir = 'auto';
    path.title = bookmark.path || t('Root');
    body.append(path);

    const actionsWrap = create('div', 'item-actions');
    const folder = createIconButton('folder', t('Show in bookmarks'), 'icon-button');
    folder.addEventListener('click', () => actions.openFolder(bookmark.parentId));
    const remove = createIconButton('trash', t('Delete'), 'icon-button');
    remove.addEventListener('click', () => actions.deleteBookmark(bookmark));
    const buttons = getBookmarksManagerUrl(bookmark.parentId) ? [folder, remove] : [remove];
    if (onMoveBookmark) {
      const move = createIconButton('folderInput', featureText('Move to folder'), 'icon-button');
      move.addEventListener('click', () => onMoveBookmark(bookmark));
      buttons.unshift(move);
    }
    actionsWrap.append(...buttons);

    main.append(favicon, body);
    top.append(main, actionsWrap);
    item.append(top);

    const badges = create('div', 'badges');
    if (bookmark.isDuplicate) badges.append(chip(t('Duplicate'), 'status-duplicate'));
    if (bookmark.isOld) {
      const oldChip = chip(formatAgeBadge(bookmark.ageDays), 'warning');
      oldChip.title = t('{{count}} days old', { count: formatNumber(bookmark.ageDays) });
      badges.append(oldChip);
    }
    if (bookmark.isUntitled) badges.append(chip(t('Untitled'), 'status-untitled'));
    if (bookmark.hasTitleCollision) badges.append(chip(t('Title collision'), 'status-collision'));
    if (badges.childNodes.length) item.append(badges);
    return item;
  }

  function renderMatches(root) {
    const section = create('div', 'section popup-home');
    if (!isLibraryView() && !state.target?.valid) {
      const empty = create('div', 'empty');
      empty.append(create('div', 'metric-value', t('No scope')), create('div', 'empty-copy', t('Chrome internal pages are goblins. Use a normal site.')));
      section.append(empty);
      root.append(section);
      return;
    }

    const controlStrip = create('div', 'control-strip-inline');
    const searchWrap = create('div', 'search-wrap search-wrap-inline-compact');
    const search = create('input', 'input input-compact input-inline-search');
    search.type = 'search';
    search.placeholder = t('Search bookmarks');
    search.setAttribute('aria-label', t('Filter visible bookmarks in this scope'));
    search.value = state.query;
    search.title = t('Filter visible bookmarks in this scope');

    const debouncedSearch = debounce((selStart, selEnd) => {
      actions.recalculate();
      deps.render({ preserveSearchFocus: true, selectionStart: selStart, selectionEnd: selEnd });
    }, 150);

    search.addEventListener('input', (event) => {
      const value = event.target.value;
      const selectionStart = typeof event.target.selectionStart === 'number' ? event.target.selectionStart : value.length;
      const selectionEnd = typeof event.target.selectionEnd === 'number' ? event.target.selectionEnd : selectionStart;
      state.query = value;
      debouncedSearch(selectionStart, selectionEnd);
    });
    setSearchRef(search);
    searchWrap.append(search);

    const scopeSeg = create('div', 'scope-seg-control');
    scopeSeg.setAttribute('role', 'group');
    scopeSeg.setAttribute('aria-label', t('Choose current bookmark scope'));
    [[MATCH_MODES.PAGE, t('Page')], [MATCH_MODES.HOST, t('Host')], [MATCH_MODES.DOMAIN, t('Domain')]].forEach(([value, label]) => {
      const btn = create('button', `scope-seg-btn${state.mode === value ? ' active' : ''}`);
      btn.type = 'button';
      btn.textContent = label;
      btn.title = t('Choose current bookmark scope');
      btn.setAttribute('aria-pressed', state.mode === value ? 'true' : 'false');
      btn.addEventListener('click', () => actions.updateMode(value));
      scopeSeg.append(btn);
    });

    controlStrip.append(searchWrap);
    if (!isLibraryView()) controlStrip.append(scopeSeg);
    section.append(controlStrip);
    const reviewLine = renderCompactReview();
    if (reviewLine) section.append(reviewLine);

    // When fuzzy fallback rescued an otherwise-empty result set, surface
    // that so the user knows why the ranking looks different and that
    // matches may be approximate.
    if (state.visibleFromFuzzy && state.query) {
      const fuzzyHint = create('div', 'compact-review-line compact-review-line-inline');
      fuzzyHint.append(create('span', 'review-dot', '~'));
      fuzzyHint.append(create('div', 'helper', t('No exact matches — showing fuzzy results.')));
      section.append(fuzzyHint);
    }

    const list = create('div', 'list');
    if (state.groupByFolder && deps.renderFolderTree && deps.renderFolderTree(list)) {
      // grouped by folder by the side panel
    } else if (!state.visibleBookmarks.length) {
      const empty = create('div', 'empty');
      empty.append(create('div', 'metric-value', formatNumber(0)), create('div', 'empty-copy', isLibraryView() ? featureText('No bookmarks match this filter.') : t('No bookmarks for {{mode}} after this filter.', { mode: modeLabel(state.mode).toLowerCase() })));
      list.append(empty);
    } else {
      let rendered = 0;
      const total = state.visibleBookmarks.length;
      const limit = state.rowLimit === POPUP_ROW_LIMIT_UNLIMITED ? total : (state.rowLimit || POPUP_MAX_ROWS);
      const lazyLoad = state.lazyLoad !== false;
      const appendBatch = () => {
        const next = Math.min(total, rendered + limit);
        const fragment = document.createDocumentFragment();
        for (; rendered < next; rendered += 1) fragment.append(renderItem(state.visibleBookmarks[rendered]));
        list.append(fragment);
      };
      appendBatch();
      if (rendered < total && !lazyLoad) {
        list.append(create('div', 'helper', t('Showing {{shown}} of {{count}}. Open the dashboard for the full library console.', { shown: formatNumber(rendered), count: formatNumber(total) })));
      } else if (rendered < total) {
        list.addEventListener('scroll', () => {
          if (rendered < total && list.scrollHeight - list.scrollTop - list.clientHeight < SCROLL_LOAD_MARGIN_PX) appendBatch();
        }, { passive: true });
      }
    }

    section.append(list);
    root.append(section);
  }

  function renderToast(root) {
    if (!state.toast) return;
    const toast = create('div', `toast${state.toast.error ? ' error' : ''}`);
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.append(create('div', 'toast-copy', state.toast.message));
    if (state.toast.action?.label && typeof state.toast.action.handler === 'function') {
      const action = create('button', 'button toast-action-button');
      action.type = 'button';
      action.textContent = state.toast.action.label;
      action.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        window.clearTimeout(deps.setToastTimerRef.current);
        await state.toast.action.handler();
      });
      toast.append(action);
    }
    root.append(toast);
  }

  return { modeLabel, duplicateGroupsCount, renderMatches, renderToast, renderItem };
}
