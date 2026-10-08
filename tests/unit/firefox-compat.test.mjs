// Firefox-shaped bookmark trees and API behavior (controlled tests with a fake browser; real Firefox is covered by tools/firefox-acceptance.mjs).
// Firefox facts used here were observed in Firefox 157: the invisible root is 'root________' with the fixed children
// menu________, toolbar_____, unfiled_____, mobile______; nothing carries `unmodifiable`; separators are nodes of type
// 'separator' whose url is "data:"; onRemoved reports a folder without `children`; bookmarks.onImportEnded does not exist.
import test from 'node:test';
import assert from 'node:assert/strict';
import { setChromeApiForTesting, addBookmarkEventListeners, getBookmarksManagerUrl, getExtensionsManagerUrl, detectBrowser, _resetBrowserDetectionForTesting } from '../../extension/src/platform/browser-api.js';
import { getDefaultImportParentId, getNormalizedBookmarks, invalidateBookmarkCache } from '../../extension/src/core/bookmark-utils.js';
import { flattenLiveTree, writableFolders } from '../../extension/src/services/maintenance-preview-service.js';
import { createSnapshot, restoreSnapshot } from '../../extension/src/services/snapshot-service.js';
import { removeTagsForBookmark, setTagsForBookmark, updateTagsMap, loadTagsMap } from '../../extension/src/services/tag-service.js';
import { createInspectTools } from '../../extension/src/dashboard/inspect-tools.js';
import { computeDropDestination } from '../../extension/src/dashboard/drag-drop-logic.js';
import { fakeBrowser } from '../helpers/browser.mjs';

const mark = (node, extra = {}) => ({ dateAdded: 1, ...node, ...extra });
const bookmark = (id, title, url = `https://${id}.test/`) => mark({ id, title, url, type: 'bookmark' });
const folder = (id, title, children = []) => mark({ id, title, type: 'folder', children });
const separator = id => mark({ id, title: '', type: 'separator', url: 'data:' });

function firefoxTree() {
  return [folder('root________', '', [
    folder('menu________', 'Bookmarks Menu', [folder('F1', 'Mozilla Firefox', [bookmark('B1', 'Get Help')]), separator('SEP1')]),
    folder('toolbar_____', 'Bookmarks Toolbar', [bookmark('B2', 'Toolbar link')]),
    folder('unfiled_____', 'Other Bookmarks', [folder('F2', 'Mine', [bookmark('B3', 'Mine one'), separator('SEP2')])]),
    folder('mobile______', 'Mobile Bookmarks')
  ])];
}
function chromeTree() {
  return [folder('0', '', [
    folder('1', 'Bookmarks bar', [bookmark('C1', 'Bar one')]),
    folder('2', 'Other bookmarks', [folder('C2', 'Mine', [bookmark('C3', 'Mine one')])]),
    folder('9', 'Managed bookmarks', [folder('M1', 'Admin folder', [bookmark('M2', 'Admin link')])])
  ])].map(root => { root.children[2].unmodifiable = 'managed'; return root; });
}
function treeApi(tree, extra = {}) {
  const listeners = {};
  const event = name => ({ addListener(fn) { (listeners[name] ||= []).push(fn); }, removeListener() {} });
  const api = {
    bookmarks: { async getTree() { return structuredClone(tree); }, onCreated: event('created'), onRemoved: event('removed'), onChanged: event('changed'), onMoved: event('moved') },
    runtime: { getURL: path => 'moz-extension://11111111-2222-3333-4444-555555555555/' + path, getManifest: () => ({ version: '5.0.0' }) },
    ...extra
  };
  setChromeApiForTesting(api); invalidateBookmarkCache(); _resetBrowserDetectionForTesting();
  return { api, listeners };
}
test.afterEach(() => { setChromeApiForTesting(null); _resetBrowserDetectionForTesting(); invalidateBookmarkCache(); });

test('Firefox tree: restore destinations include the four fixed roots and exclude the invisible root', async () => {
  treeApi(firefoxTree());
  const ids = (await writableFolders()).map(item => item.id);
  assert.ok(!ids.includes('root________'), 'the invisible root cannot hold bookmarks (bookmarks.create fails with "The bookmark root cannot be modified")');
  for (const id of ['menu________', 'toolbar_____', 'unfiled_____', 'mobile______', 'F1', 'F2']) assert.ok(ids.includes(id), id);
  assert.equal(JSON.stringify(firefoxTree()).includes('unmodifiable'), false);
});

