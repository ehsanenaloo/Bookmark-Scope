import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocaleMap } from '../../extension/src/locales/build-locale-map.js';

test('buildLocaleMap freezes a unique key map', () => {
  const map = buildLocaleMap([['A', 'A'], ['B', 'Bee']], 'x');
  assert.equal(map.A, 'A');
  assert.equal(Object.isFrozen(map), true);
});

test('buildLocaleMap rejects duplicate keys', () => {
  assert.throws(() => buildLocaleMap([['A', '1'], ['A', '2']], 'dupe'), /Duplicate translation key/);
});
