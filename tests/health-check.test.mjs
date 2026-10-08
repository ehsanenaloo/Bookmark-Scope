import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyHealthResponse, shouldSkipHealthCheck } from '../src/background/health-check.js';
import { HEALTH_STATUSES } from '../src/constants.js';

test('classifyHealthResponse maps healthy/redirected/broken/server responses', () => {
  assert.equal(classifyHealthResponse({ status: 200, url: 'https://a.test', redirected: false }, 'https://a.test', 'HEAD').status, HEALTH_STATUSES.HEALTHY);
  assert.equal(classifyHealthResponse({ status: 200, url: 'https://b.test/final', redirected: true }, 'https://b.test', 'GET').status, HEALTH_STATUSES.REDIRECTED);
  assert.equal(classifyHealthResponse({ status: 404, url: 'https://a.test', redirected: false }, 'https://a.test', 'HEAD').status, HEALTH_STATUSES.BROKEN);
  assert.equal(classifyHealthResponse({ status: 503, url: 'https://a.test', redirected: false }, 'https://a.test', 'HEAD').status, HEALTH_STATUSES.SERVER_ERROR);
});

test('shouldSkipHealthCheck blocks unsupported protocols and store urls', () => {
  assert.equal(shouldSkipHealthCheck('chrome://bookmarks'), true);
  assert.equal(shouldSkipHealthCheck('javascript:alert(1)'), true);
  assert.equal(shouldSkipHealthCheck('https://chromewebstore.google.com/detail/foo'), true);
  assert.equal(shouldSkipHealthCheck('https://example.com'), false);
});

test('shouldSkipHealthCheck blocks additional non-http protocols', () => {
  assert.equal(shouldSkipHealthCheck('chrome-extension://abc/page.html'), true);
  assert.equal(shouldSkipHealthCheck('file:///home/user/doc.html'), true);
  assert.equal(shouldSkipHealthCheck('edge://settings'), true);
  assert.equal(shouldSkipHealthCheck('about:blank'), true);
  assert.equal(shouldSkipHealthCheck('data:text/html,hello'), true);
  assert.equal(shouldSkipHealthCheck('blob:https://example.com/uuid'), true);
  assert.equal(shouldSkipHealthCheck(''), true);
  assert.equal(shouldSkipHealthCheck(null), true);
  assert.equal(shouldSkipHealthCheck('https://google.com'), false);
});

test('classifyHealthResponse does not report a fragment or host-case difference as a redirect', () => {
  const fragment = classifyHealthResponse({ status: 200, url: 'https://a.test/page', redirected: false }, 'https://a.test/page#section', 'HEAD');
  assert.equal(fragment.status, HEALTH_STATUSES.HEALTHY);
  const canonical = classifyHealthResponse({ status: 200, url: 'https://example.com/', redirected: false }, 'HTTPS://Example.COM', 'GET');
  assert.equal(canonical.status, HEALTH_STATUSES.HEALTHY);
  const moved = classifyHealthResponse({ status: 200, url: 'https://a.test/other', redirected: false }, 'https://a.test/page#section', 'HEAD');
  assert.equal(moved.status, HEALTH_STATUSES.REDIRECTED);
  const flagged = classifyHealthResponse({ status: 200, url: 'https://a.test/page', redirected: true }, 'https://a.test/page', 'GET');
  assert.equal(flagged.status, HEALTH_STATUSES.REDIRECTED);
});
