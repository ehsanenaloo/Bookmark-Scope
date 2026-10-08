import { createTab, getManifest } from '../platform/browser-api.js';
import { getRuntimeConfig } from '../config/runtime-config.js';

export function createPopupFooter(deps) {
  const { state, footerRefs, formatNumber, hasSourceMessage, t, create, createFooterActionButton } = deps;

  let footerAnimationFrame = null;
  let footerCycleStartedAt = null;

  function localizeConfigString(value = '') {
    const source = String(value || '').trim();
    if (!source) return '';
    return hasSourceMessage(source) ? t(source) : source;
  }

  // The About tab shows identity (name, version, author, license) instead of plain copy.
  function fillFooterBody(body, tab) {
    body.textContent = '';
    body.classList.toggle('footer-about-body', tab.id === 'about');
    if (tab.id !== 'about') {
      body.textContent = tab.message || '';
      return;
    }
    let version = '';
    try { version = getManifest().version || ''; } catch { version = ''; }
    const title = create('span', 'footer-about-title');
    title.append(create('strong', 'footer-about-name', t('Bookmark Scope')));
    if (version) title.append(create('span', 'footer-about-version', 'v' + version));
    const author = t('Made by Ehsan Enaloo.').replace(/[.。।۔]$/, '');
    body.append(title, create('span', 'footer-about-credit', author + ' · MIT'));
    body.title = tab.message || '';
  }

  function getFooterConfig() {
    const runtimeConfig = getRuntimeConfig();
    const items = runtimeConfig.footer.items.map((item, index) => {
      const fallbackLabel = t('Item {{count}}', { count: formatNumber(index + 1) });
      return {
        id: item.id || `item-${index + 1}`,
        label: localizeConfigString(item.labelKey || item.label) || fallbackLabel,
        message: localizeConfigString(item.messageKey || item.message),
        ctaLabel: localizeConfigString(item.ctaLabelKey || item.ctaLabel),
        showCtaButton: item.showCtaButton !== false,
        url: item.id === 'rate' ? (item.url || runtimeConfig.footerRateUrl) : item.url,
        action: item.action || 'info'
      };
    });

    return {
      autoRotate: runtimeConfig.footer.autoRotate,
      rotateEveryMs: runtimeConfig.footer.rotateEveryMs,
      items
    };
  }

  function getFooterItems() {
    return getFooterConfig().items;
  }

  function getFooterRotateMs() {
    return getFooterConfig().rotateEveryMs;
  }

  function initializeFooterState() {
    state.footerAutoRotate = getFooterConfig().autoRotate;
    state.footerTab = getFooterItems()[0]?.id || '';
  }

  function getFooterTab() {
    const items = getFooterItems();
    return items.find((tab) => tab.id === state.footerTab) || items[0];
  }

  function positionFooterIndicator(nav) {
    if (!nav) return;
    const activeItem = nav.querySelector('.footer-nav-item.active');
    const activeLine = nav.querySelector('.footer-nav-active-line');
    const progressLine = nav.querySelector('.footer-nav-progress');
    if (!activeItem || !activeLine || !progressLine) return;
    const navRect = nav.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    const left = Math.max(0, itemRect.left - navRect.left + 8);
    const width = Math.max(18, itemRect.width - 16);
    activeLine.style.left = `${left}px`;
    activeLine.style.width = `${width}px`;
    progressLine.style.left = `${left}px`;
    progressLine.style.width = `${width}px`;
    progressLine.style.transform = `scaleX(${activeItem.dataset.active === 'true' ? state.footerProgress : 0})`;
  }

  function updateFooterIndicatorProgress() {
    const indicator = footerRefs.nav?.querySelector('.footer-nav-progress');
    if (indicator) indicator.style.transform = `scaleX(${state.footerProgress})`;
  }

  function stopFooterAutoRotate(resetProgress = true) {
    if (footerAnimationFrame) {
      cancelAnimationFrame(footerAnimationFrame);
      footerAnimationFrame = null;
    }
    footerCycleStartedAt = null;
    if (resetProgress) state.footerProgress = 0;
  }

  function pauseFooterAutoRotate() {
    state.footerHoverPaused = true;
    if (footerAnimationFrame) {
      cancelAnimationFrame(footerAnimationFrame);
      footerAnimationFrame = null;
    }
  }

  function resumeFooterAutoRotate() {
    state.footerHoverPaused = false;
    footerCycleStartedAt = performance.now() - (state.footerProgress * getFooterRotateMs());
    ensureFooterAutoRotate();
  }

  function updateFooterUI() {
    if (!footerRefs.panelBody || !footerRefs.panelControls || !footerRefs.nav) return;
    const activeTab = getFooterTab();
    if (!activeTab) return;
    fillFooterBody(footerRefs.panelBody, activeTab);
    footerRefs.panelControls.textContent = '';
    const actionButton = createFooterActionButton(activeTab);
    if (actionButton) footerRefs.panelControls.append(actionButton);
    footerRefs.nav.querySelectorAll('.footer-nav-item').forEach((item) => {
      const isActive = item.dataset.footerId === activeTab?.id;
      item.classList.toggle('active', isActive);
      item.dataset.active = isActive ? 'true' : 'false';
      item.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
    requestAnimationFrame(() => {
      positionFooterIndicator(footerRefs.nav);
      updateFooterIndicatorProgress();
    });
  }

  function ensureFooterAutoRotate() {
    if (!state.footerAutoRotate || state.footerHoverPaused) {
      if (footerAnimationFrame) {
        cancelAnimationFrame(footerAnimationFrame);
        footerAnimationFrame = null;
      }
      return;
    }
    if (!footerCycleStartedAt) footerCycleStartedAt = performance.now();
    if (footerAnimationFrame) cancelAnimationFrame(footerAnimationFrame);
    const tick = (now) => {
      if (!state.footerAutoRotate || state.footerHoverPaused) return;
      const elapsed = now - footerCycleStartedAt;
      const progress = Math.max(0, Math.min(1, elapsed / getFooterRotateMs()));
      state.footerProgress = progress;
      updateFooterIndicatorProgress();
      if (progress >= 1) {
        const items = getFooterItems();
        const currentIndex = items.findIndex((tab) => tab.id === state.footerTab);
        const nextIndex = (currentIndex + 1) % items.length;
        state.footerTab = items[nextIndex].id;
        footerCycleStartedAt = now;
        state.footerProgress = 0;
        updateFooterUI();
        footerAnimationFrame = requestAnimationFrame(tick);
        return;
      }
      footerAnimationFrame = requestAnimationFrame(tick);
    };
    footerAnimationFrame = requestAnimationFrame(tick);
  }

  function renderFooter(root) {
    const items = getFooterItems();
    if (!items.length) return;

    const footerShell = create('div', 'footer-shell');
    const activeTab = getFooterTab();
    if (!state.footerTab) state.footerTab = activeTab.id;

    const panel = create('div', 'footer-panel');
    const panelTop = create('div', 'footer-panel-top');
    const copy = create('div', 'footer-panel-copy');
    const bodyEl = create('div', 'footer-panel-body');
    fillFooterBody(bodyEl, activeTab);
    copy.append(bodyEl);

    const controls = create('div', 'footer-panel-controls');
    const actionButton = createFooterActionButton(activeTab);
    if (actionButton) controls.append(actionButton);

    panelTop.append(copy, controls);
    panel.append(panelTop);

    const nav = create('div', 'footer-nav');
    nav.style.gridTemplateColumns = `repeat(${Math.max(1, items.length)}, minmax(0, 1fr))`;
    nav.append(create('div', 'footer-nav-track'));
    nav.append(create('div', 'footer-nav-active-line'));
    nav.append(create('div', 'footer-nav-progress'));
    items.forEach((tab) => {
      const item = create('button', `footer-nav-item${tab.id === activeTab.id ? ' active' : ''}`);
      item.type = 'button';
      item.title = tab.label;
      item.dataset.footerId = tab.id;
      item.dataset.active = tab.id === activeTab.id ? 'true' : 'false';
      item.setAttribute('aria-pressed', tab.id === activeTab.id ? 'true' : 'false');
      item.append(create('span', 'footer-nav-label', tab.label));
      item.addEventListener('click', () => {
        state.footerTab = tab.id;
        footerCycleStartedAt = performance.now();
        state.footerProgress = 0;
        updateFooterUI();
        ensureFooterAutoRotate();
      });
      nav.append(item);
    });

    footerShell.addEventListener('mouseenter', pauseFooterAutoRotate);
    footerShell.addEventListener('mouseleave', resumeFooterAutoRotate);
    footerShell.addEventListener('focusin', pauseFooterAutoRotate);
    footerShell.addEventListener('focusout', (event) => {
      if (!footerShell.contains(event.relatedTarget)) resumeFooterAutoRotate();
    });
    footerShell.append(panel, nav);
    root.append(footerShell);
    footerRefs.shell = footerShell;
    footerRefs.panelBody = copy.firstChild;
    footerRefs.panelControls = controls;
    footerRefs.nav = nav;
    updateFooterUI();
  }

  return {
    initializeFooterState,
    getFooterItems,
    getFooterTab,
    getFooterRotateMs,
    updateFooterUI,
    stopFooterAutoRotate,
    pauseFooterAutoRotate,
    resumeFooterAutoRotate,
    ensureFooterAutoRotate,
    renderFooter,
    resolveFooterAction(item) {
      if (!item) return null;
      if (item.action === 'link') {
        return () => {
          if (item.url) {
            createTab({ url: item.url, active: true });
          } else {
            deps.setToast(t('{{label}} is not available in this build yet.', { label: item.label }), false, null, 2200);
          }
        };
      }
      if (item.action === 'info') {
        if (item.url) return () => createTab({ url: item.url, active: true });
        return () => deps.actions.openDashboard();
      }
      return null;
    }
  };
}
