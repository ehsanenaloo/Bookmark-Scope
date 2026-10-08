/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 */

import { getMatchTarget, matchesMode } from './src/url-utils.js';
import { getNormalizedBookmarks } from './src/bookmark-utils.js';
import { MATCH_MODES, STORAGE_KEYS, HEALTH_STATUSES } from './src/constants.js';
import { initI18n, t } from './src/i18n.js';
import { setPinOnboardingVisible } from './src/services/preferences-service.js';
import { REVIEW_REMINDER_ALARM,  getReviewReminderSettings, buildReviewReminderLabel, scheduleReviewReminderAlarm, deferReviewReminderByInterval } from './src/services/review-reminder-service.js';
import { registerContextMenus, attachContextMenuListener } from './src/services/context-menu-service.js';
import { BG_HEALTH_SCAN_ALARM, scheduleBgHealthScan, runScheduledHealthScan } from './src/services/scheduled-health-scan-service.js';
import { updateTagsMap, removeTagsForBookmark } from './src/services/tag-service.js';
import { addAlarmListener, addBookmarkEventListeners, addRuntimeInstalledListener, addRuntimeMessageListener, addRuntimeStartupListener, addStorageChangedListener, addTabActivatedListener, addTabUpdatedListener, createNotification, clearNotification, addNotificationClickedListener, addNotificationClosedListener, createTab, getTab, queryTabs, setBadgeBackgroundColor, setBadgeText } from './src/platform/browser-api.js';
import { createLogger } from './src/services/diagnostics-service.js';
import { initializeStorageLayer, getLocalStorage } from './src/services/storage-service.js';
import { now } from './src/platform/time.js';
import { MESSAGE_TYPES, getMessageType } from './src/runtime/messages.js';
import { classifyHealthResponse, createHealthFailure, shouldSkipHealthCheck } from './src/background/health-check.js';

const logger = createLogger('background');
const storageReady = initializeStorageLayer().then(async (result) => {
  await logger.info('storage_initialized', result);
  return result;
}).catch(async (error) => {
  await logger.error('storage_init_failed', { message: error?.message || String(error) });
  throw error;
});
const i18nReady = initI18n({ applyDocument: false });
const BADGE_REFRESH_DEBOUNCE_MS = 120;
const badgeRefreshTimers = new Map();
let currentTabBadgeRefreshTimer = 0;

async function setBadgeForActiveTab(tabId) {
  try {
    const tab = await getTab(tabId);
    if (!tab?.url) { await setBadgeText({ text: '', tabId }); return; }
    const stored = await getLocalStorage([STORAGE_KEYS.POPUP_MODE, STORAGE_KEYS.IGNORE_QUERY, STORAGE_KEYS.IGNORE_HASH]);
    const parseOptions = {
      ignoreQueryString: stored[STORAGE_KEYS.IGNORE_QUERY] === true,
      ignoreHashFragment: stored[STORAGE_KEYS.IGNORE_HASH] !== false
    };
    const target = getMatchTarget(tab.url, parseOptions);
    if (!target.valid) { await setBadgeText({ text: '', tabId }); return; }
    // Badge follows the user's selected popup mode (page/host/domain).
    // Falls back to DOMAIN when nothing is stored — the historical default
    // and the most useful at-a-glance signal for unconfigured users.
    const mode = Object.values(MATCH_MODES).includes(stored?.[STORAGE_KEYS.POPUP_MODE])
      ? stored[STORAGE_KEYS.POPUP_MODE]
      : MATCH_MODES.DOMAIN;
    const bookmarks = await getNormalizedBookmarks(parseOptions);
    const count = bookmarks.filter((bookmark) => matchesMode(bookmark, target, mode)).length;
    await setBadgeBackgroundColor({ color: '#2563eb', tabId });
    await setBadgeText({ text: count ? String(Math.min(count, 999)) : '', tabId });
  } catch (error) {
    console.warn('Failed to update badge.', error);
  }
}

