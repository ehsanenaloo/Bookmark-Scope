import test from 'node:test';
import assert from 'node:assert/strict';
import { DASHBOARD_STORAGE_KEYS, GROUP_BY_OPTIONS, GROUP_SORT_OPTIONS, MATCH_MODES, SORT_OPTIONS, STORAGE_KEYS, THEME_MODES } from '../src/constants.js';
import { STORAGE_SCHEMA_VERSION, sanitizeStorageSnapshot } from '../src/services/storage-schema.js';

test('sanitizeStorageSnapshot normalizes invalid enum values and booleans', () => {
  const sanitized = sanitizeStorageSnapshot({
    [STORAGE_KEYS.POPUP_MODE]: 'trash',
    [STORAGE_KEYS.POPUP_SORT]: SORT_OPTIONS.NEWEST,
    [STORAGE_KEYS.IGNORE_QUERY]: 'yes',
    [STORAGE_KEYS.IGNORE_HASH]: false,
    [DASHBOARD_STORAGE_KEYS.GROUP_BY]: 'weird',
    [DASHBOARD_STORAGE_KEYS.GROUP_SORT]: GROUP_SORT_OPTIONS.ALPHA_ASC,
    [STORAGE_KEYS.THEME_MODE]: 'matrix'
  });

  assert.equal(sanitized[STORAGE_KEYS.POPUP_MODE], MATCH_MODES.DOMAIN);
  assert.equal(sanitized[STORAGE_KEYS.POPUP_SORT], SORT_OPTIONS.NEWEST);
  assert.equal(sanitized[STORAGE_KEYS.IGNORE_QUERY], false);
  assert.equal(sanitized[STORAGE_KEYS.IGNORE_HASH], false);
  assert.equal(sanitized[DASHBOARD_STORAGE_KEYS.GROUP_BY], GROUP_BY_OPTIONS.FLAT);
  assert.equal(sanitized[DASHBOARD_STORAGE_KEYS.GROUP_SORT], GROUP_SORT_OPTIONS.ALPHA_ASC);
  assert.equal(sanitized[STORAGE_KEYS.THEME_MODE], THEME_MODES.SYSTEM);
  assert.equal(sanitized[STORAGE_KEYS.STORAGE_SCHEMA_VERSION], STORAGE_SCHEMA_VERSION);
});

test('sanitizeStorageSnapshot caps retained history and diagnostics', () => {
  const longArray = Array.from({ length: 500 }, (_, index) => ({ index }));
  const sanitized = sanitizeStorageSnapshot({
    [STORAGE_KEYS.REVIEW_SESSIONS]: longArray,
    [STORAGE_KEYS.CLEANUP_HISTORY]: longArray,
    [STORAGE_KEYS.DIAGNOSTIC_EVENTS]: longArray
  });

  assert.equal(sanitized[STORAGE_KEYS.REVIEW_SESSIONS].length, 20);
  assert.equal(sanitized[STORAGE_KEYS.CLEANUP_HISTORY].length, 60);
  assert.equal(sanitized[STORAGE_KEYS.DIAGNOSTIC_EVENTS].length, 200);
});