test('Chromium tree behaves as before: root and managed (unmodifiable) folders are not destinations', async () => {
  treeApi(chromeTree());
  const ids = (await writableFolders()).map(item => item.id);
  assert.deepEqual(ids.sort(), ['1', '2', 'C2']);
  const flat = flattenLiveTree(chromeTree());
  assert.equal(flat.find(node => node.id === '0').isRoot, true);
  assert.equal(flat.find(node => node.id === 'M2').managed, true);
  assert.equal(flat.filter(node => node.isRoot).length, 1);
});

test('flattenLiveTree marks only the top-level node as the root', () => {
  const flat = flattenLiveTree(firefoxTree());
  assert.deepEqual(flat.filter(node => node.isRoot).map(node => node.id), ['root________']);
});

test('default import parent is Other Bookmarks in Firefox and Chromium', async () => {
  treeApi(firefoxTree());
  assert.equal(await getDefaultImportParentId(), 'unfiled_____');
  treeApi(chromeTree());
  assert.equal(await getDefaultImportParentId(), '2');
  // Titles are localized in the browser UI language; the fixed ids must be enough.
  const german = firefoxTree();
  german[0].children[0].title = 'Lesezeichen-Menü'; german[0].children[1].title = 'Lesezeichen-Symbolleiste'; german[0].children[2].title = 'Weitere Lesezeichen';
  treeApi(german);
  assert.equal(await getDefaultImportParentId(), 'unfiled_____');
  german[0].children = german[0].children.filter(node => node.id !== 'unfiled_____');
  treeApi(german);
  assert.equal(await getDefaultImportParentId(), 'toolbar_____', 'toolbar id recognized when Other Bookmarks is missing');
  const noMatch = firefoxTree(); noMatch[0].children = noMatch[0].children.filter(node => node.id === 'mobile______'); noMatch[0].children[0].title = 'Mobil';
  treeApi(noMatch);
  assert.equal(await getDefaultImportParentId(), 'mobile______', 'falls back to the first root');
});

test('separators (type "separator", url "data:") are not bookmarks', async () => {
  treeApi(firefoxTree());
  const all = await getNormalizedBookmarks();
  assert.deepEqual(all.map(item => item.id).sort(), ['B1', 'B2', 'B3']);
  assert.ok(all.every(item => item.url !== 'data:'));
});

test('snapshot omits separators and keeps the four fixed roots', async () => {
  treeApi(firefoxTree(), { storage: { local: { async get() { return {}; }, async set() {} }, onChanged: { addListener() {} } } });
  const snapshot = await createSnapshot();
  assert.deepEqual(snapshot.roots.map(root => root.sourceId), ['menu________', 'toolbar_____', 'unfiled_____', 'mobile______']);
  assert.equal(JSON.stringify(snapshot).includes('"data:"'), false);
  const menu = snapshot.roots[0];
  assert.deepEqual(menu.children.map(node => node.sourceId), ['F1']);
  assert.deepEqual(snapshot.roots[2].children[0].children.map(node => node.sourceId), ['B3']);
});

test('snapshot restore: Firefox root is refused, a fixed root accepts the container folder', async () => {
  const f = fakeBrowser([]);
  // Re-shape the shared fake into a Firefox tree: root id and fixed children.
  f.root.id = 'root________';
  f.root.children = [{ id: 'toolbar_____', title: 'Bookmarks Toolbar', children: [] }, { id: 'unfiled_____', title: 'Other Bookmarks', children: [] }];
  f.stored.storageSchemaVersion = 7;
  const snapshot = { format: 'bookmark-scope-snapshot', version: 1, createdAt: '2026-10-08T00:00:00.000Z', extensionVersion: '5.0.0', roots: [{ sourceId: 'unfiled_____', type: 'folder', title: 'Other Bookmarks', dateAdded: 1, children: [{ sourceId: 'B3', type: 'bookmark', title: 'Mine one', url: 'https://b3.test/', dateAdded: 1, tags: [] }] }] };
  await assert.rejects(() => restoreSnapshot(snapshot, 'root________'), /Destination is unavailable or managed/);
  assert.deepEqual(f.calls.creates, []);
  const result = await restoreSnapshot(snapshot, 'toolbar_____');
  assert.equal(result.operation.status, 'completed');
  assert.equal(f.calls.creates[0].parentId, 'toolbar_____');
  assert.equal(f.calls.creates.length, 3);
});

test('addBookmarkEventListeners tolerates a browser without bookmarks.onImportEnded (Firefox)', () => {
  const { listeners } = treeApi(firefoxTree());
  const seen = [];
  addBookmarkEventListeners({ created: () => seen.push('c'), removed: () => seen.push('r'), changed: () => {}, moved: () => {}, importEnded: () => seen.push('i') });
  assert.deepEqual(Object.keys(listeners).sort(), ['changed', 'created', 'moved', 'removed']);
});

