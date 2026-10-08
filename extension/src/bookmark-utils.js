/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 */

import { matchesMode, parseUrlSafe } from './url-utils.js';
import { CLEANUP_FILTERS, OLD_BOOKMARK_DAYS, SEARCH_CACHE_MAX_SIZE } from './constants.js';
import { addBookmarkEventListeners, getBookmarkTree } from './platform/browser-api.js';
import { fuzzySearchBookmarks } from './fuzzy-match.js';
import { filterBookmarksByTags } from './services/tag-service.js';

function flattenNodes(nodes, pathParts = [], out = [], parseOptions = {}) {
  for (const node of nodes || []) {
    // Firefox separators are nodes of type 'separator' carrying the placeholder url "data:"; they are not bookmarks.
    if (node.type === 'separator') continue;
    if (node.url) {
      out.push({
        id: node.id,
        parentId: node.parentId || '',
        index: Number.isInteger(node.index) ? node.index : 0,
        title: node.title || '(Untitled bookmark)',
        url: node.url,
        dateAdded: node.dateAdded || 0,
        path: pathParts.join(' / ') || 'Root',
        parsed: parseUrlSafe(node.url, parseOptions)
      });
      continue;
    }

    const nextPath = node.title ? [...pathParts, node.title] : pathParts;
    if (Array.isArray(node.children) && node.children.length) {
      flattenNodes(node.children, nextPath, out, parseOptions);
    }
  }
}

// ─── Bookmark cache ───────────────────────────────────────────────────────────
// Caches the result of getNormalizedBookmarks per parseOptions signature.
// Invalidated automatically whenever Chrome fires a bookmark mutation event.
// Each extension page (popup, dashboard) and the service worker (background)
// gets its own module-level cache instance — this is correct behaviour: they
// operate independently and have independent parseOptions.

const _bookmarkCache = new Map(); // key → flat bookmark array
let _bookmarkGeneration = 0;

function _invalidateBookmarkCache() {
  _bookmarkGeneration += 1;
  _bookmarkCache.clear();
}

// Register invalidation listeners once, only in contexts that expose the
// bookmarks API. Route through the shared browser wrapper so the cache logic
// stays testable and the platform coupling lives in one place.
try {
  addBookmarkEventListeners({
    created: _invalidateBookmarkCache,
    removed: _invalidateBookmarkCache,
    changed: _invalidateBookmarkCache,
    moved: _invalidateBookmarkCache,
    importEnded: _invalidateBookmarkCache
  });
} catch {
  // Ignore non-extension contexts such as static analysis or tests that do not
  // provide the bookmarks API. The cache still works; it simply won't auto-
  // invalidate without the platform surface.
}

/**
 * Call this explicitly after any write operation performed by the extension
 * itself (create, remove, edit) so the cache is invalidated immediately —
 * before the Chrome event fires asynchronously.
 */
export function invalidateBookmarkCache() {
  _invalidateBookmarkCache();
}

function _parseOptionsKey(parseOptions) {
  // Stable, compact key — parseOptions only has two boolean fields
  const iq = Boolean(parseOptions?.ignoreQueryString);
  const ih = parseOptions?.ignoreHashFragment !== false; // default true
  return `${iq ? '1' : '0'}${ih ? '1' : '0'}`;
}

export async function getNormalizedBookmarks(parseOptions = {}) {
  const key = _parseOptionsKey(parseOptions);
  if (_bookmarkCache.has(key)) return _bookmarkCache.get(key);
  const generation = _bookmarkGeneration;
  const tree = await getBookmarkTree();
  const output = [];
  flattenNodes(tree, [], output, parseOptions);
  if (generation !== _bookmarkGeneration) return getNormalizedBookmarks(parseOptions);
  _bookmarkCache.set(key, output);
  return output;
}

