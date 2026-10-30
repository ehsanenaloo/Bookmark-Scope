/* Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License. */
import { getActiveLocale } from '../locales/i18n.js';
import { createTab, getManifest } from '../platform/browser-api.js';
import { detectBrowserFromUserAgent } from './uninstall-survey-service.js';

// Pages on enaloo.com that the extension only opens as links. Nothing is sent
// by the extension itself and only coarse values go in the address.
export const SITE_APP_URL = 'https://enaloo.com/apps/bookmark-scope/';
export const WELCOME_PAGE_URL = `${SITE_APP_URL}welcome/`;
export const FEEDBACK_PAGE_URL = `${SITE_APP_URL}feedback/`;

function currentUserAgent() {
  return typeof navigator === 'undefined' ? '' : navigator.userAgent;
}

export function buildWelcomeUrl({ version, lang, userAgent } = {}) {
  const { browser } = detectBrowserFromUserAgent(userAgent);
  const params = new URLSearchParams();
  if (version) params.set('v', String(version));
  if (lang) params.set('lang', String(lang));
  params.set('b', browser);
  return `${WELCOME_PAGE_URL}?${params}`;
}

export function buildFeedbackUrl({ kind = 'bug', version, userAgent } = {}) {
  const params = new URLSearchParams({ kind: kind === 'feature' ? 'feature' : 'bug' });
  if (version) params.set('v', String(version));
  if (kind !== 'feature') {
    const { browser, version: browserVersion } = detectBrowserFromUserAgent(userAgent);
    params.set('b', browser);
    if (browserVersion) params.set('bv', browserVersion);
  }
  return `${FEEDBACK_PAGE_URL}?${params}`;
}

export function getFeedbackUrl(kind) {
  return buildFeedbackUrl({ kind, version: getManifest().version, userAgent: currentUserAgent() });
}

/** Opens the welcome page in a background tab. Call it only for a fresh install. */
export async function openWelcomePage() {
  const url = buildWelcomeUrl({ version: getManifest().version, lang: getActiveLocale(), userAgent: currentUserAgent() });
  await createTab({ url, active: false });
  return url;
}
