/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 *
 * third-party-import.js
 *
 * Parsers for popular bookmarking services' export formats. All parsers
 * return the same shape so the import-action layer doesn't have to
 * special-case anything:
 *
 *   {
 *     bookmarks: [
 *       { title: string, url: string, dateAdded?: number, tags?: string[] }
 *     ],
 *     errors: [ { line?: number, message: string } ]
 *   }
 *
 * Conventions
 * ───────────
 * - URLs that aren't http(s) are dropped silently (same policy as the
 *   built-in CSV/JSON importer). Logged as a single summary error if we
 *   skipped any so the user has visibility.
 * - dateAdded is in milliseconds since epoch. Each service uses a
 *   different unit (Pocket: seconds-as-string, Pinboard: ISO 8601,
 *   Raindrop: ISO 8601); the parsers normalise.
 * - tags arrive as freeform user strings — we pass them through verbatim
 *   here and let the tag-service normalisation handle the final shape
 *   when they're saved. That keeps responsibility in one place.
 * - Empty input is not an error, just an empty result. Truly malformed
 *   input (invalid JSON, broken HTML) returns an empty bookmark list
 *   and a single descriptive error.
 *
 * Detection
 * ─────────
 * Callers can use detectImportFormat() to auto-pick the right parser
 * from a file's name and/or content sniff. Each parser is also exported
 * directly for callers who already know the source.
 */

// ─── Shared helpers ──────────────────────────────────────────────────────────

function isSafeImportableUrl(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function pushUnsafeSkip(errors, skipped) {
  if (skipped > 0) {
    errors.push({
      message: `Skipped ${skipped} non-http(s) URL${skipped === 1 ? '' : 's'} for safety.`
    });
  }
}

function parseUnixSeconds(value) {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  // Pocket emits seconds; if a parser hands us milliseconds by accident
  // (number > year 9999 in seconds), accept it as-is.
  if (num > 1e12) return Math.floor(num);
  return Math.floor(num * 1000);
}

function parseIsoOrNumeric(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

/**
 * Splits a tag string the way Pocket and Pinboard typically emit them:
 * comma-separated or space-separated. Whitespace-only tokens are dropped;
 * the caller (tag-service.normaliseTag) handles case + length validation.
 *
 * Pocket export uses commas. Pinboard uses spaces. Raindrop emits commas
 * with optional spaces. A single function handles all three.
 */
function splitTagString(raw) {
  if (typeof raw !== 'string') return [];
  return raw.split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);
}

// ─── Pocket (HTML export) ────────────────────────────────────────────────────

/**
 * Pocket exports a single-file HTML document with all bookmarks as
 *   <a href="..." time_added="1234567890" tags="t1,t2">Title</a>
 *
 * The structure is a Netscape-style bookmark file (DL/DT/A nesting) but
 * Pocket doesn't preserve folder hierarchy — everything is flat. So we
 * skip the structural elements entirely and just match <a> tags with a
 * regex, which is fast and tolerant of the various malformed exports
 * users have reported over the years.
 *
 * We accept either time_added (Pocket's own field) or add_date (the
 * Netscape standard). Both are unix-seconds-as-string.
 */
export function parsePocketHtml(text) {
  const result = { bookmarks: [], errors: [] };
  const html = String(text || '');
  if (!html.trim()) return result;

  let unsafeSkipped = 0;

  // Match every <a> tag. The HTML parser would be more correct, but
  // we're in a service-worker / module context where DOMParser may not
  // exist, and Pocket's export is regular enough for regex to suffice.
  // [^>]* matches all attributes; we then pull the ones we want out
  // of the captured string.
  const anchorRe = /<a\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorRe.exec(html)) !== null) {
    const attrs = match[1];
    const inner = match[2];
    const href = decodeHtmlEntities(extractAttribute(attrs, 'href'));
    if (!isSafeImportableUrl(href)) {
      if (href) unsafeSkipped++;
      continue;
    }
    const timeRaw = extractAttribute(attrs, 'time_added') || extractAttribute(attrs, 'add_date');
    const tagsRaw = extractAttribute(attrs, 'tags');
    const title = decodeHtmlEntities(inner.replace(/<[^>]+>/g, '').trim()) || href;
    result.bookmarks.push({
      title,
      url: href.trim(),
      dateAdded: parseUnixSeconds(timeRaw),
      tags: tagsRaw ? splitTagString(decodeHtmlEntities(tagsRaw)) : []
    });
  }

  pushUnsafeSkip(result.errors, unsafeSkipped);
  return result;
}

