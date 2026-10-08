import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionTools } from '../extension/src/dashboard/action-tools.js';
import { createBookmark, removeBookmark, moveBookmark } from '../extension/src/platform/browser-api.js';
import { fakeBrowser, leaf, folder } from './helpers/browser.mjs';

// moveBookmark(id, { parentId, index }) must mean the FINAL index on every
// engine. Chromium interprets a same-parent forward index as a pre-removal
// index (verified with real Chromium 141), Firefox as a final index (verified
// with real Firefox 157); the fake emulates both and the wrapper normalises.
const ENGINES = ['chromium', 'firefox'];
const ids = (x, id = 'P') => x.find(id).children.map(n => n.id);
const five = () => [folder('P', ['a1', 'a2', 'a3', 'a4', 'a5'].map(id => leaf(id))), folder('Q', [leaf('q1'), leaf('q2')])];

for (const semantics of ENGINES) {
  test(`[${semantics}] forward same-folder move lands at the requested final index`, async () => {
    for (const [from, to] of [[0, 1], [0, 2], [0, 3], [1, 3], [2, 4], [0, 4]]) {
      const x = fakeBrowser(five(), {}, { semantics });
      const expected = ids(x); const [moved] = expected.splice(from, 1); expected.splice(to, 0, moved);
      await moveBookmark(moved, { parentId: 'P', index: to });
      assert.deepEqual(ids(x), expected, `${from} -> ${to}`);
      assert.equal(x.find(moved).index, to);
    }
  });

  test(`[${semantics}] backward, same-index and adjacent moves are unchanged`, async () => {
    for (const [from, to] of [[4, 0], [3, 1], [2, 1], [2, 2], [0, 0], [4, 4]]) {
      const x = fakeBrowser(five(), {}, { semantics });
      const expected = ids(x); const [moved] = expected.splice(from, 1); expected.splice(to, 0, moved);
      await moveBookmark(moved, { parentId: 'P', index: to });
      assert.deepEqual(ids(x), expected, `${from} -> ${to}`);
    }
  });

  test(`[${semantics}] cross-folder and append (undefined index) moves are passed through untouched`, async () => {
    const x = fakeBrowser(five(), {}, { semantics });
    await moveBookmark('a1', { parentId: 'Q', index: 1 });
    assert.deepEqual(x.calls.moves.at(-1), { id: 'a1', parentId: 'Q', index: 1 });
    assert.deepEqual(ids(x, 'Q'), ['q1', 'a1', 'q2']);
    await moveBookmark('a2', { parentId: 'P' });
    assert.deepEqual(x.calls.moves.at(-1), { id: 'a2', parentId: 'P' });
    assert.deepEqual(ids(x), ['a3', 'a4', 'a5', 'a2']);
  });

  test(`[${semantics}] errors from a missing node or failing move propagate unchanged`, async () => {
    const x = fakeBrowser(five(), {}, { semantics });
    await assert.rejects(moveBookmark('nope', { parentId: 'P', index: 2 }), /missing node/);
    x.failures.move.add('a1');
    await assert.rejects(moveBookmark('a1', { parentId: 'P', index: 3 }), /injected move failure/);
    assert.deepEqual(ids(x), ['a1', 'a2', 'a3', 'a4', 'a5']);
  });

  function setup(tree) {
    const browser = fakeBrowser(tree, {}, { semantics }); const toasts = [];
    const state = { allBookmarks: [], tagsByBookmark: {}, visibleBookmarks: [] };
    const tools = createActionTools({ state, t: (s, vars = {}) => s.replace(/\{\{(.*?)\}\}/g, (_, k) => vars[k] ?? k), formatNumber: String, sendMessage: async () => {}, showConfirmDialog: async () => true, setToast: (message, options = {}) => toasts.push({ message, ...options }), refreshData: async () => {}, renderListOnly() {}, pushCleanupHistory: async () => {}, invalidateBookmarkCache() {}, createBookmark, removeBookmark, moveBookmark, deselectBookmarks() {} });
    return { ...browser, state, tools, toasts };
  }
  const drop = async (x, sourceIds, targetId, position) =>
    x.tools.handleDragDropMove(sourceIds.map(id => structuredClone(x.find(id))), x.find(targetId), position);

  test(`[${semantics}] drag-drop forward drop and its Undo restore exact order, including the last position`, async () => {
    const cases = [['a1', 'a3', 'after', ['a2', 'a3', 'a1', 'a4', 'a5']], ['a1', 'a4', 'before', ['a2', 'a3', 'a1', 'a4', 'a5']], ['a1', 'a5', 'after', ['a2', 'a3', 'a4', 'a5', 'a1']], ['a2', 'a4', 'after', ['a1', 'a3', 'a4', 'a2', 'a5']], ['a5', 'a1', 'before', ['a5', 'a1', 'a2', 'a3', 'a4']]];
    for (const [source, target, position, expected] of cases) {
      const x = setup(five());
      assert.equal(await drop(x, [source], target, position), true);
      assert.deepEqual(ids(x), expected, `${source} ${position} ${target}`);
      await x.toasts.at(-1).action();
      assert.deepEqual(ids(x), ['a1', 'a2', 'a3', 'a4', 'a5'], `undo ${source} ${position} ${target}`);
    }
  });

  test(`[${semantics}] multi-selection: same-folder forward, last position, cross-folder and mixed batches with reverse Undo`, async () => {
    const batches = [
      { sources: ['a1', 'a2'], target: 'a4', position: 'after', expected: ['a3', 'a4', 'a1', 'a2', 'a5'], parent: 'P' },
      { sources: ['a1', 'a3'], target: 'a5', position: 'after', expected: ['a2', 'a4', 'a5', 'a1', 'a3'], parent: 'P' },
      { sources: ['a3', 'a1'], target: 'a5', position: 'before', expected: ['a2', 'a4', 'a3', 'a1', 'a5'], parent: 'P' },
      { sources: ['a2', 'a4'], target: 'a1', position: 'before', expected: ['a2', 'a4', 'a1', 'a3', 'a5'], parent: 'P' },
      { sources: ['q1', 'a1', 'a3'], target: 'a4', position: 'after', expected: ['a2', 'a4', 'q1', 'a1', 'a3', 'a5'], parent: 'P' },
      { sources: ['a1', 'a2', 'a3'], target: 'q2', position: 'after', expected: ['q1', 'q2', 'a1', 'a2', 'a3'], parent: 'Q' }
    ];
    for (const b of batches) {
      const x = setup(five());
      await drop(x, b.sources, b.target, b.position);
      assert.deepEqual(ids(x, b.parent), b.expected, `${b.sources} ${b.position} ${b.target}`);
      await x.toasts.at(-1).action();
      assert.deepEqual(ids(x), ['a1', 'a2', 'a3', 'a4', 'a5'], `undo ${b.sources}`);
      assert.deepEqual(ids(x, 'Q'), ['q1', 'q2'], `undo Q ${b.sources}`);
    }
  });
}

