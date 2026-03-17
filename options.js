import { MATCH_MODES, SORT_OPTIONS, POPUP_WIDTHS, MERGE_STRATEGIES, STORAGE_KEYS, THEME_MODES } from './src/constants.js';
import { applyTheme, loadStoredTheme, watchSystemTheme } from './src/theme-utils.js';

const defaults = {
  [STORAGE_KEYS.POPUP_MODE]: MATCH_MODES.DOMAIN,
  [STORAGE_KEYS.POPUP_SORT]: SORT_OPTIONS.TITLE_ASC,
  [STORAGE_KEYS.IGNORE_QUERY]: false,
  [STORAGE_KEYS.IGNORE_HASH]: true,
  [STORAGE_KEYS.POPUP_WIDTH]: POPUP_WIDTHS.COMFORTABLE,
  [STORAGE_KEYS.MERGE_STRATEGY]: MERGE_STRATEGIES.KEEP_NEWEST,
  [STORAGE_KEYS.CLEANUP_FILTER]: 'all',
  [STORAGE_KEYS.THEME_MODE]: THEME_MODES.SYSTEM
};

const el = {
  form: document.getElementById('settings-form'),
  defaultMode: document.getElementById('default-mode'),
  defaultSort: document.getElementById('default-sort'),
  popupWidth: document.getElementById('popup-width'),
  themeMode: document.getElementById('theme-mode'),
  mergeStrategy: document.getElementById('merge-strategy'),
  ignoreQuery: document.getElementById('ignore-query'),
  ignoreHash: document.getElementById('ignore-hash'),
  reset: document.getElementById('reset-defaults'),
  status: document.getElementById('status')
};

function fillSelect(select, entries) {
  select.textContent = '';
  for (const [value, label] of entries) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
}

function setStatus(message) {
  el.status.textContent = message;
  window.clearTimeout(setStatus.timer);
  setStatus.timer = window.setTimeout(() => {
    el.status.textContent = '';
  }, 2200);
}

async function load() {
  fillSelect(el.defaultMode, [
    [MATCH_MODES.PAGE, 'This page'],
    [MATCH_MODES.HOST, 'This host'],
    [MATCH_MODES.DOMAIN, 'This domain']
  ]);
  fillSelect(el.defaultSort, [
    [SORT_OPTIONS.TITLE_ASC, 'Title'],
    [SORT_OPTIONS.URL_ASC, 'URL'],
    [SORT_OPTIONS.NEWEST, 'Newest'],
    [SORT_OPTIONS.OLDEST, 'Oldest'],
    [SORT_OPTIONS.PATH_ASC, 'Folder path']
  ]);
  fillSelect(el.popupWidth, [
    [POPUP_WIDTHS.COMPACT, 'Compact'],
    [POPUP_WIDTHS.COMFORTABLE, 'Comfortable']
  ]);
  fillSelect(el.themeMode, [
    [THEME_MODES.SYSTEM, 'System'],
    [THEME_MODES.LIGHT, 'Light'],
    [THEME_MODES.DARK, 'Dark']
  ]);
  fillSelect(el.mergeStrategy, [
    [MERGE_STRATEGIES.KEEP_NEWEST, 'Keep newest bookmark'],
    [MERGE_STRATEGIES.KEEP_OLDEST, 'Keep oldest bookmark']
  ]);

  const stored = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
  el.defaultMode.value = stored[STORAGE_KEYS.POPUP_MODE] || defaults[STORAGE_KEYS.POPUP_MODE];
  el.defaultSort.value = stored[STORAGE_KEYS.POPUP_SORT] || defaults[STORAGE_KEYS.POPUP_SORT];
  el.popupWidth.value = stored[STORAGE_KEYS.POPUP_WIDTH] || defaults[STORAGE_KEYS.POPUP_WIDTH];
  el.themeMode.value = stored[STORAGE_KEYS.THEME_MODE] || defaults[STORAGE_KEYS.THEME_MODE];
  el.mergeStrategy.value = stored[STORAGE_KEYS.MERGE_STRATEGY] || defaults[STORAGE_KEYS.MERGE_STRATEGY];
  el.ignoreQuery.checked = Boolean(stored[STORAGE_KEYS.IGNORE_QUERY]);
  el.ignoreHash.checked = stored[STORAGE_KEYS.IGNORE_HASH] !== false;
  applyTheme(el.themeMode.value);
}

async function save(event) {
  event.preventDefault();
  await chrome.storage.local.set({
    [STORAGE_KEYS.POPUP_MODE]: el.defaultMode.value,
    [STORAGE_KEYS.POPUP_SORT]: el.defaultSort.value,
    [STORAGE_KEYS.POPUP_WIDTH]: el.popupWidth.value,
    [STORAGE_KEYS.THEME_MODE]: el.themeMode.value,
    [STORAGE_KEYS.MERGE_STRATEGY]: el.mergeStrategy.value,
    [STORAGE_KEYS.IGNORE_QUERY]: el.ignoreQuery.checked,
    [STORAGE_KEYS.IGNORE_HASH]: el.ignoreHash.checked
  });
  applyTheme(el.themeMode.value);
  setStatus('Settings saved. The extension is slightly less feral now.');
}

async function resetDefaults() {
  await chrome.storage.local.set(defaults);
  await load();
  applyTheme(el.themeMode.value);
  setStatus('Defaults restored. Back to sensible behavior.');
}

el.form.addEventListener('submit', save);
el.reset.addEventListener('click', resetDefaults);
load();

let stopWatchingTheme = null;
(async function setupTheme(){
  const mode = await loadStoredTheme();
  applyTheme(mode);
  stopWatchingTheme = watchSystemTheme(() => {
    if ((document.documentElement.dataset.themeMode || 'system') === THEME_MODES.SYSTEM) applyTheme(THEME_MODES.SYSTEM);
  });
})();
