// Disposable Chromium profile only; synthetic bookmarks only. Verifies the
// dashboard sort control, CSV export and Netscape bookmarks.html import in a real
// browser. Run it through: node tests/browser/run.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { loadChromium, launchOptions } from './common.mjs';

const chromium = await loadChromium();
if (!chromium) { console.error('Playwright is not installed.'); process.exit(2); }
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bookmark-scope-gaps-'));
const results = { recordedAt: new Date().toISOString(), browser: '', checks: [], errors: [] };
const pass = (name, extra = {}) => { console.error('PASS: ' + name); results.checks.push({ name, passed: true, ...extra }); };

const CHROME_HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1690000000" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://chrome-one.test/a?x=1&amp;y=2" ADD_DATE="1695000000" ICON="data:image/png;base64,iVBORw0KGgo=">Chrome One &amp; Co</A>
        <DT><H3 ADD_DATE="1690000001">Dev</H3>
        <DL><p>
            <DT><A HREF="https://chrome-two.test/" ADD_DATE="1696000000">Chrome Two</A>
            <DT><A HREF="javascript:alert(1)">Bookmarklet</A>
        </DL><p>
    </DL><p>
    <DT><H3 ADD_DATE="1690000003">Other bookmarks</H3>
    <DL><p>
        <DT><A HREF="https://chrome-three.test/" ADD_DATE="1698000000">Chrome Three</A>
    </DL><p>
</DL><p>
`;
const FIREFOX_HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks Menu</H1>
<DL><p>
    <DT><H3 ADD_DATE="1600000000" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks Toolbar</H3>
    <DL><p>
        <DT><A HREF="https://ff-one.test/" ADD_DATE="1600000200" ICON_URI="fake-favicon-uri:https://ff-one.test/favicon.ico" ICON="data:image/png;base64,${'QUJD'.repeat(50000)}" TAGS="Reading List,work">Firefox One</A>
        <DT><A HREF="place:sort=8&amp;maxResults=10">Recent</A>
        <DT><A HREF="https://chrome-one.test/a?x=1&amp;y=2" TAGS="dup-tag">Same URL as Chrome One</A>
    </DL><p>
</DL>
`;
fs.writeFileSync(path.join(profile, 'chrome-bookmarks.html'), CHROME_HTML);
fs.writeFileSync(path.join(profile, 'firefox-bookmarks.html'), FIREFOX_HTML);

