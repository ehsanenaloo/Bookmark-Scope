import {
  HEALTH_SCAN_TIMEOUT_MS,
  HEALTH_SCAN_CONCURRENCY,
  HEALTH_CACHE_MAX_ENTRIES,
  HEALTH_CACHE_EVICTION_BATCH,
  DASHBOARD_MODE
} from '../core/constants.js';
import { OPTIONAL_HOST_PATTERNS } from '../core/constants.js';
import { requestPermissions } from '../platform/browser-api.js';
import { runtimeMessages } from '../runtime/messages.js';
import { writeHealthRecord, getHealthCacheGeneration, awaitPendingHealthWrites } from '../services/health-cache-service.js';

export function createInspectTools({
  state,
  t,
  now,
  formatNumber,
  makeStableId,
  getHealthKey,
  summarizeHealth,
  inspectUrlHealthRecord,
  runWithConcurrency,
  sendMessage,
  render,
  renderListOnly,
  updateInspectProgress,
  rememberListScroll,
  setToast,
  pushCleanupHistory,
  applyHealthRecordToBookmarks,
  getSelectedBookmarks,
  modeLabel,
  getSelectionCount,
  getActiveScopeLabel
}) {
  function cancelHealthInspection() {
    if (!state.isInspectingHealth && !state.inspectStopPending) return;
    state.inspectAbortRequested = true;
    state.inspectStopPending = true;
    state.isInspectingHealth = false;
    const activeRequestIds = [...state.inspectControllers];
    rememberListScroll();
    render();
    for (const requestId of activeRequestIds) {
      void sendMessage(runtimeMessages.abortUrlHealth(requestId));
    }
  }

  async function inspectUrlHealth(url) {
    return inspectUrlHealthRecord({
      url,
      sendMessage,
      timeoutMs: HEALTH_SCAN_TIMEOUT_MS,
      requestIdFactory: makeStableId,
      inspectControllers: state.inspectControllers,
      now,
      t
    });
  }

  async function ensureHealthPermission() {
    const request = { origins: [...OPTIONAL_HOST_PATTERNS] };
    // permissions.request() has to be the first await after the click: Firefox only accepts it while the
    // user-input handler is still running and rejects it after any other awaited call. When the grant is
    // already held, request() resolves true without a prompt in Chrome and Firefox.
    state.healthPermissionState = 'prompt';
    const granted = await requestPermissions(request);
    state.healthPermissionState = granted ? 'granted' : 'denied';
    return granted;
  }

  async function inspectBookmarksHealth(bookmarks, options = {}) {
    if (state.resumableScanRunning) return;
    if (state.inspectStopPending) return;
    // The click that follows a pointer-press Stop must not start a new scan.
    if (Date.now() - Number(state.inspectStopPressedAt || 0) < 700) return;
    if (state.isInspectingHealth) {
      cancelHealthInspection();
      return;
    }
    // Guard against concurrent re-entry during the async permission prompt.
    if (state.inspectLaunchPending) return;
    state.inspectLaunchPending = true;

    let permissionGranted = false;
    try {
      permissionGranted = await ensureHealthPermission();
    } finally {
      state.inspectLaunchPending = false;
    }

    if (!permissionGranted) {
      rememberListScroll();
      render();
      setToast(t('Health scans need temporary site access. Permission denied, so the scan was not run.'), { error: true });
      return;
    }

    const unique = [];
    const seen = new Set();
    for (const bookmark of bookmarks || []) {
      const key = getHealthKey(bookmark);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      unique.push(bookmark);
    }

    if (!unique.length) {
      setToast(t('No matching links to inspect in the current scope.'), { error: true });
      return;
    }

    const renderIntervalMs = 500;
    let lastProgressRenderAt = 0;
    let pendingProgressRender = null;

    // Rebuilding the whole dashboard on every progress tick replaced the Stop
    // button under the pointer, so clicks were lost. The button and its counter
    // are updated in place; the list and sidebar refresh at a calmer pace.
    const listRefreshIntervalMs = 2000;
    let lastListRefreshAt = 0;
    const flushHealthProgress = (final = false) => {
      if (state.inspectAbortRequested) return;
      state.healthSummary = summarizeHealth(state.visibleBookmarks, state.healthByKey);
      updateInspectProgress?.();
      const timestamp = performance.now();
      if (final || timestamp - lastListRefreshAt >= listRefreshIntervalMs) {
        lastListRefreshAt = timestamp;
        rememberListScroll();
        if (renderListOnly) renderListOnly();
        else render();
      }
    };

    const scheduleHealthProgressRender = (force = false) => {
      if (state.inspectAbortRequested) return;
      const scrollingRecently = performance.now() - (state.lastListScrollAt || 0) < 300;
      if (!force && scrollingRecently) {
        if (pendingProgressRender) return;
        pendingProgressRender = setTimeout(() => {
          pendingProgressRender = null;
          scheduleHealthProgressRender();
        }, 220);
        return;
      }
      const elapsed = performance.now() - lastProgressRenderAt;
      if (force || elapsed >= renderIntervalMs) {
        lastProgressRenderAt = performance.now();
        if (pendingProgressRender) {
          clearTimeout(pendingProgressRender);
          pendingProgressRender = null;
        }
        flushHealthProgress(force);
        return;
      }

      if (pendingProgressRender) return;
      pendingProgressRender = setTimeout(() => {
        pendingProgressRender = null;
        lastProgressRenderAt = performance.now();
        flushHealthProgress();
      }, Math.max(16, renderIntervalMs - elapsed));
    };

    const cacheGeneration = await getHealthCacheGeneration();
    const inspectSessionId = state.inspectSessionId + 1;
    state.inspectSessionId = inspectSessionId;
    state.isInspectingHealth = true;
    state.inspectStopPending = false;
    state.inspectAbortRequested = false;
    state.inspectControllers = new Set();
    state.healthScanProgress = 0;
    state.healthScanTotal = unique.length;
    render();

    let inspectionError = null;
    try {
    await runWithConcurrency(unique, HEALTH_SCAN_CONCURRENCY, async (bookmark) => {
      if (state.inspectAbortRequested || inspectSessionId !== state.inspectSessionId) return;
      const record = await inspectUrlHealth(bookmark.url);
      if (state.inspectAbortRequested || inspectSessionId !== state.inspectSessionId) return;
      if (!record?.aborted) {
        const recordKey = getHealthKey(bookmark);
        // In-memory LRU eviction by checkedAt — keeps recently-checked entries
        // even if they were inserted long ago. Persistent storage applies the
        // same bound separately (see health-cache-service.js).
        const keys = Object.keys(state.healthByKey);
        if (keys.length >= HEALTH_CACHE_MAX_ENTRIES) {
          // Sort by checkedAt ascending (oldest checked first) and drop the
          // tail. O(n log n) but runs at most once per HEALTH_CACHE_EVICTION_BATCH
          // inserts, so amortised cost is O(log n) per insert.
          const sorted = keys
            .map((key) => [key, Number(state.healthByKey[key]?.checkedAt || 0)])
            .sort((a, b) => a[1] - b[1]);
          const dropCount = Math.min(HEALTH_CACHE_EVICTION_BATCH, sorted.length);
          for (let i = 0; i < dropCount; i++) {
            delete state.healthByKey[sorted[i][0]];
          }
        }
        const persisted = await writeHealthRecord(recordKey, record, cacheGeneration);
        if (!persisted) return;
        state.healthByKey[recordKey] = record;
        // Persist immediately — the service batches writes per microtask so
        // a busy scan still produces only one storage write.
        applyHealthRecordToBookmarks(recordKey, record);
        state.healthScanProgress += 1;
        scheduleHealthProgressRender(state.healthScanProgress === unique.length);
      }
    }, () => state.inspectAbortRequested);

    } catch (error) {
      inspectionError = error;
      state.inspectAbortRequested = true;
    }
    try { await awaitPendingHealthWrites(); }
    catch (error) { inspectionError ||= error; state.inspectAbortRequested = true; }
    if (pendingProgressRender) {
      clearTimeout(pendingProgressRender);
      pendingProgressRender = null;
    }

    const stopped = state.inspectAbortRequested || inspectSessionId !== state.inspectSessionId;
    if (inspectSessionId === state.inspectSessionId) {
      state.isInspectingHealth = false;
      state.inspectStopPending = false;
    }
    state.inspectAbortRequested = false;
    state.inspectControllers = new Set();
    state.healthLastRunAt = now();
    state.healthSummary = summarizeHealth(state.visibleBookmarks, state.healthByKey);
    const completedCount = state.healthScanProgress;
    state.healthScanTotal = 0;
    state.healthScanProgress = 0;

    const contextLabel = options.contextLabel || (
      getSelectionCount()
        ? t('selected bookmarks')
        : getActiveScopeLabel?.() || (state.mode === DASHBOARD_MODE ? t('Entire library') : modeLabel(state.mode)) || t('Unknown scope')
    );

    if (!stopped) {
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
        note: t('Health scan finished for {{scope}}.', { scope: contextLabel })
      });
    }

    render();
    const summary = state.healthSummary;
    if (inspectionError) {
      setToast(`${t('Unexpected error.')} ${inspectionError.message}`, { error: true, persist: true });
      return;
    }
    if (stopped) {
      setToast(t('Inspection stopped after {{done}}/{{total}} links for {{scope}}. Partial results were kept.', { done: formatNumber(completedCount), total: formatNumber(unique.length), scope: contextLabel }), { error: true });
      return;
    }
    setToast(t('Health scan finished for {{scope}}: {{healthy}} healthy · {{redirected}} redirected · {{broken}} broken · {{server}} server · {{unreachable}} unreachable.', { scope: contextLabel, healthy: formatNumber(summary.healthy), redirected: formatNumber(summary.redirected), broken: formatNumber(summary.broken), server: formatNumber(summary.serverError), unreachable: formatNumber(summary.unreachable) }));
  }

  return { cancelHealthInspection, inspectBookmarksHealth, inspectUrlHealth, ensureHealthPermission };
}