async function refreshBadgeForCurrentTab() {
  const [tab] = await queryTabs({ active: true, currentWindow: true });
  if (tab?.id !== undefined) await setBadgeForActiveTab(tab.id);
}

function scheduleBadgeUpdateForTab(tabId) {
  if (tabId === undefined || tabId === null) return;
  if (badgeRefreshTimers.has(tabId)) clearTimeout(badgeRefreshTimers.get(tabId));
  const timerId = setTimeout(async () => {
    badgeRefreshTimers.delete(tabId);
    await setBadgeForActiveTab(tabId);
  }, BADGE_REFRESH_DEBOUNCE_MS);
  badgeRefreshTimers.set(tabId, timerId);
}

function scheduleRefreshBadgeForCurrentTab() {
  if (currentTabBadgeRefreshTimer) clearTimeout(currentTabBadgeRefreshTimer);
  currentTabBadgeRefreshTimer = setTimeout(async () => {
    currentTabBadgeRefreshTimer = 0;
    await refreshBadgeForCurrentTab();
  }, BADGE_REFRESH_DEBOUNCE_MS);
}

async function notifyReviewReminder(settings) {
  await i18nReady;
  const overdueText = settings.nextReviewAt
    ? t('Next scheduled review was {{datetime}}.', { datetime: buildReviewReminderLabel(settings.nextReviewAt) })
    : t('Your scheduled review is due.');
  try {
    await createNotification('bookmark-manager-review-due', {
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: t('Bookmark Scope review is due'),
      message: `${overdueText} ${t('Open the Library Dashboard and clean the swamp before it becomes archaeology.')}`
    });
  } catch (error) {
    console.warn('Failed to create review reminder notification.', error);
  }
}

async function notifyPinOnboarding() {
  await i18nReady;
  try {
    await clearNotification('bookmark-scope-pin-hint');
    await createNotification('bookmark-scope-pin-hint', {
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: t('Pin Bookmark Scope for faster access'),
      message: t('Open the Extensions menu, find Bookmark Scope, and click the pin icon for one-click access.')
    });
  } catch (error) {
    console.warn('Failed to create pin onboarding notification.', error);
  }
}

addTabActivatedListener(({ tabId }) => { scheduleBadgeUpdateForTab(tabId); });
addTabUpdatedListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.status === 'complete' || changeInfo.url)) scheduleBadgeUpdateForTab(tabId);
});
addBookmarkEventListeners({
  created: scheduleRefreshBadgeForCurrentTab,
  removed: async (bookmarkId, removeInfo) => {
    // Badge refresh comes first since it's cheap and time-sensitive.
    scheduleRefreshBadgeForCurrentTab();
    // Purge tag entries for the deleted bookmark (and any descendant
    // bookmarks if a folder was removed). removeInfo.node is a tree
    // snapshot of what was removed, so we can walk it. Sync edge cases
    // may miss leaves — pruneOrphanedTags on dashboard load is the
    // backstop.
    try {
      const ids = collectBookmarkIds(removeInfo?.node);
      if (!ids.length && bookmarkId) ids.push(bookmarkId);
      if (!ids.length) return;
      await updateTagsMap(map => {
        for (const id of ids) map = removeTagsForBookmark(map, id).map;
        return map;
      });
    } catch (error) {
      console.warn('[BookmarkScope:tags] Failed to purge tags after onRemoved.', error);
    }
  },
  changed: scheduleRefreshBadgeForCurrentTab,
  moved: scheduleRefreshBadgeForCurrentTab,
  importEnded: scheduleRefreshBadgeForCurrentTab
});

/**
 * Walks a Chrome bookmark tree node (as supplied by onRemoved.removeInfo.node)
 * and returns the ids of all bookmark leaves it contains. Folders contribute
 * their own id plus the ids of their descendants — Chrome treats a folder
 * removal as cascading, so we mirror that in tag cleanup.
 */
