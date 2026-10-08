import test from 'node:test';
import assert from 'node:assert/strict';
import { MESSAGE_TYPES, runtimeMessages, getMessageType } from '../extension/src/runtime/messages.js';

test('runtime message builders use canonical types', () => {
  assert.equal(runtimeMessages.getActiveTabContext().type, MESSAGE_TYPES.GET_ACTIVE_TAB_CONTEXT);
  assert.deepEqual(runtimeMessages.openBookmarkFolder('42'), { type: MESSAGE_TYPES.OPEN_BOOKMARK_FOLDER, parentId: '42' });
  assert.deepEqual(runtimeMessages.openUrl('https://example.com'), { type: MESSAGE_TYPES.OPEN_URL, url: 'https://example.com' });
  assert.deepEqual(runtimeMessages.refreshBadge(), { type: MESSAGE_TYPES.REFRESH_BADGE });
  assert.deepEqual(runtimeMessages.syncReviewReminder(), { type: MESSAGE_TYPES.SYNC_REVIEW_REMINDER });
  assert.deepEqual(runtimeMessages.fetchUrlHealth({ url: 'https://example.com', timeoutMs: 123, requestId: 'abc' }), {
    type: MESSAGE_TYPES.FETCH_URL_HEALTH,
    url: 'https://example.com',
    timeoutMs: 123,
    requestId: 'abc'
  });
  assert.deepEqual(runtimeMessages.abortUrlHealth('abc'), { type: MESSAGE_TYPES.ABORT_URL_HEALTH, requestId: 'abc' });
  assert.equal(getMessageType(runtimeMessages.refreshBadge()), MESSAGE_TYPES.REFRESH_BADGE);
});
