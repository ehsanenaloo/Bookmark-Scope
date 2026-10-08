export function createGroupTools(deps) {
  const {
    state,
    t,
    render,
    savePreferences,
    formatNumber,
    getCleanupSummary,
    summarizeHealth,
    recalculateVisibleBookmarks,
    GROUP_BY_OPTIONS,
    GROUP_SORT_OPTIONS,
    SORT_OPTIONS
  } = deps;

  function groupByLabel(value) {
    switch (value) {
      case GROUP_BY_OPTIONS.DOMAIN:
        return t('Grouped by domain');
      case GROUP_BY_OPTIONS.FOLDER:
        return t('Grouped by folder');
      case GROUP_BY_OPTIONS.STATUS:
        return t('Grouped by status');
      case GROUP_BY_OPTIONS.FLAT:
      default:
        return t('Flat list');
    }
  }

  function updateGroupBy(value) {
    state.groupBy = Object.values(GROUP_BY_OPTIONS).includes(value) ? value : GROUP_BY_OPTIONS.FLAT;
    state.collapsedGroupKeys.clear();
    if (state.groupBy === GROUP_BY_OPTIONS.FLAT) {
      state.groupSort = GROUP_SORT_OPTIONS.DEFAULT;
    }
    savePreferences();
    render();
  }

  // Bookmark order inside the list (or inside each group). Group order has its
  // own control (updateGroupSort); saved views persist both values.
  function updateSort(value) {
    state.sort = Object.values(SORT_OPTIONS).includes(value) ? value : SORT_OPTIONS.TITLE_ASC;
    state.focusSearchAfterRender = false; // keep keyboard focus on the sort control
    recalculateVisibleBookmarks();
    savePreferences();
    render();
  }

  function groupSortLabel(value) {
    switch (value) {
      case GROUP_SORT_OPTIONS.SIZE_DESC:
        return t('Largest first');
      case GROUP_SORT_OPTIONS.ALPHA_ASC:
        return t('A → Z');
      case GROUP_SORT_OPTIONS.DEFAULT:
      default:
        return t('Default order');
    }
  }

  function updateGroupSort(value) {
    state.groupSort = Object.values(GROUP_SORT_OPTIONS).includes(value) ? value : GROUP_SORT_OPTIONS.DEFAULT;
    savePreferences();
    render();
  }

  function getBookmarkGroupMeta(bookmark, groupBy) {
    switch (groupBy) {
      case GROUP_BY_OPTIONS.DOMAIN: {
        const label = bookmark.parsed?.domain || bookmark.parsed?.hostname || t('No domain');
        return { key: `domain:${String(label).toLowerCase()}`, label, tone: 'domain' };
      }
      case GROUP_BY_OPTIONS.FOLDER: {
        const label = bookmark.path || t('Root');
        return { key: `folder:${String(label).toLowerCase()}`, label, tone: 'folder' };
      }
      case GROUP_BY_OPTIONS.STATUS: {
        if (bookmark.isDuplicate) return { key: 'status:duplicate', label: t('Duplicates'), tone: 'duplicate' };
        if (bookmark.isOld) return { key: 'status:old', label: t('Old bookmarks'), tone: 'old' };
        if (bookmark.isUntitled) return { key: 'status:untitled', label: t('Untitled'), tone: 'untitled' };
        if (bookmark.hasTitleCollision) return { key: 'status:collision', label: t('Title collisions'), tone: 'collision' };
        return { key: 'status:clean', label: t('Clean bookmarks'), tone: 'clean' };
      }
      case GROUP_BY_OPTIONS.FLAT:
      default:
        return { key: 'flat', label: t('All bookmarks'), tone: 'flat' };
    }
  }

  function summarizeGroupMeta(items) {
    const summary = getCleanupSummary(items);
    const bits = [t('{{count}} bookmarks', { count: formatNumber(items.length) })];
    if (summary.duplicateCount) bits.push(t('{{count}} duplicate', { count: formatNumber(summary.duplicateCount) }));
    if (summary.oldCount) bits.push(t('{{count}} old', { count: formatNumber(summary.oldCount) }));
    if (summary.untitledCount) bits.push(t('{{count}} untitled', { count: formatNumber(summary.untitledCount) }));
    if (summary.titleCollisionCount) bits.push(t('{{count}} collision', { count: formatNumber(summary.titleCollisionCount) }));
    return bits.join(' · ');
  }

  function getGroupDefaultSortWeight(group) {
    if (state.groupBy === GROUP_BY_OPTIONS.STATUS) {
      const order = ['status:duplicate', 'status:old', 'status:untitled', 'status:collision', 'status:clean'];
      const idx = order.indexOf(group.key);
      return idx === -1 ? 999 : idx;
    }
    if (state.groupBy === GROUP_BY_OPTIONS.FOLDER) {
      return group.label.toLowerCase();
    }
    return -(group.items.length || 0);
  }

  function sortGroups(groups) {
    switch (state.groupSort) {
      case GROUP_SORT_OPTIONS.SIZE_DESC:
        groups.sort((a, b) => (b.items.length - a.items.length) || a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
        break;
      case GROUP_SORT_OPTIONS.ALPHA_ASC:
        groups.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
        break;
      case GROUP_SORT_OPTIONS.DEFAULT:
      default:
        groups.sort((a, b) => {
          const weightA = getGroupDefaultSortWeight(a);
          const weightB = getGroupDefaultSortWeight(b);
          if (typeof weightA === 'number' && typeof weightB === 'number') {
            return (weightA - weightB) || a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
          }
          return String(weightA).localeCompare(String(weightB), undefined, { sensitivity: 'base' }) || a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
        });
        break;
    }
  }

  function getGroupedVisibleBookmarks() {
    if (state.groupBy === GROUP_BY_OPTIONS.FLAT) return [];
    const buckets = new Map();
    state.visibleBookmarks.forEach((bookmark) => {
      const meta = getBookmarkGroupMeta(bookmark, state.groupBy);
      const group = buckets.get(meta.key) || { ...meta, items: [] };
      group.items.push(bookmark);
      buckets.set(meta.key, group);
    });

    const groups = Array.from(buckets.values()).map((group) => ({
      ...group,
      summary: summarizeGroupMeta(group.items)
    }));

    sortGroups(groups);

    return groups;
  }

  function isGroupFullySelected(group) {
    return group.items.length > 0 && group.items.every((bookmark) => state.selectedIds.has(bookmark.id));
  }

  function toggleGroupSelection(group) {
    if (isGroupFullySelected(group)) {
      group.items.forEach((bookmark) => state.selectedIds.delete(bookmark.id));
    } else {
      group.items.forEach((bookmark) => state.selectedIds.add(bookmark.id));
    }
    render();
  }

  function isGroupCollapsed(groupKey) {
    return state.collapsedGroupKeys.has(groupKey);
  }

  function toggleGroupCollapsed(groupKey) {
    if (state.collapsedGroupKeys.has(groupKey)) {
      state.collapsedGroupKeys.delete(groupKey);
    } else {
      state.collapsedGroupKeys.add(groupKey);
    }
    render();
  }

  function setAllGroupsCollapsed(collapsed) {
    const groups = getGroupedVisibleBookmarks();
    state.collapsedGroupKeys = collapsed ? new Set(groups.map((group) => group.key)) : new Set();
    render();
  }

  function getGroupHealthSummary(group) {
    const summary = summarizeHealth(group.items, state.healthByKey);
    return {
      ...summary,
      unhealthy: (summary.broken || 0) + (summary.serverError || 0) + (summary.unreachable || 0)
    };
  }

  return {
    groupByLabel,
    updateGroupBy,
    groupSortLabel,
    updateGroupSort,
    updateSort,
    getGroupedVisibleBookmarks,
    isGroupFullySelected,
    toggleGroupSelection,
    isGroupCollapsed,
    toggleGroupCollapsed,
    setAllGroupsCollapsed,
    getGroupHealthSummary
  };
}