function collectBookmarkIds(node) {
  if (!node) return [];
  const ids = [];
  const stack = [node];
  while (stack.length) {
    const current = stack.pop();
    if (current?.id) ids.push(current.id);
    if (Array.isArray(current?.children)) stack.push(...current.children);
  }
  return ids;
}

addNotificationClickedListener(async (notificationId) => {
  if (notificationId !== 'bookmark-scope-pin-hint') return;
  await clearNotification('bookmark-scope-pin-hint');
  await setPinOnboardingVisible(false);
  await createTab({ url: 'chrome://extensions/', active: true });
});

addNotificationClosedListener((notificationId) => {
  if (notificationId !== 'bookmark-scope-pin-hint') return;
  clearNotification('bookmark-scope-pin-hint').catch(() => {});
});

addRuntimeInstalledListener(async (details) => {
  await storageReady;
  await i18nReady;
  await logger.info('runtime_installed', { reason: details?.reason || 'unknown' });
  await refreshBadgeForCurrentTab();
  await scheduleReviewReminderAlarm();
  await scheduleBgHealthScan();
  await registerContextMenus();
  if (details?.reason === 'install') {
    await setPinOnboardingVisible(true);
    await notifyPinOnboarding();
  }
});

addRuntimeStartupListener(async () => {
  await storageReady;
  await i18nReady;
  await logger.info('runtime_startup');
  await refreshBadgeForCurrentTab();
  await scheduleReviewReminderAlarm();
  await scheduleBgHealthScan();
  await registerContextMenus();
  const stored = await getLocalStorage([STORAGE_KEYS.PIN_ONBOARDING_VISIBLE]);
  if (stored?.[STORAGE_KEYS.PIN_ONBOARDING_VISIBLE] === true) {
    await notifyPinOnboarding();
  }
});

// Click handler is attached at module load so it survives service worker
// restarts — Chrome reloads background.js when a click arrives even if
// no other event held the worker alive.
attachContextMenuListener();

addStorageChangedListener((changes, areaName) => {
  if (areaName !== 'local') return;
  const reminderKeys = [
    STORAGE_KEYS.REVIEW_REMINDER_ENABLED,
    STORAGE_KEYS.REVIEW_REMINDER_INTERVAL_DAYS,
    STORAGE_KEYS.REVIEW_REMINDER_LAST_REVIEW_AT,
    STORAGE_KEYS.REVIEW_REMINDER_NEXT_AT
  ];
  if (changes[STORAGE_KEYS.LOCALE_PREFERENCE]) {
    initI18n({ applyDocument: false }).catch((error) => console.warn('Failed to refresh locale after storage change.', error));
  }
  if (reminderKeys.some((key) => changes[key])) {
    scheduleReviewReminderAlarm().catch((error) => console.warn('Failed to refresh reminder alarm after storage change.', error));
  }
  // The badge reflects the user's selected popup mode; if that preference
  // changes (or the user toggles ignoreQuery / ignoreHash, which can alter
  // PAGE-mode match counts), re-render the badge for the active tab.
  if (changes[STORAGE_KEYS.POPUP_MODE] || changes[STORAGE_KEYS.IGNORE_QUERY] || changes[STORAGE_KEYS.IGNORE_HASH]) {
    scheduleRefreshBadgeForCurrentTab();
  }
  // Reschedule (or clear) the background health scan alarm whenever the
  // user toggles the feature or changes its cadence. lastRunAt and
  // lastBrokenCount are internal bookkeeping that the service itself
  // writes; we ignore those to avoid recursive reschedules.
  if (
    changes[STORAGE_KEYS.BG_HEALTH_SCAN_ENABLED] ||
    changes[STORAGE_KEYS.BG_HEALTH_SCAN_INTERVAL_DAYS]
  ) {
    scheduleBgHealthScan().catch((error) =>
      console.warn('Failed to refresh bg health scan alarm after storage change.', error));
  }
});

