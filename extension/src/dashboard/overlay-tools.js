/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 */

import { runtimeMessages } from '../runtime/messages.js';
import { getBookmarksManagerUrl } from '../platform/browser-api.js';
import { getRuntimeConfig } from '../config/runtime-config.js';
import { USER_GUIDE_URL } from '../config/footer-config.js';
import { featureText as l } from '../locales/feature-messages.js';

export function createOverlayTools(deps) {
  const {
    state,
    t,
    render,
    create,
    createIconButton,
    createIconElement,
    trapFocus,
    sendMessage,
    setPinOnboardingVisible,
    getFixedMenuPosition,
    applyFixedMenuPosition,
    clampFixedMenuToViewport,
    createThemeControls,
    updateColorPalette,
    COLOR_PALETTES,
    getManifest,
    getRuntimeUrl
  } = deps;

  // Prefer targeted overlay-only re-render; fall back to full render if not provided
  const renderOverlays = deps.renderOverlaysOnly || render;

  function closeAboutModal() {
    if (!state.aboutOpen) return;
    state.aboutOpen = false;
    render();
  }

  function createAboutFeatureCard(icon, title, copy) {
    const card = create('div', 'about-feature-card compact dashboard-about-feature-card');
    const iconWrap = create('div', 'about-feature-icon dashboard-about-feature-icon');
    iconWrap.append(createIconElement(icon));

    const copyWrap = create('div', 'about-feature-copy-wrap dashboard-about-feature-copy-wrap');
    copyWrap.append(
      create('div', 'about-feature-title dashboard-about-feature-title', title),
      create('div', 'about-copy about-copy-muted about-feature-copy dashboard-about-feature-copy', copy)
    );

    card.append(iconWrap, copyWrap);
    return card;
  }

  function closeConfirmDialog(result = false) {
    if (!state.confirmDialog) return;
    const { resolve } = state.confirmDialog;
    state.confirmDialog = null;
    render();
    if (typeof resolve === 'function') resolve(Boolean(result));
  }

  function showConfirmDialog({ title = t('Confirm action'), message = '', confirmLabel = t('Confirm'), cancelLabel = t('Cancel'), danger = false } = {}) {
    return new Promise((resolve) => {
      state.confirmDialog = { title, message, confirmLabel, cancelLabel, danger, resolve };
      render();
    });
  }

  function renderConfirmDialog(root) {
    if (!state.confirmDialog) return;
    const overlay = create('div', 'modal-overlay confirm-dialog-overlay');
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeConfirmDialog(false);
    });

    const modal = create('div', 'modal-card confirm-dialog dashboard-confirm-dialog');
    const head = create('div', 'confirm-dialog-head');
    const title = create('div', 'confirm-dialog-title', state.confirmDialog.title);
    const close = createIconButton('close', t('Close confirmation dialog'), 'icon-button mono-icon-button modal-close confirm-dialog-close');
    close.addEventListener('click', () => closeConfirmDialog(false));
    head.append(title, close);

    const body = create('div', 'confirm-dialog-body');
    body.append(create('div', 'confirm-dialog-copy', state.confirmDialog.message));

    const actions = create('div', 'confirm-dialog-actions');
    const cancel = create('button', 'ghost-button confirm-dialog-cancel', state.confirmDialog.cancelLabel || t('Cancel'));
    cancel.type = 'button';
    cancel.addEventListener('click', () => closeConfirmDialog(false));
    const confirm = create('button', `${state.confirmDialog.danger ? 'button danger' : 'primary-button'} confirm-dialog-confirm`, state.confirmDialog.confirmLabel || t('Confirm'));
    confirm.type = 'button';
    confirm.addEventListener('click', () => closeConfirmDialog(true));
    actions.append(cancel, confirm);

    modal.append(head, body, actions);
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', state.confirmDialog.title);
    overlay.append(modal);
    root.append(overlay);

    const releaseTrap = trapFocus(modal);
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { releaseTrap(); closeConfirmDialog(false); }
    });
  }

  function getAboutLinks() {
    const { footer, footerRateUrl } = getRuntimeConfig();
    const find = (id) => footer.items.find((item) => item.id === id) || {};
    return {
      github: find('github').url || 'https://github.com/ehsanenaloo/Bookmark-Scope',
      rate: find('rate').url || footerRateUrl,
      support: find('support').url || 'https://buymeacoffee.com/enaloo'
    };
  }

  function createAboutLinkButton(icon, label, url, extraClass = 'secondary') {
    const button = create('button', 'button about-link-button ' + extraClass);
    button.type = 'button';
    button.append(createIconElement(icon, 'icon-svg about-link-icon'), create('span', '', label));
    button.addEventListener('click', () => { if (url) sendMessage(runtimeMessages.openUrl(url)); });
    return button;
  }

  function createAboutDetailRow(icon, label, valueNode) {
    const row = create('div', 'about-detail-row');
    const term = create('dt', 'about-detail-term');
    term.append(createIconElement(icon, 'icon-svg about-detail-icon'), create('span', '', label));
    const value = create('dd', 'about-detail-value');
    value.append(valueNode);
    row.append(term, value);
    return row;
  }

  function createShortcutHint() {
    const wrap = create('span', 'about-shortcut');
    const keys = create('span', 'about-shortcut-keys');
    keys.dir = 'ltr';
    keys.append(
      create('kbd', '', 'Ctrl/Cmd'), create('span', 'about-shortcut-plus', '+'),
      create('kbd', '', 'Shift'), create('span', 'about-shortcut-plus', '+'),
      create('kbd', '', 'P')
    );
    wrap.append(keys, create('span', 'about-shortcut-label', l('Open the command palette')));
    return wrap;
  }

  function renderAboutModal(root) {
    if (!state.aboutOpen) return;
    const { version } = getManifest();
    const links = getAboutLinks();
    const overlay = create('div', 'modal-overlay');
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeAboutModal();
    });

    const modal = create('div', 'modal-card about-modal dashboard-about-modal');
    const head = create('div', 'about-head');
    const icon = create('img', 'about-icon');
    icon.alt = '';
    icon.src = getRuntimeUrl('icons/icon-48.png');
    const meta = create('div', 'about-meta');
    meta.append(
      create('div', 'about-title', t('Bookmark Scope')),
      create('div', 'about-version', t('Version {{version}}', { version }))
    );
    const close = createIconButton('close', t('Close about dialog'), 'icon-button mono-icon-button modal-close');
    close.addEventListener('click', closeAboutModal);
    head.append(icon, meta, close);

    const body = create('div', 'about-body dashboard-about-body');

    const intro = create('section', 'about-intro');
    intro.append(
      create('div', 'about-kicker', t('Bookmark control without the sludge.')),
      create('div', 'about-copy about-copy-muted', l('Find, organize and clean up your Chrome bookmarks by page, site and domain.'))
    );

    const features = create('section', 'about-section dashboard-about-section');
    features.append(create('div', 'about-section-title', t('What it does')));
    const featureList = create('div', 'about-feature-grid dashboard-about-feature-grid');
    featureList.append(
      createAboutFeatureCard('overview', t('Fast scope switching'), t('Move from page to host, domain, or full-library views in a couple of clicks.')),
      createAboutFeatureCard('history', t('Cleanup that stays reversible'), t('Review duplicates, stale bookmarks, and fixes with history and undo-friendly workflows.')),
      createAboutFeatureCard('cleanup', t('Dashboard-grade maintenance'), t('Use the full dashboard for triage, cleanup passes, health scans, and longer review sessions.'))
    );
    features.append(featureList);

    const actions = create('div', 'about-actions dashboard-about-actions');
    actions.append(
      createAboutLinkButton('help', l('User guide'), USER_GUIDE_URL),
      createAboutLinkButton('github', t('GitHub'), links.github),
      createAboutLinkButton('star', t('Rate on Store'), links.rate),
      createAboutLinkButton('coffee', t('Buy me a coffee'), links.support, 'primary')
    );

    const details = create('dl', 'about-details');
    details.append(
      createAboutDetailRow('edit', l('Author'), create('span', '', t('Made by Ehsan Enaloo.').replace(/[.。।۔]$/, ''))),
      createAboutDetailRow('shield', l('Privacy'), create('span', '', l('Everything stays in your browser. No analytics.'))),
      createAboutDetailRow('keyboard', l('Keyboard shortcut'), createShortcutHint()),
      createAboutDetailRow('layers', l('License'), create('span', '', l('MIT License. Third-party: Public Suffix List (MPL-2.0), Lucide icons (ISC).')))
    );

    const footer = create('div', 'about-footer-note dashboard-about-footer', t('Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.'));

    body.append(intro, actions, features, details, footer);
    modal.append(head, body);
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', t('About Bookmark Scope'));
    overlay.append(modal);
    root.append(overlay);

    const releaseTrap = trapFocus(modal);
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { releaseTrap(); closeAboutModal(); }
    });
  }

  async function dismissPinOnboarding() {
    state.pinOnboardingVisible = false;
    await setPinOnboardingVisible(false);
    render();
  }

  function renderPinOnboarding(root) {
    if (!state.pinOnboardingVisible) return;
    const section = create('div', 'section dashboard-pin-onboarding');
    const card = create('div', 'pin-onboarding-card dashboard-pin-onboarding-card');
    const body = create('div', 'pin-onboarding-body');
    body.append(
      create('div', 'pin-onboarding-eyebrow', t('Quick setup')),
      create('div', 'pin-onboarding-title', t('Pin Bookmark Scope for one-click access')),
      create('div', 'pin-onboarding-copy', t('Open the Extensions menu, find Bookmark Scope, then click the pin icon for one-click access.')),
      create('div', 'pin-onboarding-steps', t('Extensions menu → Bookmark Scope → Pin'))
    );
    const actions = create('div', 'pin-onboarding-actions');
    const dismiss = create('button', 'button pin-onboarding-button', t('Got it'));
    dismiss.type = 'button';
    dismiss.addEventListener('click', dismissPinOnboarding);
    actions.append(dismiss);
    card.append(body, actions);
    section.append(card);
    root.append(section);
  }

  function closeHeaderMenu() {
    if (!state.headerMenuOpen && !state.headerMenuPosition) return;
    state.headerMenuOpen = false;
    state.headerMenuPosition = null;
    renderOverlays();
  }

  function toggleHeaderMenu(anchorElement) {
    if (state.headerMenuOpen) {
      state.headerMenuOpen = false;
      state.headerMenuPosition = null;
      renderOverlays();
      return;
    }

    state.listHeadMenuOpen = false;
    state.listHeadMenuPosition = null;
    state.headerMenuPosition = anchorElement ? getFixedMenuPosition(anchorElement.getBoundingClientRect()) : null;
    state.headerMenuOpen = true;
    renderOverlays();
  }

  function openSupportLink() {
    sendMessage(runtimeMessages.openUrl('https://buymeacoffee.com/enaloo'));
  }

  function closeListHeadMenu() {
    if (!state.listHeadMenuOpen && !state.listHeadMenuPosition) return;
    state.listHeadMenuOpen = false;
    state.listHeadMenuPosition = null;
    renderOverlays();
  }

  function toggleListHeadMenu(anchorElement) {
    if (state.listHeadMenuOpen) {
      state.listHeadMenuOpen = false;
      state.listHeadMenuPosition = null;
      renderOverlays();
      return;
    }

    state.headerMenuOpen = false;
    state.headerMenuPosition = null;
    state.listHeadMenuPosition = anchorElement ? getFixedMenuPosition(anchorElement.getBoundingClientRect()) : null;
    state.listHeadMenuOpen = true;
    renderOverlays();
  }

  function createDashboardMenuItem(icon, label, handler, { danger = false, disabled = false, menu = 'list' } = {}) {
    const button = create('button', `dashboard-header-menu-item${danger ? ' danger' : ''}`);
    button.type = 'button';
    button.setAttribute('role', 'menuitem');
    button.disabled = disabled;
    button.append(createIconElement(icon, 'dashboard-header-menu-icon'), create('span', 'dashboard-header-menu-label', label));
    button.addEventListener('click', async () => {
      if (disabled) return;
      if (menu === 'header') {
        state.headerMenuOpen = false;
        state.headerMenuPosition = null;
      } else {
        state.listHeadMenuOpen = false;
        state.listHeadMenuPosition = null;
      }
      render();
      await handler();
    });
    return button;
  }

  function createListHeadActionsMenu(options = {}) {
    const wrap = create('div', 'dashboard-list-actions-menu-wrap dashboard-header-menu-wrap');
    const menuButton = createIconButton('moreVertical', t('More actions'), 'icon-button mono-icon-button dashboard-menu-button dashboard-list-menu-button');
    menuButton.setAttribute('aria-haspopup', 'menu');
    menuButton.setAttribute('aria-expanded', state.listHeadMenuOpen ? 'true' : 'false');
    menuButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleListHeadMenu(event.currentTarget);
    });
    wrap.append(menuButton);
    wrap._menuItems = options.items || [];
    return wrap;
  }

  function renderHeaderMenuOverlay(root) {
    if (!state.headerMenuOpen || !state.headerMenuPosition) return;

    const menu = create('div', 'dashboard-header-menu dashboard-header-menu-portal dashboard-menu-portal');
    menu.setAttribute('role', 'menu');
    menu.addEventListener('click', (event) => event.stopPropagation());
    applyFixedMenuPosition(menu, state.headerMenuPosition);

    menu.append(
      createDashboardMenuItem('info', t('About'), async () => { state.aboutOpen = true; render(); }, { menu: 'header' }),
      ...(getBookmarksManagerUrl() ? [createDashboardMenuItem('bookmarks', t('Open Chrome bookmarks'), async () => sendMessage(runtimeMessages.openUrl(getBookmarksManagerUrl())), { menu: 'header' })] : []),
      createDashboardMenuItem('settings', t('Settings'), async () => sendMessage(runtimeMessages.openUrl(getRuntimeUrl('pages/options/options.html'))), { menu: 'header' })
    );

    menu.append(create('div', 'dashboard-header-menu-divider'));

    const themeSection = create('div', 'dashboard-header-menu-theme');
    themeSection.append(create('div', 'dashboard-header-menu-section-title', t('Theme')));
    const themeControls = createThemeControls();
    themeControls.classList.add('dashboard-theme-controls-menu');
    themeSection.append(themeControls);

    const paletteSection = create('div', 'dashboard-header-menu-palette');
    paletteSection.append(create('div', 'dashboard-header-menu-section-title', t('Color palette')));
    const paletteButtons = create('div', 'dashboard-palette-controls');
    [
      [COLOR_PALETTES.TEAL,    t('Teal'),    '#00897b'],
      [COLOR_PALETTES.BLUE,    t('Blue'),    '#1a73e8'],
      [COLOR_PALETTES.INDIGO,  t('Indigo'),  '#3949ab'],
      [COLOR_PALETTES.NEUTRAL, t('Neutral'), '#5f6368']
    ].forEach(([value, label, color]) => {
      const btn = create('button', `palette-swatch-btn${state.colorPalette === value ? ' active' : ''}`);
      btn.type = 'button';
      btn.title = label;
      btn.dataset.paletteControl = value;
      btn.setAttribute('aria-pressed', state.colorPalette === value ? 'true' : 'false');
      btn.setAttribute('aria-label', label);
      btn.style.setProperty('--swatch-color', color);
      btn.addEventListener('click', () => updateColorPalette(value));
      paletteButtons.append(btn);
    });
    paletteSection.append(paletteButtons);

    menu.append(themeSection, paletteSection);

    root.append(menu);
    clampFixedMenuToViewport(menu);
  }

  function renderListHeadMenuOverlay(root, items = []) {
    if (!state.listHeadMenuOpen || !state.listHeadMenuPosition) return;

    const menu = create('div', 'dashboard-header-menu dashboard-list-head-menu dashboard-list-head-menu-portal dashboard-menu-portal');
    menu.setAttribute('role', 'menu');
    menu.addEventListener('click', (event) => event.stopPropagation());
    applyFixedMenuPosition(menu, state.listHeadMenuPosition);

    for (const item of items) {
      if (item === 'divider') {
        menu.append(create('div', 'dashboard-header-menu-divider'));
        continue;
      }
      menu.append(createDashboardMenuItem(item.icon, item.label, item.handler, {
        danger: Boolean(item.danger),
        disabled: Boolean(item.disabled),
        menu: 'list'
      }));
    }

    root.append(menu);
    clampFixedMenuToViewport(menu);
  }

  return {
    closeAboutModal,
    closeConfirmDialog,
    showConfirmDialog,
    renderConfirmDialog,
    renderAboutModal,
    renderPinOnboarding,
    closeHeaderMenu,
    toggleHeaderMenu,
    openSupportLink,
    closeListHeadMenu,
    toggleListHeadMenu,
    createListHeadActionsMenu,
    renderHeaderMenuOverlay,
    renderListHeadMenuOverlay
  };
}
