/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 *
 * tag-service.js
 *
 * Tags are user-defined labels that live alongside Chrome's folder
 * hierarchy. Internally we store one big map:
 *
 *   tagsByBookmark[bookmarkId] = ['work', 'urgent', 'react']
 *
 * The map is kept in chrome.storage.local because the Chrome bookmarks
 * API has nowhere to attach extra fields. Tags survive bookmark moves
 * and folder reorganisation; they're tied to the bookmark id.
 *
 * Conventions
 * ───────────
 * - Tag strings are normalised on input (lowercased, trimmed, whitespace
 *   collapsed) so "Work", " work ", and "WORK" become a single tag.
 * - Empty / overlong / control-character-laced inputs are rejected at
 *   normaliseTag time; callers shouldn't have to defend themselves.
 * - Bookmarks with no tags are not stored in the map (saves quota; an
 *   absent key is equivalent to "no tags").
 * - When a bookmark is removed (chrome.bookmarks.onRemoved), its entry
 *   should be purged via removeTagsForBookmark — see the background
 *   service-worker wiring for that.
 *
 * This module is pure-function-leaning: side effects (load, save) are
 * isolated and chrome.storage calls are awaitable, but the bulk of the
 * logic (normalisation, set-union, queries) operates on plain JS objects
 * so it can be unit-tested without browser plumbing.
 */

import { getLocalStorage, setLocalStorage, withStorageLock } from './storage-service.js';
import { getBookmarkTree } from '../platform/browser-api.js';
import {
  STORAGE_KEYS,
  TAG_MAX_LENGTH,
  TAG_MAX_PER_BOOKMARK,
  TAG_MAX_UNIQUE_TAGS
} from '../constants.js';

// ─── Normalisation ───────────────────────────────────────────────────────────

/**
 * Canonicalises a tag string. Returns the normalised value, or null if
 * the input cannot become a valid tag. Trims, lowercases, collapses
 * internal whitespace, and strips control characters. Length is enforced
 * after normalisation so users get the actual characters they typed.
 *
 * Note: \t and \n are kept (then collapsed by /\s+/) so multi-line paste
 * input like "react\nhooks" tokenises sensibly. Truly non-printable
 * control chars (\u0000-\u0008, \u000b-\u000c, \u000e-\u001f, \u007f)
 * and zero-width / line-separator chars are dropped outright.
 */
export function normaliseTag(raw) {
  if (typeof raw !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u2028\u2029]/g, '');
  const collapsed = cleaned.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!collapsed) return null;
  if (collapsed.length > TAG_MAX_LENGTH) return null;
  return collapsed;
}

/**
 * Normalises and dedupes an array of raw tag inputs. Useful when the
 * caller has a CSV-ish string or a user paste. Returns up to
 * TAG_MAX_PER_BOOKMARK unique normalised tags, dropping invalid entries
 * silently. Order is preserved (first occurrence wins).
 */
export function normaliseTagList(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  const seen = new Set();
  for (const raw of rawList) {
    const norm = normaliseTag(raw);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
    if (out.length >= TAG_MAX_PER_BOOKMARK) break;
  }
  return out;
}

/**
 * Splits a freeform input ("react, hooks   urgent") into individual
 * candidate tag strings. Treats commas and ASCII whitespace as
 * separators; the per-token normalisation handles the rest.
 */
export function tokeniseTagInput(input) {
  if (typeof input !== 'string') return [];
  return input.split(/[\s,]+/).filter(Boolean);
}

// ─── Map operations (pure) ───────────────────────────────────────────────────

/**
 * Returns the list of tags for a bookmark, or an empty array if none.
 * Defensive against malformed entries — a non-array value at the key is
 * treated as empty.
 */
export function getTagsForBookmark(map, bookmarkId) {
  if (!map || !bookmarkId) return [];
  const entry = map[bookmarkId];
  return Array.isArray(entry) ? entry.slice() : [];
}

/**
 * Returns a new map with the bookmark's tags set to the given array.
 * Pure — does not mutate the input. An empty result is represented by
 * deleting the key so the stored map stays compact.
 */
export function setTagsForBookmark(map, bookmarkId, tags) {
  const next = { ...(map || {}) };
  const cleaned = normaliseTagList(tags);
  if (cleaned.length === 0) {
    delete next[bookmarkId];
  } else {
    next[bookmarkId] = cleaned;
  }
  return next;
}

/**
 * Adds a single tag to a bookmark's list. No-op when the tag is invalid
 * or already present. Respects TAG_MAX_PER_BOOKMARK.
 */
export function addTagToBookmark(map, bookmarkId, rawTag) {
  const norm = normaliseTag(rawTag);
  if (!norm) return { map: map || {}, added: false };
  const current = getTagsForBookmark(map, bookmarkId);
  if (current.includes(norm)) return { map: map || {}, added: false };
  if (current.length >= TAG_MAX_PER_BOOKMARK) return { map: map || {}, added: false };
  const next = setTagsForBookmark(map, bookmarkId, [...current, norm]);
  return { map: next, added: true };
}

/**
 * Removes a tag from a bookmark's list. No-op when the tag wasn't there.
 */
export function removeTagFromBookmark(map, bookmarkId, rawTag) {
  const norm = normaliseTag(rawTag);
  if (!norm) return { map: map || {}, removed: false };
  const current = getTagsForBookmark(map, bookmarkId);
  if (!current.includes(norm)) return { map: map || {}, removed: false };
  const next = setTagsForBookmark(map, bookmarkId, current.filter((t) => t !== norm));
  return { map: next, removed: true };
}