addAlarmListener(async (alarm) => {
  if (alarm.name === REVIEW_REMINDER_ALARM) {
    const settings = await getReviewReminderSettings();
    if (!settings.enabled) return;
    if (settings.nextReviewAt && settings.nextReviewAt <= now()) {
      await notifyReviewReminder(settings);
      // FIX: persist nextAt so schedule survives browser restarts
      await deferReviewReminderByInterval(settings, now());
      return;
    }
    await scheduleReviewReminderAlarm(settings);
    return;
  }

  if (alarm.name === BG_HEALTH_SCAN_ALARM) {
    // Wake-up path for the scheduled background health scan. Reuses the
    // same fetchHealthStatusInBackground as the dashboard's manual scan,
    // so behaviour (HEAD with GET fallback, request abort, etc.) stays
    // consistent. The service re-arms the alarm on its own when done.
    try {
      const result = await runScheduledHealthScan({
        runHealthFetch: (url) => fetchHealthStatusInBackground(url, 8000, ''),
        logger
      });
      await logger.info('bg_health_scan_ran', result);
    } catch (error) {
      await logger.error('bg_health_scan_failed', { message: error?.message || String(error) });
      // Even if the run blew up, re-arm so we don't leave the schedule
      // dead until the next install/startup.
      try { await scheduleBgHealthScan(); } catch {}
    }
    return;
  }
});


// ─── Health check ──────────────────────────────────────────────────────────

const activeHealthRequests = new Map();

function cleanupActiveHealthRequest(requestId) {
  if (!requestId) return;
  const active = activeHealthRequests.get(requestId);
  if (active?.timeoutId) clearTimeout(active.timeoutId);
  activeHealthRequests.delete(requestId);
}

function abortActiveHealthRequest(requestId) {
  const active = activeHealthRequests.get(requestId);
  if (!active) return false;
  try { active.controller.abort(); } catch {}
  if (active.timeoutId) clearTimeout(active.timeoutId);
  activeHealthRequests.delete(requestId);
  return true;
}

async function fetchHealthStatusInBackground(url, timeoutMs = 8000, requestId = '') {
  if (shouldSkipHealthCheck(url)) {
    return createHealthFailure(HEALTH_STATUSES.UNKNOWN, url, { skipped: true, error: 'Skipped by policy' });
  }

  const controller = new AbortController();
  let headTimedOut = false;
  const timeoutId = setTimeout(() => {
    headTimedOut = true;
    controller.abort();
  }, timeoutMs);
  if (requestId) activeHealthRequests.set(requestId, { controller, timeoutId, url, startedAt: now() });

  async function doGetFallback() {
    const getController = new AbortController();
    let getTimedOut = false;
    const getTimeoutMs = Math.min(timeoutMs, 5000);
    const getTimeoutId = setTimeout(() => {
      getTimedOut = true;
      getController.abort();
    }, getTimeoutMs);

    // Re-register so abortActiveHealthRequest can cancel the GET phase too.
    // The HEAD timer is already cleared in the finally block of the outer try,
    // so we replace the entry rather than leak a stale controller.
    if (requestId) activeHealthRequests.set(requestId, { controller: getController, timeoutId: getTimeoutId, url, startedAt: now() });

    try {
      const getResponse = await fetch(url, { method: 'GET', redirect: 'follow', cache: 'no-store', signal: getController.signal });
      clearTimeout(getTimeoutId);
      return classifyHealthResponse(getResponse, url, 'GET');
    } catch (getError) {
      clearTimeout(getTimeoutId);
      if (getError?.name === 'AbortError') {
        if (getTimedOut) {
          return createHealthFailure(HEALTH_STATUSES.UNREACHABLE, url, { timedOut: true, error: 'Timed out', method: 'GET' });
        }
        return createHealthFailure(HEALTH_STATUSES.UNKNOWN, url, { aborted: true, error: 'Aborted', method: 'GET' });
      }
      return createHealthFailure(HEALTH_STATUSES.UNREACHABLE, url, { error: getError?.message || 'Network failure', method: 'GET' });
    }
  }

  try {
    // Primary: HEAD
    let headResponse;
    try {
      headResponse = await fetch(url, { method: 'HEAD', redirect: 'follow', cache: 'no-store', signal: controller.signal });
    } catch (headError) {
      if (headError?.name === 'AbortError' || controller.signal.aborted) {
        if (headTimedOut) {
          return createHealthFailure(HEALTH_STATUSES.UNREACHABLE, url, { timedOut: true, error: 'Timed out', method: 'HEAD' });
        }
        return createHealthFailure(HEALTH_STATUSES.UNKNOWN, url, { aborted: true, error: 'Aborted', method: 'HEAD' });
      }
      const headMsg = String(headError?.message || headError || '').toLowerCase();
      const isMethodNotAllowed = headMsg.includes('405') || headMsg.includes('method not allowed') || headMsg.includes('not allowed');
      // Fallback to GET when server rejects HEAD via exception.
      // Clear the HEAD timer before re-entering doGetFallback (which re-registers
      // the request entry with its own GET timer).
      if (isMethodNotAllowed) {
        clearTimeout(timeoutId);
        return await doGetFallback();
      }
      return createHealthFailure(HEALTH_STATUSES.UNREACHABLE, url, { error: headError?.message || 'Network failure', method: 'HEAD' });
    }

    // HEAD succeeded as an HTTP response — but server may still have returned 405.
    if (headResponse.status === 405) {
      clearTimeout(timeoutId);
      return await doGetFallback();
    }
    return classifyHealthResponse(headResponse, url, 'HEAD');
  } finally {
    clearTimeout(timeoutId);
    cleanupActiveHealthRequest(requestId);
  }
}


