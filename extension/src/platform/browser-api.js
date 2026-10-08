let chromeApiOverride = null;

/**
 * Returns the WebExtension API object — `browser` in Firefox, `chrome`
 * elsewhere (Chrome, Edge, Opera, Brave). We prefer `browser` because
 * Firefox's `chrome` namespace exists but only supports the callback
 * style of the API; `browser.*` is consistently promise-based. Chrome
 * MV3 exposes promise-based methods on `chrome.*` natively, so this is
 * a clean cross-browser path without a polyfill.
 *
 * Tests pass `setChromeApiForTesting(...)` to inject a fake.
 */
export function getChromeApi() {
  if (chromeApiOverride) return chromeApiOverride;
  // Firefox: `browser` is a real global with promise-based methods.
  // Some Firefox-for-Android builds put it on `globalThis.browser`; the
  // typeof check handles both.
  if (typeof globalThis !== 'undefined' && globalThis.browser && globalThis.browser.runtime) {
    return globalThis.browser;
  }
  // Older Firefox builds and pre-MV3 environments may not expose
  // globalThis.browser but still have a `browser` binding at the
  // global scope.
  // eslint-disable-next-line no-undef
  if (typeof browser !== 'undefined' && browser.runtime) {
    // eslint-disable-next-line no-undef
    return browser;
  }
  if (typeof chrome === 'undefined') {
    throw new Error('WebExtension API is not available in this environment.');
  }
  return chrome;
}

export function setChromeApiForTesting(api) {
  chromeApiOverride = api || null;
}

export async function storageGet(keys) {
  return getChromeApi().storage.local.get(keys);
}

export async function storageSet(values) {
  return getChromeApi().storage.local.set(values);
}

export function addStorageChangedListener(listener) {
  const api = getChromeApi();
  api.storage.onChanged.addListener(listener);
  return () => api.storage.onChanged.removeListener(listener);
}

export async function clearAlarm(name) {
  return getChromeApi().alarms.clear(name);
}

export async function createAlarm(name, options) {
  return getChromeApi().alarms.create(name, options);
}

export async function queryTabs(queryInfo) {
  return getChromeApi().tabs.query(queryInfo);
}

export async function getTab(tabId) {
  return getChromeApi().tabs.get(tabId);
}

export async function createTab(createProperties) {
  return getChromeApi().tabs.create(createProperties);
}

export async function sendRuntimeMessage(message) {
  return getChromeApi().runtime.sendMessage(message);
}

export function addRuntimeMessageListener(listener) {
  getChromeApi().runtime.onMessage.addListener(listener);
}

export function addRuntimeInstalledListener(listener) {
  getChromeApi().runtime.onInstalled.addListener(listener);
}

export function addRuntimeStartupListener(listener) {
  getChromeApi().runtime.onStartup.addListener(listener);
}

export async function createNotification(notificationId, options) {
  return getChromeApi().notifications.create(notificationId, options);
}

export async function clearNotification(notificationId) {
  return getChromeApi().notifications.clear(notificationId);
}

export function addNotificationClickedListener(listener) {
  getChromeApi().notifications.onClicked.addListener(listener);
}

export function addNotificationClosedListener(listener) {
  getChromeApi().notifications.onClosed.addListener(listener);
}

export async function setBadgeText(details) {
  return getChromeApi().action.setBadgeText(details);
}

export async function setBadgeBackgroundColor(details) {
  return getChromeApi().action.setBadgeBackgroundColor(details);
}

export function addAlarmListener(listener) {
  getChromeApi().alarms.onAlarm.addListener(listener);
}

export function addTabActivatedListener(listener) {
  getChromeApi().tabs.onActivated.addListener(listener);
}

export function addTabUpdatedListener(listener) {
  getChromeApi().tabs.onUpdated.addListener(listener);
}

