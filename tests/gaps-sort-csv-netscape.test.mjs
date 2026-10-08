import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNetscapeHtml, looksLikeNetscapeBookmarks, detectImportFormat, parseImportedThirdPartyFile, parsePocketHtml, NETSCAPE_LIMITS } from '../src/services/third-party-import.js';
import { createCsv, createCsvFile, CSV_BOM, parseImportedText, parseImportedFilePreview, _internals } from '../src/dashboard/import-export-tools.js';
import { buildImportPreview, importBookmarks, loadImportJournal } from '../src/services/import-service.js';
import { validateSmartView, applySmartView } from '../src/services/smart-view-service.js';
import { loadDashboardPreferences } from '../src/services/preferences-service.js';
import { createGroupTools } from '../src/dashboard/group-tools.js';
import { createRenderTools } from '../src/dashboard/render-tools.js';
import { sortBookmarks } from '../src/bookmark-utils.js';
import { CLEANUP_FILTERS, DASHBOARD_MODE, GROUP_BY_OPTIONS, GROUP_SORT_OPTIONS, SORT_OPTIONS, DASHBOARD_STORAGE_KEYS } from '../src/constants.js';
import { FEATURE_MESSAGES } from '../src/locales/feature-messages.js';
import { fakeBrowser, folder } from './helpers/browser.mjs';
import { domFixture } from './helpers/dom.mjs';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CHROME = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1690000000" LAST_MODIFIED="1700000000" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://example.test/news?a=1&amp;b=2" ADD_DATE="1695000000" ICON="data:image/png;base64,iVBORw0KGgo=">News &amp; Weather</A>
        <DT><H3 ADD_DATE="1690000001" LAST_MODIFIED="1700000001">Dev</H3>
        <DL><p>
            <DT><A HREF="https://developer.mozilla.org/" ADD_DATE="1696000000">MDN</A>
            <DT><H3 ADD_DATE="1690000002">Deep</H3>
            <DL><p>
                <DT><A HREF="https://deep.test/" ADD_DATE="1697000000">Deep &quot;link&quot;</A>
            </DL><p>
        </DL><p>
        <DT><A HREF="javascript:alert(1)" ADD_DATE="1695000001">bookmarklet</A>
    </DL><p>
    <DT><H3 ADD_DATE="1690000003">Other bookmarks</H3>
    <DL><p>
        <DT><A HREF="https://other.test/" ADD_DATE="1698000000">Other</A>
    </DL><p>
</DL><p>
`;

const FIREFOX = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks Menu</H1>

<DL><p>
    <DT><H3 ADD_DATE="1600000000" LAST_MODIFIED="1600000100" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks Toolbar</H3>
    <DD>Add bookmarks to this folder to see them displayed on the Bookmarks Toolbar
    <DL><p>
        <DT><A HREF="https://tagged.test/" ADD_DATE="1600000200" LAST_MODIFIED="1600000300" ICON_URI="fake-favicon-uri:https://tagged.test/favicon.ico" ICON="data:image/png;base64,${'A'.repeat(200)}" TAGS="Reading List,work, two words ,">Tagged &#39;page&#39;</A>
        <DD>A description that is not a title
        <DT><A HREF="place:sort=8&amp;maxResults=10" ADD_DATE="1600000400">Recent</A>
    </DL><p>
    <DT><H3 ADD_DATE="1600000500">Bookmarks Menu</H3>
    <DL><p>
        <DT><A HREF="https://tagged.test/" ADD_DATE="1600000600" TAGS="dup">Tagged again</A>
    </DL><p>
</DL>
`;

// ─── Netscape parser ─────────────────────────────────────────────────────────

