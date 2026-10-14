import test from 'node:test';
import assert from 'node:assert/strict';
import { createPopupMatchesToast } from '../../extension/src/popup/matches-toast.js';
import { POPUP_MAX_ROWS } from '../../extension/src/core/constants.js';

// Controlled DOM bindings only. This is not browser or layout acceptance.
function node(tag, className = '') {
  return {
    tag, className, children: [], listeners: {}, dataset: {},
    get childNodes() { return this.children; },
    append(...items) { for (const item of items) { if (item.fragment) this.children.push(...item.children); else this.children.push(item); } },
    addEventListener(type, handler) { this.listeners[type] = handler; },
    setAttribute() {}
  };
}

function setup(total, prefs = {}) {
  globalThis.document = { createDocumentFragment: () => ({ fragment: true, children: [], append(...items) { this.children.push(...items); } }) };
  const bookmarks = Array.from({ length: total }, (_, i) => ({ id: String(i), title: `T${i}`, url: `https://a.test/${i}`, path: 'p', parentId: '1' }));
  const state = { target: { valid: true }, mode: 'domain', query: '', visibleBookmarks: bookmarks, scopeBookmarks: bookmarks, scopeSummary: {}, visibleFromFuzzy: false, rowLimit: POPUP_MAX_ROWS, lazyLoad: true, ...prefs };
  const create = (tag, cls = '', text) => { const n = node(tag, cls); if (text !== undefined) n.text = text; return n; };
  const toast = createPopupMatchesToast({
    state, formatNumber: String, createFaviconNode: () => node('i'), debounce: (fn) => fn,
    createIconButton: () => node('button'), t: (s) => s, create, setSearchRef() {}, groupDuplicates: () => new Map(), actions: {}
  });
  const root = node('div');
  toast.renderMatches(root);
  const list = root.children[0].children.find((c) => c.className === 'list');
  return { list, count: () => list.children.filter((c) => c.className === 'item').length };
}

test('popup renders one batch, then loads more near the bottom of the list', () => {
  const { list, count } = setup(55);
  assert.equal(count(), POPUP_MAX_ROWS);
  list.scrollHeight = 5000; list.clientHeight = 400; list.scrollTop = 0;
  list.listeners.scroll();
  assert.equal(count(), POPUP_MAX_ROWS);
  list.scrollTop = 4500;
  list.listeners.scroll();
  assert.equal(count(), POPUP_MAX_ROWS * 2);
  list.listeners.scroll();
  list.listeners.scroll();
  assert.equal(count(), 55);
});

test('popup adds no scroll handler when everything fits in one batch', () => {
  const { list, count } = setup(POPUP_MAX_ROWS);
  assert.equal(count(), POPUP_MAX_ROWS);
  assert.equal(list.listeners.scroll, undefined);
});

test('rowLimit sets the batch size when lazy load is on', () => {
  const { list, count } = setup(300, { rowLimit: 50 });
  assert.equal(count(), 50);
  list.scrollHeight = 5000; list.clientHeight = 400; list.scrollTop = 4500;
  list.listeners.scroll();
  assert.equal(count(), 100);
});

test('unlimited renders every row at once', () => {
  const { list, count } = setup(300, { rowLimit: 0 });
  assert.equal(count(), 300);
  assert.equal(list.listeners.scroll, undefined);
});

test('lazy load off caps the list at the limit and shows the dashboard note', () => {
  const { list, count } = setup(300, { rowLimit: 100, lazyLoad: false });
  assert.equal(count(), 100);
  assert.equal(list.listeners.scroll, undefined);
  assert.equal(list.children.at(-1).className, 'helper');
});
