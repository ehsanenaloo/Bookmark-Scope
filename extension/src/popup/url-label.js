/**
 * Short label for the URL line of a popup row. The popup already shows one
 * site, so the host is left out when it equals the current page's host and
 * the line disappears when nothing else is left. Returns '' to hide the line.
 */
export function describeBookmarkUrl(bookmark, target) {
  const url = bookmark?.url || '';
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const rest = `${parsed.pathname === '/' ? '' : parsed.pathname}${parsed.search}${parsed.hash}`;
  const sameHost = Boolean(target?.hostname) && parsed.hostname.toLowerCase() === target.hostname;
  if (sameHost) return rest;
  return `${parsed.host.replace(/^www\./i, '')}${rest}`;
}
