/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 */

import {
  MATCH_MODES,
  SORT_OPTIONS,
  POPUP_WIDTHS,
  MERGE_STRATEGIES,
  STORAGE_KEYS,
  THEME_MODES,
  COLOR_PALETTES,
  OPTIONAL_HOST_PATTERNS
} from './src/constants.js';
import { applyTheme, applyPalette, loadStoredTheme, loadStoredPalette, saveColorPalette, watchSystemTheme } from './src/theme-utils.js';
import { getLocalStorage, initializeStorageLayer, setLocalStorage } from './src/services/storage-service.js';
import { OPTION_PAGE_DEFAULTS } from './src/services/storage-schema.js';
import { createLogger } from './src/services/diagnostics-service.js';
import { loadBgHealthScanSettings, saveBgHealthScanSettings } from './src/services/scheduled-health-scan-service.js';
import { containsPermissions, requestPermissions } from './src/platform/browser-api.js';
import { getReviewReminderSettings, DAY_MS } from './src/services/review-reminder-service.js';
import { saveReviewReminderPreferences } from './src/services/preferences-service.js';
import { now } from './src/platform/time.js';
import {
  AUTO_LOCALE,
  getLocaleOptions,
  initI18n,
  setStoredLocalePreference,
  t,
  translateTree
} from './src/i18n.js';

const logger = createLogger('options');

// Defaults are exported from storage-schema.js so that any change to the
// schema is automatically reflected here without manual duplication.
const defaults = OPTION_PAGE_DEFAULTS;

const el = {
  form: document.getElementById('settings-form'),
  defaultMode: document.getElementById('default-mode'),
  defaultSort: document.getElementById('default-sort'),
  popupWidth: document.getElementById('popup-width'),
  themeMode: document.getElementById('theme-mode'),
  colorPalette: document.getElementById('color-palette'),
  localePreference: document.getElementById('locale-preference'),
  mergeStrategy: document.getElementById('merge-strategy'),
  ignoreQuery: document.getElementById('ignore-query'),
  ignoreHash: document.getElementById('ignore-hash'),
  bgScanEnabled: document.getElementById('bg-scan-enabled'),
  bgScanInterval: document.getElementById('bg-scan-interval'),
  bgScanStatus: document.getElementById('bg-scan-status'),
  reminderEnabled: document.getElementById('review-reminder-enabled'),
  reminderInterval: document.getElementById('review-reminder-interval'),
  reset: document.getElementById('reset-defaults'),
  status: document.getElementById('status')
};

function fillSelect(select, entries) {
  const selectedValue = select.value;
  select.textContent = '';
  for (const [value, label] of entries) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  if (entries.some(([value]) => value === selectedValue)) select.value = selectedValue;
}

function populateSelects() {
  fillSelect(el.defaultMode, [
    [MATCH_MODES.PAGE, t('This page')],
    [MATCH_MODES.HOST, t('This host')],
    [MATCH_MODES.DOMAIN, t('This domain')]
  ]);
  fillSelect(el.defaultSort, [
    [SORT_OPTIONS.TITLE_ASC, t('Title')],
    [SORT_OPTIONS.URL_ASC, t('URL')],
    [SORT_OPTIONS.NEWEST, t('Newest')],
    [SORT_OPTIONS.OLDEST, t('Oldest')],
    [SORT_OPTIONS.PATH_ASC, t('Folder path')]
  ]);
  fillSelect(el.popupWidth, [
    [POPUP_WIDTHS.COMPACT, t('Compact')],
    [POPUP_WIDTHS.COMFORTABLE, t('Comfortable')]
  ]);
  fillSelect(el.themeMode, [
    [THEME_MODES.SYSTEM, t('System')],
    [THEME_MODES.LIGHT, t('Light')],
    [THEME_MODES.DARK, t('Dark')]
  ]);
  fillSelect(el.colorPalette, [
    [COLOR_PALETTES.TEAL,    t('Teal')],
    [COLOR_PALETTES.BLUE,    t('Blue')],
    [COLOR_PALETTES.INDIGO,  t('Indigo')],
    [COLOR_PALETTES.NEUTRAL, t('Neutral')]
  ]);
  fillSelect(el.localePreference, [
    [AUTO_LOCALE, t('Auto (browser)')],
    ...getLocaleOptions().map((locale) => [locale.value, locale.label])
  ]);
  fillSelect(el.mergeStrategy, [
    [MERGE_STRATEGIES.KEEP_NEWEST, t('Keep newest bookmark')],
    [MERGE_STRATEGIES.KEEP_OLDEST, t('Keep oldest bookmark')]
  ]);
}

