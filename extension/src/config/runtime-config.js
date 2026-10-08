import { DEFAULT_FOOTER_NAV_CONFIG, getFooterReviewUrl, readFooterNavConfig } from './footer-config.js';

/**
 * Returns the resolved runtime footer config.
 *
 * Priority order:
 *  1. A raw config object passed directly (used in tests or by footerConfig.js override).
 *  2. window.FOOTER_NAV_CONFIG set by the classic footerConfig.js script (legacy path,
 *     kept for backward compatibility — the script is no longer required).
 *  3. DEFAULT_FOOTER_NAV_CONFIG defined in footer-config.js (module default).
 *
 * popup.js no longer depends on footerConfig.js loading before popup.js.
 * footerConfig.js may still be included to override config at runtime, but it
 * is now optional — the extension works correctly without it.
 */
export function getRuntimeConfig(rawConfig = globalThis.FOOTER_NAV_CONFIG ?? DEFAULT_FOOTER_NAV_CONFIG) {
  const footer = readFooterNavConfig(rawConfig);
  return {
    footer,
    footerRateUrl: getFooterReviewUrl(footer)
  };
}
