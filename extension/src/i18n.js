import { STORAGE_KEYS } from './constants.js';
import { getLocalStorage, setLocalStorage } from './services/storage-service.js';
import { LOCALE_REGISTRY, loadLocaleMessages } from './locales/index.js';
import { getUiLanguage } from './platform/browser-api.js';

export const AUTO_LOCALE = 'auto';
export const DEFAULT_LOCALE = 'en';

export const LOCALE_PREFERENCES = Object.freeze(
  LOCALE_REGISTRY.reduce((acc, locale) => {
    acc[locale.code.toUpperCase().replace(/[^A-Z0-9]+/g, '_')] = locale.code;
    return acc;
  }, { AUTO: AUTO_LOCALE })
);

const LOCALE_BY_CODE = new Map(LOCALE_REGISTRY.map((locale) => [locale.code, locale]));
const DEFAULT_SOURCE_MESSAGES = Object.freeze(LOCALE_BY_CODE.get(DEFAULT_LOCALE)?.messages || {});
const LOCALE_MESSAGE_CACHE = new Map([[DEFAULT_LOCALE, DEFAULT_SOURCE_MESSAGES]]);
const RTL_LOCALES = new Set(LOCALE_REGISTRY.filter((locale) => locale.rtl).map((locale) => locale.code));
const ALIAS_TO_CODE = new Map();

for (const locale of LOCALE_REGISTRY) {
  ALIAS_TO_CODE.set(locale.code.toLowerCase(), locale.code);
  ALIAS_TO_CODE.set(locale.intl.toLowerCase(), locale.code);
  for (const alias of locale.aliases) ALIAS_TO_CODE.set(String(alias).toLowerCase(), locale.code);
}

let activeLocale = DEFAULT_LOCALE;
let activePreference = AUTO_LOCALE;
let localeOverrides = Object.freeze({});

function browserLocale() {
  try {
    return getUiLanguage() || navigator.language || navigator.languages?.[0] || DEFAULT_LOCALE;
  } catch {
    return navigator.language || navigator.languages?.[0] || DEFAULT_LOCALE;
  }
}


function getLocaleBaseMessages(locale = activeLocale) {
  return LOCALE_MESSAGE_CACHE.get(locale) || LOCALE_BY_CODE.get(locale)?.messages || {};
}

async function ensureLocaleMessagesLoaded(locale = activeLocale) {
  const normalized = normalizeLocale(locale);
  if (LOCALE_MESSAGE_CACHE.has(normalized)) return LOCALE_MESSAGE_CACHE.get(normalized);

  const entry = LOCALE_BY_CODE.get(normalized);
  if (!entry) return DEFAULT_SOURCE_MESSAGES;

  const loaded = entry.messages || await entry.loadMessages?.() || {};
  const frozen = Object.freeze(loaded);
  LOCALE_MESSAGE_CACHE.set(normalized, frozen);
  return frozen;
}

function canonicalizeLocale(value = '') {
  return String(value || '').trim().replace(/\s+/g, '').replace(/-/g, '_').toLowerCase();
}

export function normalizeLocale(value = '') {
  const canonical = canonicalizeLocale(value);
  if (!canonical) return DEFAULT_LOCALE;

  const exact = ALIAS_TO_CODE.get(canonical);
  if (exact) return exact;

  const primary = canonical.split('_')[0];
  const primaryMatch = ALIAS_TO_CODE.get(primary);
  if (primaryMatch) return primaryMatch;

  return DEFAULT_LOCALE;
}

export function resolveLocale(preference = AUTO_LOCALE) {
  if (preference === AUTO_LOCALE) return normalizeLocale(browserLocale());
  return normalizeLocale(preference);
}

export async function getStoredLocalePreference() {
  const stored = await getLocalStorage([STORAGE_KEYS.LOCALE_PREFERENCE]);
  const value = stored[STORAGE_KEYS.LOCALE_PREFERENCE];
  return isSupportedLocalePreference(value) ? value : AUTO_LOCALE;
}

