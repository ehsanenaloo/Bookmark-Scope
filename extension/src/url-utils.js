/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 */

// MAINTAINABILITY NOTE: MULTI_PART_TLDS is a static list of known second-level
// TLDs (e.g. co.uk, com.au). It is intentionally hardcoded to avoid a network
// dependency on the Public Suffix List at runtime. If a new SLD is missing,
// domain-mode matching will still work correctly — it will just use the wrong
// registrable domain (e.g. treating "foo.co.uk" as ".co.uk" rather than
// "foo.co.uk"). Add missing entries here when users report incorrect grouping.
// Reference: https://publicsuffix.org/list/public_suffix_list.dat
import { PUBLIC_SUFFIX_RULES } from './public-suffix-rules.js';
const suffixRules = new Set(PUBLIC_SUFFIX_RULES);

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') {
    return '/';
  }
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

function normalizeSearch(search, ignoreQueryString) {
  if (ignoreQueryString) return '';
  return search || '';
}

function normalizeHash(hash, ignoreHashFragment) {
  if (ignoreHashFragment) return '';
  return hash || '';
}

export function getRegistrableDomain(hostname) {
  let normalized = String(hostname || '').toLowerCase().trim().replace(/\.+$/, '');
  if (!normalized) return '';
  if (normalized === 'localhost' || normalized.includes(':') || /^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) return normalized;
  try { normalized = new URL('https://' + normalized).hostname; } catch { return ''; }
  const parts = normalized.split('.');
  let suffixLength = 1;
  for (let i = 0; i < parts.length; i++) {
    const candidate = parts.slice(i).join('.');
    if (suffixRules.has('!' + candidate)) {
      suffixLength = parts.length - i - 1;
      break;
    }
    if (suffixRules.has(candidate)) suffixLength = Math.max(suffixLength, parts.length - i);
    if (i > 0 && suffixRules.has('*.' + candidate)) suffixLength = Math.max(suffixLength, parts.length - i + 1);
  }
  return parts.slice(-Math.min(parts.length, suffixLength + 1)).join('.');
}

export function parseUrlSafe(rawUrl, options = {}) {
  const {
    ignoreQueryString = false,
    ignoreHashFragment = true
  } = options;

  try {
    const url = new URL(rawUrl);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { valid: false, reason: 'unsupported_scheme', rawUrl };
    }

    const hostname = url.hostname.toLowerCase();
    const pathname = normalizePathname(url.pathname);
    const search = normalizeSearch(url.search, ignoreQueryString);
    const hash = normalizeHash(url.hash, ignoreHashFragment);

    return {
      valid: true,
      rawUrl,
      protocol: url.protocol,
      hostname,
      domain: getRegistrableDomain(hostname),
      pathname,
      search,
      hash,
      normalizedPageKey: `${url.protocol}//${url.host.toLowerCase()}${pathname}${search}${hash}`,
      displayUrl: `${url.protocol}//${url.host.toLowerCase()}${pathname}${url.search || ''}${url.hash || ''}`
    };
  } catch {
    return { valid: false, reason: 'invalid_url', rawUrl };
  }
}

export function getMatchTarget(tabUrl, options = {}) {
  const parsed = parseUrlSafe(tabUrl, options);
  if (!parsed.valid) {
    return {
      valid: false,
      label: 'Unsupported page',
      subtitle: 'Open an http or https page to inspect matching bookmarks.'
    };
  }

  return {
    valid: true,
    ...parsed,
    label: parsed.displayUrl,
    subtitle: `${parsed.hostname} · ${parsed.domain}`
  };
}

export function matchesMode(bookmarkMeta, target, mode) {
  if (!bookmarkMeta.parsed.valid || !target.valid) return false;

  switch (mode) {
    case 'page':
      return bookmarkMeta.parsed.normalizedPageKey === target.normalizedPageKey;
    case 'host':
      return bookmarkMeta.parsed.hostname === target.hostname;
    case 'domain':
      return bookmarkMeta.parsed.domain === target.domain;
    default:
      return false;
  }
}
