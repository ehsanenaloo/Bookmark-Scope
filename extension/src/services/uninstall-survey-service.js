/* Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License. */
import { getActiveLocale } from '../locales/i18n.js';
import { getManifest, getPlatformInfo, setUninstallUrl } from '../platform/browser-api.js';
import { now } from '../platform/time.js';
import { readSupportNudge } from './support-nudge-service.js';

// The browser opens this page after the extension is removed. The page asks why.
// Every value is coarse and anonymous: no identifier, no bookmark data.
export const UNINSTALL_SURVEY_URL = 'https://enaloo.com/apps/bookmark-scope/uninstall/';
const DAY_MS = 86400000;
const OS_BY_PLATFORM = Object.freeze({ win: 'win', mac: 'mac', linux: 'linux', cros: 'cros', android: 'android' });

export function detectBrowserFromUserAgent(userAgent = '') {
  const ua = String(userAgent);
  const edge = ua.match(/Edg\/(\d{1,3})/);
  if (edge) return { browser: 'edge', version: edge[1] };
  const firefox = ua.match(/Firefox\/(\d{1,3})/);
  if (firefox) return { browser: 'firefox', version: firefox[1] };
  const chrome = ua.match(/Chrome\/(\d{1,3})/);
  if (chrome && !/OPR\//.test(ua)) return { browser: 'chrome', version: chrome[1] };
  return { browser: 'other', version: '' };
}

export function installAgeBucket(installedAt, at = now()) {
  if (!Number.isFinite(installedAt) || installedAt <= 0 || installedAt > at) return 'unknown';
  const days = (at - installedAt) / DAY_MS;
  if (days < 1) return 'd1';
  if (days < 7) return 'w1';
  if (days < 30) return 'm1';
  if (days < 90) return 'm3';
  return 'more';
}

export function buildUninstallSurveyUrl({ version, lang, userAgent, os, installedAt, at } = {}) {
  const { browser, version: browserVersion } = detectBrowserFromUserAgent(userAgent);
  const params = new URLSearchParams();
  if (version) params.set('v', String(version));
  if (lang) params.set('lang', String(lang));
  params.set('b', browser);
  if (browserVersion) params.set('bv', browserVersion);
  params.set('os', OS_BY_PLATFORM[os] || 'other');
  params.set('age', installAgeBucket(installedAt, at));
  return `${UNINSTALL_SURVEY_URL}?${params}`;
}

/** Refreshes the survey address so its version, language and install age stay current. */
export async function registerUninstallSurvey() {
  const platform = await getPlatformInfo().catch(() => null);
  const nudge = await readSupportNudge().catch(() => null);
  const userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const url = buildUninstallSurveyUrl({
    version: getManifest().version,
    lang: getActiveLocale(),
    userAgent,
    os: platform?.os,
    installedAt: nudge?.installedAt
  });
  await setUninstallUrl(url);
  return url;
}
