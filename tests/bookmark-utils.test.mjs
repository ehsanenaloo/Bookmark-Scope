import test from 'node:test';
import assert from 'node:assert/strict';
import { detectDuplicates, filterScopedBookmarks } from '../src/bookmark-utils.js';
import { CLEANUP_FILTERS, HEALTH_STATUSES } from '../src/constants.js';

const now = Date.now();
const bookmarks = detectDuplicates([
  {
    id: '1', title: 'One', url: 'https://example.com/a', path: 'Root', dateAdded: now,
    parsed: { valid: true, normalizedPageKey: 'https://example.com/a', hostname: 'example.com', domain: 'example.com' }
  },
  {
    id: '2', title: 'One', url: 'https://example.com/a', path: 'Root', dateAdded: now,
    parsed: { valid: true, normalizedPageKey: 'https://example.com/a', hostname: 'example.com', domain: 'example.com' }
  },
  {
    id: '3', title: '', url: 'https://elsewhere.test', path: 'Root', dateAdded: now - 900 * 86400000,
    parsed: { valid: true, normalizedPageKey: 'https://elsewhere.test', hostname: 'elsewhere.test', domain: 'elsewhere.test' },
    healthStatus: HEALTH_STATUSES.BROKEN
  }
]);

test('detectDuplicates marks duplicates and untitled/old items', () => {
  assert.equal(bookmarks[0].isDuplicate, true);
  assert.equal(bookmarks[2].isUntitled, true);
  assert.equal(bookmarks[2].isOld, true);
});

test('filterScopedBookmarks supports cleanup filters and advanced search', () => {
  const duplicates = filterScopedBookmarks(bookmarks, '', { cleanupFilter: CLEANUP_FILTERS.DUPLICATES });
  assert.equal(duplicates.length, 2);
  const broken = filterScopedBookmarks(bookmarks, 'health:broken', { cleanupFilter: CLEANUP_FILTERS.ALL });
  assert.equal(broken.length, 1);
});
