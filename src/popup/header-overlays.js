import { createTab, getManifest, getRuntimeUrl } from '../platform/browser-api.js';
import { featureText } from '../locales/feature-messages.js';
import { MATCH_MODES, OLD_BOOKMARK_DAYS, SORT_OPTIONS, THEME_MODES, COLOR_PALETTES } from '../constants.js';

export function createPopupHeaderOverlays(deps) {
  const {
    state,
    formatNumber,
    iconSvg,
    createIconButton,
    createIconElement,
    trapFocus,
    t,
    create,
    groupDuplicates,
    actions
  } = deps;

  function modeLabel(mode) {
    switch (mode) {
      case MATCH_MODES.PAGE:
        return t('This page');
      case MATCH_MODES.HOST:
        return t('This host');
      default:
        return t('This domain');
    }
  }

  function duplicateGroupsCount(items) {
    return groupDuplicates(items).size;
  }

  let popupMenuOutsideHandlersBound = false;

  function setOverflowTriggerExpanded(expanded) {
    document.querySelectorAll('.overflow-trigger').forEach((button) => {
      button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    });
  }

  function hardCloseOverflowMenu() {
    state.menuOpen = false;
    setOverflowTriggerExpanded(false);
    detachPopupMenuDismissHandlers();
  }

  function detachPopupMenuDismissHandlers() {
    if (!popupMenuOutsideHandlersBound) return;
    document.removeEventListener('pointerdown', onPopupMenuPointerDown, true);
    document.removeEventListener('keydown', onPopupMenuKeyDown, true);
    popupMenuOutsideHandlersBound = false;
  }

  function attachPopupMenuDismissHandlers() {
    if (popupMenuOutsideHandlersBound) return;
    document.addEventListener('pointerdown', onPopupMenuPointerDown, true);
    document.addEventListener('keydown', onPopupMenuKeyDown, true);
    popupMenuOutsideHandlersBound = true;
  }

  function onPopupMenuPointerDown(event) {
    const menu = document.querySelector('.header-overflow');
    if (!menu || menu.contains(event.target)) return;
    closeOverflowMenu();
  }

  function onPopupMenuKeyDown(event) {
    if (event.key === 'Escape') closeOverflowMenu();
  }

  function syncPopupMenuGlobalHandlers() {
    if (state.menuOpen) {
      attachPopupMenuDismissHandlers();
      setOverflowTriggerExpanded(true);
    } else {
      detachPopupMenuDismissHandlers();
      setOverflowTriggerExpanded(false);
    }
  }

  function toggleOverflowMenu() {
    state.menuOpen = !state.menuOpen;
    deps.render();
  }

  function closeOverflowMenu(options = {}) {
    const { rerender = true } = options;
    if (!state.menuOpen) return;
    state.menuOpen = false;
    if (rerender) deps.render();
    else {
      setOverflowTriggerExpanded(false);
      syncPopupMenuGlobalHandlers();
    }
  }

  function updateThemeControls() {
    document.querySelectorAll('[data-theme-control]').forEach((button) => {
      const active = button.dataset.themeControl === state.themeMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function createThemeControls() {
    const wrap = create('div', 'theme-controls');
    const items = [
      { mode: THEME_MODES.SYSTEM, icon: 'system', title: t('Follow system theme') },
      { mode: THEME_MODES.LIGHT, icon: 'light', title: t('Use light theme') },
      { mode: THEME_MODES.DARK, icon: 'dark', title: t('Use dark theme') }
    ];
    for (const item of items) {
      const button = createIconButton(item.icon, item.title, 'icon-button mono-icon-button theme-button');
      button.dataset.themeControl = item.mode;
      button.addEventListener('click', () => actions.updateThemeMode(item.mode));
      wrap.append(button);
    }
    return wrap;
  }

  function closeAboutModal() {
    if (!state.aboutOpen) return;
    state.aboutOpen = false;
    deps.render();
  }

  function openPopupSupportLink() {
    createTab({ url: 'https://buymeacoffee.com/enaloo', active: true });
  }

  function createAboutFeature(icon, title, copy, compact = false, titleOnly = false, extraClass = '') {
    const className = `about-feature-card${compact ? ' compact' : ''}${titleOnly ? ' title-only' : ''}${extraClass ? ` ${extraClass}` : ''}`;
    const card = create('div', className);
    card.title = title;
    const iconWrap = create('div', 'about-feature-icon');
    iconWrap.append(createIconElement(icon));
    const copyWrap = create('div', 'about-feature-copy-wrap');
    const titleEl = create('div', 'about-feature-title', title);
    titleEl.title = title;
    copyWrap.append(titleEl);
    if (!titleOnly && copy) copyWrap.append(create('div', 'about-copy about-copy-muted about-feature-copy', copy));
    card.append(iconWrap, copyWrap);
    return card;
  }

  function closeConfirmDialog(result = false) {
    if (!state.confirmDialog) return;
    const { resolve } = state.confirmDialog;
    state.confirmDialog = null;
    deps.render();
    if (typeof resolve === 'function') resolve(Boolean(result));
  }

  function showConfirmDialog({ title = t('Confirm action'), message = '', confirmLabel = t('Confirm'), cancelLabel = t('Cancel'), danger = false } = {}) {
    return new Promise((resolve) => {
      state.confirmDialog = { title, message, confirmLabel, cancelLabel, danger, resolve };
      deps.render();
    });
  }

  function createConfirmDialog(root) {
    if (!state.confirmDialog) return;
    const overlay = create('div', 'modal-overlay confirm-dialog-overlay');
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeConfirmDialog(false);
    });

    const modal = create('div', 'modal-card confirm-dialog');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', state.confirmDialog.title);
    const head = create('div', 'confirm-dialog-head');
    const title = create('div', 'confirm-dialog-title', state.confirmDialog.title);
    const close = create('button', 'button ghost modal-close confirm-dialog-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', t('Close dialog'));
    close.addEventListener('click', () => closeConfirmDialog(false));
    head.append(title, close);

    const body = create('div', 'confirm-dialog-body', state.confirmDialog.message);
    const actionsWrap = create('div', 'confirm-dialog-actions');
    const cancel = create('button', 'button secondary', state.confirmDialog.cancelLabel);
    cancel.type = 'button';
    cancel.addEventListener('click', () => closeConfirmDialog(false));
    const confirm = create('button', `button ${state.confirmDialog.danger ? 'danger' : 'primary'}`, state.confirmDialog.confirmLabel);
    confirm.type = 'button';
    confirm.addEventListener('click', () => closeConfirmDialog(true));
    actionsWrap.append(cancel, confirm);

    modal.append(head, body, actionsWrap);
    overlay.append(modal);
    root.append(overlay);

    const releaseTrap = trapFocus(modal);
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { releaseTrap(); closeConfirmDialog(false); }
    });
  }

  function createAboutModal(root) {
    if (!state.aboutOpen) return;

    const { version } = getManifest();
    const overlay = create('div', 'modal-overlay');
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) closeAboutModal();
    });

    const modal = create('div', 'modal-card about-modal popup-about-modal');
    const head = create('div', 'about-head');
    const icon = create('img', 'about-icon');
    icon.src = getRuntimeUrl('icon-48.png');
    icon.alt = '';
    const meta = create('div', 'about-meta');
    meta.append(
      create('div', 'about-title', t('Bookmark Scope')),
      create('div', 'about-version', t('Version {{version}}', { version }))
    );
    const close = createIconButton('close', t('Close about dialog'), 'icon-button mono-icon-button modal-close');
    close.addEventListener('click', closeAboutModal);
    head.append(icon, meta, close);

    const body = create('div', 'about-body popup-about-body');

    const hero = create('section', 'about-hero popup-about-hero');
    hero.append(
      create('div', 'about-badge', t('About')),
      create('div', 'about-kicker', t('Bookmark control without the sludge.')),
      create('div', 'about-copy about-copy-muted', t('Quick scoped triage in the popup. Deep cleanup lives in the dashboard.'))
    );

    const section = create('section', 'about-section');
    section.append(create('div', 'about-section-title', t('What it does')));
    const featureGrid = create('div', 'about-feature-grid popup-about-feature-grid popup-about-inline-strip');
    featureGrid.append(
      createAboutFeature('overview', t('Fast scope switching'), '', true, true, 'popup-about-inline-feature'),
      createAboutFeature('history', t('Cleanup that stays reversible'), '', true, true, 'popup-about-inline-feature'),
      createAboutFeature('cleanup', t('Dashboard-grade maintenance'), '', true, true, 'popup-about-inline-feature')
    );
    section.append(featureGrid);

    const support = create('section', 'about-support-card popup-about-support-card');
    support.append(
      create('div', 'about-section-title', t('Like the extension?')),
      create('div', 'about-copy', t('If Bookmark Scope saved you time or spared you a cleanup headache, you can buy me a coffee.'))
    );
    const actionsRow = create('div', 'about-actions');
    const github = create('button', 'button secondary about-action-button', t('GitHub'));
    github.type = 'button';
    github.addEventListener('click', () => createTab({ url: 'https://github.com/ehsanenaloo/Bookmark-Scope', active: true }));
    const coffee = create('button', 'button primary about-action-button', t('Buy me a coffee'));
    coffee.type = 'button';
    coffee.addEventListener('click', openPopupSupportLink);
    actionsRow.append(github, coffee);
    support.append(actionsRow);

    const credit = create('div', 'about-footer-note popup-about-credit');
    credit.append(create('div', 'about-copy about-copy-muted', t('Made by Ehsan Enaloo.').replace(/[.。।۔]$/, '') + ' · ' + featureText('MIT License')));

    body.append(hero, section, support, credit);
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

  function createPopupOverflowMenu() {
    if (!state.menuOpen) return null;

    const menu = create('div', 'overflow-menu is-open');
    menu.setAttribute('role', 'menu');
    menu.addEventListener('click', (event) => event.stopPropagation());

    const settingsAction = create('button', 'overflow-item', t('Open settings'));
    settingsAction.type = 'button';
    settingsAction.addEventListener('click', (event) => {
      event.stopPropagation();
      closeOverflowMenu();
      createTab({ url: getRuntimeUrl('options.html'), active: true });
    });

    const chromeAction = create('button', 'overflow-item', t('Open Chrome bookmarks'));
    chromeAction.type = 'button';
    chromeAction.addEventListener('click', (event) => {
      event.stopPropagation();
      closeOverflowMenu();
      createTab({ url: 'chrome://bookmarks/', active: true });
    });

    const aboutAction = create('button', 'overflow-item', t('About'));
    aboutAction.type = 'button';
    aboutAction.addEventListener('click', (event) => {
      event.stopPropagation();
      closeOverflowMenu({ rerender: false });
      state.aboutOpen = true;
      deps.render();
    });

    const themeBlock = create('div', 'overflow-theme-block');
    themeBlock.append(create('div', 'overflow-label', t('Theme')));
    themeBlock.append(createThemeControls());

    const sortBlock = create('div', 'overflow-sort-block');
    sortBlock.append(create('div', 'overflow-label', t('Sort')));
    const sortButtons = create('div', 'overflow-sort-buttons');
    [
      [SORT_OPTIONS.TITLE_ASC, t('Title')],
      [SORT_OPTIONS.NEWEST, t('Newest')],
      [SORT_OPTIONS.OLDEST, t('Oldest')],
      [SORT_OPTIONS.URL_ASC, t('URL')]
    ].forEach(([value, label]) => {
      const btn = create('button', `overflow-sort-btn${state.sort === value ? ' active' : ''}`);
      btn.type = 'button';
      btn.textContent = label;
      btn.setAttribute('aria-pressed', state.sort === value ? 'true' : 'false');
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
        closeOverflowMenu();
        actions.updateSort(value);
      });
      sortButtons.append(btn);
    });
    sortBlock.append(sortButtons);

    const paletteBlock = create('div', 'overflow-sort-block');
    paletteBlock.append(create('div', 'overflow-label', t('Color palette')));
    const paletteButtons = create('div', 'overflow-sort-buttons');
    [
      [COLOR_PALETTES.TEAL,    t('Teal'),    '#00897b'],
      [COLOR_PALETTES.BLUE,    t('Blue'),    '#1a73e8'],
      [COLOR_PALETTES.INDIGO,  t('Indigo'),  '#3949ab'],
      [COLOR_PALETTES.NEUTRAL, t('Neutral'), '#5f6368']
    ].forEach(([value, label, color]) => {
      const btn = create('button', `overflow-sort-btn palette-swatch-btn${state.colorPalette === value ? ' active' : ''}`);
      btn.type = 'button';
      btn.textContent = label;
      btn.dataset.paletteControl = value;
      btn.title = label;
      btn.setAttribute('aria-pressed', state.colorPalette === value ? 'true' : 'false');
      btn.style.setProperty('--swatch-color', color);
      btn.addEventListener('click', async (event) => {
        event.stopPropagation();
        closeOverflowMenu();
        await actions.updateColorPalette(value);
      });
      paletteButtons.append(btn);
    });
    paletteBlock.append(paletteButtons);

    menu.append(settingsAction, chromeAction, aboutAction, sortBlock, paletteBlock, themeBlock);
    return menu;
  }

  function createOverflowMenu() {
    const wrap = create('div', 'header-overflow');
    const trigger = createIconButton('moreVertical', t('More controls'), 'icon-button mono-icon-button overflow-trigger');
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', state.menuOpen ? 'true' : 'false');
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleOverflowMenu();
    });
    wrap.append(trigger);
    const menu = createPopupOverflowMenu();
    if (menu) wrap.append(menu);
    return wrap;
  }

  function renderHeader(root) {
    const header = create('div', 'section header header-minimal');
    const topRow = create('div', 'header-top-row header-top-row-minimal');
    const left = create('div', 'header-main');
    const brand = create('div', 'brand-row brand-row-minimal');
    const brandBadge = create('div', 'brand-badge brand-badge-logo');
    const brandLogo = create('img', 'brand-logo-img');
    brandLogo.src = getRuntimeUrl('icon-32.png');
    brandLogo.alt = '';
    brandBadge.append(brandLogo);
    brand.append(brandBadge);
    const titleWrap = create('div', 'title-wrap title-wrap-minimal');
    const subtitleText = state.target?.valid
      ? state.target.label
      : t('Unsupported page');
    const subtitleEl = create('div', 'subtitle subtitle-single-line subtitle-url', subtitleText);
    subtitleEl.title = subtitleText;
    titleWrap.append(
      create('h1', 'title title-single-line', t('Bookmark Scope')),
      subtitleEl
    );
    brand.append(titleWrap);
    left.append(brand);

    const actionsWrap = create('div', 'header-actions header-actions-minimal');
    const dashBtn = create('button', 'button primary compact-dashboard-button compact-dashboard-button-minimal', t('Dashboard'));
    dashBtn.type = 'button';
    dashBtn.title = t('Open Dashboard');
    dashBtn.addEventListener('click', actions.openDashboard);

    const isPageBookmarked = state.target?.valid && state.tab?.url &&
      (state.bookmarkedUrlsSet?.has(state.tab.url) ??
        state.allBookmarks.some((b) => b.url === state.tab.url));
    const starBtn = create('button', `icon-button mono-icon-button bookmark-star-btn${isPageBookmarked ? ' is-bookmarked' : ''}`);
    starBtn.type = 'button';
    starBtn.title = isPageBookmarked ? t('Remove bookmark') : t('Bookmark current page');
    starBtn.setAttribute('aria-label', isPageBookmarked ? t('Remove bookmark') : t('Bookmark current page'));
    starBtn.setAttribute('aria-pressed', isPageBookmarked ? 'true' : 'false');
    starBtn.innerHTML = iconSvg('star');
    if (state.target?.valid) {
      starBtn.addEventListener('click', async () => {
        closeOverflowMenu({ rerender: false });
        if (isPageBookmarked) {
          await actions.unbookmarkCurrentPage();
        } else {
          await actions.bookmarkCurrentPage();
        }
      });
    }
    if (!state.target?.valid) {
      starBtn.disabled = true;
      starBtn.style.opacity = '0.35';
    }

    actionsWrap.append(dashBtn, starBtn, createOverflowMenu());
    topRow.append(left, actionsWrap);

    const strip = create('div', 'status-strip compact single-line-summary full-width-strip summary-strip-minimal');
    const scopePill = create('div', 'mini-pill pill-scope', t('{{count}} in scope', { count: formatNumber(state.scopeBookmarks.length) }));
    scopePill.title = t('Bookmarks in the current page, host, or domain scope.');
    strip.append(scopePill);

    const oldCount = state.scopeSummary.oldCount;
    if (oldCount > 0) {
      const oldPill = create('div', 'mini-pill pill-warn', t('{{count}} old', { count: formatNumber(oldCount) }));
      oldPill.title = t('Bookmarks older than {{days}} days in this scope.', { days: formatNumber(OLD_BOOKMARK_DAYS) });
      strip.append(oldPill);
    }

    const dupCount = duplicateGroupsCount(state.scopeBookmarks);
    if (dupCount > 0) {
      const dupPill = create('div', 'mini-pill pill-danger', t('{{count}} duplicate', { count: formatNumber(dupCount) }));
      dupPill.title = t('Duplicate URL groups in this scope.');
      strip.append(dupPill);
    }

    header.append(topRow, strip);
    root.append(header);
  }

  function createPinOnboardingModal(root) {
    if (!state.pinOnboardingVisible) return;
    const overlay = create('div', 'modal-overlay pin-onboarding-overlay');
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) actions.dismissPinOnboarding();
    });
    const modal = create('div', 'modal-card pin-onboarding-modal');
    const head = create('div', 'pin-onboarding-head');
    const headerCopy = create('div', 'pin-onboarding-head-copy');
    headerCopy.append(create('div', 'pin-onboarding-eyebrow', t('Quick setup')), create('div', 'pin-onboarding-title', t('Pin Bookmark Scope for one-click access')));
    const close = create('button', 'button ghost modal-close pin-onboarding-close', '×');
    close.type = 'button';
    close.setAttribute('aria-label', t('Close quick setup'));
    close.addEventListener('click', actions.dismissPinOnboarding);
    head.append(headerCopy, close);
    const body = create('div', 'pin-onboarding-body');
    body.append(create('div', 'pin-onboarding-copy', t('Click the Extensions menu, find Bookmark Scope, then click the pin icon.')), create('div', 'pin-onboarding-steps', t('Extensions menu → Bookmark Scope → Pin')));
    const actionsWrap = create('div', 'pin-onboarding-actions');
    const dismiss = create('button', 'button primary pin-onboarding-button', t('Got it'));
    dismiss.type = 'button';
    dismiss.addEventListener('click', actions.dismissPinOnboarding);
    actionsWrap.append(dismiss);
    modal.append(head, body, actionsWrap);
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', t('Pin Bookmark Scope for one-click access'));
    overlay.append(modal);
    root.append(overlay);
    const releaseTrap = trapFocus(modal);
    overlay.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { releaseTrap(); actions.dismissPinOnboarding(); }
    });
  }

  return {
    detachPopupMenuDismissHandlers,
    hardCloseOverflowMenu,
    syncPopupMenuGlobalHandlers,
    closeOverflowMenu,
    updateThemeControls,
    showConfirmDialog,
    createConfirmDialog,
    createAboutModal,
    createPinOnboardingModal,
    renderHeader
  };
}
