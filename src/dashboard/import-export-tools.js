/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 */

export function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Header order is also the column order the parser will look up by name.
// Changing this list will not break old CSV files thanks to the header-row
// lookup in parseCsv() — but it WILL change what new exports contain.
const CSV_HEADERS = ['Title', 'URL', 'Folder path', 'Date added', 'Tags', 'Text encoding'];

function escapeCsvCell(value) {
  let str = String(value ?? '');
  if (/^(?:\s*[=+@-]|[\t\r\n]|')/.test(str)) str = "'" + str;
  // RFC 4180 §2.6: only escape if the value contains a separator, quote,
  // or line break. Always quoting works too, but unquoted simple cells
  // round-trip cleanly through naive parsers as well.
  return `"${str.replace(/"/g, '""')}"`;
}

export function createCsv(items) {
  const rows = [CSV_HEADERS];
  for (const item of items || []) {
    rows.push([
      item.title || '',
      item.url || '',
      item.path || '',
      item.dateAdded ? new Date(item.dateAdded).toISOString() : '',
      JSON.stringify(Array.isArray(item.tags) ? item.tags : []),
      'apostrophe-v1'
    ]);
  }
  // RFC 4180 uses CRLF line endings. Most tools accept LF, but CRLF avoids
  // surprises when the file is opened in Excel on Windows.
  return rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
}

/** Excel and other spreadsheet applications detect UTF-8 only from a byte-order mark. */
export const CSV_BOM = '\ufeff';

/** Content of a downloadable CSV export: BOM + RFC 4180 rows (see createCsv). */
export function createCsvFile(items) {
  return CSV_BOM + createCsv(items);
}

/**
 * Parses an RFC 4180-style CSV string into an array of arrays of cells.
 *
 * Handles:
 *   - Quoted fields containing commas (e.g. `"a,b"`)
 *   - Embedded CRLF inside quoted fields (e.g. `"line1\nline2"`)
 *   - Escaped quotes inside quoted fields (e.g. `"He said ""hi"""`)
 *   - CR, LF, and CRLF row separators (any may be mixed)
 *   - Trailing blank line (silently dropped)
 *
 * Returns rows as raw string arrays — header mapping is the caller's job.
 * A state machine is used because regex cannot correctly handle embedded
 * newlines within quoted fields.
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;
  // A leading UTF-8 BOM (written by createCsvFile; kept by some readers) is not data.
  const input = String(text || '').replace(/^\ufeff/, '');

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          // Escaped quote: emit one " and skip the next char.
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    // Unquoted state
    if (ch === '"') {
      // A bare quote in unquoted context: per RFC 4180 it's malformed, but
      // be lenient — treat as the start of a quoted run only if the cell
      // is still empty (the common malformed case is `value"with"quote`
      // which we'd rather preserve literally).
      if (cell === '') {
        inQuotes = true;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\r' || ch === '\n') {
      row.push(cell);
      cell = '';
      rows.push(row);
      row = [];
      // Swallow the LF of a CRLF pair so we don't emit a phantom blank row.
      if (ch === '\r' && input[i + 1] === '\n') i++;
      continue;
    }
    cell += ch;
  }
  // Flush whatever remains. A trailing empty line (cell === '' && row.length === 0)
  // would be a spurious empty row, so guard against it.
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

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

function parseDateSafe(value) {
  if (!value) return 0;
  const ms = Date.parse(String(value));
  return Number.isFinite(ms) ? ms : 0;
}

export function parseImportedText(text, fileName = '') {
  const input = String(text || '');
  if (!input.trim()) return [];

  if (/\.json$/i.test(fileName)) {
    try {
      const parsed = JSON.parse(input);
      const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.bookmarks) ? parsed.bookmarks : [];
      return items
        .filter((item) => item && typeof item.url === 'string' && isSafeImportableUrl(item.url))
        .map((item, index) => ({
          title: String(item.title || item.name || item.url || `Imported ${index + 1}`).trim(),
          url: item.url.trim(),
          path: typeof item.path === 'string' ? item.path : '',
          dateAdded: Number.isFinite(Number(item.dateAdded)) ? Number(item.dateAdded) : 0,
          tags: Array.isArray(item.tags) ? item.tags : []
        }));
    } catch {
      // Malformed JSON — return empty so the caller can show a user-facing error.
      return [];
    }
  }

  if (/\.csv$/i.test(fileName)) {
    const rows = parseCsv(input);
    if (!rows.length) return [];

    // Header-row lookup: locate each known column by name (case-insensitive)
    // so column reordering or missing columns don't break the parse. Falls
    // back to positional [title, url] when no recognisable header is found.
    const header = rows[0].map((cell) => String(cell || '').trim().toLowerCase());
    const looksLikeHeader = header.includes('url') || header.includes('title');
    let titleIdx = 0;
    let urlIdx = 1;
    let pathIdx = -1;
    let dateIdx = -1;
    let tagsIdx = -1;
    let encodingIdx = -1;
    const dataRows = looksLikeHeader ? rows.slice(1) : rows;
    if (looksLikeHeader) {
      titleIdx = header.indexOf('title');
      urlIdx = header.indexOf('url');
      pathIdx = header.indexOf('folder path');
      dateIdx = header.indexOf('date added');
      tagsIdx = header.indexOf('tags');
      encodingIdx = header.indexOf('text encoding');
      if (titleIdx < 0) titleIdx = 0;
      if (urlIdx < 0) urlIdx = 1;
    }

    const decodedRows = dataRows.map(cells => cells[encodingIdx] === 'apostrophe-v1'
      ? cells.map(cell => cell.startsWith("'") ? cell.slice(1) : cell) : cells);
    const parseTags = value => { try { const tags = JSON.parse(value || '[]'); return Array.isArray(tags) ? tags : []; } catch { return []; } };
    return decodedRows
      .map((cells) => ({
        title: String(cells[titleIdx] || ''),
        url: String(cells[urlIdx] || '').trim(),
        path: pathIdx >= 0 ? String(cells[pathIdx] || '').trim() : '',
        dateAdded: dateIdx >= 0 ? parseDateSafe(cells[dateIdx]) : 0,
        tags: tagsIdx >= 0 ? parseTags(cells[tagsIdx]) : []
      }))
      .filter((item) => isSafeImportableUrl(item.url));
  }

  // Plain-text fallback: one URL per line.
  return input.split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => ({ title: `Imported ${index + 1}`, url: line }))
    .filter((item) => isSafeImportableUrl(item.url));
}

// ─── Test hooks ───────────────────────────────────────────────────────────────

export function parseImportedFilePreview(text,fileName='') {
  const items=parseImportedText(text,fileName);
  let sourceCount=0;const warnings=[];
  if(/\.json$/i.test(fileName)){
    try{const value=JSON.parse(text);const rows=Array.isArray(value)?value:Array.isArray(value?.bookmarks)?value.bookmarks:null;if(!rows)throw new Error('Expected a bookmark array.');sourceCount=rows.length;}catch(error){warnings.push({message:error.message});}
  }else if(/\.csv$/i.test(fileName)){
    const rows=parseCsv(String(text||''));const header=(rows[0]||[]).map(cell=>cell.trim().toLowerCase());sourceCount=Math.max(0,rows.length-(header.includes('title')||header.includes('url')?1:0));
  }else sourceCount=String(text||'').split(/\r?\n/).filter(line=>line.trim()).length;
  const excluded=Math.max(0,sourceCount-items.length);
  if(excluded)warnings.push({message:`Excluded ${excluded} invalid or non-http(s) records.`});
  return {items,warnings,excluded,sourceCount};
}

/** Exposed for unit tests of the CSV state machine. */
export const _internals = Object.freeze({
  parseCsv,
  escapeCsvCell
});
