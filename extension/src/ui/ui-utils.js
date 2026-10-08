/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 *
 * ui-utils.js — shared DOM helpers used by both popup.js and dashboard.js.
 * Keep this module free of any state or Chrome API calls so it stays
 * side-effect-free and easy to test.
 */

/**
 * Returns the hostname of a URL, or an empty string on any parse failure.
 * @param {string} url
 * @returns {string}
 */
export function getHostnameSafe(url) {
  try { return new URL(url).hostname || ''; } catch { return ''; }
}

/**
 * Builds the Chrome internal favicon URL for a given page URL.
 * Returns an empty string for non-http(s) URLs, on parse failure, or
 * when running in a browser without the `favicon` permission (Firefox).
 * Callers fall back to the letter-avatar treatment when this returns
 * an empty string, so no extra branching needed at the call site.
 * @param {string} url
 * @param {number} [size=32]
 * @returns {string}
 */
export function getChromeFaviconUrl(url, size = 32) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return '';
    // The /_favicon/ endpoint is a Chrome-only feature backed by the
    // `favicon` permission. In Firefox the request 404s, which is
    // visually fine (we fall back to the letter avatar) but generates
    // a console error per row. Detect Firefox and skip the request
    // outright. We import lazily to avoid a circular dependency with
    // browser-api.js.
    if (_isFirefox()) return '';
    return `/_favicon/?pageUrl=${encodeURIComponent(parsed.href)}&size=${size}`;
  } catch {
    return '';
  }
}

// Memoised one-time check so getChromeFaviconUrl stays cheap inside the
// virtual scroller's hot path. Resolved on first call, cached forever.
let _firefoxCheck = null;
function _isFirefox() {
  if (_firefoxCheck !== null) return _firefoxCheck;
  try {
    if (typeof globalThis !== 'undefined' && globalThis.browser?.runtime?.getURL) {
      const url = globalThis.browser.runtime.getURL('');
      _firefoxCheck = typeof url === 'string' && url.startsWith('moz-extension://');
      return _firefoxCheck;
    }
  } catch {}
  _firefoxCheck = false;
  return false;
}

/** Test seam to reset the cached Firefox check. */
export function _resetFaviconBrowserCheckForTesting() {
  _firefoxCheck = null;
}

/**
 * Creates a favicon node for a bookmark list item.
 * Shows a letter-avatar fallback and lazily loads the Chrome favicon.
 * @param {{ url: string, title: string }} bookmark
 * @param {Function} create  — the host file's create(tag, className, text) helper
 * @returns {HTMLElement}
 */
export function createFaviconNode(bookmark, create) {
  const host = getHostnameSafe(bookmark.url);
  const wrap = create('div', 'item-favicon');
  const fallback = create('span', 'item-favicon-fallback',
    (host || bookmark.title || '?').trim().charAt(0).toUpperCase() || '?'
  );
  wrap.append(fallback);

  const chromeFaviconUrl = getChromeFaviconUrl(bookmark.url, 32);
  if (host && chromeFaviconUrl) {
    const img = create('img', 'item-favicon-img');
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('load', () => { wrap.classList.add('has-image'); });
    img.addEventListener('error', () => {
      img.remove();
      wrap.classList.remove('has-image');
    }, { once: true });
    img.src = chromeFaviconUrl;
    wrap.prepend(img);
  }
  return wrap;
}

/**
 * Traps keyboard focus inside a container element (modal / dialog).
 * Returns a cleanup function that removes the listener.
 *
 * Usage:
 *   const release = trapFocus(modalEl);
 *   // later, when modal closes:
 *   release();
 *
 * @param {HTMLElement} container
 * @returns {() => void} cleanup function
 */
const focusTraps = new WeakMap();

export function trapFocus(container) {
  const ownerDocument = container.ownerDocument || document;
  const traps = focusTraps.get(ownerDocument) || [];
  focusTraps.set(ownerDocument, traps);
  const token = {};
  traps.push(token);
  const originalTabIndex = container.getAttribute('tabindex');
  const isActive = () => traps[traps.length - 1] === token;
  const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'summary',
    '[tabindex]:not([tabindex="-1"])'
  ].join(', ');

  function getFocusable() {
    return Array.from(container.querySelectorAll(FOCUSABLE))
      .filter((el) => {
        if(el.disabled || el.type === 'hidden' || el.tabIndex < 0 || el.closest('[hidden]') || el.closest('[aria-hidden="true"]'))return false;
        for(let parent=el.parentElement;parent && parent!==container;parent=parent.parentElement){
          if(parent.tagName==='DETAILS' && !parent.open && parent.querySelector('summary')!==el)return false;
        }
        return true;
      });
  }

  function focusInside(last = false) {
    const focusable = getFocusable();
    if (focusable.length) (last ? focusable[focusable.length - 1] : focusable[0]).focus();
    else {
      container.setAttribute('tabindex', '-1');
      container.focus();
    }
  }

  function onFocusIn(event) {
    if (isActive() && !container.contains(event.target)) focusInside();
  }

  function onKeyDown(event) {
    if (!isActive() || event.key !== 'Tab') return;
    const focusable = getFocusable();
    if (!focusable.length) { event.preventDefault(); focusInside(); return; }

    if (!container.contains(ownerDocument.activeElement) || ownerDocument.activeElement === container) {
      event.preventDefault();
      focusInside(event.shiftKey);
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (ownerDocument.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (ownerDocument.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  ownerDocument.addEventListener('keydown', onKeyDown, true);
  ownerDocument.addEventListener('focusin', onFocusIn, true);

  // Move focus into the modal on open — first focusable element
  focusInside();

  return () => {
    ownerDocument.removeEventListener('keydown', onKeyDown, true);
    ownerDocument.removeEventListener('focusin', onFocusIn, true);
    const index = traps.indexOf(token);
    if (index !== -1) traps.splice(index, 1);
    if (!traps.length) focusTraps.delete(ownerDocument);
    if (originalTabIndex === null) container.removeAttribute('tabindex');
    else container.setAttribute('tabindex', originalTabIndex);
  };
}

/**
 * Simple debounce: delays fn execution until ms have passed since the last call.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
