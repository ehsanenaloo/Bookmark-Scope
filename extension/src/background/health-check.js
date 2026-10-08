import { HEALTH_STATUSES } from '../core/constants.js';
import { now } from '../platform/time.js';

export function isStoreUrl(url) {
  try {
    const { host } = new URL(url);
    return host === 'chrome.google.com' || host === 'chromewebstore.google.com';
  } catch {
    return false;
  }
}

export function shouldSkipHealthCheck(url) {
  if (!url) return true;
  if (isStoreUrl(url)) return true;
  const SKIP_PREFIXES = [
    'chrome://', 'chrome-extension://', 'edge://', 'about:',
    'javascript:', 'file://', 'data:', 'blob:'
  ];
  return SKIP_PREFIXES.some((prefix) => url.startsWith(prefix));
}

export function createHealthRecord(status, extras = {}) {
  return {
    status,
    checkedAt: now(),
    ...extras
  };
}

// Response.url never carries the #fragment and is returned in canonical form
// (lower-case scheme/host, explicit path), so a plain string comparison would
// report an unmoved bookmark as redirected. Compare canonical URLs without the
// fragment; real redirects are still caught by response.redirected.
function isSameResourceUrl(finalUrl, requestedUrl) {
  if (finalUrl === requestedUrl) return true;
  try {
    const a = new URL(finalUrl);
    const b = new URL(requestedUrl);
    a.hash = '';
    b.hash = '';
    return a.href === b.href;
  } catch {
    return false;
  }
}

export function classifyHealthResponse(response, requestedUrl, method) {
  const finalUrl = response.url || requestedUrl;
  const sameUrl = isSameResourceUrl(finalUrl, requestedUrl);
  if (response.status >= 500) return createHealthRecord(HEALTH_STATUSES.SERVER_ERROR, { statusCode: response.status, finalUrl, method });
  if (response.status >= 400) return createHealthRecord(HEALTH_STATUSES.BROKEN, { statusCode: response.status, finalUrl, method });
  if (response.redirected || !sameUrl) return createHealthRecord(HEALTH_STATUSES.REDIRECTED, { statusCode: response.status, finalUrl, method });
  return createHealthRecord(HEALTH_STATUSES.HEALTHY, { statusCode: response.status, finalUrl, method });
}

export function createHealthFailure(status, requestedUrl, extras = {}) {
  return createHealthRecord(status, {
    finalUrl: requestedUrl,
    ...extras
  });
}
