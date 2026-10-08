/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 */

import { CLEANUP_FILTERS, HEALTH_STATUSES } from '../core/constants.js';
import { runtimeMessages } from '../runtime/messages.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function createReviewTools(deps) {
  const {
    state,
    t,
    formatNumber,
    isoNow,
    now,
    makeStableId,
    saveReviewReminderPreferences,
    sendMessage,
    downloadTextFile,
    render,
    setToast,
    modeLabel,
    getScopeSummary,
    getScopeHealthSummary,
    summarizeHealth,
    getBookmarksByHealthStatus,
    getRedirectedBookmarks,
    clearCleanupFilters,
    toggleBookmarksSelection,
    areBookmarksSelected,
    handleSaveReviewSession,
    inspectBookmarksHealth,
    handleRepairRedirects,
    runCleanupPreset,
    handleMergeDuplicates,
    pushCleanupHistory
  } = deps;

  function formatActionType(type) {
    const normalized = String(type || '').trim().toLowerCase();
    const known = {
      'health-scan': t('Health'),
      'mark-reviewed': t('Mark reviewed now'),
      'repair-redirects': t('Repair redirected'),
      'undo-delete': t('Undo'),
      'delete': t('Delete'),
      'bookmark-current-page': t('Bookmark current page'),
      'import': t('Imports')
    };
    if (known[normalized]) return known[normalized];
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
    const currentTime = now();
    const recentCutoff = currentTime - (7 * 24 * 60 * 60 * 1000);

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

  function formatRelativeDays(timestamp) {
    if (!timestamp) return t('not scheduled');
    const diff = timestamp - now();
    const days = Math.ceil(Math.abs(diff) / (24 * 60 * 60 * 1000));
    if (days <= 1) return diff >= 0 ? t('within 24h') : t('overdue by <1 day');
    return diff >= 0 ? t('in {{days}} days', { days: formatNumber(days) }) : t('overdue by {{days}} days', { days: formatNumber(days) });
  }

  function getReminderState() {
    const nextAt = Number(state.nextReviewAt || 0);
    const due = Boolean(state.reminderEnabled && nextAt && nextAt <= now());
    return {
      enabled: Boolean(state.reminderEnabled),
      intervalDays: Number(state.reminderIntervalDays || 14),
      lastReviewAt: Number(state.lastReviewAt || 0),
      nextReviewAt: nextAt,
      due,
      statusLabel: !state.reminderEnabled
        ? t('Reminders are off')
        : nextAt
          ? (due ? t('Review due — {{relative}}', { relative: formatRelativeDays(nextAt) }) : t('Next review {{relative}}', { relative: formatRelativeDays(nextAt) }))
          : t('Reminder schedule has no next date yet')
    };
  }

  function buildReminderState() {
    return getReminderState();
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
    const confidence = health.checked ? t('Includes link-health data for {{count}} checked bookmarks.', { count: formatNumber(health.checked) }) : t('Metadata-only score until you run a health scan.');
    return { score: rounded, grade, confidence, health, isMetadataOnly: !health.checked };
  }

  function buildReviewReport() {
    return {
      generatedAt: isoNow(),
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
    const stamp = isoNow().replace(/[:.]/g, '-');
    downloadTextFile(`bookmark-manager-review-report-${stamp}.json`, JSON.stringify(buildReviewReport(), null, 2), 'application/json');
    setToast(t('Exported review report JSON. Tiny audit trail, less amnesia.'));
  }

  function buildSmartRecommendations() {
    const recommendations = [];
    const scopeSummary = getScopeSummary();
    const health = state.healthSummary || summarizeHealth(state.visibleBookmarks, state.healthByKey);
    const reminder = getReminderState();
    const score = computeHealthScore();

    if (reminder.enabled && reminder.due) {
      recommendations.push({
        id: 'due-review',
        tone: 'warning',
        title: t('Scheduled review is due'),
        body: t('Your {{days}}-day review cadence is overdue. Open the mess now before it ferments.', { days: formatNumber(reminder.intervalDays) }),
        actions: [
          { label: t('Mark reviewed now'), run: handleMarkReviewedNow },
          { label: t('Save review session'), run: handleSaveReviewSession }
        ]
      });
    }

    if (!getScopeHealthSummary().checked && state.visibleBookmarks.length) {
      recommendations.push({
        id: 'scan-health',
        tone: 'muted',
        title: t('Run a health scan on this scope'),
        body: t('Your health score is partly blind because no visible links have been inspected yet.'),
        actions: [
          { label: t('Inspect visible links'), run: () => inspectBookmarksHealth(state.visibleBookmarks) }
        ]
      });
    }

    if ((health.broken + health.serverError + health.unreachable) > 0) {
      const unhealthyBookmarks = getBookmarksByHealthStatus([HEALTH_STATUSES.BROKEN, HEALTH_STATUSES.SERVER_ERROR, HEALTH_STATUSES.UNREACHABLE]);
      recommendations.push({
        id: 'unhealthy-links',
        tone: 'danger',
        title: t('Cull or repair unhealthy links'),
        body: t('{{count}} visible bookmarks failed health checks. Dead links rot the shelf.', { count: formatNumber(health.broken + health.serverError + health.unreachable) }),
        actions: [
          { label: areBookmarksSelected(unhealthyBookmarks) ? t('Uncheck unhealthy') : t('Select unhealthy'), run: () => toggleBookmarksSelection(unhealthyBookmarks) },
          { label: t('Review unhealthy'), run: () => { clearCleanupFilters(); state.query = ''; render(); } }
        ]
      });
    }

    if (health.redirected > 0) {
      recommendations.push({
        id: 'redirect-cleanup',
        tone: 'warning',
        title: t('Repair redirected bookmarks'),
        body: t('{{count}} visible bookmarks could be updated to their final URL and lose the redirect detour.', { count: formatNumber(health.redirected) }),
        actions: [
          { label: t('Repair redirected'), run: () => handleRepairRedirects(getRedirectedBookmarks(state.visibleBookmarks, state.healthByKey)) }
        ]
      });
    }

    if (scopeSummary.duplicateGroupCount > 0) {
      recommendations.push({
        id: 'merge-dupes',
        tone: 'muted',
        title: t('Merge duplicate groups'),
        body: t('{{count}} duplicate groups are wasting slots in this scope.', { count: formatNumber(scopeSummary.duplicateGroupCount) }),
        actions: [
          { label: t('Review duplicates'), run: () => runCleanupPreset(CLEANUP_FILTERS.DUPLICATES, 'is:duplicate') },
          { label: t('Merge visible duplicates'), run: handleMergeDuplicates }
        ]
      });
    }

    if (scopeSummary.oldCount > 0 && (scopeSummary.oldCount >= 10 || (scopeSummary.oldCount / Math.max(1, scopeSummary.total)) > 0.25)) {
      recommendations.push({
        id: 'stale-review',
        tone: 'muted',
        title: t('Review stale bookmarks'),
        body: t('{{count}} bookmarks in this scope are old enough to vote twice.', { count: formatNumber(scopeSummary.oldCount) }),
        actions: [
          { label: t('Review old'), run: () => runCleanupPreset(CLEANUP_FILTERS.OLD, 'age:old') }
        ]
      });
    }

    if ((scopeSummary.untitledCount + scopeSummary.titleCollisionCount) > 0) {
      recommendations.push({
        id: 'metadata',
        tone: 'muted',
        title: t('Fix muddy metadata'),
        body: t('{{untitled}} untitled and {{collisions}} title-collision bookmarks are making search dumber.', { untitled: formatNumber(scopeSummary.untitledCount), collisions: formatNumber(scopeSummary.titleCollisionCount) }),
        actions: [
          { label: t('Review untitled'), run: () => runCleanupPreset(CLEANUP_FILTERS.UNTITLED, 'is:untitled') },
          { label: t('Review collisions'), run: () => runCleanupPreset(CLEANUP_FILTERS.TITLE_COLLISIONS, 'is:title-collision') }
        ]
      });
    }

    if (!recommendations.length) {
      recommendations.push({
        id: 'steady-state',
        tone: 'success',
        title: score.score >= 90 ? t('Library health looks strong') : t('No urgent cleanup recommendation'),
        body: score.score >= 90 ? t('Health score {{score}}/{{total}} ({{grade}}). Nothing obvious is rotting in this scope right now.', { score: formatNumber(score.score), total: formatNumber(100), grade: score.grade }) : t('Nothing acute is screaming for action. Keep the cadence and the swamp stays shallow.'),
        actions: reminder.enabled ? [{ label: t('Mark reviewed now'), run: handleMarkReviewedNow }] : []
      });
    }

    return recommendations.slice(0, 4);
  }


  function getReviewQueue() {
    return buildSmartRecommendations();
  }

  async function persistReminderSettings() {
    await saveReviewReminderPreferences({
      enabled: state.reminderEnabled,
      intervalDays: state.reminderIntervalDays,
      lastReviewAt: state.lastReviewAt,
      nextReviewAt: state.nextReviewAt
    });
    await sendMessage(runtimeMessages.syncReviewReminder());
  }

  async function handleUpdateReminderSettings(partial = {}) {
    state.reminderEnabled = partial.enabled ?? state.reminderEnabled;
    state.reminderIntervalDays = Number(partial.intervalDays || state.reminderIntervalDays || 14);
    if (partial.lastReviewAt !== undefined) state.lastReviewAt = Number(partial.lastReviewAt || 0);
    if (partial.nextReviewAt !== undefined) state.nextReviewAt = Number(partial.nextReviewAt || 0);
    if (state.reminderEnabled && !state.nextReviewAt) {
      const anchor = state.lastReviewAt || now();
      state.nextReviewAt = anchor + (state.reminderIntervalDays * 24 * 60 * 60 * 1000);
    }
    if (!state.reminderEnabled) {
      state.nextReviewAt = 0;
    }
    await persistReminderSettings();
    render();
  }

  async function handleMarkReviewedNow() {
    const currentTime = now();
    state.lastReviewAt = currentTime;
    // Only advance the next-review date when reminders are already enabled.
    // If the user has reminders off, respect that choice — just log the review.
    if (state.reminderEnabled) {
      state.nextReviewAt = currentTime + (state.reminderIntervalDays * 24 * 60 * 60 * 1000);
    }
    await persistReminderSettings();
    await pushCleanupHistory({
      type: 'mark-reviewed',
      count: state.visibleBookmarks.length,
      note: t('Marked {{scope}} as reviewed.', { scope: modeLabel(state.mode).toLowerCase() })
    });
    const toastMessage = state.reminderEnabled
      ? t('Review marked complete. Next reminder {{relative}}.', { relative: formatRelativeDays(state.nextReviewAt) })
      : t('Review marked complete.');
    setToast(toastMessage);
    render();
  }

  return {
    formatActionType,
    getHistoryTrends,
    buildReviewReport,
    exportReviewReport,
    buildReminderState,
    getReminderState,
    computeHealthScore,
    buildSmartRecommendations,
    getReviewQueue,
    persistReminderSettings,
    handleUpdateReminderSettings,
    handleMarkReviewedNow
  };
}
