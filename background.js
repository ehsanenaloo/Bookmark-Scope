import { getMatchTarget, matchesMode } from './src/url-utils.js';
import { getNormalizedBookmarks } from './src/bookmark-utils.js';
import { MATCH_MODES, STORAGE_KEYS } from './src/constants.js';

const REVIEW_REMINDER_ALARM = 'bookmark-manager-review-reminder';
const DAY_MS = 24 * 60 * 60 * 1000;

async function setBadgeForActiveTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab?.url) {
      await chrome.action.setBadgeText({ text: '', tabId });
      return;
    }

    const target = getMatchTarget(tab.url);
    if (!target.valid) {
      await chrome.action.setBadgeText({ text: '', tabId });
      return;
    }

    const bookmarks = await getNormalizedBookmarks();
    const count = bookmarks.filter((bookmark) => matchesMode(bookmark, target, MATCH_MODES.DOMAIN)).length;

    await chrome.action.setBadgeBackgroundColor({ color: '#2563eb', tabId });
    await chrome.action.setBadgeText({ text: count ? String(Math.min(count, 999)) : '', tabId });
  } catch (error) {
    console.warn('Failed to update badge.', error);
  }
}

async function refreshBadgeForCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id !== undefined) {
    await setBadgeForActiveTab(tab.id);
  }
}

async function getReminderSettings() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.REVIEW_REMINDER_ENABLED,
    STORAGE_KEYS.REVIEW_REMINDER_INTERVAL_DAYS,
    STORAGE_KEYS.REVIEW_REMINDER_LAST_REVIEW_AT,
    STORAGE_KEYS.REVIEW_REMINDER_NEXT_AT
  ]);

  return {
    enabled: Boolean(stored[STORAGE_KEYS.REVIEW_REMINDER_ENABLED]),
    intervalDays: Number(stored[STORAGE_KEYS.REVIEW_REMINDER_INTERVAL_DAYS] || 14),
    lastReviewAt: Number(stored[STORAGE_KEYS.REVIEW_REMINDER_LAST_REVIEW_AT] || 0),
    nextReviewAt: Number(stored[STORAGE_KEYS.REVIEW_REMINDER_NEXT_AT] || 0)
  };
}

function buildReminderLabel(timestamp) {
  if (!timestamp) return 'No review date saved';
  return new Date(timestamp).toLocaleString();
}

async function scheduleReviewReminder(forceSettings = null) {
  const settings = forceSettings || await getReminderSettings();
  await chrome.alarms.clear(REVIEW_REMINDER_ALARM);
  if (!settings.enabled) return;

  const now = Date.now();
  let nextAt = Number(settings.nextReviewAt || 0);
  if (!nextAt) {
    const anchor = Number(settings.lastReviewAt || now);
    nextAt = anchor + (Math.max(1, settings.intervalDays || 14) * DAY_MS);
    await chrome.storage.local.set({ [STORAGE_KEYS.REVIEW_REMINDER_NEXT_AT]: nextAt });
  }

  const when = nextAt > now ? nextAt : now + 60 * 1000;
  await chrome.alarms.create(REVIEW_REMINDER_ALARM, { when });
}

async function notifyReviewReminder(settings) {
  const overdueText = settings.nextReviewAt
    ? `Next scheduled review was ${buildReminderLabel(settings.nextReviewAt)}.`
    : 'Your scheduled review is due.';

  try {
    await chrome.notifications.create('bookmark-manager-review-due', {
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'Bookmark Manager review is due',
      message: `${overdueText} Open the Library Dashboard and clean the swamp before it becomes archaeology.`
    });
  } catch (error) {
    console.warn('Failed to create review reminder notification.', error);
  }
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  setBadgeForActiveTab(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && (changeInfo.status === 'complete' || changeInfo.url)) {
    setBadgeForActiveTab(tabId);
  }
});

chrome.bookmarks.onCreated.addListener(refreshBadgeForCurrentTab);
chrome.bookmarks.onRemoved.addListener(refreshBadgeForCurrentTab);
chrome.bookmarks.onChanged.addListener(refreshBadgeForCurrentTab);
chrome.bookmarks.onMoved.addListener(refreshBadgeForCurrentTab);
chrome.bookmarks.onImportEnded.addListener(refreshBadgeForCurrentTab);

chrome.runtime.onInstalled.addListener(async () => {
  await refreshBadgeForCurrentTab();
  await scheduleReviewReminder();
});
chrome.runtime.onStartup.addListener(async () => {
  await refreshBadgeForCurrentTab();
  await scheduleReviewReminder();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  const reminderKeys = [
    STORAGE_KEYS.REVIEW_REMINDER_ENABLED,
    STORAGE_KEYS.REVIEW_REMINDER_INTERVAL_DAYS,
    STORAGE_KEYS.REVIEW_REMINDER_LAST_REVIEW_AT,
    STORAGE_KEYS.REVIEW_REMINDER_NEXT_AT
  ];
  if (reminderKeys.some((key) => changes[key])) {
    scheduleReviewReminder().catch((error) => console.warn('Failed to refresh reminder alarm after storage change.', error));
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== REVIEW_REMINDER_ALARM) return;
  const settings = await getReminderSettings();
  if (!settings.enabled) return;

  if (settings.nextReviewAt && settings.nextReviewAt <= Date.now()) {
    await notifyReviewReminder(settings);
    await chrome.alarms.create(REVIEW_REMINDER_ALARM, { when: Date.now() + DAY_MS });
    return;
  }

  await scheduleReviewReminder(settings);
});

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  (async () => {
    switch (request?.type) {
      case 'GET_ACTIVE_TAB_CONTEXT': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        sendResponse({ tab: tab || null, target: tab?.url ? getMatchTarget(tab.url) : null });
        break;
      }
      case 'OPEN_BOOKMARK_FOLDER': {
        if (request.parentId) {
          await chrome.tabs.create({ url: `chrome://bookmarks/?id=${encodeURIComponent(request.parentId)}`, active: true });
        }
        sendResponse({ success: true });
        break;
      }
      case 'OPEN_URL': {
        if (request.url) {
          await chrome.tabs.create({ url: request.url, active: true });
        }
        sendResponse({ success: true });
        break;
      }
      case 'REFRESH_BADGE': {
        await refreshBadgeForCurrentTab();
        sendResponse({ success: true });
        break;
      }
      case 'SYNC_REVIEW_REMINDER': {
        await scheduleReviewReminder();
        sendResponse({ success: true });
        break;
      }
      default:
        sendResponse({ success: false, error: 'Unknown request type.' });
        break;
    }
  })().catch((error) => {
    sendResponse({ success: false, error: error?.message || 'Unexpected error.' });
  });

  return true;
});