test('addBookmarkEventListeners still registers onImportEnded where it exists (Chromium)', () => {
  const { api, listeners } = treeApi(chromeTree());
  const added = [];
  api.bookmarks.onImportEnded = { addListener: fn => added.push(fn) };
  addBookmarkEventListeners({ importEnded: () => {} });
  assert.equal(added.length, 1);
  assert.equal(listeners.created, undefined);
});

test('browser-internal page URLs: Firefox has none an extension may open, Chromium has chrome:// pages', () => {
  treeApi([], {});
  assert.equal(detectBrowser(), 'firefox');
  assert.equal(getBookmarksManagerUrl(), null);
  assert.equal(getBookmarksManagerUrl('unfiled_____'), null);
  assert.equal(getExtensionsManagerUrl(), null);
  setChromeApiForTesting({ runtime: { getURL: path => 'chrome-extension://abc/' + path } }); _resetBrowserDetectionForTesting();
  assert.equal(getBookmarksManagerUrl(), 'chrome://bookmarks/');
  assert.equal(getBookmarksManagerUrl('a b'), 'chrome://bookmarks/?id=a%20b');
  assert.equal(getExtensionsManagerUrl(), 'chrome://extensions/');
});

test('tag purge after a Firefox folder removal: updateTagsMap drops descendants the event does not report', async () => {
  const tree = firefoxTree();
  const f = fakeBrowser([]);
  f.root.id = 'root________';
  f.root.children = [{ id: 'unfiled_____', title: 'Other Bookmarks', children: [{ id: 'F2', title: 'Mine', children: [{ id: 'B3', title: 'Mine one', url: 'https://b3.test/' }, { id: 'B4', title: 'Other', url: 'https://b4.test/' }] }, { id: 'KEEP', title: 'Keep', url: 'https://keep.test/' }] }];
  f.stored.storageSchemaVersion = 7;
  await updateTagsMap(map => setTagsForBookmark(setTagsForBookmark(setTagsForBookmark(map, 'B3', ['a']), 'B4', ['b']), 'KEEP', ['k']));
  assert.deepEqual(Object.keys(await loadTagsMap()).sort(), ['B3', 'B4', 'KEEP']);
  // Firefox: removing folder F2 reports onRemoved only for F2 (no children, no per-descendant events).
  f.find('unfiled_____').children.splice(0, 1);
  const removeInfo = { parentId: 'unfiled_____', index: 0, node: { id: 'F2', parentId: 'unfiled_____', index: 0, type: 'folder', title: 'Mine' } };
  assert.equal(removeInfo.node.children, undefined);
  await updateTagsMap(map => removeTagsForBookmark(map, removeInfo.node.id).map);
  assert.deepEqual(Object.keys(await loadTagsMap()), ['KEEP']);
  assert.equal(tree.length, 1);
});

test('ensureHealthPermission asks permissions.request first, before any other awaited call (Firefox user-input rule)', async () => {
  const order = [];
  setChromeApiForTesting({ permissions: { async contains() { order.push('contains'); return false; }, async request() { order.push('request'); return true; } } });
  const state = {};
  const tools = createInspectTools({ state, t: text => text, now: Date.now, formatNumber: String, makeStableId: () => 'id', getHealthKey: () => '', summarizeHealth: () => ({}), inspectUrlHealthRecord: async () => ({}), runWithConcurrency: async () => {}, sendMessage: async () => ({}), render() {}, renderListOnly() {}, updateInspectProgress() {}, rememberListScroll() {}, setToast() {}, pushCleanupHistory: async () => {}, applyHealthRecordToBookmarks() {}, getSelectedBookmarks: () => [], modeLabel: () => '', getSelectionCount: () => 0, getActiveScopeLabel: () => '' });
  const pending = tools.ensureHealthPermission();
  assert.deepEqual(order, ['request'], 'request must be issued synchronously, in the same turn as the click');
  assert.equal(await pending, true);
  assert.equal(state.healthPermissionState, 'granted');
  setChromeApiForTesting({ permissions: { async request() { return false; } } });
  assert.equal(await tools.ensureHealthPermission(), false);
  assert.equal(state.healthPermissionState, 'denied');
});

test('same-folder drag destinations are final indexes, which is how Firefox interprets bookmarks.move (verified in Firefox 157)', () => {
  const source = { id: 'a1', parentId: 'P', index: 0 };
  const target = id => ({ id, parentId: 'P', index: { a2: 1, a3: 2, a4: 3 }[id] });
  assert.deepEqual(computeDropDestination(source, target('a3'), 'after'), { parentId: 'P', index: 2 });
  assert.deepEqual(computeDropDestination({ id: 'a4', parentId: 'P', index: 3 }, target('a2'), 'before'), { parentId: 'P', index: 1 });
});