export async function getDefaultImportParentId() {
  const tree = await getBookmarkTree();
  const root = tree?.[0];
  const children = root?.children || [];
  // Chromium roots are '1' (bar) and '2' (other); Firefox uses fixed GUIDs for its toolbar and unsorted ("Other Bookmarks") roots.
  const other = children.find((node) => ['2', 'unfiled_____'].includes(String(node.id)) || /other bookmarks/i.test(node.title || ''));
  const bar = children.find((node) => ['1', 'toolbar_____'].includes(String(node.id)) || /bookmarks bar/i.test(node.title || ''));
  return other?.id || bar?.id || children?.[0]?.id || root?.id || undefined;
}

function normalizeTitle(title) {
  return String(title || '').trim().toLowerCase();
}

function isEffectivelyUntitled(title) {
  const normalized = normalizeTitle(title);
  return !normalized || normalized === '(untitled bookmark)' || normalized === 'untitled' || normalized === 'new bookmark';
}

export function detectDuplicates(bookmarks) {
  const urlCounts = new Map();
  const titleToUrls = new Map();
  const now = Date.now();

  for (const bookmark of bookmarks) {
    const urlKey = bookmark.parsed.valid ? bookmark.parsed.normalizedPageKey : bookmark.url;
    const titleKey = normalizeTitle(bookmark.title);
    urlCounts.set(urlKey, (urlCounts.get(urlKey) || 0) + 1);
    if (titleKey) {
      const set = titleToUrls.get(titleKey) || new Set();
      set.add(urlKey);
      titleToUrls.set(titleKey, set);
    }
  }

  return bookmarks.map((bookmark) => {
    const urlKey = bookmark.parsed.valid ? bookmark.parsed.normalizedPageKey : bookmark.url;
    const titleKey = normalizeTitle(bookmark.title);
    const ageDays = bookmark.dateAdded ? Math.floor((now - bookmark.dateAdded) / 86400000) : null;
    const titleUrlSet = titleToUrls.get(titleKey);
    const titleCollisionCount = titleUrlSet ? titleUrlSet.size : 0;
    return {
      ...bookmark,
      duplicateKey: urlKey,
      isDuplicate: (urlCounts.get(urlKey) || 0) > 1,
      isUntitled: isEffectivelyUntitled(bookmark.title),
      ageDays,
      isOld: Number.isFinite(ageDays) ? ageDays >= OLD_BOOKMARK_DAYS : false,
      hasTitleCollision: Boolean(titleKey) && titleCollisionCount > 1,
      titleCollisionCount
    };
  });
}

const parsedSearchCache = new Map();

function parseSearchQuery(rawQuery) {
  const query = String(rawQuery || '').trim();
  const cacheKey = query.toLowerCase();
  if (parsedSearchCache.has(cacheKey)) return parsedSearchCache.get(cacheKey);
  const tokens = query ? query.split(/\s+/) : [];
  const terms = [];
  const ops = {
    title: [],
    url: [],
    path: [],
    host: [],
    domain: [],
    health: [],
    flags: new Set()
  };

  for (const token of tokens) {
    const match = token.match(/^(title|url|path|host|domain|health|is|age):(.*)$/i);
    if (!match) {
      terms.push(token.toLowerCase());
      continue;
    }
    const key = match[1].toLowerCase();
    const value = match[2].trim().toLowerCase();
    if (!value) continue;
    if (key === 'is') {
      ops.flags.add(value);
    } else if (key === 'age') {
      if (value === 'old' || value === 'stale') ops.flags.add('old');
    } else if (key === 'health') {
      ops.health.push(value);
    } else {
      ops[key].push(value);
    }
  }

  const parsed = { terms, ops };
  if (parsedSearchCache.size >= SEARCH_CACHE_MAX_SIZE) {
    const firstKey = parsedSearchCache.keys().next().value;
    if (firstKey !== undefined) parsedSearchCache.delete(firstKey);
  }
  parsedSearchCache.set(cacheKey, parsed);
  return parsed;
}