test('the Chromium fake really uses pre-removal indexes and the Firefox fake final indexes (raw API)', async () => {
  const c = fakeBrowser(five(), {}, { semantics: 'chromium' });
  await c.api.bookmarks.move('a1', { parentId: 'P', index: 2 });
  assert.deepEqual(ids(c), ['a2', 'a1', 'a3', 'a4', 'a5']);
  const f = fakeBrowser(five(), {}, { semantics: 'firefox' });
  await f.api.bookmarks.move('a1', { parentId: 'P', index: 2 });
  assert.deepEqual(ids(f), ['a2', 'a3', 'a1', 'a4', 'a5']);
});

test('Chromium wrapper sends index + 1 only for a same-parent forward move; Firefox never adjusts', async () => {
  const c = fakeBrowser(five(), {}, { semantics: 'chromium' });
  await moveBookmark('a1', { parentId: 'P', index: 2 }); await moveBookmark('a5', { parentId: 'P', index: 0 }); await moveBookmark('a2', { parentId: 'Q', index: 1 });
  assert.deepEqual(c.calls.moves.map(m => m.index), [3, 0, 1]);
  const f = fakeBrowser(five(), {}, { semantics: 'firefox' });
  await moveBookmark('a1', { parentId: 'P', index: 2 });
  assert.deepEqual(f.calls.moves.map(m => m.index), [2]);
});