function extractAttribute(attrString, name) {
  // Matches name="value" or name='value' or name=bareword (no quotes).
  // The bareword variant ends at whitespace or >.
  const re = new RegExp(`(?:^|\\s)${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i');
  const match = re.exec(attrString);
  if (!match) return '';
  return match[2] ?? match[3] ?? match[4] ?? '';
}

function decodeHtmlEntities(s) {
  // A tiny decoder for the entities that show up in real Pocket exports.
  // We intentionally don't pull in a general-purpose HTML decoder — that
  // would be 5× the size of this file. If a user has an entity not in
  // this list, the title will be slightly off; URL/tags are unaffected.
  if (typeof s !== 'string') return '';
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return s.replace(/&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-f]+);/gi, (entity, code) => {
    if (!code.startsWith('#')) return named[code.toLowerCase()];
    const n = code.slice(0,2).toLowerCase() === '#x' ? parseInt(code.slice(2),16) : Number(code.slice(1));
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '\ufffd';
  });
}

// ─── Pinboard (JSON export) ──────────────────────────────────────────────────

/**
 * Pinboard exports JSON as an array of bookmark records:
 *   [
 *     {
 *       "href": "https://...",
 *       "description": "Title text",   // yes, "description" is the title
 *       "extended": "Notes",            // ignored for now
 *       "meta": "...",                  // a hash, ignored
 *       "hash": "...",
 *       "time": "2024-01-15T12:34:56Z",
 *       "shared": "yes",
 *       "toread": "no",
 *       "tags": "react hooks docs"      // space-separated
 *     },
 *     ...
 *   ]
 *
 * The "description" / title swap is the weird one — keeps catching new
 * importers off-guard. We normalise to {title, url} here.
 */
export function parsePinboardJson(text) {
  const result = { bookmarks: [], errors: [] };
  if (!text || !String(text).trim()) return result;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    result.errors.push({ message: `JSON parse error: ${error.message || 'malformed input'}` });
    return result;
  }
  if (!Array.isArray(parsed)) {
    // Some users wrap the array in an object — try to recover.
    if (parsed && Array.isArray(parsed.bookmarks)) {
      parsed = parsed.bookmarks;
    } else if (parsed && Array.isArray(parsed.posts)) {
      // Pinboard's API endpoint format wraps in {posts: [...]}.
      parsed = parsed.posts;
    } else {
      result.errors.push({ message: 'Expected a JSON array of bookmark records.' });
      return result;
    }
  }

  let unsafeSkipped = 0;
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const url = String(entry.href || '').trim();
    if (!isSafeImportableUrl(url)) {
      if (url) unsafeSkipped++;
      continue;
    }
    const title = String(entry.description || '').trim() || url;
    const dateAdded = parseIsoOrNumeric(entry.time);
    const tags = entry.tags ? splitTagString(entry.tags) : [];
    result.bookmarks.push({ title, url, dateAdded, tags });
  }

  pushUnsafeSkip(result.errors, unsafeSkipped);
  return result;
}

// ─── Raindrop.io (CSV export) ────────────────────────────────────────────────

/**
 * Raindrop.io's CSV export has a header row with these columns
 * (case-sensitive in their format, though we look them up case-
 * insensitively):
 *
 *   id, title, note, excerpt, url, folder, tags, created, cover, highlights
 *
 * "tags" is a comma-separated list inside the cell (so each row has
 * commas-within-quotes). "created" is ISO 8601. "folder" is a /-
 * separated path which we treat as a single string for now — the
 * import action layer puts everything into a flat "Imported from
 * Raindrop" folder.
 *
 * Reuses the RFC-4180 state-machine parser from our built-in CSV
 * importer so we don't repeat that logic.
 */
import { _internals as csvInternals } from '../dashboard/import-export-tools.js';

export function parseRaindropCsv(text) {
  const result = { bookmarks: [], errors: [] };
  const input = String(text || '');
  if (!input.trim()) return result;
  const rows = csvInternals.parseCsv(input);
  if (!rows.length) return result;

  // Header lookup. Raindrop always emits a header row; if we don't see
  // one, treat the first row as positional [title, url].
  const header = rows[0].map((cell) => String(cell || '').trim().toLowerCase());
  const headerHasNames = header.includes('url') || header.includes('title');
  const dataRows = headerHasNames ? rows.slice(1) : rows;

  const idx = {
    title: headerHasNames ? header.indexOf('title') : 0,
    url: headerHasNames ? header.indexOf('url') : 1,
    tags: headerHasNames ? header.indexOf('tags') : -1,
    created: headerHasNames ? header.indexOf('created') : -1
  };
  // Defensive defaults if a column is missing from a re-edited export.
  if (idx.title < 0) idx.title = 0;
  if (idx.url < 0) idx.url = 1;

  let unsafeSkipped = 0;
  for (const cells of dataRows) {
    const url = String(cells[idx.url] || '').trim();
    if (!isSafeImportableUrl(url)) {
      if (url) unsafeSkipped++;
      continue;
    }
    const title = String(cells[idx.title] || '').trim() || url;
    const tags = idx.tags >= 0 ? splitTagString(String(cells[idx.tags] || '')) : [];
    const dateAdded = idx.created >= 0 ? parseIsoOrNumeric(cells[idx.created]) : 0;
    result.bookmarks.push({ title, url, dateAdded, tags });
  }

  pushUnsafeSkip(result.errors, unsafeSkipped);
  return result;
}

// ─── Netscape bookmark file (browser bookmarks.html) ─────────────────────────

export const NETSCAPE_LIMITS = Object.freeze({
  maxInputChars: 10 * 1024 * 1024, // same ceiling as the dashboard file picker
  maxDepth: 100,                   // same folder-depth ceiling as the snapshot validator
  maxBookmarks: 50000,             // same node ceiling as the snapshot validator
  maxUrlChars: 8192,
  maxTitleChars: 10000,
  maxFolderNameChars: 256
});

const NETSCAPE_DOCTYPE = /^\s*<!doctype\s+netscape-bookmark-file/i;

/**
 * True for the Netscape bookmark file format written by Chrome, Edge,
 * Firefox, Safari, Brave, Vivaldi and most bookmark managers: either the
 * NETSCAPE-Bookmark-file-1 doctype, or (for exports that omit it) a
 * definition-list structure with folder headings near the top of the file.
 */
export function looksLikeNetscapeBookmarks(content) {
  const head = String(content || '').replace(/^\ufeff/, '').slice(0, 32768);
  if (NETSCAPE_DOCTYPE.test(head)) return true;
  return /<dl[\s>]/i.test(head) && /<dt[\s>]/i.test(head) && /<h3[\s>]/i.test(head) && /<a\s[^>]*href/i.test(head);
}

function netscapeDate(value) {
  const num = Number(String(value ?? '').trim());
  if (!Number.isFinite(num) || num <= 0) return 0;
  if (num < 1e11) return Math.floor(num * 1000);   // seconds (Chrome, Firefox, Safari)
  if (num < 1e14) return Math.floor(num);          // milliseconds
  return Math.floor(num / 1000);                   // microseconds
}

function isNameChar(code) {
  return (code >= 48 && code <= 58) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || code === 45 || code === 95;
}

function isSpace(code) {
  return code === 32 || code === 9 || code === 10 || code === 13 || code === 12;
}

/**
 * Tolerant, non-recursive tokenizer for Netscape bookmark files. It never
 * builds a DOM and never evaluates markup: it recognises only the handful of
 * tags that carry structure (DL, H3, A) and ignores every other tag, so
 * unclosed DT/P/DD elements, stray markup and hostile content are harmless.
 * Only the attributes it needs (HREF, ADD_DATE, TAGS) are copied out of a
 * start tag; large attributes such as ICON data URIs are skipped without
 * being materialised.
 *
 * Folder semantics: an H3 names the DL that follows it. The resulting path
 * ("Bookmarks bar / News") is descriptive, matching the existing import
 * contract; bookmarks are still created flat in the chosen destination.
 */
export function parseNetscapeHtml(text) {
  const result = { bookmarks: [], errors: [] };
  const input = String(text || '').replace(/^\ufeff/, '');
  if (!input.trim()) return result;
  if (input.length > NETSCAPE_LIMITS.maxInputChars) {
    result.errors.push({ message: 'Bookmark file is too large to import (maximum 10 MiB).' });
    return result;
  }

  const WANTED = { href: 'href', add_date: 'addDate', tags: 'tags' };
  const length = input.length;
  const folders = [];        // names of currently open folders (null for unnamed lists)
  let overflow = 0;          // DL nesting beyond maxDepth (counted, not stored)
  let pendingFolder = null;  // name from an H3 awaiting its DL
  let current = null;        // open <a> or <h3> collecting text
  let unsafeSkipped = 0, oversizedSkipped = 0, capped = false, depthTruncated = false;

  const folderPath = () => folders.filter(Boolean).join(' / ');
  const clean = (value) => decodeHtmlEntities(value).replace(/\s+/g, ' ').trim();

  function finish() {
    if (!current) return;
    const item = current;
    current = null;
    if (item.kind === 'h3') {
      pendingFolder = clean(item.text).slice(0, NETSCAPE_LIMITS.maxFolderNameChars) || null;
      return;
    }
    pendingFolder = null;
    const href = decodeHtmlEntities(item.attrs.href || '').trim();
    if (!href) return;
    if (href.length > NETSCAPE_LIMITS.maxUrlChars) { oversizedSkipped++; return; }
    if (!isSafeImportableUrl(href)) { unsafeSkipped++; return; }
    if (result.bookmarks.length >= NETSCAPE_LIMITS.maxBookmarks) { capped = true; return; }
    result.bookmarks.push({
      title: clean(item.text).slice(0, NETSCAPE_LIMITS.maxTitleChars) || href,
      url: href,
      path: folderPath(),
      dateAdded: netscapeDate(item.attrs.addDate),
      tags: item.attrs.tags ? decodeHtmlEntities(item.attrs.tags).split(',').map((tag) => tag.trim()).filter(Boolean) : []
    });
  }

  // Reads attributes starting at `i` (just after the tag name). Returns the
  // index after the closing '>' and, when `keep` is true, the wanted values.
  function readAttributes(start, keep) {
    const attrs = {};
    let i = start;
    while (i < length) {
      let code = input.charCodeAt(i);
      while (i < length && (isSpace(code) || code === 47)) code = input.charCodeAt(++i);
      if (i >= length) break;
      if (code === 62) return { end: i + 1, attrs };
      const nameStart = i;
      while (i < length && !isSpace(code) && code !== 61 && code !== 62 && code !== 47) code = input.charCodeAt(++i);
      const name = input.slice(nameStart, i).toLowerCase();
      while (i < length && isSpace(code)) code = input.charCodeAt(++i);
      if (code !== 61) continue; // valueless attribute
      code = input.charCodeAt(++i);
      while (i < length && isSpace(code)) code = input.charCodeAt(++i);
      let valueStart = i;
      let valueEnd;
      if (code === 34 || code === 39) {
        const close = input.indexOf(input[i], i + 1);
        if (close < 0) { // unterminated quote: stop at the next '>' instead of swallowing the file
          const gt = input.indexOf('>', i + 1);
          valueStart = i + 1; valueEnd = gt < 0 ? length : gt; i = valueEnd;
        } else { valueStart = i + 1; valueEnd = close; i = close + 1; }
      } else {
        while (i < length && !isSpace(code) && code !== 62) code = input.charCodeAt(++i);
        valueEnd = i;
      }
      if (keep && WANTED[name] && attrs[WANTED[name]] === undefined) attrs[WANTED[name]] = input.slice(valueStart, valueEnd);
    }
    return { end: length, attrs };
  }

  let pos = 0;
  while (pos < length) {
    const lt = input.indexOf('<', pos);
    const textEnd = lt < 0 ? length : lt;
    if (current && textEnd > pos && current.text.length < 20000) current.text += input.slice(pos, textEnd);
    if (lt < 0) break;
    const next = input.charCodeAt(lt + 1);
    if (next === 33) { // <!-- comment --> or <!DOCTYPE ...>
      if (input.startsWith('<!--', lt)) {
        const close = input.indexOf('-->', lt + 4);
        pos = close < 0 ? length : close + 3;
      } else {
        const close = input.indexOf('>', lt + 2);
        pos = close < 0 ? length : close + 1;
      }
      continue;
    }
    const closing = next === 47;
    const nameStart = lt + (closing ? 2 : 1);
    let nameEnd = nameStart;
    while (nameEnd < length && isNameChar(input.charCodeAt(nameEnd))) nameEnd++;
    if (nameEnd === nameStart) { // a literal '<' in text, not a tag
      if (current) current.text += '<';
      pos = lt + 1;
      continue;
    }
    const tag = input.slice(nameStart, nameEnd).toLowerCase();
    const { end, attrs } = readAttributes(nameEnd, !closing && tag === 'a');
    pos = end;

    if (closing) {
      if (tag === 'a' || tag === 'h3') finish();
      else if (tag === 'dl') {
        finish();
        if (overflow > 0) overflow--; else folders.pop();
        pendingFolder = null;
      }
      continue;
    }
    switch (tag) {
      case 'a': finish(); current = { kind: 'a', attrs, text: '' }; break;
      case 'h3': finish(); current = { kind: 'h3', attrs: {}, text: '' }; break;
      case 'dl':
        finish();
        if (folders.length >= NETSCAPE_LIMITS.maxDepth) { overflow++; depthTruncated = true; }
        else folders.push(pendingFolder);
        pendingFolder = null;
        break;
      case 'dt': finish(); pendingFolder = null; break;
      case 'dd': case 'p': case 'hr': case 'h1': case 'title': case 'meta': case 'br': finish(); break;
      default: break; // formatting tags inside titles are ignored; their text is kept
    }
  }
  finish();

  pushUnsafeSkip(result.errors, unsafeSkipped);
  if (oversizedSkipped) result.errors.push({ message: `Skipped ${oversizedSkipped} URL${oversizedSkipped === 1 ? '' : 's'} longer than ${NETSCAPE_LIMITS.maxUrlChars} characters.` });
  if (capped) result.errors.push({ message: `Only the first ${NETSCAPE_LIMITS.maxBookmarks.toLocaleString('en-US')} bookmarks were read; the rest of the file was ignored.` });
  if (depthTruncated) result.errors.push({ message: `Folders nested deeper than ${NETSCAPE_LIMITS.maxDepth} levels share one descriptive path.` });
  return result;
}

// ─── Format detection ────────────────────────────────────────────────────────

/**
 * Picks a parser based on filename extension + a quick content sniff.
 * Returns one of 'netscape' | 'pocket' | 'pinboard' | 'raindrop' | null.
 *
 * The detection isn't bulletproof (a user could rename files) but
 * covers the common case where exports keep their default names.
 */
export function detectImportFormat(fileName, content) {
  const name = String(fileName || '').toLowerCase();
  const text = String(content || '').trimStart();

  // Browser bookmarks.html (Netscape bookmark file) is recognised by its
  // doctype or structure, regardless of the file name.
  if (looksLikeNetscapeBookmarks(text)) return 'netscape';

  // Pinboard exports tend to be named like "pinboard_export.json".
  if (name.includes('pinboard') && (name.endsWith('.json') || text.startsWith('['))) {
    return 'pinboard';
  }
  // Raindrop's CSV has a known column header. Sniff for it before the
  // generic CSV path.
  if (name.includes('raindrop') || /^id,title,/i.test(text.slice(0, 80))) {
    return 'raindrop';
  }
  // Pocket exports are typically "ril_export.html" or "pocket-export.html".
  // "ril" is from Pocket's earlier name "Read It Later".
  if (name.includes('pocket') || name.includes('ril_export') || /<dl><dt><a /i.test(text.slice(0, 200))) {
    return 'pocket';
  }
  // Fall through to caller for the default JSON/CSV path.
  return null;
}

/**
 * Convenience wrapper: pick the right parser, run it, return the same
 * shape every time. Returns null when no third-party format matches,
 * so the caller can fall back to the built-in parser.
 */
export function parseImportedThirdPartyFile(fileName, content) {
  const format = detectImportFormat(fileName, content);
  switch (format) {
    case 'netscape': return { format, ...parseNetscapeHtml(content) };
    case 'pocket': return { format, ...parsePocketHtml(content) };
    case 'pinboard': return { format, ...parsePinboardJson(content) };
    case 'raindrop': return { format, ...parseRaindropCsv(content) };
    default: return null;
  }
}