function matchesAdvancedSearch(bookmark, parsedQuery) {
  const { terms, ops } = parsedQuery;
  const title = String(bookmark.title || '').toLowerCase();
  const url = String(bookmark.url || '').toLowerCase();
  const path = String(bookmark.path || '').toLowerCase();
  const host = String(bookmark.parsed?.hostname || '').toLowerCase();
  const domain = String(bookmark.parsed?.domain || '').toLowerCase();
  const composite = `${title} ${url} ${path}`;

  if (terms.some((term) => !composite.includes(term))) return false;
  if (ops.title.some((term) => !title.includes(term))) return false;
  if (ops.url.some((term) => !url.includes(term))) return false;
  if (ops.path.some((term) => !path.includes(term))) return false;
  if (ops.host.some((term) => !host.includes(term))) return false;
  if (ops.domain.some((term) => !domain.includes(term))) return false;

  if (ops.health.length) {
    const bookmarkHealth = String(bookmark.healthStatus || '').toLowerCase();
    const isBad = ['broken', 'server-error', 'unreachable'].includes(bookmarkHealth);
    const isGood = ['healthy', 'redirected'].includes(bookmarkHealth);
    for (const term of ops.health) {
      if (term === 'bad' && !isBad) return false;
      if ((term === 'good' || term === 'ok') && !isGood) return false;
      if (term !== 'bad' && term !== 'good' && term !== 'ok' && bookmarkHealth !== term) return false;
    }
  }

  if (ops.flags.has('duplicate') && !bookmark.isDuplicate) return false;
  if (ops.flags.has('untitled') && !bookmark.isUntitled) return false;
  if (ops.flags.has('old') && !bookmark.isOld) return false;
  if ((ops.flags.has('collision') || ops.flags.has('title-collision')) && !bookmark.hasTitleCollision) return false;

  return true;
}

function matchesCleanupFilter(bookmark, cleanupFilter) {
  switch (cleanupFilter) {
    case CLEANUP_FILTERS.DUPLICATES:
      return bookmark.isDuplicate;
    case CLEANUP_FILTERS.UNTITLED:
      return bookmark.isUntitled;
    case CLEANUP_FILTERS.OLD:
      return bookmark.isOld;
    case CLEANUP_FILTERS.TITLE_COLLISIONS:
      return bookmark.hasTitleCollision;
    case CLEANUP_FILTERS.ALL:
    default:
      return true;
  }
}

export function filterBookmarks(bookmarks, target, mode, query, options = {}) {
  const {
    duplicatesOnly = false,
    cleanupFilter = CLEANUP_FILTERS.ALL
  } = options;

  const parsedQuery = parseSearchQuery(query);

  return bookmarks.filter((bookmark) => {
    if (!matchesMode(bookmark, target, mode)) return false;
    if (duplicatesOnly && !bookmark.isDuplicate) return false;
    if (!matchesCleanupFilter(bookmark, cleanupFilter)) return false;
    return matchesAdvancedSearch(bookmark, parsedQuery);
  });
}

export function filterScopedBookmarks(bookmarks, query, options = {}) {
  const {
    duplicatesOnly = false,
    cleanupFilter = CLEANUP_FILTERS.ALL,
    tagsByBookmark = null,
    requiredTags = null
  } = options;
  const parsedQuery = parseSearchQuery(query);

  let filtered = bookmarks.filter((bookmark) => {
    if (duplicatesOnly && !bookmark.isDuplicate) return false;
    if (!matchesCleanupFilter(bookmark, cleanupFilter)) return false;
    return matchesAdvancedSearch(bookmark, parsedQuery);
  });

  // Apply the tag overlay after the cheaper filters so we run it on the
  // smallest possible list. requiredTags is intentionally separate from
  // the search-query string — tags don't appear in title/url, and using
  // operators like `tag:work` would have to compete with future cleanup
  // operators. A dedicated parameter keeps the contract obvious.
  if (Array.isArray(requiredTags) && requiredTags.length && tagsByBookmark) {
    filtered = filterBookmarksByTags(filtered, tagsByBookmark, requiredTags);
  }

  return filtered;
}

