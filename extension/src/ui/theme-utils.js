/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 */

import { STORAGE_KEYS, THEME_MODES, COLOR_PALETTES } from '../core/constants.js';
import { getLocalStorage, setLocalStorage } from '../services/storage-service.js';

export function resolveThemeMode(mode = THEME_MODES.SYSTEM) {
  if (mode === THEME_MODES.LIGHT) return THEME_MODES.LIGHT;
  if (mode === THEME_MODES.DARK) return THEME_MODES.DARK;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? THEME_MODES.DARK : THEME_MODES.LIGHT;
}

export function applyTheme(mode = THEME_MODES.SYSTEM) {
  const resolved = resolveThemeMode(mode);
  document.documentElement.dataset.themeMode = mode;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function applyPalette(palette = COLOR_PALETTES.TEAL) {
  const valid = Object.values(COLOR_PALETTES);
  document.documentElement.dataset.palette = valid.includes(palette) ? palette : COLOR_PALETTES.TEAL;
}

export async function loadStoredTheme() {
  const stored = await getLocalStorage([STORAGE_KEYS.THEME_MODE]);
  return stored[STORAGE_KEYS.THEME_MODE] || THEME_MODES.SYSTEM;
}

export async function loadStoredPalette() {
  const stored = await getLocalStorage([STORAGE_KEYS.COLOR_PALETTE]);
  return stored[STORAGE_KEYS.COLOR_PALETTE] || COLOR_PALETTES.TEAL;
}

export async function saveThemeMode(mode) {
  await setLocalStorage({ [STORAGE_KEYS.THEME_MODE]: mode });
  return applyTheme(mode);
}

export async function saveColorPalette(palette) {
  await setLocalStorage({ [STORAGE_KEYS.COLOR_PALETTE]: palette });
  applyPalette(palette);
  return palette;
}

export function watchSystemTheme(onChange) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => onChange(media.matches ? THEME_MODES.DARK : THEME_MODES.LIGHT);
  if (typeof media.addEventListener === 'function') media.addEventListener('change', handler);
  else media.addListener(handler);
  return () => {
    if (typeof media.removeEventListener === 'function') media.removeEventListener('change', handler);
    else media.removeListener(handler);
  };
}
