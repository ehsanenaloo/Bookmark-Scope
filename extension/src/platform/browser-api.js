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
  // Firefox does not implement bookmarks.onImportBegan/onImportEnded (its
  // imports fire onCreated for each node), so the event may be absent.
  if (listeners.importEnded && api.onImportEnded) api.onImportEnded.addListener(listeners.importEnded);
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

/**
 * Moves a bookmark or folder. `destination.index` is always the FINAL index:
 * the position the node occupies in the destination folder after the move.
 *
 * The engines disagree for a forward move inside the same folder. Firefox
 * already uses the final index. Chromium (Chrome, Edge, Brave) treats the
 * index as a position in the folder while the node is still in it, so moving
 * forward to final index N needs N + 1 (verified with Chromium 141: moving a1
 * of [a1,a2,a3,a4] to index 2 yields [a2,a1,a3,a4]). The correction applies
 * only to a same-parent move to a higher index with a defined index; other
 * moves, and an undefined index (append), are passed through unchanged.
 */
export async function moveBookmark(id, destination) {
  const api = getChromeApi();
  if (detectBrowser() !== 'firefox' && destination && Number.isInteger(destination.index)) {
    const [current] = await api.bookmarks.get(id);
    const targetParent = destination.parentId ?? current.parentId;
    if (current.parentId === targetParent && current.index < destination.index) {
      return api.bookmarks.move(id, { ...destination, index: destination.index + 1 });
    }
  }
  return api.bookmarks.move(id, destination);
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

// ─── Browser-internal pages ──────────────────────────────────────────────────

/**
 * URL of the browser's own bookmarks manager (optionally focused on a folder),
 * or null when the browser offers none that an extension may open. Chromium
 * exposes chrome://bookmarks/?id=<folderId>. Firefox rejects every privileged
 * page (about:library, place:, chrome://...) in tabs.create with "Illegal URL",
 * so callers must hide the control instead of calling createTab.
 */
export function getBookmarksManagerUrl(folderId) {
  if (detectBrowser() === 'firefox') return null;
  return folderId ? `chrome://bookmarks/?id=${encodeURIComponent(folderId)}` : 'chrome://bookmarks/';
}

/** URL of the browser's extension manager, or null where tabs.create cannot open it (Firefox rejects about:addons). */
export function getExtensionsManagerUrl() {
  return detectBrowser() === 'firefox' ? null : 'chrome://extensions/';
}