/**
 * Detect whether a query is using advanced-search operators (`title:`,
 * `url:`, `is:`, etc.). When it is, fuzzy fallback would hide intent —
 * the user clearly wants the exact filter they typed. When it isn't, a
 * fuzzy pass can rescue typos and word-order variations.
 */
function hasAdvancedOperators(query) {
  return /\b(title|url|path|host|domain|health|is|age):/i.test(String(query || ''));
}

/**
 * Returns bookmarks filtered like filterScopedBookmarks, except: if the
 * advanced-search pass returns 0 results AND the query has no explicit
 * operators, fall back to fuzzy matching against title / URL / path.
 *
 * Order of the fuzzy results is preserved (score-desc) so the caller can
 * skip its own sort when fuzzy mode kicked in. The return value carries
 * a `fuzzy` flag so the UI can show a "showing fuzzy matches" hint.
 *
 * @returns {{ items: object[], fuzzy: boolean }}
 */
export function searchScopedBookmarks(bookmarks, query, options = {}) {
  const items = filterScopedBookmarks(bookmarks, query, options);
  // Only attempt fuzzy fallback when the advanced pass returned nothing,
  // the query is non-empty, and the user didn't use explicit operators.
  const trimmed = String(query || '').trim();
  if (items.length || !trimmed || hasAdvancedOperators(trimmed)) {
    return { items, fuzzy: false };
  }
  // Respect cleanup / duplicates-only filters during the fuzzy pass too —
  // the user's intent for those toggles doesn't change just because we're
  // using a different matcher for the text query.
  const {
    duplicatesOnly = false,
    cleanupFilter = CLEANUP_FILTERS.ALL,
    tagsByBookmark = null,
    requiredTags = null
  } = options;
  let candidates = bookmarks.filter((bookmark) => {
    if (duplicatesOnly && !bookmark.isDuplicate) return false;
    if (!matchesCleanupFilter(bookmark, cleanupFilter)) return false;
    return true;
  });
  if (Array.isArray(requiredTags) && requiredTags.length && tagsByBookmark) {
    candidates = filterBookmarksByTags(candidates, tagsByBookmark, requiredTags);
  }
  const ranked = fuzzySearchBookmarks(trimmed, candidates);
  return { items: ranked.map((r) => r.bookmark), fuzzy: ranked.length > 0 };
}

export function sortBookmarks(bookmarks, sortValue) {
  const items = [...bookmarks];
  items.sort((a, b) => {
    switch (sortValue) {
      case 'url-asc':
        return a.url.localeCompare(b.url, undefined, { sensitivity: 'base' });
      case 'newest':
        return (b.dateAdded || 0) - (a.dateAdded || 0);
      case 'oldest':
        return (a.dateAdded || 0) - (b.dateAdded || 0);
      case 'path-asc':
        return (a.path || '').localeCompare(b.path || '', undefined, { sensitivity: 'base' });
      case 'title-asc':
      default:
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    }
  });
  return items;
}

export function groupDuplicates(bookmarks) {
  const groups = new Map();
  for (const bookmark of bookmarks) {
    if (!bookmark.isDuplicate) continue;
    const key = bookmark.duplicateKey;
    const list = groups.get(key) || [];
    list.push(bookmark);
    groups.set(key, list);
  }
  return groups;
}

export function getCleanupSummary(bookmarks) {
  // Single pass instead of five separate filter() calls — O(n) not O(5n)
  let duplicateCount = 0;
  let untitledCount = 0;
  let oldCount = 0;
  let titleCollisionCount = 0;
  const duplicateKeys = new Set();

  for (const bookmark of bookmarks) {
    if (bookmark.isDuplicate) {
      duplicateCount++;
      duplicateKeys.add(bookmark.duplicateKey);
    }
    if (bookmark.isUntitled) untitledCount++;
    if (bookmark.isOld) oldCount++;
    if (bookmark.hasTitleCollision) titleCollisionCount++;
  }

  return {
    total: bookmarks.length,
    duplicateCount,
    untitledCount,
    oldCount,
    titleCollisionCount,
    duplicateGroupCount: duplicateKeys.size
  };
}