function isSupportedLocalePreference(value) {
  return value === AUTO_LOCALE || LOCALE_BY_CODE.has(value);
}


function sanitizeLocaleOverrides(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const sanitized = {};
  for (const [locale, entries] of Object.entries(raw)) {
    if (!LOCALE_BY_CODE.has(locale) || !entries || typeof entries !== 'object' || Array.isArray(entries)) continue;
    const nextEntries = {};
    for (const [source, value] of Object.entries(entries)) {
      const safeSource = String(source || '').trim();
      if (!safeSource || !hasSourceMessage(safeSource)) continue;
      if (typeof value !== 'string') continue;
      nextEntries[safeSource] = value;
    }
    if (Object.keys(nextEntries).length) sanitized[locale] = nextEntries;
  }
  return sanitized;
}

export async function getStoredLocaleOverrides() {
  const stored = await getLocalStorage([STORAGE_KEYS.LOCALE_OVERRIDES]);
  return sanitizeLocaleOverrides(stored[STORAGE_KEYS.LOCALE_OVERRIDES]);
}

export async function setStoredLocaleOverrides(overrides) {
  const safe = sanitizeLocaleOverrides(overrides);
  await setLocalStorage({ [STORAGE_KEYS.LOCALE_OVERRIDES]: safe });
  localeOverrides = Object.freeze(safe);
  return localeOverrides;
}

export function getLocaleOverrideMessages(locale = activeLocale) {
  return localeOverrides[locale] || {};
}

export function getLocaleMessages(locale = activeLocale) {
  const localePack = getLocaleBaseMessages(locale);
  const overridePack = getLocaleOverrideMessages(locale);
  return Object.freeze({ ...localePack, ...overridePack });
}

export function getSourceMessages() {
  return DEFAULT_SOURCE_MESSAGES;
}

export async function setStoredLocalePreference(preference) {
  const safe = isSupportedLocalePreference(preference) ? preference : AUTO_LOCALE;
  await setLocalStorage({ [STORAGE_KEYS.LOCALE_PREFERENCE]: safe });
  activePreference = safe;
  activeLocale = resolveLocale(safe);
  await ensureLocaleMessagesLoaded(DEFAULT_LOCALE);
  await ensureLocaleMessagesLoaded(activeLocale);
  return activeLocale;
}


export function getActiveLocale() {
  return activeLocale;
}

export function getActiveIntlLocale(locale = activeLocale) {
  return (LOCALE_BY_CODE.get(locale)?.intl || DEFAULT_LOCALE).replace(/_/g, '-');
}

export function getActiveLocalePreference() {
  return activePreference;
}

export function isRtlLocale(locale = activeLocale) {
  return RTL_LOCALES.has(locale);
}

export function hasSourceMessage(source) {
  return Object.prototype.hasOwnProperty.call(DEFAULT_SOURCE_MESSAGES, source);
}

