/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 *
 * fuzzy-match.js — small, dependency-free fuzzy string matcher.
 *
 * Designed for "smart search" over bookmark fields (title + URL + path).
 * Strategy:
 *   1. Exact substring  → score 1000 + bonus for prefix-of-word matches.
 *   2. Subsequence      → score < 1000, weighted by:
 *        - contiguous runs of matched characters
 *        - matches at word boundaries (after space, slash, dash, dot)
 *        - matches at the start of the haystack
 *
 * Returns a score and the matched character indices so the caller can
 * highlight matched substrings. Higher score = better match. Score 0
 * means "no match" — caller should drop the item.
 *
 * Why not a dependency: a real lib (e.g. fuse.js) is ~10KB of code for
 * what we need (one field, one query, simple ranking). This implementation
 * is ~150 LOC and unit-testable.
 */

const SCORE_NO_MATCH = 0;
const SCORE_EXACT_BASE = 1000;
const BONUS_PREFIX = 50;            // query matches start of haystack
const BONUS_WORD_BOUNDARY = 15;     // matched char is at the start of a word
const BONUS_CONTIGUOUS = 10;        // matched char immediately follows previous match
const PENALTY_GAP = 1;              // for each unmatched char between matches

// Characters that mark a word boundary for boundary-bonus purposes.
// Includes URL/path delimiters so a query like "gh" can score well
// against "github.com" by matching the start of each segment.
const WORD_BOUNDARY_CHARS = new Set([
  ' ', '\t', '/', '\\', '-', '_', '.', ':', '?', '#', '&', '=', '+'
]);

function isWordBoundary(haystack, index) {
  if (index === 0) return true;
  return WORD_BOUNDARY_CHARS.has(haystack[index - 1]);
}

/**
 * Returns { score, matches } where `matches` is an array of indices in the
 * (lowercased) haystack that the query characters aligned with.
 *
 * Both query and haystack are matched case-insensitively. The caller is
 * expected to already have trimmed/normalised both.
 *
 * @param {string} query
 * @param {string} haystack
 * @returns {{ score: number, matches: number[] }}
 */
export function fuzzyScore(query, haystack) {
  if (!query) return { score: SCORE_NO_MATCH, matches: [] };
  if (!haystack) return { score: SCORE_NO_MATCH, matches: [] };

  const q = query.toLowerCase();
  const h = haystack.toLowerCase();

  // Fast path: exact substring match.
  const idx = h.indexOf(q);
  if (idx >= 0) {
    let score = SCORE_EXACT_BASE;
    if (idx === 0) score += BONUS_PREFIX;
    if (isWordBoundary(haystack, idx)) score += BONUS_WORD_BOUNDARY;
    // Shorter haystacks rank higher for exact matches — less padding around
    // the match. Cap the bonus so very short strings can't dominate.
    score += Math.max(0, 50 - h.length);
    const matches = [];
    for (let i = 0; i < q.length; i++) matches.push(idx + i);
    return { score, matches };
  }

  // Subsequence search: try to find each query char in order, preferring
  // matches at word boundaries and contiguous with previous matches.
  let qi = 0;
  let hi = 0;
  let score = 0;
  let prevMatchIndex = -2; // -2 so first match never registers as "contiguous"
  const matches = [];

  while (qi < q.length && hi < h.length) {
    if (q[qi] === h[hi]) {
      score += 1;
      if (isWordBoundary(haystack, hi)) score += BONUS_WORD_BOUNDARY;
      if (hi === prevMatchIndex + 1) score += BONUS_CONTIGUOUS;
      matches.push(hi);
      prevMatchIndex = hi;
      qi++;
    } else {
      score -= PENALTY_GAP;
    }
    hi++;
  }

  if (qi < q.length) return { score: SCORE_NO_MATCH, matches: [] };
  // Floor the subsequence score so an unlucky run of penalties can't make
  // a real match look worse than "no match". 1 is the minimum positive score.
  return { score: Math.max(1, score), matches };
}

/**
 * Higher-level: scores a bookmark against the query by checking title, URL,
 * and folder path. Returns the best-of-three score plus which field matched
 * (so callers can show the right highlight). Score 0 = drop.
 *
 * @param {string} query
 * @param {{ title?: string, url?: string, path?: string }} bookmark
 * @returns {{ score: number, field: 'title'|'url'|'path'|'', matches: number[] }}
 */
export function fuzzyScoreBookmark(query, bookmark) {
  if (!query || !bookmark) return { score: 0, field: '', matches: [] };
  // Title matches are most useful to the user, so a 1.5× weight; URL is
  // straightforward signal; path is least specific.
  const title = String(bookmark.title || '');
  const url = String(bookmark.url || '');
  const path = String(bookmark.path || '');

  const titleResult = fuzzyScore(query, title);
  const urlResult = fuzzyScore(query, url);
  const pathResult = fuzzyScore(query, path);

  const candidates = [
    { score: titleResult.score * 1.5, field: 'title', matches: titleResult.matches },
    { score: urlResult.score, field: 'url', matches: urlResult.matches },
    { score: pathResult.score * 0.6, field: 'path', matches: pathResult.matches }
  ];

  let best = { score: 0, field: '', matches: [] };
  for (const c of candidates) {
    if (c.score > best.score) best = c;
  }
  // Round so test assertions don't drown in .5s.
  best.score = Math.round(best.score);
  return best;
}

/**
 * Filters and sorts a list of bookmarks by fuzzy match against the query.
 * Items with score 0 are dropped. Result is sorted score-desc; ties break
 * on title ascending for stable, predictable ordering.
 *
 * @param {string} query
 * @param {Array<{ title?: string, url?: string, path?: string }>} bookmarks
 * @returns {Array<{ bookmark: object, score: number, field: string, matches: number[] }>}
 */
export function fuzzySearchBookmarks(query, bookmarks) {
  if (!query || !Array.isArray(bookmarks)) return [];
  const results = [];
  for (const bookmark of bookmarks) {
    const result = fuzzyScoreBookmark(query, bookmark);
    if (result.score > 0) {
      results.push({ bookmark, score: result.score, field: result.field, matches: result.matches });
    }
  }
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Stable tiebreak by title.
    const at = String(a.bookmark?.title || '').toLowerCase();
    const bt = String(b.bookmark?.title || '').toLowerCase();
    return at.localeCompare(bt);
  });
  return results;
}