let context;
try {
  context = await chromium.launchPersistentContext(profile, launchOptions({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }));
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 30000 });
  results.browser = context.browser()?.version() || 'Chromium';
  const origin = `chrome-extension://${worker.url().split('/')[2]}/`;
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => results.errors.push(error.message));
  // Extension APIs are driven from an extension page (the worker handle is not used for chrome.bookmarks).
  const ext = (fn, arg) => page.evaluate(fn, arg);
  const reload = async () => { await page.goto(origin + 'pages/dashboard/dashboard.html'); await page.waitForSelector('[data-library-tools]'); };

  await page.goto(origin + 'pages/dashboard/dashboard.html');
  // Synthetic fixture: creation order gives Banana < apple < Cherry by date.
  await ext(async () => {
    const tree = await chrome.bookmarks.getTree();
    const base = tree[0].children.find(node => !node.unmodifiable);
    const parent = await chrome.bookmarks.create({ parentId: base.id, title: 'GapsFixture' });
    for (const [title, url] of [['Banana', 'https://gaps-c.test/'], ['apple', 'https://gaps-b.test/'], ['Cherry', 'https://gaps-a.test/']]) {
      await chrome.bookmarks.create({ parentId: parent.id, title, url });
      await new Promise(resolve => setTimeout(resolve, 15));
    }
  });
  await reload();
  const search = page.locator('.dashboard-search-input');
  await search.fill('gaps-');
  const order = async () => page.locator('.item-title').allTextContents().then(list => list.map(text => text.trim()));
  await page.waitForFunction(() => document.querySelectorAll('.item-title').length === 3);

  // (a) sort control
  const sortSelect = page.getByRole('combobox', { name: 'Sort visible bookmarks' });
  assert.equal(await sortSelect.count(), 1);
  assert.deepEqual(await order(), ['apple', 'Banana', 'Cherry']);
  const labels = await sortSelect.locator('option').allTextContents();
  assert.deepEqual(labels, ['Title', 'URL', 'Newest', 'Oldest', 'Folder path']);
  const layout = await page.evaluate(() => {
    const group = document.querySelector('.dashboard-groupby-select').getBoundingClientRect();
    const sort = document.querySelector('.dashboard-sort-select').getBoundingClientRect();
    return { sameRow: Math.abs(group.top - sort.top) < 2, sameHeight: group.height === sort.height, sameWidth: group.width === sort.width };
  });
  assert.deepEqual(layout, { sameRow: true, sameHeight: true, sameWidth: true });
  for (const [value, expected] of [['url-asc', ['Cherry', 'apple', 'Banana']], ['newest', ['Cherry', 'apple', 'Banana']], ['oldest', ['Banana', 'apple', 'Cherry']], ['title-asc', ['apple', 'Banana', 'Cherry']]]) {
    await sortSelect.selectOption(value);
    await page.waitForFunction(first => document.querySelector('.item-title')?.textContent.trim() === first, expected[0]);
    assert.deepEqual(await order(), expected, value);
  }
  await sortSelect.selectOption('oldest');
  await page.waitForFunction(() => document.querySelector('.item-title')?.textContent.trim() === 'Banana');
  const storedSort = await ext(async () => Object.entries(await chrome.storage.local.get(null)).filter(([key]) => /sort/i.test(key)));
  assert.ok(storedSort.some(([, value]) => value === 'oldest'), JSON.stringify(storedSort));
  await reload();
  await page.locator('.dashboard-search-input').fill('gaps-');
  await page.waitForFunction(() => document.querySelectorAll('.item-title').length === 3);
  assert.equal(await page.getByRole('combobox', { name: 'Sort visible bookmarks' }).inputValue(), 'oldest');
  assert.deepEqual(await order(), ['Banana', 'apple', 'Cherry']);
  pass('Sort: dashboard sort control reorders (title/URL/newest/oldest) and persists across reload', { storedSort });

  // keyboard: Tab/focus the select and change it with the arrow keys (native select behaviour)
  const keyboardSort = page.getByRole('combobox', { name: 'Sort visible bookmarks' });
  await keyboardSort.focus();
  await page.keyboard.press('ArrowUp'); // oldest -> newest
  await page.waitForFunction(() => document.querySelector('.item-title')?.textContent.trim() === 'Cherry');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Sort visible bookmarks');
  await page.keyboard.press('ArrowDown'); // back to oldest, focus still on the control
  await page.waitForFunction(() => document.querySelector('.item-title')?.textContent.trim() === 'Banana');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Sort visible bookmarks');
  pass('Sort: sort select is operable by keyboard (arrow keys) and keeps focus after the list re-renders');

  // saved view carries sort
  await sortSelect.selectOption('newest');
  await page.waitForFunction(() => document.querySelector('.item-title')?.textContent.trim() === 'Cherry');
  await page.locator('[data-library-tools]').click();
  await page.locator('[data-feature-action="Saved views"]').click();
  await page.getByRole('textbox', { name: 'View name', exact: true }).fill('Sorted newest');
  await page.locator('[data-feature-action="Save view"]').click();
  let views = [];
  for (let attempt = 0; attempt < 100 && !views.some(view => view.name === 'Sorted newest'); attempt++) {
    views = await ext(async () => (await chrome.storage.local.get('smartViews')).smartViews || []);
    if (!views.length) await page.waitForTimeout(50); // observe state; never repeat the action
  }
  assert.equal(views.find(view => view.name === 'Sorted newest')?.sort, 'newest', JSON.stringify(views));
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('combobox', { name: 'Sort visible bookmarks' }).selectOption('url-asc');
  await page.waitForFunction(() => document.querySelector('.item-title')?.textContent.trim() === 'Cherry');
  await page.locator('[data-library-tools]').click();
  await page.locator('[data-feature-action="Saved views"]').click();
  await page.locator('.feature-field select').selectOption(views.find(view => view.name === 'Sorted newest').id);
  await page.locator('[data-feature-action="Open view"]').click();
  await page.waitForSelector('.feature-overlay', { state: 'detached' });
  assert.equal(await page.getByRole('combobox', { name: 'Sort visible bookmarks' }).inputValue(), 'newest');
  pass('Sort: saved view stores and re-applies the dashboard sort');

  // (b) CSV export
  await page.locator('.dashboard-search-input').fill('gaps-');
  await page.waitForFunction(() => document.querySelectorAll('.item-title').length === 3);
  await page.locator('.dashboard-list-menu-button').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByText('Export visible as CSV', { exact: true }).click()]);
  assert.match(download.suggestedFilename(), /^bookmark-manager-visible-.*\.csv$/);
  const csvPath = path.join(profile, 'exported.csv');
  await download.saveAs(csvPath);
  const bytes = fs.readFileSync(csvPath);
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 BOM');
  const csvText = bytes.toString('utf8').slice(1);
  assert.ok(csvText.startsWith('"Title","URL","Folder path","Date added","Tags","Text encoding"\r\n'));
  assert.equal(csvText.split('\r\n').length, 4);
  for (const title of ['Banana', 'apple', 'Cherry']) assert.ok(csvText.includes(`"${title}"`));
  assert.ok(csvText.includes('/ GapsFixture"'));
  // Visible-set semantics: filter to one bookmark and export again.
  await page.locator('.dashboard-search-input').fill('gaps-a');
  await page.waitForFunction(() => document.querySelectorAll('.item-title').length === 1);
  await page.locator('.dashboard-list-menu-button').click();
  const [download2] = await Promise.all([page.waitForEvent('download'), page.getByText('Export visible as CSV', { exact: true }).click()]);
  const csv2 = fs.readFileSync(await download2.path(), 'utf8');
  assert.equal(csv2.slice(1).split('\r\n').length, 2);
  assert.ok(csv2.includes('Cherry') && !csv2.includes('Banana'));
  pass('CSV export: Export visible as CSV downloads a BOM-prefixed RFC 4180 file of exactly the visible set', { filename: download.suggestedFilename(), bytes: bytes.length });

  // palette entry
  await page.keyboard.press('Control+Shift+P');
  await page.getByRole('dialog').locator('input').first().fill('csv');
  const [download3] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  assert.match(download3.suggestedFilename(), /\.csv$/);
  pass('CSV export: command palette "Export visible as CSV" runs the same export');

  // Re-import the exported CSV (policy keep) and compare titles/urls/folder
  await ext(async () => {
    const [match] = await chrome.bookmarks.search({ title: 'GapsFixture' });
    await chrome.bookmarks.removeTree(match.id);
  });
  await reload();
  let chooser = page.waitForEvent('filechooser');
  await page.locator('[data-library-tools]').click();
  await page.locator('[data-feature-action="Import bookmarks…"]').click();
  await (await chooser).setFiles(csvPath);
  await page.waitForSelector('[data-feature-action="Import bookmarks"]');
  const csvPreview = await page.locator('.feature-dialog').textContent();
  assert.ok(csvPreview.includes('Supported bookmarks in this file: 3'), csvPreview.slice(0, 400));
  assert.ok(csvPreview.includes('GapsFixture'));
  await page.locator('[data-feature-action="Import bookmarks"]').click();
  await page.waitForFunction(() => /Created \/ merged \/ skipped \/ failed \/ remaining: 3 \/ 0 \/ 0 \/ 0 \/ 0/.test(document.querySelector('.feature-status')?.textContent || ''));
  const reimported = await ext(async () => (await chrome.bookmarks.search({ url: 'https://gaps-a.test/' })).map(node => node.title));
  assert.deepEqual(reimported, ['Cherry']);
  pass('CSV export: exported CSV re-imports through the preview/journal pipeline (3 created)');
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  // (c) Netscape imports
  const importFile = async (file, policy) => {
    await reload();
    const fileChooser = page.waitForEvent('filechooser');
    await page.locator('[data-library-tools]').click();
    await page.locator('[data-feature-action="Import bookmarks…"]').click();
    await (await fileChooser).setFiles(file);
    await page.waitForSelector('[data-feature-action="Import bookmarks"]');
    if (policy) await page.getByLabel('Duplicate policy', { exact: true }).selectOption(policy);
  };
  const status = pattern => page.waitForFunction(pattern => new RegExp(pattern).test(document.querySelector('.feature-status')?.textContent || ''), pattern);

  await importFile(path.join(profile, 'chrome-bookmarks.html'), 'keep');
  const dialog = await page.locator('.feature-dialog').textContent();
  assert.ok(dialog.includes('Supported bookmarks in this file: 3'), dialog.slice(0, 500));
  assert.ok(dialog.includes('Skipped 1 non-http(s) URL for safety.'));
  assert.ok(dialog.includes('Bookmarks bar / Dev') && dialog.includes('Other bookmarks'));
  assert.ok(dialog.includes('Chrome One & Co'));
  await page.locator('[data-feature-action="Import bookmarks"]').click();
  await status('Created / merged / skipped / failed / remaining: 3 / 0 / 0 / 0 / 0');
  const chromeNodes = await ext(async () => {
    const out = {};
    for (const host of ['chrome-one', 'chrome-two', 'chrome-three']) out[host] = (await chrome.bookmarks.search({ url: `https://${host}.test/` + (host === 'chrome-one' ? 'a?x=1&y=2' : '') })).map(node => node.title);
    out.bookmarklets = (await chrome.bookmarks.search({ title: 'Bookmarklet' })).length;
    return out;
  });
  assert.deepEqual(chromeNodes, { 'chrome-one': ['Chrome One & Co'], 'chrome-two': ['Chrome Two'], 'chrome-three': ['Chrome Three'], bookmarklets: 0 });
  pass('Netscape import: Chrome-style bookmarks.html: nested/Other folders previewed, unsafe URL excluded, 3 created flat', chromeNodes);
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await importFile(path.join(profile, 'firefox-bookmarks.html'), 'skip');
  const ffDialog = await page.locator('.feature-dialog').textContent();
  assert.ok(ffDialog.includes('Supported bookmarks in this file: 2'), ffDialog.slice(0, 500));
  assert.ok(ffDialog.includes('Matches / repeated / excluded: 1 / 0 / 0'), ffDialog.slice(0, 600));
  assert.ok(ffDialog.includes('Tags: reading list, work'));
  await page.locator('[data-feature-action="Import bookmarks"]').click();
  await status('Created / merged / skipped / failed / remaining: 1 / 0 / 1 / 0 / 0');
  const ffTags = await ext(async () => {
    const [node] = await chrome.bookmarks.search({ url: 'https://ff-one.test/' });
    const tags = (await chrome.storage.local.get('tagsByBookmark')).tagsByBookmark || {};
    return { title: node.title, tags: tags[node.id] };
  });
  assert.deepEqual(ffTags, { title: 'Firefox One', tags: ['reading list', 'work'] });
  pass('Netscape import: Firefox-style bookmarks.html (200 KB ICON data URI, TAGS, place: URL): policy skip creates 1, skips the existing match, tags normalized');
  await page.getByRole('button', { name: 'Close', exact: true }).click();

  await importFile(path.join(profile, 'firefox-bookmarks.html'), 'merge');
  await page.locator('[data-feature-action="Import bookmarks"]').click();
  await status('Created / merged / skipped / failed / remaining: 0 / 2 / 0 / 0 / 0');
  const merged = await ext(async () => {
    const [node] = await chrome.bookmarks.search({ url: 'https://chrome-one.test/a?x=1&y=2' });
    return (await chrome.storage.local.get('tagsByBookmark')).tagsByBookmark[node.id];
  });
  assert.deepEqual(merged, ['dup-tag']);
  pass('Netscape import: policy merge adds file tags to the existing bookmark without creating copies');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  const journal = await ext(async () => Object.values((await chrome.storage.local.get('importJournal')).importJournal || {}).map(item => item.status));
  assert.ok(journal.length >= 4 && journal.every(item => item === 'completed'), JSON.stringify(journal));
  pass('Netscape import: import journal records every operation as completed', { journal });

  assert.deepEqual(results.errors, []);
  results.passed = true;
} catch (error) {
  if (process.env.GAPS_SCREENSHOT) await context?.pages().at(-1)?.screenshot({ path: process.env.GAPS_SCREENSHOT }).catch(() => {});
  results.passed = false; results.failure = error.stack || String(error);
  console.error(results.failure);
  process.exitCode = 1;
} finally {
  await context?.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
console.log(JSON.stringify(results, null, 2));
