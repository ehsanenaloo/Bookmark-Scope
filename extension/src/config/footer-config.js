const DEFAULT_FOOTER_ITEMS = Object.freeze([
  Object.freeze({
    id: 'about',
    labelKey: 'About',
    messageKey: 'Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.',
    ctaLabelKey: 'Learn More',
    showCtaButton: true,
    action: 'info'
  }),
  Object.freeze({
    id: 'github',
    labelKey: 'GitHub',
    messageKey: 'Source code, releases, and project details live in your GitHub repo.',
    ctaLabelKey: 'Open GitHub',
    showCtaButton: true,
    url: 'https://github.com/ehsanenaloo/Bookmark-Scope',
    action: 'link'
  }),
  Object.freeze({
    id: 'rate',
    labelKey: 'Rate',
    messageKey: 'Enjoying the extension? A good rating helps the extension build trust faster.',
    ctaLabelKey: 'Rate on Store',
    showCtaButton: true,
    action: 'link'
  }),
  Object.freeze({
    id: 'support',
    labelKey: 'Support',
    messageKey: 'If Bookmark Scope saves you time, you can support the project with a small coffee.',
    ctaLabelKey: 'Buy me a coffee',
    showCtaButton: true,
    url: 'https://buymeacoffee.com/enaloo',
    action: 'link'
  })
]);

export const DEFAULT_FOOTER_NAV_CONFIG = Object.freeze({
  autoRotate: true,
  rotateEveryMs: 5000,
  storeExtensionId: '',
  allowRuntimeReviewFallback: true,
  items: DEFAULT_FOOTER_ITEMS
});

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeRotateEveryMs(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeString(value, fallback = '') {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

function normalizeFooterItem(item, fallbackItem, index) {
  const source = isPlainObject(item) ? item : {};
  const fallback = fallbackItem || {};
  return {
    id: normalizeString(source.id, normalizeString(fallback.id, `item-${index + 1}`)),
    labelKey: normalizeString(source.labelKey, normalizeString(fallback.labelKey)),
    label: normalizeString(source.label, normalizeString(fallback.label)),
    messageKey: normalizeString(source.messageKey, normalizeString(fallback.messageKey)),
    message: normalizeString(source.message, normalizeString(fallback.message)),
    ctaLabelKey: normalizeString(source.ctaLabelKey, normalizeString(fallback.ctaLabelKey)),
    ctaLabel: normalizeString(source.ctaLabel, normalizeString(fallback.ctaLabel)),
    showCtaButton: normalizeBoolean(source.showCtaButton, normalizeBoolean(fallback.showCtaButton, true)),
    url: normalizeString(source.url, normalizeString(fallback.url)),
    action: normalizeString(source.action, normalizeString(fallback.action, 'info'))
  };
}

function createFallbackItemMap(items) {
  return new Map(items.map((item, index) => [normalizeString(item.id, `item-${index + 1}`), item]));
}

function normalizeFooterItems(items, fallbackItems) {
  const fallbackMap = createFallbackItemMap(fallbackItems);
  const sourceItems = Array.isArray(items) && items.length ? items : fallbackItems;

  return sourceItems
    .map((item, index) => {
      const itemId = normalizeString(item?.id, `item-${index + 1}`);
      return normalizeFooterItem(item, fallbackMap.get(itemId) || fallbackItems[index], index);
    })
    .filter((item, index, collection) => item.id && collection.findIndex((candidate) => candidate.id === item.id) === index);
}

export function readFooterNavConfig(rawConfig = globalThis.FOOTER_NAV_CONFIG) {
  const source = isPlainObject(rawConfig) ? rawConfig : {};
  return {
    autoRotate: normalizeBoolean(source.autoRotate, DEFAULT_FOOTER_NAV_CONFIG.autoRotate),
    rotateEveryMs: normalizeRotateEveryMs(source.rotateEveryMs, DEFAULT_FOOTER_NAV_CONFIG.rotateEveryMs),
    storeExtensionId: normalizeString(source.storeExtensionId, DEFAULT_FOOTER_NAV_CONFIG.storeExtensionId),
    allowRuntimeReviewFallback: normalizeBoolean(
      source.allowRuntimeReviewFallback,
      DEFAULT_FOOTER_NAV_CONFIG.allowRuntimeReviewFallback
    ),
    items: normalizeFooterItems(source.items, DEFAULT_FOOTER_NAV_CONFIG.items)
  };
}

export function getFooterReviewUrl(config, runtimeExtensionId = globalThis.chrome?.runtime?.id) {
  const storeExtensionId = normalizeString(config?.storeExtensionId);
  const fallbackExtensionId = normalizeString(runtimeExtensionId);
  const extensionId = storeExtensionId || (config?.allowRuntimeReviewFallback !== false ? fallbackExtensionId : '');
  return extensionId ? `https://chromewebstore.google.com/detail/${extensionId}/reviews` : '';
}