export function addBookmarkEventListeners(listeners) {
  const api = getChromeApi().bookmarks;
  if (listeners.created) api.onCreated.addListener(listeners.created);
  if (listeners.removed) api.onRemoved.addListener(listeners.removed);
  if (listeners.changed) api.onChanged.addListener(listeners.changed);
  if (listeners.moved) api.onMoved.addListener(listeners.moved);
  if (listeners.importEnded) api.onImportEnded.addListener(listeners.importEnded);
}

export async function createBookmark(details) {
  return getChromeApi().bookmarks.create(details);
}

export async function updateBookmark(id, changes) {
  return getChromeApi().bookmarks.update(id, changes);
}

export async function removeBookmark(id) {
  return getChromeApi().bookmarks.remove(id);
}

export async function moveBookmark(id, destination) {
  return getChromeApi().bookmarks.move(id, destination);
}

export async function getBookmarkTree() {
  return getChromeApi().bookmarks.getTree();
}

export function getManifest() {
  return getChromeApi().runtime.getManifest();
}

export function getRuntimeUrl(path) {
  return getChromeApi().runtime.getURL(path);
}

export function getUiLanguage() {
  const api = getChromeApi();
  return api.i18n?.getUILanguage?.() || null;
}

export async function containsPermissions(permissions) {
  return getChromeApi().permissions.contains(permissions);
}

export async function requestPermissions(permissions) {
  return getChromeApi().permissions.request(permissions);
}

export async function removePermissions(permissions) {
  return getChromeApi().permissions.remove(permissions);
}

// ─── Context menus ───────────────────────────────────────────────────────────

export async function createContextMenuItem(properties) {
  return new Promise((resolve, reject) => {
    try {
      getChromeApi().contextMenus.create(properties, () => {
        const err = getChromeApi().runtime?.lastError;
        if (err) reject(new Error(err.message || String(err)));
        else resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

export async function removeAllContextMenus() {
  return new Promise((resolve) => {
    try {
      getChromeApi().contextMenus.removeAll(() => resolve());
    } catch {
      resolve();
    }
  });
}

export function addContextMenuClickedListener(listener) {
  getChromeApi().contextMenus.onClicked.addListener(listener);
}

// ─── Browser detection ───────────────────────────────────────────────────────

/**
 * Identifies the host browser. Used sparingly — most of the codebase
 * shouldn't need to branch on this. The few places that legitimately
 * do are: Firefox-specific notification format quirks, and the bg-
 * health-scan permission prompt UX which works slightly differently
 * across browsers.
 *
 * Returns one of: 'firefox' | 'chrome' | 'edge' | 'unknown'.
 * Detection is done from `runtime.getURL` URL prefix where possible
 * (moz-extension:// vs chrome-extension://), with userAgent as a
 * last-resort fallback. The result is cached for the lifetime of the
 * context since it never changes.
 */
let _detectedBrowser = null;
export function detectBrowser() {
  if (_detectedBrowser) return _detectedBrowser;
  try {
    const api = getChromeApi();
    const url = api?.runtime?.getURL?.('');
    if (typeof url === 'string') {
      if (url.startsWith('moz-extension://')) return (_detectedBrowser = 'firefox');
      if (url.startsWith('chrome-extension://')) {
        // Edge also uses chrome-extension://, so fall through to UA sniff.
        if (typeof navigator !== 'undefined' && /Edg\//.test(navigator.userAgent || '')) {
          return (_detectedBrowser = 'edge');
        }
        return (_detectedBrowser = 'chrome');
      }
    }
  } catch {
    // getChromeApi can throw in test environments without a chrome global.
  }
  // Final fallback: navigator.userAgent. Available in all extension
  // contexts; just less reliable than a runtime URL.
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    if (/Firefox\//.test(ua)) return (_detectedBrowser = 'firefox');
    if (/Edg\//.test(ua)) return (_detectedBrowser = 'edge');
    if (/Chrome\//.test(ua)) return (_detectedBrowser = 'chrome');
  }
  return (_detectedBrowser = 'unknown');
}

/** Resets the cached detection. Tests only. */
export function _resetBrowserDetectionForTesting() {
  _detectedBrowser = null;
}
