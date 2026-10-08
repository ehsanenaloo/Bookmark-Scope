/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 *
 * context-menu-service.js
 *
 * Registers and dispatches the right-click menu entries that integrate
 * with Bookmark Scope. Three entries are exposed:
 *
 *   1. "Show all bookmarks of this domain"
 *      — opens the dashboard scoped to the current tab's registrable
 *        domain. Useful for quickly auditing what you've saved from
 *        a specific site.
 *
 *   2. "Find duplicates of this page"
 *      — opens the dashboard scoped to the current tab's URL and pre-
 *        filtered to duplicates only. Useful for cleaning up the same
 *        page saved multiple times under different folders.
 *
 *   3. "Find duplicates of this link" (on link contexts)
 *      — same as above but for whatever URL the user right-clicked,
 *        not the current tab. Lets you check before bookmarking again.
 *
 * The dashboard reads the `?cm=` query param at startup and applies
 * the requested view; see dashboard.js for the consumer side.
 *
 * Registration is idempotent — removeAll() first, then create() — so
 * the service is safe to call from both onInstalled and onStartup.
 */

import {
  createContextMenuItem,
  removeAllContextMenus,
  addContextMenuClickedListener,
  createTab,
  getRuntimeUrl
} from '../platform/browser-api.js';
import { t } from '../i18n.js';

// Stable IDs so the click handler can dispatch reliably. These must not
// be reused for other menu items in the future.
export const CONTEXT_MENU_IDS = Object.freeze({
  SHOW_DOMAIN: 'bookmark-scope-show-domain',
  FIND_PAGE_DUPLICATES: 'bookmark-scope-find-page-dupes',
  FIND_LINK_DUPLICATES: 'bookmark-scope-find-link-dupes'
});

// Query-param protocol the dashboard understands. Kept tiny — the
// dashboard already has all the filtering machinery; we just hand it
// a starting URL and a hint about what scope to use.
export const CONTEXT_MENU_PARAMS = Object.freeze({
  ACTION: 'cm',
  URL: 'url'
});

export const CONTEXT_MENU_ACTIONS = Object.freeze({
  SHOW_DOMAIN: 'show-domain',
  FIND_DUPLICATES: 'find-duplicates'
});

/**
 * Builds the dashboard URL with context-menu parameters attached.
 * Returns just the path+query — caller passes through getRuntimeUrl().
 *
 * Exported for tests so we don't have to mock getRuntimeUrl.
 */
export function buildDashboardContextUrl(action, targetUrl) {
  const params = new URLSearchParams();
  params.set(CONTEXT_MENU_PARAMS.ACTION, action);
  if (targetUrl) params.set(CONTEXT_MENU_PARAMS.URL, targetUrl);
  return `dashboard.html?${params.toString()}`;
}

/**
 * Parses the dashboard's startup URL. Returns null if no context-menu
 * action is requested, so callers can fall through to the normal init
 * path. Resilient to malformed or unknown action values.
 */
export function parseDashboardContextParams(locationSearch) {
  try {
    const params = new URLSearchParams(String(locationSearch || ''));
    const action = params.get(CONTEXT_MENU_PARAMS.ACTION);
    if (!action) return null;
    if (!Object.values(CONTEXT_MENU_ACTIONS).includes(action)) return null;
    const url = params.get(CONTEXT_MENU_PARAMS.URL) || '';
    // Validate URL — only http/https are useful to the dashboard, and
    // accepting arbitrary strings here would let a crafted link pre-
    // populate the search with junk.
    if (url) {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          return { action, url: '' };
        }
      } catch {
        return { action, url: '' };
      }
    }
    return { action, url };
  } catch {
    return null;
  }
}

/**
 * (Re)registers all Bookmark Scope context menu items. Safe to call
 * repeatedly — the service worker calls this from both onInstalled
 * and onStartup so menu state survives across browser restarts and
 * extension reloads.
 */
export async function registerContextMenus() {
  try {
    await removeAllContextMenus();

    await createContextMenuItem({
      id: CONTEXT_MENU_IDS.SHOW_DOMAIN,
      title: t('Show all bookmarks of this domain'),
      contexts: ['page']
    });

    await createContextMenuItem({
      id: CONTEXT_MENU_IDS.FIND_PAGE_DUPLICATES,
      title: t('Find duplicates of this page in bookmarks'),
      contexts: ['page']
    });

    await createContextMenuItem({
      id: CONTEXT_MENU_IDS.FIND_LINK_DUPLICATES,
      title: t('Find duplicates of this link in bookmarks'),
      contexts: ['link']
    });
  } catch (error) {
    // The browser will surface its own error to the user; we just want
    // to avoid crashing the service worker.
    console.warn('[BookmarkScope:context-menu] Failed to register menus.', error);
  }
}

/**
 * Wires the click handler. Should be called exactly once per service
 * worker lifetime (background.js handles this at module top level).
 */
export function attachContextMenuListener() {
  addContextMenuClickedListener(async (info, tab) => {
    try {
      const target = pickTargetUrl(info, tab);
      if (!target) return;

      let action = '';
      switch (info.menuItemId) {
        case CONTEXT_MENU_IDS.SHOW_DOMAIN:
          action = CONTEXT_MENU_ACTIONS.SHOW_DOMAIN;
          break;
        case CONTEXT_MENU_IDS.FIND_PAGE_DUPLICATES:
        case CONTEXT_MENU_IDS.FIND_LINK_DUPLICATES:
          action = CONTEXT_MENU_ACTIONS.FIND_DUPLICATES;
          break;
        default:
          return; // unknown id — not ours
      }

      const path = buildDashboardContextUrl(action, target);
      await createTab({ url: getRuntimeUrl(path), active: true });
    } catch (error) {
      console.warn('[BookmarkScope:context-menu] Click handler failed.', error);
    }
  });
}

/**
 * Picks the right URL for a click event:
 *   - link context → the link the user right-clicked
 *   - page context → the current tab's URL
 *
 * Returns null when neither is usable (e.g. right-click on a chrome://
 * page where we can't reach the tab URL).
 */
function pickTargetUrl(info, tab) {
  // Link context wins when present — that's specifically what the user
  // pointed at, not just the page they're browsing.
  if (info?.linkUrl && isInspectableUrl(info.linkUrl)) return info.linkUrl;
  if (tab?.url && isInspectableUrl(tab.url)) return tab.url;
  return null;
}

function isInspectableUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
