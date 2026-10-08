import test from 'node:test';
import assert from 'node:assert/strict';
import { createPopupActions } from '../src/popup/actions.js';
import { fakeBrowser, folder, leaf, deferred } from './helpers/browser.mjs';

function setup(tree, stored = {}) {
  const browser = fakeBrowser(tree, stored);
  const state = { allBookmarks: [], target: { valid: true, normalizedPageKey: 'page' }, tab: { url: 'https://page.test/' } };
  const toasts = [];
  let refreshFails = false;
  let confirmed = true;
  const actions = createPopupActions({
    state, t: (s, vars = {}) => s.replace(/\{\{(.*?)\}\}/g, (_, key) => vars[key] ?? key),
    invalidateBookmarkCache() {}, getParseOptions: () => ({}), getMatchTarget: () => state.target,
    getNormalizedBookmarks: async () => {
      if (refreshFails) throw new Error('injected refresh failure');
      return browser.find('P').children.filter(node => node.url).map(node => ({ ...node, parsed: { valid: true, normalizedPageKey: 'page' } }));
    }, detectDuplicates: items => items, matchesMode: () => true, getCleanupSummary: () => ({}),
    filterScopedBookmarks: items => items, sortBookmarks: items => items, render() {},
    showConfirmDialog: async () => confirmed, setToast: (message, options = {}) => toasts.push({ message, ...options })
  });
  state.allBookmarks = browser.find('P').children.filter(node => node.url).map(node => ({ ...node, parsed: { valid: true, normalizedPageKey: 'page' } }));
  return { ...browser, actions, state, toasts, failRefresh() { refreshFails = true; }, decline() { confirmed = false; } };
}

for (const failedId of ['A', 'B']) test(`popup partial page removal (${failedId}) exposes Undo only for applied deletion`, async () => {
  const x = setup([folder('P', [leaf('A'), folder('F'), leaf('B')])], { tagsByBookmark: { A: ['work'], B: ['keep'] } });
  x.failures.remove.add(failedId);
  assert.deepEqual(await x.actions.unbookmarkCurrentPage(), { deleted: 1, failed: 1 });
  const undo = x.toasts.at(-1).action.handler;
  assert.equal(x.toasts.at(-1).error, true);
  await undo(); await undo();
  assert.equal(x.calls.creates.length, 1);
  assert.deepEqual(x.find('P').children.map(node => node.title), ['A', 'F', 'B']);
  assert.equal(x.find(failedId).id, failedId);
  assert.deepEqual(x.stored.tagsByBookmark['created-1'], failedId === 'A' ? ['keep'] : ['work']);
});

test('single popup Undo remaps tags after worker cleanup and preserves other metadata', async () => {
  const x = setup([folder('P', [leaf('A'), leaf('B')])], { tagsByBookmark: { A: ['work', 'urgent'], B: ['keep'] } });
  await x.actions.deleteBookmark(x.find('A'));
  delete x.stored.tagsByBookmark.A;
  const undo = x.toasts.at(-1).action.handler;
  await undo(); await undo();
  assert.equal(x.calls.creates.length, 1);
  assert.deepEqual(x.stored.tagsByBookmark, { B: ['keep'], 'created-1': ['work', 'urgent'] });
  assert.deepEqual(x.find('P').children.map(node => node.title), ['A', 'B']);
});

test('metadata failure retains recovery identity and retries metadata without duplicate creation', async () => {
  const x = setup([folder('P', [leaf('A')])], { tagsByBookmark: { A: ['work'] } });
  await x.actions.deleteBookmark(x.find('A'));
  x.failures.set = values => 'tagsByBookmark' in values;
  await x.toasts.at(-1).action.handler();
  assert.equal(x.calls.creates.length, 1);
  assert.equal(x.toasts.at(-1).persist, true);
  x.failures.set = null;
  x.stored.tagsByBookmark['created-1'] = ['concurrent'];
  await x.toasts.at(-1).action.handler();
  assert.equal(x.calls.creates.length, 1);
  assert.deepEqual(x.stored.tagsByBookmark['created-1'], ['concurrent', 'work']);
});

for (const failedId of ['A', 'B']) test(`failed recovery creation (${failedId}) remains retryable in sibling order`, async () => {
  const x = setup([folder('P', [leaf('A'), folder('F'), leaf('B'), leaf('C')])]);
  await x.actions.unbookmarkCurrentPage();
  x.failures.create.add(`https://${failedId}.test/`);
  await x.toasts.at(-1).action.handler();
  assert.equal(x.toasts.at(-1).error, true);
  x.failures.create.clear();
  await x.toasts.at(-1).action.handler();
  assert.deepEqual(x.find('P').children.map(node => node.title), ['A', 'F', 'B', 'C']);
  assert.equal(x.find('P').children.filter(node => node.url).length, 3);
});

test('all failed removals report failure and expose no Undo', async () => {
  const x = setup([folder('P', [leaf('A'), leaf('B')])]);
  x.failures.remove.add('A'); x.failures.remove.add('B');
  assert.deepEqual(await x.actions.unbookmarkCurrentPage(), { deleted: 0, failed: 2 });
  assert.equal(x.toasts.at(-1).action, undefined);
  assert.equal(x.calls.creates.length, 0);
});

test('cancelled confirmation does not remove bookmarks or metadata', async () => {
  const x = setup([folder('P', [leaf('A')])], { tagsByBookmark: { A: ['work'] } });
  x.decline(); await x.actions.deleteBookmark(x.find('A'));
  assert.deepEqual(x.calls.removes, []); assert.deepEqual(x.stored.tagsByBookmark, { A: ['work'] });
});

test('failed refresh cannot remove the recovery action', async () => {
  const x = setup([folder('P', [leaf('A')])]);
  x.failRefresh(); await x.actions.deleteBookmark(x.find('A'));
  assert.ok(x.toasts.at(-1).action);
  await x.toasts.at(-1).action.handler();
  assert.equal(x.find('P').children.length, 1);
});

test('changed URL is not deleted using stale popup projection', async () => {
  const x = setup([folder('P', [leaf('A')])]);
  const original = { ...x.find('A') }; x.find('A').url = 'https://changed.test/';
  assert.deepEqual(await x.actions.deleteBookmark(original), { deleted: 0, failed: 1 });
  assert.deepEqual(x.calls.removes, []);
});

test('concurrent Undo invocations create exactly one recovered bookmark', async () => {
  const x = setup([folder('P', [leaf('A')])]);
  await x.actions.deleteBookmark(x.find('A'));
  const undo = x.toasts.at(-1).action.handler;
  const pending = deferred(); const create = x.api.bookmarks.create;
  x.api.bookmarks.create = async details => { await pending.promise; return create(details); };
  const first = undo(); const second = undo(); pending.resolve();
  await Promise.all([first, second]); assert.equal(x.calls.creates.length, 1);
});