// ─── Message handler ────────────────────────────────────────────────────────

const messageHandlers = {
  async [MESSAGE_TYPES.GET_ACTIVE_TAB_CONTEXT]() {
    const [tab] = await queryTabs({ active: true, currentWindow: true });
    return { tab: tab || null, target: tab?.url ? getMatchTarget(tab.url) : null };
  },
  async [MESSAGE_TYPES.OPEN_BOOKMARK_FOLDER](request) {
    if (request.parentId) await createTab({ url: `chrome://bookmarks/?id=${encodeURIComponent(request.parentId)}`, active: true });
    return { success: true };
  },
  async [MESSAGE_TYPES.OPEN_URL](request) {
    if (request.url) await createTab({ url: request.url, active: true });
    return { success: true };
  },
  async [MESSAGE_TYPES.REFRESH_BADGE]() {
    await refreshBadgeForCurrentTab();
    return { success: true };
  },
  async [MESSAGE_TYPES.SYNC_REVIEW_REMINDER]() {
    await scheduleReviewReminderAlarm();
    return { success: true };
  },
  async [MESSAGE_TYPES.FETCH_URL_HEALTH](request) {
    return fetchHealthStatusInBackground(request.url, request.timeoutMs, request.requestId);
  },
  async [MESSAGE_TYPES.ABORT_URL_HEALTH](request) {
    const aborted = abortActiveHealthRequest(request.requestId);
    return { success: true, aborted };
  }
};

addRuntimeMessageListener((request, _sender, sendResponse) => {
  const type = getMessageType(request);
  if (!type) return false;

  (async () => {
    const handler = messageHandlers[type];
    if (!handler) {
      await logger.warn('unknown_runtime_message', { type });
      sendResponse({ success: false, error: t('Unknown request type.') });
      return;
    }
    await logger.debug('runtime_message_received', { type });
    const response = await handler(request || {});
    sendResponse(response);
  })().catch(async (error) => {
    await logger.error('runtime_message_failed', { type, message: error?.message || String(error) });
    if (type === MESSAGE_TYPES.FETCH_URL_HEALTH) {
      sendResponse(createHealthFailure(HEALTH_STATUSES.UNREACHABLE, request?.url || '', { error: error?.message || 'Network failure' }));
      return;
    }
    sendResponse({ success: false, error: error?.message || t('Unexpected error.') });
  });

  return true;
});