function localizeStaticContent() {
  document.title = t('Bookmark Scope Settings');
  translateTree(document.body);
}

function setStatus(message) {
  el.status.textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    el.status.textContent = '';
  }, 2200);
}

async function load() {
  const storage = await initializeStorageLayer();
  await initI18n();
  await logger.info('options_loaded', { storageMigrated: storage.migrated, previousVersion: storage.previousVersion });
  populateSelects();

  const stored = await getLocalStorage(Object.values(STORAGE_KEYS));
  el.defaultMode.value = stored[STORAGE_KEYS.POPUP_MODE] || defaults[STORAGE_KEYS.POPUP_MODE];
  el.defaultSort.value = stored[STORAGE_KEYS.POPUP_SORT] || defaults[STORAGE_KEYS.POPUP_SORT];
  el.popupWidth.value = stored[STORAGE_KEYS.POPUP_WIDTH] || defaults[STORAGE_KEYS.POPUP_WIDTH];
  el.themeMode.value = stored[STORAGE_KEYS.THEME_MODE] || defaults[STORAGE_KEYS.THEME_MODE];
  el.colorPalette.value = stored[STORAGE_KEYS.COLOR_PALETTE] || defaults[STORAGE_KEYS.COLOR_PALETTE];
  el.localePreference.value = stored[STORAGE_KEYS.LOCALE_PREFERENCE] || defaults[STORAGE_KEYS.LOCALE_PREFERENCE];
  el.mergeStrategy.value = stored[STORAGE_KEYS.MERGE_STRATEGY] || defaults[STORAGE_KEYS.MERGE_STRATEGY];
  el.ignoreQuery.checked = Boolean(stored[STORAGE_KEYS.IGNORE_QUERY]);
  el.ignoreHash.checked = stored[STORAGE_KEYS.IGNORE_HASH] !== false;

  // Scheduled health-scan section.
  const bgSettings = await loadBgHealthScanSettings();
  el.bgScanEnabled.checked = bgSettings.enabled;
  el.bgScanInterval.value = String(bgSettings.intervalDays);
  await updateBgScanStatus(bgSettings);

  // Review reminders section.
  const reminder = await getReviewReminderSettings();
  el.reminderEnabled.checked = reminder.enabled;
  el.reminderInterval.value = String(reminder.intervalDays);

  applyTheme(el.themeMode.value);
  applyPalette(el.colorPalette.value);
  localizeStaticContent();
}

/**
 * Updates the small status line under the bg-scan section with a humane
 * summary of when it last ran and how many broken links it found.
 */
async function updateBgScanStatus(settings) {
  if (!el.bgScanStatus) return;
  if (!settings.enabled) {
    el.bgScanStatus.textContent = t('Background scan is off.');
    return;
  }
  if (!settings.lastRunAt) {
    el.bgScanStatus.textContent = t('Background scan is on. First scan will run shortly.');
    return;
  }
  const last = new Date(settings.lastRunAt);
  const lastStr = last.toLocaleString();
  el.bgScanStatus.textContent = t(
    'Last scan: {{when}}. {{broken}} bookmarks currently look broken.',
    { when: lastStr, broken: settings.lastBrokenCount }
  );
}