test('Chrome bookmarks.html: nested folders, entities, dates, unsafe URL excluded, auto-detected without file-name help', () => {
  assert.equal(detectImportFormat('whatever.txt', CHROME), 'netscape');
  const parsed = parseImportedThirdPartyFile('bookmarks_10_5_26.html', CHROME);
  assert.equal(parsed.format, 'netscape');
  assert.deepEqual(parsed.bookmarks.map(item => [item.title, item.url, item.path]), [
    ['News & Weather', 'https://example.test/news?a=1&b=2', 'Bookmarks bar'],
    ['MDN', 'https://developer.mozilla.org/', 'Bookmarks bar / Dev'],
    ['Deep "link"', 'https://deep.test/', 'Bookmarks bar / Dev / Deep'],
    ['Other', 'https://other.test/', 'Other bookmarks']
  ]);
  assert.equal(parsed.bookmarks[0].dateAdded, 1695000000000);
  assert.deepEqual(parsed.bookmarks[0].tags, []);
  assert.deepEqual(parsed.errors, [{ message: 'Skipped 1 non-http(s) URL for safety.' }]);
});

test('Firefox bookmarks.html: comma TAGS keep multi-word tags, ICON data and DD descriptions are ignored, place: URLs excluded', () => {
  const parsed = parseNetscapeHtml(FIREFOX);
  assert.equal(parsed.bookmarks.length, 2);
  assert.deepEqual(parsed.bookmarks[0], {
    title: "Tagged 'page'", url: 'https://tagged.test/', path: 'Bookmarks Toolbar', dateAdded: 1600000200000,
    tags: ['Reading List', 'work', 'two words']
  });
  assert.equal(parsed.bookmarks[1].path, 'Bookmarks Menu');
  assert.deepEqual(parsed.errors, [{ message: 'Skipped 1 non-http(s) URL for safety.' }]);
  // Tags go through the normal tag normalisation in the shared preview pipeline.
  assert.deepEqual(buildImportPreview(parsed.bookmarks, []).rows[0].tags, ['reading list', 'work', 'two words']);
});

test('multi-megabyte ICON data URIs are skipped without being copied or slowing parsing', () => {
  const legal = `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><H3>Icons</H3><DL><p>` +
    Array.from({ length: 1000 }, (_, i) => `<DT><A HREF="https://site${i}.test/" ICON="data:image/png;base64,${'QUJD'.repeat(2000)}">Site ${i}</A>`).join('\n') + '</DL></DL>';
  assert.ok(legal.length < NETSCAPE_LIMITS.maxInputChars);
  const started = performance.now();
  const parsed = parseNetscapeHtml(legal);
  assert.equal(parsed.bookmarks.length, 1000);
  assert.ok(performance.now() - started < 2000, 'tokenizer is linear in input size');
  assert.ok(parsed.bookmarks.every(item => item.url.length < 40 && item.title.startsWith('Site ')));
});