function interpolate(template, vars = {}) {
  return String(template).replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => {
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function t(source, vars = {}) {
  const localePack = getLocaleBaseMessages(activeLocale) || DEFAULT_SOURCE_MESSAGES;
  const defaultPack = DEFAULT_SOURCE_MESSAGES;
  const localeOverridePack = getLocaleOverrideMessages(activeLocale);
  const defaultOverridePack = getLocaleOverrideMessages(DEFAULT_LOCALE);
  const template = localeOverridePack[source] ?? localePack[source] ?? defaultOverridePack[source] ?? defaultPack[source] ?? source;
  return interpolate(template, vars);
}

const _numberFormatCache = new Map();
const _dateTimeFormatCache = new Map();

function _getNumberFormat(locale) {
  if (!_numberFormatCache.has(locale)) {
    _numberFormatCache.set(locale, new Intl.NumberFormat(locale));
  }
  return _numberFormatCache.get(locale);
}

function _getDateTimeFormat(locale, optionsKey, options) {
  const cacheKey = `${locale}::${optionsKey}`;
  if (!_dateTimeFormatCache.has(cacheKey)) {
    _dateTimeFormatCache.set(cacheKey, new Intl.DateTimeFormat(locale, options));
  }
  return _dateTimeFormatCache.get(cacheKey);
}

export function formatNumber(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value ?? '');
  try {
    return _getNumberFormat(getActiveIntlLocale()).format(numeric);
  } catch {
    return String(numeric);
  }
}

export function formatDateTime(value, options = {}) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    const optionsKey = JSON.stringify(options);
    return _getDateTimeFormat(getActiveIntlLocale(), optionsKey, options).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function applyLocaleToDocument(locale = activeLocale) {
  if (typeof document === 'undefined') return locale;
  document.documentElement.lang = getActiveIntlLocale(locale);
  document.documentElement.dir = isRtlLocale(locale) ? 'rtl' : 'ltr';
  document.body?.setAttribute('dir', document.documentElement.dir);
  document.documentElement.dataset.locale = locale;
  return locale;
}

function translateLeafText(el) {
  if (!el) return;
  const source = el.dataset.i18nText || (el.childNodes.length === 1 && el.firstChild.nodeType === Node.TEXT_NODE ? el.textContent : '');
  const trimmed = String(source || '').trim();
  if (!trimmed || !hasSourceMessage(trimmed)) return;
  el.dataset.i18nText = trimmed;
  el.textContent = t(trimmed);
}

function translateAttribute(el, attr, datasetKey) {
  const current = el.getAttribute(attr);
  const source = el.dataset[datasetKey] || current;
  const trimmed = String(source || '').trim();
  if (!trimmed || !hasSourceMessage(trimmed)) return;
  el.dataset[datasetKey] = trimmed;
  el.setAttribute(attr, t(trimmed));
}

let _translateTreeLocale = '';

export function translateTree(root = document.body) {
  if (!root || typeof document === 'undefined') return;
  // All visible strings are already rendered via t() at build time.
  // A full DOM sweep is only needed when the locale has changed since the
  // last call — otherwise it is a no-op that costs a querySelectorAll('*').
  const currentLocale = activeLocale;
  const localeChanged = currentLocale !== _translateTreeLocale;
  _translateTreeLocale = currentLocale;

  if (document.title) {
    const sourceTitle = document.documentElement.dataset.i18nDocumentTitle || document.title;
    if (hasSourceMessage(sourceTitle)) {
      document.documentElement.dataset.i18nDocumentTitle = sourceTitle;
      document.title = t(sourceTitle);
    }
  }

  if (!localeChanged) return;

  if (root.nodeType === Node.ELEMENT_NODE) {
    translateLeafText(root);
    translateAttribute(root, 'placeholder', 'i18nPlaceholder');
    translateAttribute(root, 'title', 'i18nTitle');
    translateAttribute(root, 'aria-label', 'i18nAriaLabel');
  }

  root.querySelectorAll('*').forEach((el) => {
    translateLeafText(el);
    translateAttribute(el, 'placeholder', 'i18nPlaceholder');
    translateAttribute(el, 'title', 'i18nTitle');
    translateAttribute(el, 'aria-label', 'i18nAriaLabel');
  });
}

export function getLocaleOptions() {
  return LOCALE_REGISTRY.map((locale) => ({
    value: locale.code,
    label: `${locale.nativeName} — ${locale.englishName}`,
    rtl: locale.rtl
  }));
}

export async function initI18n(options = {}) {
  const preference = options.preference || await getStoredLocalePreference();
  activePreference = preference;
  const nextLocale = resolveLocale(preference);
  if (nextLocale !== activeLocale) {
    _numberFormatCache.clear();
    _dateTimeFormatCache.clear();
    _translateTreeLocale = ''; // force DOM sweep on next translateTree call
  }
  activeLocale = nextLocale;
  await ensureLocaleMessagesLoaded(DEFAULT_LOCALE);
  await ensureLocaleMessagesLoaded(activeLocale);
  localeOverrides = Object.freeze(options.localeOverrides || await getStoredLocaleOverrides());
  if (options.applyDocument !== false) applyLocaleToDocument(activeLocale);
  return activeLocale;
}