async function save(event) {
  event.preventDefault();
  await setLocalStorage({
    [STORAGE_KEYS.POPUP_MODE]: el.defaultMode.value,
    [STORAGE_KEYS.POPUP_SORT]: el.defaultSort.value,
    [STORAGE_KEYS.POPUP_WIDTH]: el.popupWidth.value,
    [STORAGE_KEYS.THEME_MODE]: el.themeMode.value,
    [STORAGE_KEYS.COLOR_PALETTE]: el.colorPalette.value,
    [STORAGE_KEYS.MERGE_STRATEGY]: el.mergeStrategy.value,
    [STORAGE_KEYS.IGNORE_QUERY]: el.ignoreQuery.checked,
    [STORAGE_KEYS.IGNORE_HASH]: el.ignoreHash.checked
  });
  await setStoredLocalePreference(el.localePreference.value);

  // Persisting bg-scan settings goes through its own service so the
  // sanitisation (interval clamp, default fallback) stays in one place.
  // Enabling the scan also requires the optional host permission; ask
  // for it inline so the user doesn't have to dig around for it.
  let bgEnabled = el.bgScanEnabled.checked;
  if (bgEnabled) {
    const perm = { origins: [...OPTIONAL_HOST_PATTERNS] };
    const already = await containsPermissions(perm);
    if (!already) {
      const granted = await requestPermissions(perm);
      if (!granted) {
        bgEnabled = false;
        el.bgScanEnabled.checked = false;
        setStatus(t('Background scan needs site-access permission. It was not enabled.'));
      }
    }
  }
  await saveBgHealthScanSettings({
    enabled: bgEnabled,
    intervalDays: Number(el.bgScanInterval.value) || 7
  });
  // Reflect any clamping (e.g. user typed "100" → stored as 90) in the form.
  const refreshed = await loadBgHealthScanSettings();
  el.bgScanInterval.value = String(refreshed.intervalDays);
  await updateBgScanStatus(refreshed);

  // Review reminders: the background worker re-arms its alarm when these keys change.
  const previous = await getReviewReminderSettings();
  const reminderEnabled = el.reminderEnabled.checked;
  const reminderInterval = Math.min(365, Math.max(1, Math.round(Number(el.reminderInterval.value)) || 14));
  const intervalChanged = reminderInterval !== previous.intervalDays;
  let nextReviewAt = 0;
  if (reminderEnabled) {
    nextReviewAt = previous.enabled && previous.nextReviewAt && !intervalChanged
      ? previous.nextReviewAt
      : (previous.lastReviewAt || now()) + reminderInterval * DAY_MS;
    if (nextReviewAt <= now()) nextReviewAt = now() + reminderInterval * DAY_MS;
  }
  await saveReviewReminderPreferences({
    enabled: reminderEnabled,
    intervalDays: reminderInterval,
    lastReviewAt: previous.lastReviewAt,
    nextReviewAt
  });
  el.reminderInterval.value = String(reminderInterval);

  await initI18n();
  applyTheme(el.themeMode.value);
  applyPalette(el.colorPalette.value);
  populateSelects();
  localizeStaticContent();
  await logger.info('settings_saved', { localePreference: el.localePreference.value, themeMode: el.themeMode.value, bgScanEnabled: bgEnabled });
  setStatus(t('Settings saved. The extension is slightly less feral now.'));
}

async function resetDefaults() {
  await setLocalStorage(defaults);
  await initI18n({ preference: AUTO_LOCALE });
  await load();
  applyTheme(el.themeMode.value);
  await logger.info('settings_reset_to_defaults');
  setStatus(t('Defaults restored. Back to sensible behavior.'));
}

el.form.addEventListener('submit', save);
el.reset.addEventListener('click', resetDefaults);
load();

let stopWatchingTheme = null;
(async function setupTheme() {
  const mode = await loadStoredTheme();
  applyTheme(mode);
  stopWatchingTheme = watchSystemTheme(() => {
    if ((document.documentElement.dataset.themeMode || 'system') === THEME_MODES.SYSTEM) applyTheme(THEME_MODES.SYSTEM);
  });
})();

// pagehide is the modern replacement for unload — fires reliably on tab
// close, navigation away, and when the page is moved into the bfcache.
// unload can be silently skipped by the browser in many of those cases.
window.addEventListener('pagehide', () => {
  stopWatchingTheme?.();
});