/**
 * Removes a bookmark's entry entirely from the map. Used when a bookmark
 * is deleted from Chrome's tree so we don't leak storage.
 */
export function removeTagsForBookmark(map, bookmarkId) {
  if (!map || !bookmarkId || !(bookmarkId in map)) return { map: map || {}, removed: false };
  const next = { ...map };
  delete next[bookmarkId];
  return { map: next, removed: true };
}

// ─── Aggregate queries ───────────────────────────────────────────────────────

/**
 * Collects the universe of distinct tags across all bookmarks, with
 * counts of how many bookmarks use each. Result is sorted by count desc
 * then alphabetical asc so the most-used tags surface first in
 * autocomplete and filter UIs. Caps at TAG_MAX_UNIQUE_TAGS to keep the
 * UI responsive on degenerate libraries.
 *
 * Returns: [{ tag, count }, ...]
 */
export function summariseTags(map) {
  if (!map || typeof map !== 'object') return [];
  const counts = new Map();
  for (const tags of Object.values(map)) {
    if (!Array.isArray(tags)) continue;
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  const entries = [...counts.entries()].map(([tag, count]) => ({ tag, count }));
  entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.tag.localeCompare(b.tag);
  });
  return entries.slice(0, TAG_MAX_UNIQUE_TAGS);
}

/**
 * Filters a bookmark list to only those tagged with ALL of the given
 * tags (AND semantics). The empty `requiredTags` is treated as "no
 * filter" — returns the input unchanged.
 */
export function filterBookmarksByTags(bookmarks, map, requiredTags) {
  if (!Array.isArray(requiredTags) || requiredTags.length === 0) return bookmarks || [];
  const norm = normaliseTagList(requiredTags);
  if (!norm.length) return bookmarks || [];
  return (bookmarks || []).filter((bookmark) => {
    const tags = getTagsForBookmark(map, bookmark?.id);
    return norm.every((t) => tags.includes(t));
  });
}

/**
 * Walks the map and drops entries whose bookmarkId is no longer present
 * in the current bookmark list. Returns the cleaned map along with the
 * number of entries removed so callers can log the housekeeping.
 *
 * Run this opportunistically when bookmarks are reloaded — Chrome's
 * onRemoved fires reliably for user deletions but bookmark imports and
 * sync edge cases can leave orphaned tag entries.
 */
export function pruneOrphanedTags(map, bookmarks) {
  if (!map || typeof map !== 'object') return { map: {}, removed: 0 };
  const alive = new Set();
  for (const b of bookmarks || []) {
    if (b?.id) alive.add(b.id);
  }
  let removed = 0;
  const next = {};
  for (const [id, tags] of Object.entries(map)) {
    if (alive.has(id) && Array.isArray(tags) && tags.length) {
      next[id] = tags;
    } else {
      removed++;
    }
  }
  return { map: next, removed };
}

// ─── Storage I/O ─────────────────────────────────────────────────────────────

/**
 * Loads the full bookmark→tags map from storage. Safe to call from
 * dashboard / popup / background contexts. Always resolves to an object;
 * malformed storage shapes are coerced to {}.
 */
export async function loadTagsMap() {
  const stored = await getLocalStorage([STORAGE_KEYS.TAGS_BY_BOOKMARK]);
  const raw = stored?.[STORAGE_KEYS.TAGS_BY_BOOKMARK];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  // Defensive: filter out any keys whose value isn't an array of strings.
  const out = {};
  for (const [id, tags] of Object.entries(raw)) {
    if (Array.isArray(tags)) {
      const cleaned = normaliseTagList(tags);
      if (cleaned.length) out[id] = cleaned;
    }
  }
  return out;
}

/**
 * Persists the full map. Callers usually pass the result of a pure
 * operation (addTagToBookmark, removeTagFromBookmark, etc.) — last write
 * wins, which is fine because every tag mutation goes through the
 * dashboard with the latest snapshot in hand.
 */
export async function updateTagsMap(mutator) {
  return withStorageLock(async () => {
    const current = await loadTagsMap();
    const next = await mutator(current);
    const tree = await getBookmarkTree();
    const ids = new Set();
    const visit = (nodes) => { for (const node of nodes || []) { if (node.url) ids.add(String(node.id)); visit(node.children); } };
    visit(tree);
    const valid = {};
    for (const [id, tags] of Object.entries(next || {})) {
      const cleaned = normaliseTagList(tags);
      if (ids.has(id) && cleaned.length) valid[id] = cleaned;
    }
    await setLocalStorage({ [STORAGE_KEYS.TAGS_BY_BOOKMARK]: valid });
    return valid;
  });
}

// Apply only changed IDs from a known snapshot. Never replace unrelated data
// with a page's stale full-map snapshot.
export async function saveTagsMap(map, previousMap) {
  if (!previousMap) throw new Error('saveTagsMap requires the previous snapshot; use updateTagsMap for mutations.');
  const ids = new Set([...Object.keys(map || {}), ...Object.keys(previousMap)]);
  const changed = [...ids].filter(id => JSON.stringify(map?.[id]) !== JSON.stringify(previousMap[id]));
  return updateTagsMap(current => {
    const next = { ...current };
    for (const id of changed) {
      if (map?.[id]?.length) next[id] = map[id];
      else delete next[id];
    }
    return next;
  });
}
