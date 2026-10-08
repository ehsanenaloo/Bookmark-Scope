import { CLEANUP_FILTERS, DASHBOARD_MODE, GROUP_BY_OPTIONS, GROUP_SORT_OPTIONS, HEALTH_STATUSES, SORT_OPTIONS } from '../constants.js';

export function createRenderTools(deps) {
  const {
    state,
    t,
    create,
    iconSvg,
    createIconButton,
    createIconElement,
    formatNumber,
    debounce,
    getManifest,
    getRuntimeUrl,
    getCleanupSummary,
    getHealthRecord,
    handleOpen,
    buildInspectButton,
    inspectBookmarksHealth,
    renderItem,
    render,
    isGroupCollapsed,
    toggleGroupCollapsed,
    isGroupFullySelected,
    toggleGroupSelection,
    getGroupHealthSummary,
    getSelectedBookmarks,
    selectedBookmarks,
    getInspectTargetBookmarks,
    getInspectButtonLabel,
    modeLabel,
    getScopedBookmarks,
    getScopeSummary,
    getCleanupCount,
    cleanupFilterLabel,
    groupByLabel,
    getGroupedVisibleBookmarks,
    setAllGroupsCollapsed,
    setCleanupFilter,
    handleCopySelectedUrls,
    handleDeleteMany,
    createListHeadActionsMenu,
    handleRepairRedirects,
    handleExport,
    openSupportLink,
    toggleHeaderMenu,
    searchInputRefAccessor
  } = deps;

  const resolveSelectedBookmarks = getSelectedBookmarks || selectedBookmarks || (() => []);

  function createGroupMetricBadge(label, className) {
    const badge = create('span', `duplicate-badge bookmark-group-metric ${className}`);
    badge.textContent = label;
    return badge;
  }

  function renderGroupHeaderBadges(group) {
    const cleanup = getCleanupSummary(group.items);
    const health = getGroupHealthSummary(group);
    const wrap = create('div', 'bookmark-group-badges');

    if (cleanup.duplicateCount) {
      wrap.append(createGroupMetricBadge(t('{{count}} duplicate', { count: formatNumber(cleanup.duplicateCount) }), 'status-duplicate'));
    }
    if (health.unhealthy) {
      wrap.append(createGroupMetricBadge(t('{{count}} unhealthy', { count: formatNumber(health.unhealthy) }), 'health-broken'));
    }
    if (health.redirected) {
      wrap.append(createGroupMetricBadge(t('{{count}} redirected', { count: formatNumber(health.redirected) }), 'health-redirected'));
    }
    if (cleanup.oldCount) {
      wrap.append(createGroupMetricBadge(t('{{count}} old', { count: formatNumber(cleanup.oldCount) }), 'status-old'));
    }

    if (!wrap.childElementCount) {
      wrap.append(createGroupMetricBadge(t('No issues'), 'bookmark-group-metric-neutral'));
    }

    return wrap;
  }

  async function openGroupBookmarks(group) {
    for (const bookmark of group.items) {
      if (bookmark?.url) await handleOpen(bookmark.url);
    }
  }

  function inspectGroupBookmarks(group) {
    inspectBookmarksHealth(group.items, { contextLabel: t('{{label}} group', { label: group.label }) });
  }

  function renderBookmarkGroup(group) {
    const collapsed = isGroupCollapsed(group.key);
    const section = create('section', `bookmark-group bookmark-group-${group.tone}${collapsed ? ' is-collapsed' : ''}`);
    section.dataset.groupKey = group.key;
    const header = create('div', 'bookmark-group-header');
    const copy = create('div', 'bookmark-group-copy');
    const titleRow = create('div', 'bookmark-group-title-row');

    const toggle = create('button', 'bookmark-group-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    toggle.setAttribute('aria-label', collapsed ? t('Expand {{label}}', { label: group.label }) : t('Collapse {{label}}', { label: group.label }));
    toggle.append(createIconElement('chevronRight', 'bookmark-group-toggle-icon'));
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleGroupCollapsed(group.key);
    });

    titleRow.append(
      toggle,
      create('div', 'bookmark-group-title', group.label),
      create('span', 'bookmark-group-count', String(group.items.length))
    );

    const metaRow = create('div', 'bookmark-group-meta-row');
    metaRow.append(
      create('div', 'bookmark-group-summary', t('{{count}} bookmarks', { count: formatNumber(group.items.length) })),
      renderGroupHeaderBadges(group)
    );

    copy.append(titleRow, metaRow);
    copy.addEventListener('click', () => toggleGroupCollapsed(group.key));

    const actions = create('div', 'bookmark-group-actions');
    const selectButton = create('button', 'ghost-button compact-list-button bookmark-group-select', isGroupFullySelected(group) ? t('Uncheck group') : t('Select group'));
    selectButton.type = 'button';
    selectButton.addEventListener('click', () => toggleGroupSelection(group));

    const inspectButton = buildInspectButton(t('Inspect this group'), group.items.length, 'ghost-button compact-list-button bookmark-group-inspect');
    inspectButton.addEventListener('click', () => inspectGroupBookmarks(group));

    const openButton = create('button', 'ghost-button compact-list-button bookmark-group-open', t('Open group'));
    openButton.type = 'button';
    openButton.disabled = group.items.length === 0;
    openButton.addEventListener('click', async () => { await openGroupBookmarks(group); });

    actions.append(selectButton, inspectButton, openButton);

    header.append(copy, actions);
    section.append(header);

    if (!collapsed) {
      const list = create('div', 'bookmark-group-list');
      group.items.forEach((bookmark) => list.append(renderItem(bookmark)));
      section.append(list);
    }

    return section;
  }

  function renderGroupDisplayControl() {
    const grouped = getGroupedVisibleBookmarks();
    if (!grouped.length) return null;
    const allCollapsed = grouped.every((group) => isGroupCollapsed(group.key));
    const label = allCollapsed ? t('Expand groups') : t('Collapse groups');

    const control = create('div', 'dashboard-group-display-control');
    const toggle = create('button', `ghost-button compact-list-button dashboard-group-display-button${allCollapsed ? ' is-collapsed-state' : ' is-expanded-state'}`, label);
    toggle.type = 'button';
    toggle.setAttribute('aria-pressed', allCollapsed ? 'false' : 'true');
    toggle.addEventListener('click', () => setAllGroupsCollapsed(!allCollapsed));

    control.append(toggle);
    return control;
  }

  function renderHeader(root) {
    const header = create('div', 'section header dashboard-header-v2');
    const left = create('div', 'dashboard-header-left');
    const brand = create('div', 'dashboard-brand-row');
    const brandIcon = create('img', 'dashboard-brand-icon');
    brandIcon.alt = '';
    brandIcon.src = getRuntimeUrl('icon-48.png');
    const brandText = create('div', 'dashboard-brand-text');
    const eyebrow = create('div', 'dashboard-eyebrow', t('Library dashboard'));
    const title = create('h1', 'title dashboard-title', t('Bookmark Scope'));
    const context = create('div', 'dashboard-context context-text', t('{{count}} total bookmarks in the library.', { count: formatNumber(state.allBookmarks.length) }));
    brandText.append(eyebrow, title, context);
    brand.append(brandIcon, brandText);
    left.append(brand);

    const right = create('div', 'dashboard-header-right');
    const actionRow = create('div', 'dashboard-header-actions dashboard-header-menu-shell');

    const supportButton = create('button', 'button primary-button dashboard-support-button');
    supportButton.type = 'button';
    supportButton.textContent = t('Buy me a coffee');
    supportButton.addEventListener('click', openSupportLink);

    const menuWrap = create('div', 'dashboard-header-menu-wrap');
    const menuButton = createIconButton('moreVertical', t('More actions'), 'icon-button mono-icon-button dashboard-menu-button');
    menuButton.setAttribute('aria-haspopup', 'menu');
    menuButton.setAttribute('aria-expanded', state.headerMenuOpen ? 'true' : 'false');
    menuButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleHeaderMenu(event.currentTarget);
    });
    menuWrap.append(menuButton);

    actionRow.append(supportButton, menuWrap);
    right.append(actionRow);
    header.append(left, right);
    root.append(header);
  }

  function renderToolbar(root) {
    const toolbar = create('div', 'section toolbar dashboard-toolbar-v2');

    const controls = create('div', 'dashboard-control-strip has-group-control');
    const search = create('input', 'search-input dashboard-search-input');
    search.type = 'search';
    search.placeholder = t('Search title, URL, or folder');
    search.setAttribute('aria-label', t('Search bookmarks by title, URL, or folder'));
    search.value = state.query;

    const debouncedDashSearch = debounce((selStart, selEnd) => {
      state.searchSelectionStart = selStart;
      state.searchSelectionEnd = selEnd;
      deps.recalculateVisibleBookmarks();
      deps.renderListOnly();
    }, 150);

    search.addEventListener('input', (event) => {
      const value = event.target.value;
      state.query = value;
      state.focusSearchAfterRender = true;
      debouncedDashSearch(event.target.selectionStart, event.target.selectionEnd);
    });
    searchInputRefAccessor.set(search);

    const groupWrap = create('div', 'dashboard-groupby-wrap');
    const groupSelect = create('select', 'select dashboard-groupby-select');
    [
      [GROUP_BY_OPTIONS.FLAT, t('Flat view')],
      [GROUP_BY_OPTIONS.DOMAIN, t('Group by domain')],
      [GROUP_BY_OPTIONS.FOLDER, t('Group by folder')],
      [GROUP_BY_OPTIONS.STATUS, t('Group by status')]
    ].forEach(([value, label]) => {
      const option = create('option', '', label);
      option.value = value;
      option.selected = state.groupBy === value;
      groupSelect.append(option);
    });
    groupSelect.title = t('Choose how visible bookmarks are grouped');
    groupSelect.setAttribute('aria-label', t('Choose how visible bookmarks are grouped'));
    groupSelect.addEventListener('change', (event) => deps.updateGroupBy(event.target.value));
    groupWrap.append(groupSelect);

    // Bookmark order (list, or inside each group). Same enum and persistence as
    // the popup/options sort; group order keeps its own control below.
    const sortWrap = create('div', 'dashboard-groupby-wrap dashboard-sort-wrap');
    const sortSelect = create('select', 'select dashboard-groupby-select dashboard-sort-select');
    [
      [SORT_OPTIONS.TITLE_ASC, t('Title')],
      [SORT_OPTIONS.URL_ASC, t('URL')],
      [SORT_OPTIONS.NEWEST, t('Newest')],
      [SORT_OPTIONS.OLDEST, t('Oldest')],
      [SORT_OPTIONS.PATH_ASC, t('Folder path')]
    ].forEach(([value, label]) => {
      const option = create('option', '', label);
      option.value = value;
      option.selected = state.sort === value;
      sortSelect.append(option);
    });
    sortSelect.title = t('Sort visible bookmarks');
    sortSelect.setAttribute('aria-label', t('Sort visible bookmarks'));
    sortSelect.addEventListener('change', (event) => {
      deps.updateSort(event.target.value);
      // The toolbar is rebuilt by render(); return keyboard focus to the new control.
      document.querySelector('.dashboard-sort-select')?.focus();
    });
    sortWrap.append(sortSelect);

    controls.append(search, groupWrap, sortWrap);

    if (state.groupBy !== GROUP_BY_OPTIONS.FLAT) {
      controls.classList.add('has-group-sort-control');
      const groupSortWrap = create('div', 'dashboard-groupsort-wrap');
      const groupSortSelect = create('select', 'select dashboard-groupsort-select');
      [
        [GROUP_SORT_OPTIONS.DEFAULT, deps.groupSortLabel(GROUP_SORT_OPTIONS.DEFAULT)],
        [GROUP_SORT_OPTIONS.SIZE_DESC, deps.groupSortLabel(GROUP_SORT_OPTIONS.SIZE_DESC)],
        [GROUP_SORT_OPTIONS.ALPHA_ASC, deps.groupSortLabel(GROUP_SORT_OPTIONS.ALPHA_ASC)]
      ].forEach(([value, label]) => {
        const option = create('option', '', label);
        option.value = value;
        option.selected = state.groupSort === value;
        groupSortSelect.append(option);
      });
      groupSortSelect.title = t('Choose how groups are sorted');
      groupSortSelect.setAttribute('aria-label', t('Choose how groups are sorted'));
      groupSortSelect.addEventListener('change', (event) => deps.updateGroupSort(event.target.value));
      groupSortWrap.append(groupSortSelect);
      controls.append(groupSortWrap);
    }

    const filters = create('div', 'cleanup-chip-row dashboard-filter-strip');
    [
      [CLEANUP_FILTERS.ALL, t('All')],
      [CLEANUP_FILTERS.DUPLICATES, t('Duplicates')],
      [CLEANUP_FILTERS.UNTITLED, t('Untitled')],
      [CLEANUP_FILTERS.OLD, t('Old')],
      [CLEANUP_FILTERS.TITLE_COLLISIONS, t('Collisions')]
    ].forEach(([value, label]) => {
      const toneClass = value === CLEANUP_FILTERS.DUPLICATES
        ? ' is-duplicate'
        : value === CLEANUP_FILTERS.TITLE_COLLISIONS
          ? ' is-collision'
          : value === CLEANUP_FILTERS.OLD
            ? ' is-aging'
            : value === CLEANUP_FILTERS.UNTITLED
              ? ' is-untitled'
              : '';
      const button = create('button', `filter-chip dashboard-filter-chip${state.cleanupFilter === value ? ' active' : ''}${toneClass}`);
      button.type = 'button';
      button.title = `${label}: ${getCleanupCount(value)}`;
      button.append(
        create('span', 'filter-chip-label', label),
        create('span', 'filter-chip-count', String(getCleanupCount(value)))
      );
      button.addEventListener('click', () => setCleanupFilter(value));
      filters.append(button);
    });

    const compactToggle = create('button', `icon-button mono-icon-button dashboard-compact-toggle${state.compactMode ? ' active' : ''}`, '');
    compactToggle.type = 'button';
    compactToggle.title = state.compactMode ? t('Switch to normal density') : t('Switch to compact density');
    compactToggle.setAttribute('aria-pressed', state.compactMode ? 'true' : 'false');
    compactToggle.innerHTML = iconSvg(state.compactMode ? 'compactView' : 'listView');
    compactToggle.addEventListener('click', () => {
      state.compactMode = !state.compactMode;
      deps.renderListOnly();
    });

    toolbar.append(controls, filters, compactToggle);
    root.append(toolbar);
  }

  function renderBulkBar(root) {
    if (!state.selectedIds.size && !state.isInspectingHealth && !state.inspectStopPending) return;

    const bar = create('div', 'section bulk-bar dashboard-bulk-bar');
    const duplicateGroupCount = state.visibleDuplicateGroups;
    const text = create('div', 'summary-line compact-bulk-summary', `${t('{{count}} selected', { count: formatNumber(state.selectedIds.size) })} · ${t('{{shown}} shown · {{total}} total', { shown: formatNumber(state.visibleBookmarks.length), total: formatNumber(getScopedBookmarks().length) })} · ${cleanupFilterLabel(state.cleanupFilter)}`);

    const actions = create('div', 'footer-actions wrap');
    const clear = create('button', 'ghost-button', t('Clear'));
    clear.type = 'button';
    clear.addEventListener('click', () => { state.selectedIds.clear(); render(); });
    const selectDupes = create('button', 'ghost-button', t('Select duplicates'));
    selectDupes.type = 'button';
    selectDupes.disabled = duplicateGroupCount === 0;
    selectDupes.addEventListener('click', () => { state.visibleBookmarks.filter((item) => item.isDuplicate).forEach((bookmark) => state.selectedIds.add(bookmark.id)); render(); });
    const inspectTarget = getInspectTargetBookmarks();
    const inspectVisible = buildInspectButton(getInspectButtonLabel(), inspectTarget.length, 'ghost-button');
    inspectVisible.addEventListener('click', () => inspectBookmarksHealth(getInspectTargetBookmarks()));
    const openSelected = create('button', 'ghost-button', t('Open'));
    openSelected.type = 'button';
    openSelected.disabled = state.selectedIds.size === 0;
    openSelected.addEventListener('click', async () => { for (const bookmark of resolveSelectedBookmarks()) await handleOpen(bookmark.url); });
    const deleteSelected = create('button', 'ghost-button danger-button', t('Delete'));
    deleteSelected.type = 'button';
    deleteSelected.disabled = state.selectedIds.size === 0;
    deleteSelected.addEventListener('click', () => handleDeleteMany(resolveSelectedBookmarks()));
    actions.append(clear, selectDupes, inspectVisible, openSelected, deleteSelected);
    bar.append(text, actions);
    root.append(bar);
  }

  return {
    renderHeader,
    renderToolbar,
    renderBulkBar,
    renderGroupDisplayControl,
    renderBookmarkGroup
  };
}