test('unclosed DT/P/A tags, unquoted attributes, stray angle brackets and missing closing DL are tolerated', () => {
  const html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
<DT><H3>Folder A
<DL><p>
<DT><A HREF=https://one.test/ ADD_DATE=1500000000>One
<DT><A HREF='https://two.test/'>Two <b>bold</b> and 3 < 4
<DD>note
<DT><A HREF="https://three.test/">Three</a>
</DL><p>
<DT><A HREF="https://four.test/">Four</A>
`;
  const parsed = parseNetscapeHtml(html);
  assert.deepEqual(parsed.bookmarks.map(item => [item.title, item.url, item.path]), [
    ['One', 'https://one.test/', 'Folder A'],
    ['Two bold and 3 < 4', 'https://two.test/', 'Folder A'],
    ['Three', 'https://three.test/', 'Folder A'],
    ['Four', 'https://four.test/', '']
  ]);
  assert.equal(parsed.bookmarks[0].dateAdded, 1500000000000);
});

test('unterminated quotes and truncated files never swallow the rest of the file or throw', () => {
  assert.doesNotThrow(() => parseNetscapeHtml('<DL><DT><A HREF="https://a.test/ ADD_DATE="1">A</A><DT><A HREF="https://b.test/">B</A>'));
  const parsed = parseNetscapeHtml('<DL><DT><A HREF="https://a.test/">A</A><DT><A HREF="https://b.te');
  assert.equal(parsed.bookmarks[0].url, 'https://a.test/');
  for (const truncated of ['<', '<A', '<A HREF', '<A HREF=', '<A HREF="', '<!--', '<!DOCTYPE', '<DL><DT><H3>', '</', '<DL><DT><A HREF="https://x.test/">x'])
    assert.doesNotThrow(() => parseNetscapeHtml(truncated), truncated);
});

for (const [encoded, decoded] of [
  ['A &amp; B', 'A & B'], ['say &quot;hi&quot;', 'say "hi"'], ['it&#39;s', "it's"], ['it&#x27;s', "it's"],
  ['&lt;b&gt;not bold&lt;/b&gt;', '<b>not bold</b>'], ['&#128512; smile', '\u{1F600} smile'], ['&amp;lt; once', '&lt; once'],
  ['&#99999999; bad', '� bad'], ['&unknown; kept', '&unknown; kept'], ['فارسی و 日本語', 'فارسی و 日本語']
]) test(`title entity ${encoded}`, () => {
  const parsed = parseNetscapeHtml(`<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><A HREF="https://e.test/">${encoded}</A></DL>`);
  assert.equal(parsed.bookmarks[0].title, decoded);
});

test('titles are text only: markup and script in titles or folder names is never interpreted', () => {
  const parsed = parseNetscapeHtml(`<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><H3>&lt;img src=x onerror=alert(1)&gt;</H3><DL>
    <DT><A HREF="https://e.test/"><script>alert(1)</script><img src=x onerror=alert(2)>Safe &lt;script&gt;</A></DL></DL>`);
  assert.equal(parsed.bookmarks.length, 1);
  assert.equal(parsed.bookmarks[0].path, '<img src=x onerror=alert(1)>');
  assert.ok(!parsed.bookmarks[0].title.includes('<img'));
  assert.equal(parsed.bookmarks[0].title, 'alert(1)Safe <script>'); // script body is plain text, entities decode once
});

test('unsafe schemes are excluded after decoding, whitespace tricks and case changes', () => {
  const urls = ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'ftp://x.test/', 'about:blank', 'chrome://settings',
    'javascript&#58;alert(1)', 'java&#9;script:alert(1)', ' javascript:alert(1)', 'vbscript:x', 'blob:https://x.test/id', 'place:folder=1'];
  const html = '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL>' + urls.map((url, i) => `<DT><A HREF="${url}">u${i}</A>`).join('') + '<DT><A HREF="https://ok.test/">ok</A></DL>';
  const parsed = parseNetscapeHtml(html);
  assert.deepEqual(parsed.bookmarks.map(item => item.url), ['https://ok.test/']);
  assert.equal(parsed.errors[0].message, `Skipped ${urls.length} non-http(s) URLs for safety.`);
});

test('empty, whitespace-only and non-bookmark input yield an empty result', () => {
  for (const value of ['', '   \n', null, undefined, '<html><body>hello</body></html>', '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p></DL>'])
    assert.deepEqual(parseNetscapeHtml(value), { bookmarks: [], errors: [] });
  assert.equal(detectImportFormat('empty.html', ''), null);
});

test('size caps: oversized input is refused; bookmark count and folder depth are bounded', () => {
  const huge = '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL>' + ' '.repeat(NETSCAPE_LIMITS.maxInputChars) + '<DT><A HREF="https://a.test/">A</A></DL>';
  const refused = parseNetscapeHtml(huge);
  assert.deepEqual(refused.bookmarks, []);
  assert.match(refused.errors[0].message, /too large/);

  const many = '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL>' + Array.from({ length: NETSCAPE_LIMITS.maxBookmarks + 5 }, (_, i) => `<DT><A HREF="https://h${i}.test/">${i}</A>`).join('') + '</DL>';
  const capped = parseNetscapeHtml(many);
  assert.equal(capped.bookmarks.length, NETSCAPE_LIMITS.maxBookmarks);
  assert.ok(capped.errors.some(error => /first 50,000/.test(error.message)));

  const depth = NETSCAPE_LIMITS.maxDepth + 50;
  let nested = '<!DOCTYPE NETSCAPE-Bookmark-file-1>';
  for (let i = 0; i < depth; i++) nested += `<DL><DT><H3>f${i}</H3>`;
  nested += '<DL><DT><A HREF="https://deep.test/">Deep</A></DL>' + '</DL>'.repeat(depth);
  nested += '<DL><DT><A HREF="https://after.test/">After</A></DL>';
  const deep = parseNetscapeHtml(nested);
  assert.equal(deep.bookmarks.length, 2);
  assert.ok(deep.errors.some(error => /deeper than 100 levels/.test(error.message)));
  assert.equal(deep.bookmarks[0].path.split(' / ').length, NETSCAPE_LIMITS.maxDepth - 1, 'the unnamed root list occupies one level');
  assert.equal(deep.bookmarks[1].path, '', 'overflow depth is balanced: later top-level bookmarks keep an empty path');

  // Pathologically unclosed lists must not recurse or grow the folder stack without bound.
  assert.doesNotThrow(() => parseNetscapeHtml('<!DOCTYPE NETSCAPE-Bookmark-file-1>' + '<DL><DT><H3>x</H3>'.repeat(200000) + '<DT><A HREF="https://x.test/">x</A>'));
});

test('date attributes: seconds, milliseconds, microseconds and junk', () => {
  const dates = ['1700000000', '1700000000000', '1700000000000000', '0', '-5', 'abc', ''];
  const html = '<!DOCTYPE NETSCAPE-Bookmark-file-1><DL>' + dates.map((d, i) => `<DT><A HREF="https://d${i}.test/" ADD_DATE="${d}">d</A>`).join('') + '</DL>';
  assert.deepEqual(parseNetscapeHtml(html).bookmarks.map(item => item.dateAdded), [1700000000000, 1700000000000, 1700000000000, 0, 0, 0, 0]);
});

test('detection: doctype (with BOM or leading whitespace) or structure; other formats unchanged', () => {
  assert.equal(looksLikeNetscapeBookmarks('\ufeff  \n<!doctype netscape-bookmark-file-1>'), true);
  assert.equal(looksLikeNetscapeBookmarks('<DL><DT><H3>F</H3><DL><DT><A HREF="https://a.test/">a</A></DL></DL>'), true);
  assert.equal(looksLikeNetscapeBookmarks('<html><body><a href="https://a.test/">a</a></body></html>'), false);
  assert.equal(detectImportFormat('ril_export.html', '<DL><DT><A href="x">'), 'pocket');
  assert.equal(detectImportFormat('pocket.html', '<html><ul><li><a href="https://a.test/">a</a></ul>'), 'pocket');
  assert.equal(detectImportFormat('p.json', '[{"href":"https://a.test/"}]'), null);
  assert.equal(detectImportFormat('raindrop.html', CHROME), 'netscape');
  const pocket = parsePocketHtml('<a href="https://a.test/" time_added="1" tags="x">A</a>');
  assert.equal(pocket.bookmarks.length, 1);
});

test('parseImportedThirdPartyFile feeds the shared preview: duplicates in the file are flagged, unsafe rows never enter it', () => {
  const parsed = parseImportedThirdPartyFile('bookmarks.html', FIREFOX);
  const preview = buildImportPreview(parsed.bookmarks, [{ id: 'x', url: 'https://tagged.test/', title: 'existing' }]);
  assert.equal(preview.rows.length, 2);
  assert.equal(preview.matches, 2);
  assert.equal(preview.repeated, 1);
  assert.equal(preview.excluded, 0);
  assert.equal(preview.rows[0].path, 'Bookmarks Toolbar');
});

// ─── Import pipeline with the Netscape parser (duplicate policies, journal) ──

async function runImport(policy, existing = []) {
  const browser = fakeBrowser([folder('P', existing)]);
  const items = parseNetscapeHtml(FIREFOX).bookmarks;
  const preview = buildImportPreview(items, []);
  const result = await importBookmarks(preview.rows, 'P', { policy });
  return { browser, result };
}

test('policy keep creates every supported record, flat in the destination, with normalised tags and a journal', async () => {
  const { browser, result } = await runImport('keep');
  assert.equal(result.created, 2);
  assert.deepEqual(browser.calls.creates.map(call => [call.parentId, call.title, call.url]), [
    ['P', "Tagged 'page'", 'https://tagged.test/'], ['P', 'Tagged again', 'https://tagged.test/']
  ]);
  assert.deepEqual(Object.values(browser.stored.tagsByBookmark), [['reading list', 'work', 'two words'], ['dup']]);
  const journal = await loadImportJournal();
  assert.equal(journal[result.operation.id].status, 'completed');
});

test('policy skip imports the first copy and skips the in-file duplicate', async () => {
  const { browser, result } = await runImport('skip');
  assert.equal(result.created, 1);
  assert.equal(result.skipped, 1);
  assert.equal(browser.calls.creates.length, 1);
});

test('policy merge adds the later duplicate tags to the item imported in this run', async () => {
  const { browser, result } = await runImport('merge');
  assert.equal(result.created, 1);
  assert.equal(result.merged, 1);
  assert.deepEqual(Object.values(browser.stored.tagsByBookmark), [['reading list', 'work', 'two words', 'dup']]);
});

test('imports exclude unsafe rows even when a crafted record bypasses the parser', async () => {
  const browser = fakeBrowser([folder('P')]);
  const result = await importBookmarks([{ title: 'x', url: 'javascript:alert(1)', tags: [] }, { title: 'y', url: 'https://y.test/', tags: [] }], 'P');
  assert.equal(result.created, 1);
  assert.equal(result.failed, 1);
  assert.equal(browser.calls.creates.length, 1);
});

// ─── CSV export ──────────────────────────────────────────────────────────────

const EXPORT_ITEMS = [
  { title: 'Plain', url: 'https://plain.test/a?x=1,2', path: 'Bookmarks bar / Work', dateAdded: 1700000000000, tags: ['work', 'two words'] },
  { title: '=HYPERLINK("http://evil.test","click")', url: 'https://f1.test/', path: '+SUM(1)', dateAdded: 0, tags: [] },
  { title: '-2+3', url: 'https://f2.test/', path: '@cmd', dateAdded: 0, tags: ['@tag'] },
  { title: '\tTabbed', url: 'https://f3.test/', path: '=path', dateAdded: 0, tags: [] },
  { title: '\rCarriage', url: 'https://f4.test/', path: '', dateAdded: 0, tags: [] },
  { title: 'He said "hi", twice\nline two', url: 'https://q.test/', path: 'a,b', dateAdded: 0, tags: ['a,b', 'he said "x"'] },
  { title: 'فارسی، 日本語 and emoji \u{1F600}', url: 'https://i18n.test/', path: 'پوشه / フォルダ', dateAdded: 1, tags: ['برچسب'] },
  { title: "'already quoted", url: 'https://apos.test/', path: '', dateAdded: 0, tags: [] }
];

test('CSV export file: UTF-8 BOM, header row, CRLF rows, every cell quoted', () => {
  const file = createCsvFile(EXPORT_ITEMS);
  assert.equal(file[0], CSV_BOM);
  assert.equal(CSV_BOM, '\ufeff');
  assert.equal(new TextEncoder().encode(file).slice(0, 3).join(','), '239,187,191');
  const body = file.slice(1);
  assert.equal(body, createCsv(EXPORT_ITEMS));
  assert.ok(body.startsWith('"Title","URL","Folder path","Date added","Tags","Text encoding"\r\n'));
  assert.ok(body.split('\r\n').every(line => line.startsWith('"')));
});

test('CSV export is formula-safe for = + - @ tab CR (and leading whitespace) in every text cell', () => {
  const rows = _internals.parseCsv(createCsvFile(EXPORT_ITEMS));
  const dangerous = /^[=+\-@\t\r]/;
  for (const row of rows.slice(1)) for (const cell of row) assert.ok(!dangerous.test(cell), `cell would be interpreted as a formula: ${JSON.stringify(cell)}`);
  assert.ok(rows[2][0].startsWith("'="));
  assert.ok(rows[3][0].startsWith("'-"));
  assert.ok(rows[3][2].startsWith("'@"));
  assert.ok(rows[4][0].startsWith("'\t"));
  assert.ok(rows[4][2].startsWith("'="));
  assert.ok(rows[5][0].startsWith("'\r"));
});

test('CSV export round-trips titles, URLs, folder, date and tags through the importer (with and without BOM)', () => {
  for (const content of [createCsvFile(EXPORT_ITEMS), createCsv(EXPORT_ITEMS)]) {
    const imported = parseImportedText(content, 'bookmark-manager-visible.csv');
    assert.equal(imported.length, EXPORT_ITEMS.length);
    imported.forEach((item, index) => assert.deepEqual(item, EXPORT_ITEMS[index]));
    const preview = parseImportedFilePreview(content, 'x.csv');
    assert.equal(preview.sourceCount, EXPORT_ITEMS.length);
    assert.equal(preview.excluded, 0);
  }
});

test('CSV export of an empty set is only the header; BOM-prefixed header is recognised by the importer', () => {
  assert.equal(createCsvFile([]).slice(1), '"Title","URL","Folder path","Date added","Tags","Text encoding"');
  assert.deepEqual(parseImportedText(createCsvFile([]), 'e.csv'), []);
  assert.equal(parseImportedText(CSV_BOM + 'Title,URL\nA,https://a.test/', 'a.csv')[0].title, 'A');
});

test('CSV export parity: dashboard exposes it as a menu item and a command-palette command with Persian copy', async () => {
  const fs = await import('node:fs');
  const dashboard = fs.readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
  assert.match(dashboard, /handleExport\('csv', 'visible'\)/);
  assert.match(dashboard, /exportCsv: \{ label:'Export visible as CSV'/);
  assert.match(dashboard, /createCsvFile\(items\)/);
  const tools = fs.readFileSync(new URL('../src/dashboard/feature-tools.js', import.meta.url), 'utf8');
  assert.match(tools, /'importPreview','exportCsv'/);
  assert.match(FEATURE_MESSAGES['Export visible as CSV'], /[؀-ۿ]/);
});

// ─── Dashboard sort control ──────────────────────────────────────────────────

const BOOKMARKS = [
  { id: '1', title: 'Banana', url: 'https://c.test/', path: 'Z', dateAdded: 300 },
  { id: '2', title: 'apple', url: 'https://b.test/', path: 'A', dateAdded: 100 },
  { id: '3', title: 'Cherry', url: 'https://a.test/', path: 'M', dateAdded: 200 }
];

test('sort values produce the documented orders through the shared sortBookmarks', () => {
  const order = value => sortBookmarks(BOOKMARKS, value).map(item => item.id).join('');
  assert.equal(order(SORT_OPTIONS.TITLE_ASC), '213');
  assert.equal(order(SORT_OPTIONS.URL_ASC), '321');
  assert.equal(order(SORT_OPTIONS.NEWEST), '132');
  assert.equal(order(SORT_OPTIONS.OLDEST), '231');
  assert.equal(order(SORT_OPTIONS.PATH_ASC), '231');
});

function groupToolsFixture() {
  const state = { sort: SORT_OPTIONS.TITLE_ASC, groupBy: GROUP_BY_OPTIONS.FLAT, groupSort: GROUP_SORT_OPTIONS.DEFAULT, collapsedGroupKeys: new Set() };
  const calls = [];
  const tools = createGroupTools({
    state, t: value => value, render: () => calls.push('render'), savePreferences: () => calls.push(`save:${state.sort}`),
    recalculateVisibleBookmarks: () => calls.push(`recalculate:${state.sort}`), formatNumber: String,
    getCleanupSummary: () => ({}), summarizeHealth: () => ({}), GROUP_BY_OPTIONS, GROUP_SORT_OPTIONS, SORT_OPTIONS
  });
  return { state, calls, tools };
}

for (const value of Object.values(SORT_OPTIONS)) test(`updateSort(${value}) applies, recomputes the list, persists and renders in that order`, () => {
  const { state, calls, tools } = groupToolsFixture();
  tools.updateSort(value);
  assert.equal(state.sort, value);
  assert.deepEqual(calls, [`recalculate:${value}`, `save:${value}`, 'render']);
});

test('updateSort rejects unknown values with the default and does not touch group ordering', () => {
  const { state, tools } = groupToolsFixture();
  state.groupSort = GROUP_SORT_OPTIONS.SIZE_DESC;
  tools.updateSort('bogus');
  assert.equal(state.sort, SORT_OPTIONS.TITLE_ASC);
  assert.equal(state.groupSort, GROUP_SORT_OPTIONS.SIZE_DESC);
});

test('stored dashboard sort is validated on load; saved views keep carrying and restoring sort', async () => {
  for (const [stored, expected] of [[SORT_OPTIONS.NEWEST, SORT_OPTIONS.NEWEST], [SORT_OPTIONS.PATH_ASC, SORT_OPTIONS.PATH_ASC], ['junk', SORT_OPTIONS.TITLE_ASC], [undefined, SORT_OPTIONS.TITLE_ASC]]) {
    fakeBrowser([], stored === undefined ? {} : { [DASHBOARD_STORAGE_KEYS.SORT]: stored });
    assert.equal((await loadDashboardPreferences()).sort, expected);
  }
  for (const sort of Object.values(SORT_OPTIONS)) {
    const view = validateSmartView({ name: 'v', query: 'q', sort, cleanupFilter: CLEANUP_FILTERS.ALL, groupBy: GROUP_BY_OPTIONS.FLAT, groupSort: GROUP_SORT_OPTIONS.DEFAULT, activeTagFilter: [] });
    const state = { selectedIds: new Set(), sort: SORT_OPTIONS.TITLE_ASC };
    applySmartView(view, state);
    assert.equal(state.sort, sort);
    assert.equal(state.mode, DASHBOARD_MODE);
  }
});

test('dashboard toolbar renders a labelled sort select next to the grouping select, selected value reflects state, change calls updateSort', async () => {
  const dom = domFixture();
  try {
    const updates = [];
    const state = { query: '', groupBy: GROUP_BY_OPTIONS.FLAT, groupSort: GROUP_SORT_OPTIONS.DEFAULT, sort: SORT_OPTIONS.NEWEST, cleanupFilter: CLEANUP_FILTERS.ALL };
    const deps = new Proxy({ state, t: value => value, create: dom.create, debounce: fn => fn, updateSort: value => updates.push(value), searchInputRefAccessor: { set() {} }, getCleanupCount: () => 0 }, {
      get: (target, key) => key in target ? target[key] : () => ''
    });
    const { renderToolbar } = createRenderTools(deps);
    const root = dom.create('div');
    renderToolbar(root);
    const strip = root.querySelector('.dashboard-control-strip');
    const wraps = strip.children.map(child => child.className);
    assert.deepEqual(wraps.slice(0, 3), ['search-input dashboard-search-input', 'dashboard-groupby-wrap', 'dashboard-groupby-wrap dashboard-sort-wrap']);
    const select = root.querySelector('.dashboard-sort-select');
    assert.equal(select.getAttribute('aria-label'), 'Sort visible bookmarks');
    assert.deepEqual(select.children.map(option => option.value), Object.values(SORT_OPTIONS));
    assert.deepEqual(select.children.map(option => option.textContent), ['Title', 'URL', 'Newest', 'Oldest', 'Folder path']);
    assert.equal(select.children.find(option => option.selected).value, SORT_OPTIONS.NEWEST);
    await select.emit('change', { target: { value: SORT_OPTIONS.OLDEST } });
    assert.deepEqual(updates, [SORT_OPTIONS.OLDEST]);
    // Group ordering keeps its own control when grouping is on.
    state.groupBy = GROUP_BY_OPTIONS.DOMAIN;
    const grouped = dom.create('div');
    renderToolbar(grouped);
    assert.ok(grouped.querySelector('.dashboard-groupsort-select'));
    assert.ok(grouped.querySelector('.dashboard-sort-select'));
  } finally { dom.restore(); }
});
