// Real-Firefox checks for the Firefox build of Bookmark Scope.
//
// Starts the installed desktop Firefox headless with a throwaway profile under os.tmpdir(),
// talks to it over WebDriver BiDi (Node's built-in WebSocket; no geckodriver, no Selenium,
// no downloads), installs the package built by scripts/build-firefox.mjs as a temporary
// add-on and drives the extension pages. Synthetic bookmarks only. Your own Firefox profile
// is never opened, and nothing is written into the repository.
//
// Run:   node tests/firefox/run.mjs [--require] [--only=<regex on check id or name>]
//   --require   fail instead of skipping when Firefox is not installed
// Env:   FIREFOX_BIN         Firefox executable (default: standard install path, or "firefox" on PATH)
//        FIREFOX_SHOTS_DIR   keep screenshots in this folder (default: a temp folder that is removed)
//        EXTENSION_DIR       extension folder to test (default: extension/)
//        FIREFOX_PACKAGE_DIR install this prebuilt package folder instead of building one
// Exit status is non-zero when any check fails. See tests/firefox/README.md.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { buildFirefox, FIREFOX_EXTENSION_ID } from '../../scripts/build-firefox.mjs';

const onlyArg = process.argv.find(arg => arg.startsWith('--only='));
const only = onlyArg ? new RegExp(onlyArg.slice(7), 'i') : null;
const requireFirefox = process.argv.includes('--require');
const FIREFOX_BIN = process.env.FIREFOX_BIN || (process.platform === 'win32' ? 'C:\\Program Files\\Mozilla Firefox\\firefox.exe' : process.platform === 'darwin' ? '/Applications/Firefox.app/Contents/MacOS/firefox' : 'firefox');

function firefoxInstalled(bin) {
  if (path.isAbsolute(bin) || bin.includes('/') || bin.includes('\\')) return fs.existsSync(bin);
  const extensions = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE').split(';') : [''];
  return (process.env.PATH || '').split(path.delimiter).some(dir => dir && extensions.some(ext => fs.existsSync(path.join(dir, bin + ext))));
}
if (!firefoxInstalled(FIREFOX_BIN)) {
  const message = `Firefox was not found (looked for "${FIREFOX_BIN}"). Install desktop Firefox 140 or newer, or set FIREFOX_BIN to its path (see tests/firefox/README.md).`;
  if (requireFirefox) { console.error(`Firefox checks cannot run: ${message}`); process.exit(1); }
  console.log(`Firefox checks skipped. ${message}`);
  process.exit(0);
}

// Everything the run creates goes under os.tmpdir() and is removed at the end (unless FIREFOX_SHOTS_DIR is set).
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookmark-scope-firefox-work-'));
const shotsDir = path.resolve(process.env.FIREFOX_SHOTS_DIR || path.join(workDir, 'shots'));
const EXT_UUID = '5b1c2e0a-7d34-4a55-9c1e-0b6f2d8a4e11'; // fixed so the moz-extension:// origin is known
const EXT_ORIGIN = `moz-extension://${EXT_UUID}/`;
const IDLE_TIMEOUT_MS = 8000; // extensions.background.idle.timeout, lowered so the event page really suspends

const KEYS = { Enter: '\uE007', Escape: '\uE00C', Control: '\uE009', Shift: '\uE008', Tab: '\uE004', ArrowDown: '\uE015', ArrowUp: '\uE013', Backspace: '\uE003', Delete: '\uE017' };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ─── WebDriver BiDi client ─────────────────────────────────────────────────────
class Bidi {
  constructor(ws) {
    this.ws = ws; this.nextId = 0; this.pending = new Map(); this.events = []; this.listeners = [];
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined && this.pending.has(message.id)) {
        const { resolve, reject, method } = this.pending.get(message.id); this.pending.delete(message.id);
        if (message.type === 'success') resolve(message.result); else reject(new Error(`${method}: ${message.error}: ${message.message}`));
      } else if (message.type === 'event') {
        this.events.push(message);
        for (const listener of this.listeners) listener(message);
      }
    });
  }
  send(method, params = {}) {
    return new Promise((resolve, reject) => { const id = ++this.nextId; this.pending.set(id, { resolve, reject, method }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  onEvent(listener) { this.listeners.push(listener); }
}

// WebDriver classic over Marionette, used only for trusted (native) mouse and keyboard input:
// BiDi's input module refuses the privileged-scope browsing contexts that moz-extension:// pages live in.
class Marionette {
  constructor(socket) {
    this.socket = socket; this.nextId = 0; this.pending = new Map(); this.buffer = Buffer.alloc(0); this.hello = new Promise(resolve => { this.resolveHello = resolve; });
    socket.on('data', chunk => { this.buffer = Buffer.concat([this.buffer, chunk]); this.drain(); });
  }
  drain() {
    for (;;) {
      const colon = this.buffer.indexOf(0x3a); if (colon < 0) return;
      const length = Number(this.buffer.subarray(0, colon).toString());
      if (this.buffer.length < colon + 1 + length) return;
      const message = JSON.parse(this.buffer.subarray(colon + 1, colon + 1 + length).toString('utf8'));
      this.buffer = this.buffer.subarray(colon + 1 + length);
      if (!Array.isArray(message)) { this.resolveHello(message); continue; }
      const [, id, error, result] = message; const entry = this.pending.get(id); this.pending.delete(id);
      if (!entry) continue;
      if (error) entry.reject(new Error(entry.name + ': ' + (error.message || JSON.stringify(error)))); else entry.resolve(result);
    }
  }
  send(name, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId; this.pending.set(id, { resolve, reject, name });
      const body = JSON.stringify([0, id, name, params]); this.socket.write(Buffer.byteLength(body) + ':' + body);
    });
  }
}

async function freePort() {
  return new Promise(resolve => { const server = net.createServer().listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)); }); });
}

function writeUserJs(profile, downloadDir, marionettePort) {
  const prefs = {
    'extensions.webextensions.uuids': JSON.stringify({ [FIREFOX_EXTENSION_ID]: EXT_UUID }),
    'extensions.webextOptionalPermissionPrompts': false, // the optional-permission doorhanger cannot be clicked headlessly; this is Firefox's supported switch
    'extensions.background.idle.timeout': IDLE_TIMEOUT_MS,
    'xpinstall.signatures.required': false,
    'browser.shell.checkDefaultBrowser': false,
    'browser.startup.homepage': 'about:blank',
    'browser.startup.page': 0,
    'browser.startup.homepage_override.mstone': 'ignore',
    'startup.homepage_welcome_url': '',
    'startup.homepage_welcome_url.additional': '',
    'browser.aboutwelcome.enabled': false,
    'browser.newtabpage.enabled': false,
    'browser.tabs.warnOnClose': false,
    'app.update.enabled': false, 'app.update.auto': false, 'app.update.service.enabled': false, 'app.update.checkInstallTime': false,
    'datareporting.policy.dataSubmissionEnabled': false, 'datareporting.healthreport.uploadEnabled': false,
    'toolkit.telemetry.enabled': false, 'toolkit.telemetry.reportingpolicy.firstRun': false,
    'browser.download.folderList': 2, 'browser.download.dir': downloadDir, 'browser.download.useDownloadDir': true,
    'browser.download.always_ask_before_handling_new_types': false, 'browser.helperApps.neverAsk.saveToDisk': 'text/csv,application/json,text/html',
    'browser.download.alwaysOpenPanel': false,
    'marionette.port': marionettePort
  };
  fs.writeFileSync(path.join(profile, 'user.js'), Object.entries(prefs).map(([key, value]) => `user_pref(${JSON.stringify(key)}, ${typeof value === 'string' ? JSON.stringify(value) : value});`).join('\n') + '\n');
}

// ─── Page helper ───────────────────────────────────────────────────────────────
class Page {
  constructor(h, context) { this.h = h; this.bidi = h.bidi; this.context = context; }
  async goto(url) { await this.bidi.send('browsingContext.navigate', { context: this.context, url, wait: 'complete' }); }
  async ev(fn, arg) {
    const expression = typeof fn === 'function'
      ? `(async()=>{const __v=await (${fn.toString()})(${JSON.stringify(arg === undefined ? null : arg)});return __v===undefined?undefined:JSON.stringify(__v);})()`
      : fn;
    const result = await this.bidi.send('script.evaluate', { expression, target: { context: this.context }, awaitPromise: true, userActivation: false });
    if (result.type === 'exception') throw new Error('page exception: ' + (result.exceptionDetails?.text || '') + ' ' + JSON.stringify(result.exceptionDetails?.exception || '').slice(0, 300));
    return result.result.type === 'string' ? JSON.parse(result.result.value) : undefined;
  }
  async waitFor(fn, arg, { timeout = 20000, label = '' } = {}) {
    const deadline = Date.now() + timeout; let last;
    while (Date.now() < deadline) {
      try { last = await this.ev(fn, arg); if (last) return last; } catch (error) { last = error.message; }
      await sleep(60);
    }
    throw new Error(`waitFor timed out (${label || fn.toString().slice(0, 90)}); last=${JSON.stringify(last)}`);
  }
  async rect(selector, index = 0) {
    return this.ev(({ selector, index }) => {
      const element = document.querySelectorAll(selector)[index];
      if (!element) return null;
      element.scrollIntoView({ block: 'center', inline: 'center' });
      const r = element.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height };
    }, { selector, index });
  }
  async activate() { await this.bidi.send('browsingContext.activate', { context: this.context }).catch(() => {}); }
  async perform(actions) {
    // A popup lives in a background tab here; focusing it would make it the "active tab" it is meant to scope to.
    await this.h.marionette.send('WebDriver:SwitchToWindow', { handle: this.context, focus: !this.keepBackground });
    // SwitchToWindow(focus) returns before Firefox has actually moved window focus to the tab, and key events sent to an
    // unfocused document are dropped (a flaky search "fill" then leaves the list unfiltered). Wait for the real condition.
    if (!this.keepBackground) await this.waitFor(() => document.hasFocus(), null, { timeout: 15000, label: 'tab document has focus before synthesized input' });
    await this.h.marionette.send('WebDriver:PerformActions', { actions });
    await this.h.marionette.send('WebDriver:ReleaseActions');
  }
  async clickAt(r, { hold = 0 } = {}) {
    await this.perform([{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions: [
      { type: 'pointerMove', x: Math.round(r.x), y: Math.round(r.y), origin: 'viewport' }, { type: 'pointerDown', button: 0 },
      ...(hold ? [{ type: 'pause', duration: hold }] : []), { type: 'pointerUp', button: 0 }] }]);
  }
  async click(selector, { index = 0, hold = 0 } = {}) {
    const r = await this.waitFor(({ selector, index }) => {
      const element = document.querySelectorAll(selector)[index];
      if (!element) return false;
      element.scrollIntoView({ block: 'center', inline: 'center' });
      const box = element.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }, { selector, index }, { label: 'click target ' + selector });
    await this.clickAt(r, { hold });
  }
  async clickText(selector, text, { exact = true } = {}) {
    // Look-up and geometry happen in one page turn, so a re-render cannot invalidate the target in between.
    const locate = ({ selector, text, exact }) => {
      const element = [...document.querySelectorAll(selector)].find(candidate => exact ? candidate.textContent.trim() === text : candidate.textContent.includes(text));
      if (!element) return false;
      element.scrollIntoView({ block: 'center', inline: 'center' });
      const box = element.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    };
    let r = await this.waitFor(locate, { selector, text, exact }, { label: `text "${text}" in ${selector}` });
    // Toasts and dialogs slide in. A click on coordinates read mid-animation can miss the button, so wait until the position stops moving.
    for (let attempt = 0; attempt < 20; attempt++) {
      await sleep(60);
      const again = await this.waitFor(locate, { selector, text, exact }, { label: `text "${text}" in ${selector}` });
      const settled = Math.abs(again.x - r.x) < 0.5 && Math.abs(again.y - r.y) < 0.5;
      r = again;
      if (settled) break;
    }
    await this.clickAt(r);
  }
  async press(...keys) {
    const mapped = keys.map(key => KEYS[key] || key);
    await this.perform([{ type: 'key', id: 'kbd', actions: [...mapped.map(value => ({ type: 'keyDown', value })), ...[...mapped].reverse().map(value => ({ type: 'keyUp', value }))] }]);
  }
  async type(text) {
    await this.perform([{ type: 'key', id: 'kbd', actions: [...text].flatMap(value => [{ type: 'keyDown', value }, { type: 'keyUp', value }]) }]);
  }
  async focus(selector, index = 0) {
    await this.ev(({ selector, index }) => { const element = document.querySelectorAll(selector)[index]; element.focus(); if (element.select) element.select(); return true; }, { selector, index });
  }
  /** Focuses the field, replaces its content with real key events. */
  async fill(selector, text, index = 0) {
    await this.waitFor(({ selector, index }) => document.querySelectorAll(selector).length > index, { selector, index });
    await this.focus(selector, index);
    await this.press('Control', 'a');
    await this.press('Backspace');
    if (text) await this.type(text);
    // Input delivery is verified here, so a dropped keystroke fails at its cause instead of as a later row-count timeout.
    await this.waitFor(({ selector, index, text }) => document.querySelectorAll(selector)[index]?.value === text, { selector, index, text }, { timeout: 10000, label: 'field "' + selector + '" holds typed text' });
  }
  async text(selector) { return this.ev(selector => document.querySelector(selector)?.textContent || '', selector); }
  async count(selector) { return this.ev(selector => document.querySelectorAll(selector).length, selector); }
  /** Full-page PNG through Marionette (BiDi viewport/screenshot commands refuse privileged-scope contexts). */
  async shot(name, { size } = {}) {
    await this.h.marionette.send('WebDriver:SwitchToWindow', { handle: this.context, focus: true });
    if (size) await this.h.marionette.send('WebDriver:SetWindowRect', size);
    await sleep(500);
    const { value: data } = await this.h.marionette.send('WebDriver:TakeScreenshot', { full: true });
    fs.mkdirSync(shotsDir, { recursive: true });
    const file = path.join(shotsDir, name + '.png');
    fs.writeFileSync(file, Buffer.from(data, 'base64'));
    this.h.shots.push(file);
    return file;
  }
  async close() { await this.bidi.send('browsingContext.close', { context: this.context }).catch(() => {}); }
}

// ─── Harness ───────────────────────────────────────────────────────────────────
const h = { shots: [], errors: [], consoleErrors: [], checks: [], notRun: [], backgroundErrors: [] };
let firefox, firefoxLog = '', profile, downloadDir, pkg, server, fixtureHits = [];

async function newPage({ background = false } = {}) {
  const { context } = await h.bidi.send('browsingContext.create', { type: 'tab', background });
  return new Page(h, context);
}
async function openPopup() {
  // The popup scopes to the active tab, so the http fixture tab must be active when it loads.
  await h.marionette.send('WebDriver:SwitchToWindow', { handle: h.httpTab.context, focus: true });
  const popup = await openExt('popup', { background: true });
  await popup.waitFor(() => document.querySelector('#app')?.children.length > 0 && document.querySelectorAll('.item-title').length >= 1, null, { label: 'popup matches' });
  return popup;
}
async function openExt(name, opts) {
  const page = await newPage(opts);
  await page.goto(EXT_ORIGIN + `pages/${name}/${name}.html`);
  return page;
}
async function openDashboard() {
  const page = await openExt('dashboard');
  // Ready = the real render replaced the loading skeleton and the toolbar exists (not merely "#app has a child").
  await page.waitFor(() => document.querySelector('[data-library-tools]') && document.querySelector('.dashboard-search-input') && !document.querySelector('.dashboard-skeleton'), null, { timeout: 30000, label: 'dashboard ready' });
  return page;
}
const pageErrorsSince = mark => h.errors.slice(mark);

const checkDefs = [];
function check(id, name, fn) { checkDefs.push({ id, name, fn }); }

// A scratch dashboard page shared by data setup/inspection (runs extension-page code against browser.bookmarks).
let util;
const bm = {
  async tree() { return util.ev(async () => (await browser.bookmarks.getTree())); },
  async create(details) { return util.ev(async details => (await browser.bookmarks.create(details)), details); },
  async search(query) { return util.ev(async query => (await browser.bookmarks.search(query)), query); },
  async children(id) { return util.ev(async id => (await browser.bookmarks.getChildren(id)), id); },
  async removeTree(id) { return util.ev(async id => { await browser.bookmarks.removeTree(id); return true; }, id); },
  async storage(key) { return util.ev(async key => (await browser.storage.local.get(key))[key], key); },
  async tags() { return (await bm.storage('tagsByBookmark')) || {}; }
};
const portOf = () => server.address().port;

// ─── Checks ────────────────────────────────────────────────────────────────────
check('C01', 'manifest as installed in Firefox, event page answers runtime messages', async () => {
  const info = await util.ev(async () => {
    const manifest = browser.runtime.getManifest();
    const response = await browser.runtime.sendMessage({ type: 'REFRESH_BADGE' });
    const perms = await browser.permissions.getAll();
    return { manifest, response, perms, id: browser.runtime.id };
  });
  assert.equal(info.id, FIREFOX_EXTENSION_ID);
  assert.ok(info.manifest.background.scripts.length === 1 && info.manifest.background.scripts[0].endsWith('/background.js'), JSON.stringify(info.manifest.background));
  assert.equal(info.manifest.background.type, 'module');
  assert.equal(info.manifest.options_ui.open_in_tab, true);
  assert.ok(!info.manifest.permissions.includes('favicon'));
  assert.equal(info.manifest.browser_specific_settings.gecko.strict_min_version, '140.0');
  assert.deepEqual(info.response, { success: true });
  assert.deepEqual(info.perms.origins, []);
  assert.deepEqual(info.perms.permissions.sort(), ['alarms', 'bookmarks', 'clipboardWrite', 'contextMenus', 'notifications', 'storage', 'tabs']);
  return { permissions: info.perms.permissions };
});

check('C01b', 'Firefox reports no manifest warnings or errors for the generated manifest (read from the browser, chrome context)', async () => {
  await h.marionette.send('Marionette:SetContext', { value: 'chrome' });
  try {
    const { value } = await h.marionette.send('WebDriver:ExecuteScript', { script: 'const policy = WebExtensionPolicy.getByID(arguments[0]); const ext = policy.extension; return { warnings: ext.warnings || [], errors: ext.errors || [], version: ext.manifest.version, background: ext.manifest.background };', args: [FIREFOX_EXTENSION_ID] });
    assert.deepEqual(value.warnings, [], JSON.stringify(value.warnings));
    assert.deepEqual(value.errors, [], JSON.stringify(value.errors));
    return value;
  } finally { await h.marionette.send('Marionette:SetContext', { value: 'content' }); }
});

check('C02', 'Firefox bookmark roots: fixed ids, root excluded from destinations, import parent is Other Bookmarks', async () => {
  const info = await util.ev(async () => {
    const tree = await browser.bookmarks.getTree();
    const service = await import(browser.runtime.getURL('src/services/maintenance-preview-service.js'));
    const utils = await import(browser.runtime.getURL('src/core/bookmark-utils.js'));
    return {
      rootId: tree[0].id, rootChildren: tree[0].children.map(node => node.id),
      anyUnmodifiable: JSON.stringify(tree).includes('unmodifiable'),
      writable: (await service.writableFolders()).map(folder => folder.id),
      importParent: await utils.getDefaultImportParentId()
    };
  });
  assert.equal(info.rootId, 'root________');
  assert.deepEqual(info.rootChildren, ['menu________', 'toolbar_____', 'unfiled_____', 'mobile______']);
  assert.equal(info.anyUnmodifiable, false);
  assert.ok(!info.writable.includes('root________'), 'root offered as a restore destination');
  for (const id of info.rootChildren) assert.ok(info.writable.includes(id), id + ' missing from writable folders');
  assert.equal(info.importParent, 'unfiled_____');
  return info;
});

check('C03', 'popup initializes with matches for the active http tab and zero page errors', async () => {
  const mark = h.errors.length;
  const popup = await openExt('popup', { background: true });
  await popup.waitFor(() => document.querySelector('#app')?.children.length > 0 && document.querySelectorAll('.item-title').length >= 1, null, { label: 'popup matches' });
  h.popup = popup;
  const info = await popup.ev(() => ({ titles: [...document.querySelectorAll('.item-title')].map(node => node.textContent.trim()), favicons: document.querySelectorAll('.item-favicon-img').length, folderButtons: document.querySelectorAll('.item-actions button').length }));
  assert.ok(info.titles.includes('Local One') && info.titles.includes('Local Two'), JSON.stringify(info));
  assert.equal(info.favicons, 0, 'no /_favicon/ requests expected in Firefox');
  assert.deepEqual(pageErrorsSince(mark), []);
  return info;
});

check('C04', 'dashboard and options initialize with zero page errors', async () => {
  const mark = h.errors.length;
  const dashboard = await openDashboard();
  const options = await openExt('options');
  await options.waitFor(() => document.querySelector('select')?.options.length > 0, null, { label: 'options ready' });
  await dashboard.close(); await options.close();
  assert.deepEqual(pageErrorsSince(mark), []);
});

check('C05', 'synthetic bookmarks created through browser.bookmarks appear in the dashboard; search narrows the list', async () => {
  const dash = await openDashboard();
  await dash.fill('.dashboard-search-input', 'gaps-');
  await dash.waitFor(() => document.querySelectorAll('.item-title').length === 3, null, { label: '3 gaps rows' });
  const titles = await dash.ev(() => [...document.querySelectorAll('.item-title')].map(node => node.textContent.trim()));
  await dash.fill('.dashboard-search-input', 'gaps-a');
  await dash.waitFor(() => document.querySelectorAll('.item-title').length === 1, null, { label: '1 gaps-a row' });
  await dash.close();
  assert.deepEqual(titles, ['apple', 'Banana', 'Cherry']);
  return { titles };
});

check('C06', 'separators are not listed as bookmarks (Firefox gives them url "data:")', async () => {
  const sep = await bm.create({ parentId: h.fixtureId, type: 'separator' });
  assert.equal(sep.type, 'separator');
  const dash = await openDashboard();
  await dash.fill('.dashboard-search-input', 'data:');
  await sleep(500);
  const rows = await dash.count('.item-title');
  const total = await dash.ev(async () => { const utils = await import(browser.runtime.getURL('src/core/bookmark-utils.js')); return (await utils.getNormalizedBookmarks()).filter(b => b.url === 'data:').length; });
  await dash.close();
  await util.ev(async id => { await browser.bookmarks.remove(id); return true; }, sep.id);
  assert.equal(rows, 0); assert.equal(total, 0);
});

check('C07', 'inline tag add/remove on the active row persists to storage', async () => {
  const dash = await openDashboard();
  await dash.fill('.dashboard-search-input', 'gaps-a');
  await dash.waitFor(() => document.querySelectorAll('.item-title').length === 1);
  await dash.click('.item-title');
  await dash.waitFor(() => document.querySelector('.tag-add-input'), null, { label: 'tag input' });
  await dash.click('.tag-add-input');
  await dash.type('firefox-tag');
  await dash.press('Enter');
  await dash.waitFor(() => [...document.querySelectorAll('.tag-pill-label')].some(n => n.textContent === 'firefox-tag'), null, { label: 'tag pill' });
  const id = (await bm.search({ url: 'https://gaps-a.test/' }))[0].id;
  assert.deepEqual((await bm.tags())[id], ['firefox-tag']);
  await dash.click('.tag-pill-remove');
  await dash.waitFor(() => document.querySelectorAll('.tag-pill-label').length === 0, null, { label: 'tag removed' });
  assert.equal((await bm.tags())[id], undefined);
  await dash.close();
});

check('C08', 'bulk tags: preview, apply and undo', async () => {
  const dash = await openDashboard();
  await dash.fill('.dashboard-search-input', 'gaps-');
  await dash.waitFor(() => document.querySelectorAll('.item-title').length === 3);
  await dash.click('[data-library-tools]');
  await dash.click('[data-feature-action="Bulk tags"]');
  await dash.fill('input[aria-label="Tag to add"], input[placeholder="Tag to add"]', 'bulk-ff');
  await dash.click('[data-feature-action="Preview"]');
  await dash.waitFor(() => document.querySelector('.feature-preview')?.textContent.includes('bulk-ff'), null, { label: 'bulk preview' });
  await dash.click('[data-feature-action="Apply tag changes"]');
  await dash.waitFor(() => /Changed \/ missing \/ conflicting: 3/.test(document.querySelector('.feature-status')?.textContent || ''), null, { label: 'apply status' });
  const ids = (await bm.search({ title: 'Cherry' })).map(n => n.id);
  assert.ok((await bm.tags())[ids[0]].includes('bulk-ff'));
  await dash.click('[data-feature-action="Undo tag changes"]');
  await dash.waitFor(async () => { const t = (await browser.storage.local.get('tagsByBookmark')).tagsByBookmark || {}; return !Object.values(t).some(list => list.includes('bulk-ff')); }, null, { label: 'undo applied' });
  await dash.close();
});

check('C09', 'duplicate preview and merge keeps the survivor, moves tags and removes the other identity', async () => {
  const port = portOf();
  const a = await bm.create({ parentId: h.fixtureId, title: 'Dup keep', url: `https://dup-ff.test/x` });
  await sleep(20);
  const b = await bm.create({ parentId: h.fixtureId, title: 'Dup drop', url: `https://dup-ff.test/x` });
  await util.ev(async ({ id }) => { const tags = await import(browser.runtime.getURL('src/services/tag-service.js')); await tags.updateTagsMap(map => tags.setTagsForBookmark(map, id, ['dup-tag'])); return true; }, { id: b.id });
  const dash = await openDashboard();
  await dash.click('[data-library-tools]');
  await dash.click('[data-feature-action="Duplicate preview"]');
  await dash.waitFor(() => document.querySelectorAll('.feature-survivor input').length >= 2, null, { label: 'dup groups' });
  await dash.ev(id => { const input = document.querySelector(`.feature-survivor input[value="${id}"]`); input.click(); return input.checked; }, a.id);
  await dash.click('[data-feature-action="Merge and remove duplicates"]');
  await dash.waitFor(() => !document.querySelector('.feature-overlay'), null, { label: 'merge dialog closes' });
  await dash.waitFor(() => [...document.querySelectorAll('button')].some(btn => btn.textContent.trim() === 'Undo'), null, { label: 'undo toast' });
  const gone = (await bm.search({ url: 'https://dup-ff.test/x' })).map(n => n.id);
  assert.deepEqual(gone, [a.id]);
  assert.deepEqual((await bm.tags())[a.id], ['dup-tag']);
  await dash.close();
  await util.ev(async id => { await browser.bookmarks.remove(id); return true; }, a.id);
});

check('C10', 'delete from the row menu with Undo restores the bookmark, its folder and its tags (new identity)', async () => {
  const folder = await bm.create({ parentId: h.fixtureId, title: 'DelFolder' });
  const item = await bm.create({ parentId: folder.id, title: 'DeleteMe', url: 'https://delete-me-ff.test/' });
  await util.ev(async ({ id }) => { const tags = await import(browser.runtime.getURL('src/services/tag-service.js')); await tags.updateTagsMap(map => tags.setTagsForBookmark(map, id, ['keep-me'])); return true; }, { id: item.id });
  const dash = await openDashboard();
  await dash.fill('.dashboard-search-input', 'delete-me-ff');
  await dash.waitFor(() => document.querySelectorAll('.item-title').length === 1);
  await dash.click('.item-more-button');
  await dash.clickText('.row-menu-item', 'Delete');
  await dash.waitFor(() => document.querySelector('[role="dialog"], .confirm-dialog, .modal'), null, { label: 'confirm dialog' }).catch(() => {});
  await dash.waitFor(() => [...document.querySelectorAll('button')].some(btn => btn.textContent.trim() === 'Delete' && btn.closest('[role="dialog"], .modal, .confirm-dialog, .overlay')), null, { label: 'confirm delete button' });
  await dash.ev(() => { [...document.querySelectorAll('button')].find(btn => btn.textContent.trim() === 'Delete' && btn.closest('[role="dialog"], .modal, .confirm-dialog, .overlay')).scrollIntoView(); return true; });
  await dash.clickText('[role="dialog"] button, .modal button, .confirm-dialog button, .overlay button', 'Delete');
  await dash.waitFor(async () => (await browser.bookmarks.search({ url: 'https://delete-me-ff.test/' })).length === 0, null, { label: 'bookmark removed' });
  await util.waitFor(async id => ((await browser.storage.local.get('tagsByBookmark')).tagsByBookmark || {})[id] === undefined, item.id, { label: 'event page purged the deleted bookmark tags' });
  await dash.clickText('button', 'Undo');
  await dash.waitFor(async () => (await browser.bookmarks.search({ url: 'https://delete-me-ff.test/' })).length === 1, null, { label: 'bookmark restored' });
  const restored = (await bm.search({ url: 'https://delete-me-ff.test/' }))[0];
  assert.equal(restored.parentId, folder.id);
  assert.notEqual(restored.id, item.id);
  await dash.waitFor(async id => ((await browser.storage.local.get('tagsByBookmark')).tagsByBookmark || {})[id]?.includes('keep-me'), restored.id, { label: 'tags restored' });
  await dash.close();
  await bm.removeTree(folder.id);
});

check('C11', 'folder removal outside the extension purges descendant tags in the event page', async () => {
  const folder = await bm.create({ parentId: h.fixtureId, title: 'TagTree' });
  const sub = await bm.create({ parentId: folder.id, title: 'Sub' });
  const item = await bm.create({ parentId: sub.id, title: 'Deep', url: 'https://deep-ff.test/' });
  await util.ev(async ({ id }) => { const tags = await import(browser.runtime.getURL('src/services/tag-service.js')); await tags.updateTagsMap(map => tags.setTagsForBookmark(map, id, ['deep'])); return true; }, { id: item.id });
  assert.deepEqual((await bm.tags())[item.id], ['deep']);
  await bm.removeTree(folder.id);
  await util.waitFor(async id => ((await browser.storage.local.get('tagsByBookmark')).tagsByBookmark || {})[id] === undefined, item.id, { label: 'descendant tag purged' });
});

check('C12', 'drag-and-drop move helper: same-folder and cross-folder moves land where planned; Undo restores order', async () => {
  const folderA = await bm.create({ parentId: h.fixtureId, title: 'DnD A' });
  const folderB = await bm.create({ parentId: h.fixtureId, title: 'DnD B' });
  const info = await util.ev(async ({ a, b }) => {
    const api = await import(browser.runtime.getURL('src/platform/browser-api.js'));
    const { createActionTools } = await import(browser.runtime.getURL('src/dashboard/action-tools.js'));
    const mk = async (parentId, title) => api.createBookmark({ parentId, title, url: 'https://dnd-' + title + '.test/' });
    const items = []; for (const title of ['a1', 'a2', 'a3', 'a4']) items.push(await mk(a, title));
    const x = await mk(b, 'x1');
    const state = { allBookmarks: [...items, x], tagsByBookmark: {}, visibleBookmarks: [] };
    let toast;
    const tools = createActionTools({ state, t: (text, vars = {}) => text.replace(/\{\{(.*?)\}\}/g, (_, key) => vars[key] ?? key), formatNumber: String, sendMessage: async () => {}, showConfirmDialog: async () => true, setToast: (_text, options) => { toast = options; }, refreshData: async () => {}, renderListOnly() {}, pushCleanupHistory: async () => {}, invalidateBookmarkCache() {}, ...api, deselectBookmarks() {} });
    const order = async id => (await browser.bookmarks.getChildren(id)).map(n => n.title);
    const fresh = async node => (await browser.bookmarks.get(node.id))[0];
    const out = { start: await order(a) };
    // a1 dropped AFTER a3 inside the same folder -> expected [a2, a3, a1, a4]
    await tools.handleDragDropMove([await fresh(items[0])], await fresh(items[2]), 'after');
    out.forwardSameFolder = await order(a);
    // a4 dropped BEFORE a2 -> expected [a4, a2, a3, a1]
    await tools.handleDragDropMove([await fresh(items[3])], await fresh(items[1]), 'before');
    out.backwardSameFolder = await order(a);
    // cross folder: x1 dropped before a3
    await tools.handleDragDropMove([await fresh(x)], await fresh(items[2]), 'before');
    out.crossFolder = await order(a); out.sourceAfter = await order(b);
    await toast.action();
    out.afterUndo = await order(a); out.sourceAfterUndo = await order(b);
    // forward drop to the last position: a4 AFTER a1 -> [a2, a3, a1, a4]; Undo -> [a4, a2, a3, a1]
    await tools.handleDragDropMove([await fresh(items[3])], await fresh(items[0]), 'after');
    out.forwardToLast = await order(a);
    await toast.action();
    out.forwardToLastUndo = await order(a);
    // forward multi-selection inside one folder: a4 and a2 AFTER a3 -> [a3, a4, a2, a1]; Undo restores
    await tools.handleDragDropMove([await fresh(items[3]), await fresh(items[1])], await fresh(items[2]), 'after');
    out.forwardMulti = await order(a);
    await toast.action();
    out.forwardMultiUndo = await order(a);
    return out;
  }, { a: folderA.id, b: folderB.id });
  assert.deepEqual(info.start, ['a1', 'a2', 'a3', 'a4']);
  assert.deepEqual(info.forwardSameFolder, ['a2', 'a3', 'a1', 'a4'], JSON.stringify(info));
  assert.deepEqual(info.backwardSameFolder, ['a4', 'a2', 'a3', 'a1'], JSON.stringify(info));
  assert.deepEqual(info.crossFolder, ['a4', 'a2', 'x1', 'a3', 'a1'], JSON.stringify(info));
  assert.deepEqual(info.sourceAfter, []);
  assert.deepEqual(info.afterUndo, ['a4', 'a2', 'a3', 'a1'], JSON.stringify(info));
  assert.deepEqual(info.sourceAfterUndo, ['x1']);
  assert.deepEqual(info.forwardToLast, ['a2', 'a3', 'a1', 'a4'], JSON.stringify(info));
  assert.deepEqual(info.forwardToLastUndo, ['a4', 'a2', 'a3', 'a1'], JSON.stringify(info));
  assert.deepEqual(info.forwardMulti, ['a3', 'a4', 'a2', 'a1'], JSON.stringify(info));
  assert.deepEqual(info.forwardMultiUndo, ['a4', 'a2', 'a3', 'a1'], JSON.stringify(info));
  await bm.removeTree(folderA.id); await bm.removeTree(folderB.id);
  return info;
});

check('C13', 'sort control reorders and persists across reload; saved view stores and re-applies sort', async () => {
  let dash = await openDashboard();
  await dash.fill('.dashboard-search-input', 'gaps-');
  await dash.waitFor(() => document.querySelectorAll('.item-title').length === 3);
  const order = () => dash.ev(() => [...document.querySelectorAll('.item-title')].map(node => node.textContent.trim()));
  const select = '.dashboard-sort-select';
  const choose = async value => { await dash.waitFor(select => document.querySelector(select), select, { label: 'sort select rendered' }); await dash.ev(({ select, value }) => { const el = document.querySelector(select); el.value = value; el.dispatchEvent(new Event('change', { bubbles: true })); return true; }, { select, value }); };
  for (const [value, expected] of [['url-asc', ['Cherry', 'apple', 'Banana']], ['newest', ['Cherry', 'apple', 'Banana']], ['oldest', ['Banana', 'apple', 'Cherry']], ['title-asc', ['apple', 'Banana', 'Cherry']]]) {
    await choose(value);
    await dash.waitFor(first => document.querySelector('.item-title')?.textContent.trim() === first, expected[0], { label: 'sort ' + value });
    assert.deepEqual(await order(), expected, value);
  }
  await choose('oldest');
  await dash.waitFor(() => document.querySelector('.item-title')?.textContent.trim() === 'Banana');
  const stored = await bm.storage('dashboardSort');
  assert.equal(stored, 'oldest');
  await dash.close();
  dash = await openDashboard();
  await dash.fill('.dashboard-search-input', 'gaps-');
  await dash.waitFor(() => document.querySelectorAll('.item-title').length === 3);
  await dash.waitFor(select => document.querySelector(select), select, { label: 'sort select rendered' });
  assert.equal(await dash.ev(select => document.querySelector(select).value, select), 'oldest');
  // keyboard operability: focus + ArrowUp changes the native select
  await dash.focus(select); await dash.press('ArrowUp');
  await dash.waitFor(() => document.querySelector('.item-title')?.textContent.trim() === 'Cherry', null, { label: 'keyboard sort' });
  // saved view
  await dash.click('[data-library-tools]');
  await dash.click('[data-feature-action="Saved views"]');
  await dash.fill('input[aria-label="View name"], input[placeholder="View name"]', 'Sorted newest');
  await dash.click('[data-feature-action="Save view"]');
  const views = await util.waitFor(async () => { const v = (await browser.storage.local.get('smartViews')).smartViews || []; return v.some(x => x.name === 'Sorted newest') ? v : false; }, null, { label: 'saved view stored' });
  const saved = views.find(v => v.name === 'Sorted newest');
  assert.equal(saved.sort, 'newest');
  await dash.clickText('button', 'Close');
  await choose('url-asc');
  await dash.click('[data-library-tools]');
  await dash.click('[data-feature-action="Saved views"]');
  // The dialog fills its saved-view list asynchronously: wait until the option for the saved view exists.
  await dash.waitFor(id => [...document.querySelectorAll('.feature-field select option')].some(option => option.value === id), saved.id, { label: 'saved view listed in the dialog' });
  await dash.ev(id => { const el = document.querySelector('.feature-field select'); el.value = id; el.dispatchEvent(new Event('change', { bubbles: true })); return true; }, saved.id);
  await dash.click('[data-feature-action="Open view"]');
  await dash.waitFor(() => !document.querySelector('.feature-overlay'), null, { label: 'view applied' });
  assert.equal(await dash.ev(select => document.querySelector(select).value, select), 'newest');
  await dash.close();
});

check('C14', 'CSV export has a BOM, RFC 4180 header and only the visible set (file really downloaded)', async () => {
  const dash = await openDashboard();
  await dash.fill('.dashboard-search-input', 'gaps-');
  await dash.waitFor(() => document.querySelectorAll('.item-title').length === 3);
  for (const file of fs.readdirSync(downloadDir)) fs.rmSync(path.join(downloadDir, file), { force: true });
  await dash.click('.dashboard-list-menu-button');
  await dash.clickText('.dashboard-menu-item, button, [role="menuitem"]', 'Export visible as CSV');
  const file = await waitForFile(downloadDir, /^bookmark-manager-visible-.*\.csv$/);
  const bytes = fs.readFileSync(path.join(downloadDir, file));
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  const text = bytes.toString('utf8').slice(1);
  assert.ok(text.startsWith('"Title","URL","Folder path","Date added","Tags","Text encoding"\r\n'));
  assert.equal(text.split('\r\n').length, 4);
  for (const title of ['Banana', 'apple', 'Cherry']) assert.ok(text.includes(`"${title}"`));
  await dash.fill('.dashboard-search-input', 'gaps-a');
  await dash.waitFor(() => document.querySelectorAll('.item-title').length === 1);
  fs.rmSync(path.join(downloadDir, file), { force: true });
  await dash.click('.dashboard-list-menu-button');
  await dash.clickText('.dashboard-menu-item, button, [role="menuitem"]', 'Export visible as CSV');
  const second = await waitForFile(downloadDir, /^bookmark-manager-visible-.*\.csv$/);
  const text2 = fs.readFileSync(path.join(downloadDir, second), 'utf8');
  assert.equal(text2.slice(1).split('\r\n').length, 2);
  assert.ok(text2.includes('Cherry') && !text2.includes('Banana'));
  await dash.close();
  return { filename: file, bytes: bytes.length };
});

check('C15', 'bookmarks.html import: Chrome-style and Firefox-style fixtures through preview/journal', async () => {
  const chromeFile = path.join(profile, 'chrome-bookmarks.html'); const ffFile = path.join(profile, 'firefox-bookmarks.html');
  fs.writeFileSync(chromeFile, CHROME_HTML); fs.writeFileSync(ffFile, FIREFOX_HTML);
  const importFile = async (file, policy) => {
    const dash = await openDashboard();
    await dash.click('[data-library-tools]');
    await h.chooseFile(dash, () => dash.click('[data-feature-action="Import bookmarks…"]'), file);
    await dash.waitFor(() => document.querySelector('[data-feature-action="Import bookmarks"]'), null, { label: 'import preview' });
    if (policy) await dash.ev(policy => { const select = [...document.querySelectorAll('select')].find(el => /Duplicate policy/.test(el.getAttribute('aria-label') || el.closest('label')?.textContent || '')); select.value = policy; select.dispatchEvent(new Event('change', { bubbles: true })); return true; }, policy);
    return dash;
  };
  const status = (dash, pattern) => dash.waitFor(pattern => new RegExp(pattern).test(document.querySelector('.feature-status')?.textContent || ''), pattern, { label: 'import status ' + pattern });
  let dash = await importFile(chromeFile, 'keep');
  const dialog = await dash.text('.feature-dialog');
  assert.ok(dialog.includes('Supported bookmarks in this file: 3'), dialog.slice(0, 400));
  assert.ok(dialog.includes('Skipped 1 non-http(s) URL for safety.'));
  await dash.click('[data-feature-action="Import bookmarks"]');
  await status(dash, 'Created / merged / skipped / failed / remaining: 3 / 0 / 0 / 0 / 0');
  const created = {
    one: (await bm.search({ url: 'https://chrome-one.test/a?x=1&y=2' })).map(n => n.title),
    two: (await bm.search({ url: 'https://chrome-two.test/' })).map(n => n.title),
    three: (await bm.search({ url: 'https://chrome-three.test/' })).map(n => n.title),
    bookmarklets: (await bm.search({ title: 'Bookmarklet' })).length
  };
  assert.deepEqual(created, { one: ['Chrome One & Co'], two: ['Chrome Two'], three: ['Chrome Three'], bookmarklets: 0 });
  await dash.close();
  dash = await importFile(ffFile, 'skip');
  const ffDialog = await dash.text('.feature-dialog');
  assert.ok(ffDialog.includes('Supported bookmarks in this file: 2'), ffDialog.slice(0, 400));
  assert.ok(ffDialog.includes('Tags: reading list, work'));
  await dash.click('[data-feature-action="Import bookmarks"]');
  await status(dash, 'Created / merged / skipped / failed / remaining: 1 / 0 / 1 / 0 / 0');
  const node = (await bm.search({ url: 'https://ff-one.test/' }))[0];
  assert.deepEqual((await bm.tags())[node.id], ['reading list', 'work']);
  await dash.close();
  dash = await importFile(ffFile, 'merge');
  await dash.click('[data-feature-action="Import bookmarks"]');
  await status(dash, 'Created / merged / skipped / failed / remaining: 0 / 2 / 0 / 0 / 0');
  const dupe = (await bm.search({ url: 'https://chrome-one.test/a?x=1&y=2' }))[0];
  assert.deepEqual((await bm.tags())[dupe.id], ['dup-tag']);
  const journal = Object.values((await bm.storage('importJournal')) || {}).map(item => item.status);
  assert.ok(journal.length >= 3 && journal.every(item => item === 'completed'), JSON.stringify(journal));
  await dash.close();
  return { created, journal: journal.length };
});

check('C16', 'snapshot export and restore into a new folder (remapped IDs, journal, separators omitted)', async () => {
  const sep = await bm.create({ parentId: h.fixtureId, type: 'separator' });
  const snapshot = await util.ev(async () => { const svc = await import(browser.runtime.getURL('src/services/snapshot-service.js')); return svc.createSnapshot(); });
  assert.equal(snapshot.format, 'bookmark-scope-snapshot');
  assert.deepEqual(snapshot.roots.map(r => r.sourceId), ['menu________', 'toolbar_____', 'unfiled_____', 'mobile______']);
  const serialized = JSON.stringify(snapshot);
  assert.ok(!serialized.includes('"data:"'), 'separator leaked into snapshot');
  await util.ev(async id => { await browser.bookmarks.remove(id); return true; }, sep.id);
  const snapshotPath = path.join(profile, 'snapshot.json'); fs.writeFileSync(snapshotPath, serialized);
  const dash = await openDashboard();
  await dash.click('[data-library-tools]');
  await h.chooseFile(dash, () => dash.click('[data-feature-action="Restore snapshot"]'), snapshotPath);
  await dash.waitFor(() => document.querySelector('[data-feature-action="Restore into new folder"]'), null, { label: 'restore preview' });
  const destinations = await dash.ev(() => [...document.querySelectorAll('.feature-dialog select option')].map(option => option.textContent.trim()));
  assert.ok(destinations.length >= 4 && destinations.every(label => label.length), JSON.stringify(destinations));
  await dash.click('[data-feature-action="Restore into new folder"]');
  await dash.waitFor(() => /Created \/ excluded \/ failed \/ remaining: [1-9]/.test(document.querySelector('.feature-status')?.textContent || ''), null, { label: 'restore status' });
  const restore = (await bm.storage('snapshotRestoreJournal'))[0];
  assert.equal(restore.status, 'completed');
  assert.ok(restore.items.some(item => item.sourceId === snapshot.roots[2].children?.[0]?.sourceId && item.id));
  const container = (await bm.search('Bookmark Scope snapshot')).length;
  assert.ok(container >= 1);
  await dash.close();
  return { destinations, created: restore.items.length };
});

check('C17', 'command palette opens with Ctrl+Shift+P, runs a command, Escape restores focus', async () => {
  const dash = await openDashboard();
  await dash.focus('[data-library-tools]');
  await dash.press('Control', 'Shift', 'P');
  await dash.waitFor(() => document.querySelector('.feature-dialog input[type="search"], [role="dialog"] input'), null, { label: 'palette open' });
  await dash.type('Saved');
  await dash.press('ArrowDown'); await dash.press('Enter');
  await dash.waitFor(() => [...document.querySelectorAll('[role="dialog"]')].some(d => /Saved views/.test(d.getAttribute('aria-label') || d.textContent)), null, { label: 'saved views via palette' });
  await dash.press('Escape');
  await dash.waitFor(() => !document.querySelector('.feature-overlay'), null, { label: 'palette closed' });
  await dash.close();
});

check('C18', 'options: save preferences, review reminder section and background-scan toggle', async () => {
  const options = await openExt('options');
  await options.waitFor(() => document.querySelector('select')?.options.length > 0 && document.querySelector('#review-reminder-interval')?.value !== '' && document.querySelector('#bg-scan-interval')?.value !== '', null, { label: 'options fully loaded from storage' });
  await options.click('#review-reminder-enabled');
  await options.fill('#review-reminder-interval', '7');
  await options.ev(() => { const el = document.querySelector('#popup-width'); el.value = [...el.options].at(-1).value; el.dispatchEvent(new Event('change', { bubbles: true })); return true; });
  const submit = await options.ev(() => { const form = document.querySelector('#settings-form'); const btn = form.querySelector('button[type="submit"], #save-settings, .primary-button'); return btn ? (btn.id ? '#' + btn.id : 'button[type="submit"]') : null; });
  assert.ok(submit, 'save button not found');
  await options.click(submit);
  await options.waitFor(() => /saved/i.test(document.querySelector('#status')?.textContent || ''), null, { label: 'saved status' });
  const stored = await util.ev(async () => browser.storage.local.get(['reviewReminderEnabled', 'reviewReminderIntervalDays', 'reviewReminderNextAt', 'popupWidth']));
  assert.equal(stored.reviewReminderEnabled, true, JSON.stringify({ stored, status: await options.text('#status') })); assert.equal(stored.reviewReminderIntervalDays, 7); assert.ok(stored.reviewReminderNextAt > Date.now());
  const alarm = await util.ev(async () => (await browser.alarms.getAll()).map(a => a.name));
  assert.ok(alarm.length >= 1, 'review reminder alarm missing: ' + JSON.stringify(alarm));
  // background scan toggle goes through permissions.request after several awaits in a real click handler
  await options.ev(() => { document.querySelector('#status').textContent = ''; return true; }); // so the next "saved" is the second save
  await util.ev(async () => browser.permissions.remove({ origins: ['http://*/*', 'https://*/*'] }).catch(() => false));
  assert.equal(await util.ev(async () => browser.permissions.contains({ origins: ['http://*/*', 'https://*/*'] })), false);
  await options.click('#bg-scan-enabled');
  await options.click(submit);
  await options.waitFor(() => /saved|permission/i.test(document.querySelector('#status')?.textContent || ''), null, { label: 'bg scan status' });
  const bg = await util.ev(async () => ({ enabled: (await browser.storage.local.get('bgHealthScanEnabled')).bgHealthScanEnabled, perms: await browser.permissions.contains({ origins: ['http://*/*', 'https://*/*'] }) }));
  assert.deepEqual(bg, { enabled: true, perms: true }, 'enabling the background scan from the Save click must obtain the optional permission');
  await util.ev(async () => { await browser.storage.local.set({ bgHealthScanEnabled: false }); return true; }); // keep later checks free of scheduled scans
  await options.close();
  return { alarm, bg };
});

check('C19', 'themes (light/dark/system) and Persian RTL render without errors', async () => {
  const mark = h.errors.length;
  try {
  await util.ev(async () => { await browser.storage.local.set({ themeMode: 'dark' }); return true; });
  let dash = await openDashboard();
  const dark = await dash.ev(() => ({ theme: document.documentElement.dataset.theme || document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.body).backgroundColor }));
  await dash.close();
  await util.ev(async () => { await browser.storage.local.set({ themeMode: 'light', localePreference: 'fa' }); return true; });
  dash = await openDashboard();
  await dash.waitFor(() => document.documentElement.dir === 'rtl', null, { label: 'rtl applied' });
  const fa = await dash.ev(() => ({ dir: document.documentElement.dir, lang: document.documentElement.lang, search: document.querySelector('.dashboard-search-input')?.placeholder, bg: getComputedStyle(document.body).backgroundColor }));
  await dash.shot('dashboard-fa-rtl', { size: { width: 1280, height: 900 } });
  await dash.close();
  assert.equal(fa.dir, 'rtl'); assert.equal(fa.lang, 'fa'); assert.notEqual(dark.bg, fa.bg);
  assert.deepEqual(pageErrorsSince(mark), []);
  return { dark, fa };
  } finally {
    await util.ev(async () => { await browser.storage.local.set({ themeMode: 'system', localePreference: 'en' }); return true; });
  }
});

check('C20', 'health scan: permission granted from a real click, scan runs against a slow local server, Stop stops it', async () => {
  const port = portOf();
  await util.ev(async port => {
    const bar = 'toolbar_____';
    const folder = await browser.bookmarks.create({ parentId: bar, title: 'FastScan' });
    for (let i = 1; i <= 400; i++) await browser.bookmarks.create({ parentId: folder.id, title: 'Fast ' + i, url: `http://127.0.0.1:${port}/f${i}` });
    return folder.id;
  }, port).then(id => { h.scanFolder = id; });
  fixtureHits.length = 0;
  // Revoke so the click has to request the grant again.
  await util.ev(async () => browser.permissions.remove({ origins: ['http://*/*', 'https://*/*'] }).catch(() => false));
  const dash = await openDashboard();
  await dash.fill('.dashboard-search-input', '127.0.0.1');
  await dash.waitFor(() => document.querySelectorAll('.item-title').length > 10, null, { label: 'scan rows' });
  const idle = await dash.text('.dashboard-inspect-button');
  assert.match(idle, /Inspect visible/);
  await dash.click('.dashboard-inspect-button');
  await dash.waitFor(() => /Stop inspect/.test(document.querySelector('.dashboard-inspect-button')?.innerText || ''), null, { label: 'scan started', timeout: 20000 }).catch(async error => { throw new Error(error.message + ' | button=' + (await dash.text('.dashboard-inspect-button')).replace(/s+/g, ' ') + ' | toast=' + (await dash.text('.toast, .dashboard-toast, [role="status"]')) + ' | hits=' + fixtureHits.length); });
  const granted = await util.ev(async () => browser.permissions.contains({ origins: ['http://*/*', 'https://*/*'] }));
  assert.equal(granted, true, 'optional host permission was not granted by the click');
  await sleep(2000);
  const before = fixtureHits.length;
  assert.ok(before > 0, 'no request reached the local server');
  const keepalive = before;
  await dash.click('.dashboard-inspect-button', { hold: 120 });
  await sleep(1500);
  const atStop = fixtureHits.length;
  await sleep(2500);
  const later = fixtureHits.length;
  const label = (await dash.text('.dashboard-inspect-button')).replace(/\s+/g, ' ');
  assert.match(label, /Inspect visible/);
  assert.ok(later - atStop <= 5, `requests kept flowing after Stop (${atStop} -> ${later})`);
  assert.ok(later < 300, 'scan ran close to completion instead of stopping');
  await dash.close();
  await bm.removeTree(h.scanFolder);
  return { requestsBeforeStop: keepalive, atStop, later };
});

check('C21', 'event page suspends after idling, is woken by a message and by an alarm, and its handlers still run', async () => {
  const countStarts = async () => ((await bm.storage('diagnosticEvents')) || []).filter(event => event.event === 'storage_initialized').length;
  const alarmTime = async () => util.ev(async () => (await browser.alarms.get('bookmark-manager-review-reminder'))?.scheduledTime ?? null);
  // 1) message wake-up
  await sleep(IDLE_TIMEOUT_MS + 6000);
  const startsBefore = await countStarts();
  const woke = await util.ev(async () => browser.runtime.sendMessage({ type: 'REFRESH_BADGE' }));
  assert.deepEqual(woke, { success: true });
  await util.waitFor(async before => ((await browser.storage.local.get('diagnosticEvents')).diagnosticEvents || []).filter(event => event.event === 'storage_initialized').length > before, startsBefore, { label: 'a message restarted the suspended event page' });
  // 2) alarm wake-up: the review reminder is enabled with a future due date (C18); an early alarm makes the handler re-arm it for the due date
  const due = (await bm.storage('reviewReminderNextAt'));
  assert.ok(due > Date.now(), 'reminder due date should be in the future');
  await sleep(IDLE_TIMEOUT_MS + 6000);
  const startsMid = await countStarts();
  await util.ev(async () => { await browser.alarms.create('bookmark-manager-review-reminder', { when: Date.now() + 1500 }); return true; });
  await util.waitFor(async before => ((await browser.storage.local.get('diagnosticEvents')).diagnosticEvents || []).filter(event => event.event === 'storage_initialized').length > before, startsMid, { label: 'the alarm restarted the suspended event page' });
  await util.waitFor(async due => (await browser.alarms.get('bookmark-manager-review-reminder'))?.scheduledTime >= due - 1000, due, { label: 'alarm handler re-armed the reminder for its due date' });
  return { startsBefore, startsMid, due, alarmAfter: await alarmTime() };
});

check('C22', 'badge shows the match count for the active http tab (event page, tabs events)', async () => {
  const tab = await newPage();
  await tab.goto(`http://127.0.0.1:${portOf()}/page/one`);
  const text = await util.waitFor(async () => {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const t = tabs.find(x => x.url?.startsWith('http://127.0.0.1'));
    if (!t) return false;
    const badge = await browser.action.getBadgeText({ tabId: t.id });
    return badge || false;
  }, null, { label: 'badge text' });
  await tab.close();
  assert.ok(Number(text) >= 3, 'badge: ' + text);
  return { badge: text };
});

check('C23', 'review reminder fires, reschedules, and the notifications API accepts the extension options', async () => {
  const info = await util.ev(async () => {
    const shown = [];
    browser.notifications.onShown?.addListener(id => shown.push(id));
    await browser.storage.local.set({ reviewReminderEnabled: true, reviewReminderIntervalDays: 1, reviewReminderNextAt: Date.now() - 1000 });
    await browser.alarms.create('bookmark-manager-review-reminder', { when: Date.now() + 500 });
    let next;
    for (let i = 0; i < 80; i++) {
      next = (await browser.storage.local.get('reviewReminderNextAt')).reviewReminderNextAt;
      if (next > Date.now()) break;
      await new Promise(r => setTimeout(r, 250));
    }
    // Headless CI has no desktop notification service, so onShown/getAll may stay empty there; display is reported, not required.
    await new Promise(r => setTimeout(r, 1500));
    const listed = Object.keys(await browser.notifications.getAll());
    // Same options the event page uses: create() must resolve with the id (an invalid option rejects).
    const probe = await browser.notifications.create('bookmark-scope-probe', { type: 'basic', iconUrl: 'icons/icon-128.png', title: 'Bookmark Scope review is due', message: 'probe' });
    await browser.notifications.clear('bookmark-scope-probe');
    return { shown, listed, next, probe, observed: shown.includes('bookmark-manager-review-due') || listed.includes('bookmark-manager-review-due') };
  });
  assert.ok(info.next > Date.now(), 'reminder was not rescheduled after firing: ' + JSON.stringify(info));
  assert.equal(info.probe, 'bookmark-scope-probe');
  return info;
});

check('C24', 'context menus register without error and OPEN_BOOKMARK_FOLDER degrades with a clear error', async () => {
  const info = await util.ev(async () => {
    const svc = await import(browser.runtime.getURL('src/services/context-menu-service.js'));
    let registered = 'ok';
    try { await svc.registerContextMenus(); } catch (error) { registered = 'ERR ' + error.message; }
    // registerContextMenus() swallows errors, so prove the three items exist: creating the same id again must fail.
    const exists = {};
    for (const id of ['bookmark-scope-show-domain', 'bookmark-scope-find-page-dupes', 'bookmark-scope-find-link-dupes']) {
      exists[id] = await new Promise(resolve => { browser.contextMenus.create({ id, title: 'probe', contexts: ['page'] }, () => resolve(browser.runtime.lastError?.message || 'NOT REGISTERED')); });
    }
    const folder = await browser.runtime.sendMessage({ type: 'OPEN_BOOKMARK_FOLDER', parentId: 'unfiled_____' });
    const api = await import(browser.runtime.getURL('src/platform/browser-api.js'));
    return { registered, exists, folder, managerUrl: api.getBookmarksManagerUrl('x'), extensionsUrl: api.getExtensionsManagerUrl(), browser: api.detectBrowser() };
  });
  assert.equal(info.registered, 'ok');
  for (const [id, message] of Object.entries(info.exists)) assert.match(message, /ID already exists|already exists/i, id + ': ' + message);
  assert.equal(info.browser, 'firefox');
  assert.equal(info.managerUrl, null); assert.equal(info.extensionsUrl, null);
  assert.equal(info.folder.success, false);
  return info;
});

check('C26', 'scheduled scan runs inside the event page when its alarm fires (permission held, local fixtures only)', async () => {
  const info = await util.ev(async () => {
    const perms = await browser.permissions.request({ origins: ['http://*/*', 'https://*/*'] }).catch(error => 'ERR ' + error.message);
    return { perms: perms === true || (await browser.permissions.contains({ origins: ['http://*/*', 'https://*/*'] })) };
  }).catch(() => ({ perms: false }));
  // Hold the grant without a click: Firefox's own test route is the pref set at launch; contains() proves what is held.
  const held = await util.ev(async () => browser.permissions.contains({ origins: ['http://*/*', 'https://*/*'] }));
  assert.equal(held, true, 'optional host permission not held (earlier checks should have granted it)');
  const before = (await bm.storage('bgHealthScanLastRunAt')) || 0;
  await util.ev(async () => { await browser.storage.local.set({ bgHealthScanEnabled: true, bgHealthScanIntervalDays: 7 }); return true; });
  await sleep(2500); // let the event page's storage listener re-arm its own alarm first, then replace it with one that fires now
  await util.ev(async () => { await browser.alarms.create('bookmark-scope-scheduled-health-scan', { when: Date.now() + 800 }); return true; });
  await util.waitFor(async before => ((await browser.storage.local.get('bgHealthScanLastRunAt')).bgHealthScanLastRunAt || 0) > before, before, { label: 'scheduled scan finished', timeout: 60000 });
  await util.ev(async () => { await browser.storage.local.set({ bgHealthScanEnabled: false }); return true; });
  const alarm = await util.ev(async () => (await browser.alarms.getAll()).map(a => a.name));
  return { alarms: alarm, heldPermission: held };
});

check('C27', 'Firefox hides controls that would open privileged chrome:// pages (menus really opened)', async () => {
  const dash = await openDashboard();
  await dash.fill('.dashboard-search-input', 'gaps-a');
  await dash.waitFor(() => document.querySelectorAll('.item-title').length >= 1);
  await dash.click('.item-title');
  await dash.waitFor(() => document.querySelector('.item-actions') && document.querySelector('.detail-field'), null, { label: 'row actions and drawer rendered' });
  const rows = await dash.ev(() => ({ rowActionButtons: document.querySelectorAll('.item-actions button').length, rowFolderButtons: document.querySelectorAll('.folder-row-action').length, drawerFolder: [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Show folder').length, drawerOpen: [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === 'Open').length }));
  await dash.click('.dashboard-menu-button');
  await dash.waitFor(() => document.querySelectorAll('.dashboard-header-menu button').length > 0, null, { label: 'dashboard header menu open' });
  const menu = await dash.ev(() => [...document.querySelectorAll('.dashboard-header-menu button')].map(n => n.textContent.trim()));
  await dash.close();
  const popup = await openPopup();
  if (await popup.ev(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Got it'))) await popup.clickText('button', 'Got it'); // first-run pin hint covers the header
  await popup.waitFor(() => !document.querySelector('.modal-overlay, .pin-onboarding-overlay, [role="dialog"]'), null, { label: 'first-run hint dismissed' });
  await popup.click('.overflow-trigger');
  await popup.waitFor(() => document.querySelectorAll('.overflow-item').length > 0, null, { label: 'popup overflow menu open' });
  const popupInfo = await popup.ev(() => ({ rowButtons: [...document.querySelectorAll('.item-actions')].map(n => n.querySelectorAll('button').length), overflow: [...document.querySelectorAll('.overflow-item')].map(n => n.textContent.trim()) }));
  await popup.close();
  assert.ok(rows.rowActionButtons > 0 && rows.drawerOpen > 0, 'row/drawer actions were not rendered: ' + JSON.stringify(rows));
  assert.equal(rows.rowFolderButtons, 0); assert.equal(rows.drawerFolder, 0);
  assert.ok(menu.includes('About') && menu.includes('Settings'), 'dashboard menu did not render: ' + JSON.stringify(menu));
  assert.ok(!menu.includes('Open Chrome bookmarks'), JSON.stringify(menu));
  assert.ok(popupInfo.overflow.includes('Open settings') && popupInfo.overflow.includes('About'), 'popup menu did not render: ' + JSON.stringify(popupInfo));
  assert.ok(!popupInfo.overflow.includes('Open Chrome bookmarks'), JSON.stringify(popupInfo));
  assert.ok(popupInfo.rowButtons.every(count => count === 2), 'popup rows should have Open and Delete only: ' + JSON.stringify(popupInfo.rowButtons));
  return { rows, menu, popupInfo };
});

check('C28', 'Resumable scan: "Start new scan" requests the optional permission from the click and scans', async () => {
  const port = portOf();
  const folder = await bm.create({ parentId: 'toolbar_____', title: 'ResumableFixture' });
  for (let i = 1; i <= 6; i++) await bm.create({ parentId: folder.id, title: 'Res ' + i, url: `http://127.0.0.1:${port}/f-res${i}` });
  await util.ev(async () => browser.permissions.remove({ origins: ['http://*/*', 'https://*/*'] }).catch(() => false));
  const dash = await openDashboard();
  await dash.fill('.dashboard-search-input', 'f-res');
  await dash.waitFor(() => document.querySelectorAll('.item-title').length === 6, null, { label: '6 resumable rows' });
  await dash.click('[data-library-tools]');
  await dash.click('[data-feature-action="Resumable scan"]');
  await dash.click('[data-feature-action="Start new scan"]');
  await dash.waitFor(() => { const text = document.querySelector('.feature-scan-progress')?.textContent || ''; return /ompleted/.test(text) && text.includes('6 / 6 / 0'); }, null, { label: 'resumable scan completed', timeout: 40000 }).catch(async error => { throw new Error(error.message + ' | progress=' + (await dash.text('.feature-scan-progress')) + ' | status=' + (await dash.text('.feature-status'))); });
  const held = await util.ev(async () => browser.permissions.contains({ origins: ['http://*/*', 'https://*/*'] }));
  assert.equal(held, true);
  await dash.close();
  await bm.removeTree(folder.id);
});

check('C29', 'popup star bookmarks the active tab, a second click removes it, Undo restores it', async () => {
  const url = `http://127.0.0.1:${portOf()}/page/starred`;
  await h.httpTab.goto(url);
  try {
    const popup = await openExt('popup', { background: true });
    await h.marionette.send('WebDriver:SwitchToWindow', { handle: h.httpTab.context, focus: true });
    popup.keepBackground = true;
    await popup.goto(EXT_ORIGIN + 'pages/popup/popup.html');
    await popup.waitFor(() => document.querySelector('.bookmark-star-btn'), null, { label: 'popup star' });
    if (await popup.ev(() => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Got it'))) await popup.clickText('button', 'Got it');
    assert.equal((await bm.search({ url })).length, 0);
    await popup.click('.bookmark-star-btn');
    await util.waitFor(async url => (await browser.bookmarks.search({ url })).length === 1, url, { label: 'bookmark created' });
    const created = (await bm.search({ url }))[0];
    assert.equal(created.parentId, 'unfiled_____', 'default location in Firefox is Other Bookmarks');
    await popup.waitFor(() => document.querySelector('.bookmark-star-btn.is-bookmarked'), null, { label: 'star filled' }).catch(async error => { throw new Error(error.message + ' | ' + JSON.stringify(await popup.ev(() => ({ star: document.querySelector('.bookmark-star-btn')?.className, toast: document.querySelector('.toast')?.textContent, titles: [...document.querySelectorAll('.item-title')].map(n => n.textContent), top: document.querySelector('.header')?.textContent.slice(0, 200) })))); });
    await popup.click('.bookmark-star-btn');
    await util.waitFor(async url => (await browser.bookmarks.search({ url })).length === 0, url, { label: 'bookmark removed' });
    await popup.clickText('button', 'Undo');
    await util.waitFor(async url => (await browser.bookmarks.search({ url })).length === 1, url, { label: 'bookmark restored by Undo' });
    await popup.close();
    return { parentId: created.parentId };
  } finally {
    for (const node of await bm.search({ url })) await util.ev(async id => { await browser.bookmarks.remove(id); return true; }, node.id);
    await h.httpTab.goto(`http://127.0.0.1:${portOf()}/page/one`);
  }
});

check('C25', 'screenshots of popup (light/dark), dashboard (light/dark) and options', async () => {
  const shot = async (name, page, size) => page.shot(name, { size });
  const set = async theme => util.ev(async theme => { await browser.storage.local.set({ themeMode: theme }); return true; }, theme);
  const files = [];
  for (const theme of ['light', 'dark']) {
    await set(theme);
    await h.marionette.send('WebDriver:SwitchToWindow', { handle: h.httpTab.context, focus: true }); // the popup scopes to the active tab
    const popupTab = await openExt('popup', { background: true });
    await popupTab.waitFor(() => document.querySelectorAll('.item-title').length >= 1, null, { label: 'popup rows ' + theme });
    if (theme === 'light') {
      files.push(await shot('popup-light-firstrun', popupTab, { width: 460, height: 760 }));
      if (await popupTab.count('.modal-overlay, [role="dialog"]')) await popupTab.clickText('button', 'Got it');
      await sleep(300);
    }
    files.push(await shot(`popup-${theme}`, popupTab, { width: 460, height: 760 }));
    await popupTab.close();
    const dash = await openDashboard();
    await dash.fill('.dashboard-search-input', 'gaps-');
    await dash.waitFor(() => document.querySelectorAll('.item-title').length >= 3);
    files.push(await shot(`dashboard-${theme}`, dash, { width: 1280, height: 900 }));
    await dash.close();
  }
  await set('system');
  const options = await openExt('options');
  await options.waitFor(() => document.querySelector('select')?.options.length > 0);
  files.push(await shot('options', options, { width: 1000, height: 900 }));
  await options.close();
  return { files: files.map(file => path.basename(file)) };
});

// ─── Fixtures ──────────────────────────────────────────────────────────────────
const CHROME_HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1690000000" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://chrome-one.test/a?x=1&amp;y=2" ADD_DATE="1695000000" ICON="data:image/png;base64,iVBORw0KGgo=">Chrome One &amp; Co</A>
        <DT><H3 ADD_DATE="1690000001">Dev</H3>
        <DL><p>
            <DT><A HREF="https://chrome-two.test/" ADD_DATE="1696000000">Chrome Two</A>
            <DT><A HREF="javascript:alert(1)">Bookmarklet</A>
        </DL><p>
    </DL><p>
    <DT><H3 ADD_DATE="1690000003">Other bookmarks</H3>
    <DL><p>
        <DT><A HREF="https://chrome-three.test/" ADD_DATE="1698000000">Chrome Three</A>
    </DL><p>
</DL><p>
`;
const FIREFOX_HTML = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks Menu</H1>
<DL><p>
    <DT><H3 ADD_DATE="1600000000" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks Toolbar</H3>
    <DL><p>
        <DT><A HREF="https://ff-one.test/" ADD_DATE="1600000200" ICON_URI="fake-favicon-uri:https://ff-one.test/favicon.ico" ICON="data:image/png;base64,${'QUJD'.repeat(50000)}" TAGS="Reading List,work">Firefox One</A>
        <DT><A HREF="place:sort=8&amp;maxResults=10">Recent</A>
        <DT><A HREF="https://chrome-one.test/a?x=1&amp;y=2" TAGS="dup-tag">Same URL as Chrome One</A>
    </DL><p>
</DL>
`;

async function waitForFile(dir, pattern, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const found = fs.readdirSync(dir).find(name => pattern.test(name) && !name.endsWith('.part'));
    if (found) { await sleep(300); return found; }
    await sleep(100);
  }
  throw new Error('download did not appear in ' + dir + ' matching ' + pattern);
}

// ─── Runner ────────────────────────────────────────────────────────────────────
function killFirefox() {
  if (!firefox || firefox.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(firefox.pid), '/T', '/F']); else firefox.kill('SIGKILL');
}

async function main() {
  pkg = process.env.FIREFOX_PACKAGE_DIR ? { output: path.resolve(process.env.FIREFOX_PACKAGE_DIR), fingerprint: 'external' } : buildFirefox({ outRoot: path.join(workDir, 'package') });
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bookmark-scope-firefox-'));
  downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bookmark-scope-firefox-dl-'));
  if (!path.basename(profile).startsWith('bookmark-scope-firefox-')) throw new Error('unexpected profile path');
  const marionettePort = await freePort();
  writeUserJs(profile, downloadDir, marionettePort);
  server = http.createServer((request, response) => {
    if (request.url.startsWith('/f')) fixtureHits.push(request.url);
    const delay = request.url.startsWith('/f') ? 150 : 0;
    setTimeout(() => { response.writeHead(200, { 'content-type': 'text/html' }); response.end('<!doctype html><title>fixture</title><p>ok</p>'); }, delay);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = await freePort();
  firefox = spawn(FIREFOX_BIN, ['-headless', '-no-remote', '-marionette', '-remote-allow-system-access', '-profile', profile, `--remote-debugging-port=${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  firefox.stdout.on('data', chunk => { firefoxLog += chunk; });
  firefox.stderr.on('data', chunk => { firefoxLog += chunk; });
  let socket;
  for (let attempt = 0; attempt < 150 && !socket; attempt++) {
    try { socket = await new Promise((resolve, reject) => { const s = net.connect(marionettePort, '127.0.0.1', () => resolve(s)); s.once('error', reject); }); }
    catch { await sleep(200); }
  }
  if (!socket) throw new Error('Firefox Marionette endpoint never came up: ' + firefoxLog.slice(-1500));
  h.marionette = new Marionette(socket);
  await h.marionette.hello;
  const created = await h.marionette.send('WebDriver:NewSession', { webSocketUrl: true });
  const wsUrl = created.capabilities.webSocketUrl;
  assert.ok(wsUrl, 'Marionette session has no BiDi webSocketUrl: ' + JSON.stringify(created).slice(0, 900));
  const ws = await new Promise((resolve, reject) => { const s = new WebSocket(wsUrl); s.addEventListener('open', () => resolve(s)); s.addEventListener('error', reject); });
  h.bidi = new Bidi(ws);
  h.bidi.onEvent(message => {
    if (message.method === 'log.entryAdded') {
      const entry = message.params;
      if (entry.type === 'javascript' && entry.level === 'error') h.errors.push(`${entry.source?.context?.slice(0, 6)} ${entry.text}`);
      else if (entry.level === 'error') h.consoleErrors.push(entry.text);
    }
  });
  h.browserVersion = created.capabilities.browserVersion;
  await h.bidi.send('session.subscribe', { events: ['log.entryAdded'] });
  const installed = await h.bidi.send('webExtension.install', { extensionData: { type: 'path', path: pkg.output } });
  assert.equal(installed.extension, FIREFOX_EXTENSION_ID);

  // File chooser: the dashboard creates a hidden <input type=file> and calls click(). A native dialog cannot be
  // answered headlessly, so the click is suppressed in the page and the file is attached with WebDriver's
  // element send-keys (the same path a user-agent takes for <input type=file>); the page then sees real input/change events.
  h.chooseFile = async (page, trigger, file) => {
    await page.ev(() => { if (!HTMLInputElement.prototype.__realClick) { HTMLInputElement.prototype.__realClick = HTMLInputElement.prototype.click; HTMLInputElement.prototype.click = function () { if (this.type === 'file') { this.dataset.pickerOpened = 'true'; return; } return this.__realClick(); }; } return true; });
    await trigger();
    await page.waitFor(() => document.querySelector('input[type="file"][data-picker-opened="true"]'), null, { label: 'file picker requested' });
    await h.marionette.send('WebDriver:SwitchToWindow', { handle: page.context, focus: true });
    const found = await h.marionette.send('WebDriver:FindElement', { using: 'css selector', value: 'input[type="file"][data-picker-opened="true"]' });
    const id = found.value?.['element-6066-11e4-a52e-4f735466cecf'] ?? Object.values(found.value ?? found)[0];
    await h.marionette.send('WebDriver:ElementSendKeys', { id, text: file });
  };

  util = await openExt('dashboard');
  await util.waitFor(() => document.querySelector('[data-library-tools]'), null, { label: 'util dashboard' });
  h.util = util;
  // Fixture library (synthetic): created in Other Bookmarks.
  // Keep the library synthetic: drop Firefox's default "Mozilla Firefox" folder (links to mozilla.org) so no scan can ever touch a real site.
  for (const node of await bm.children('menu________')) if (!node.url) await bm.removeTree(node.id);
  const fixture = await bm.create({ parentId: 'unfiled_____', title: 'FFFixture' });
  h.fixtureId = fixture.id;
  for (const [title, url] of [['Banana', 'https://gaps-c.test/'], ['apple', 'https://gaps-b.test/'], ['Cherry', 'https://gaps-a.test/']]) { await bm.create({ parentId: fixture.id, title, url }); await sleep(15); }
  for (const title of ['Local One', 'Local Two']) await bm.create({ parentId: fixture.id, title, url: `http://127.0.0.1:${server.address().port}/page/${title.split(' ')[1].toLowerCase()}` });
  await bm.create({ parentId: fixture.id, title: 'نشانک فارسی', url: 'https://fa.test/' });
  // An http tab stays foreground so the popup (opened in a background tab) sees it as the active tab.
  h.httpTab = await newPage();
  await h.httpTab.goto(`http://127.0.0.1:${server.address().port}/page/one`);

  for (const def of checkDefs) {
    if (only && !only.test(def.id + ' ' + def.name)) { h.notRun.push(def.id); continue; }
    const started = Date.now();
    try {
      const detail = await def.fn();
      h.checks.push({ id: def.id, name: def.name, passed: true, ms: Date.now() - started, ...(detail && typeof detail === 'object' ? { detail } : {}) });
      console.error('PASS ' + def.id + ' ' + def.name);
    } catch (error) {
      h.checks.push({ id: def.id, name: def.name, passed: false, ms: Date.now() - started, failure: String(error.stack || error).split('\n').slice(0, 6).join('\n') });
      console.error('FAIL ' + def.id + ' ' + def.name + '\n  ' + String(error.message).slice(0, 600));
    }
  }
}

let fatal;
try { await main(); } catch (error) { fatal = error; console.error('FATAL', error.stack || error); }
finally {
  try { h.bidi?.ws.close(); h.marionette?.socket.destroy(); } catch {}
  killFirefox();
  await sleep(1500);
  h.backgroundErrors = firefoxLog.split(/\r?\n/).filter(line => /JavaScript error: moz-extension:/.test(line));
  // Firefox logs manifest problems (unknown keys, invalid permissions) while installing; any such line fails the run.
  h.manifestWarnings = firefoxLog.split(/\r?\n/).filter(line => /Reading manifest|Warning processing|Error processing/i.test(line));
  server?.closeAllConnections?.(); server?.close();
  for (const dir of [profile, downloadDir, workDir]) {
    if (!dir || path.dirname(dir) !== os.tmpdir() || !path.basename(dir).startsWith('bookmark-scope-firefox')) continue;
    for (let attempt = 0; attempt < 10; attempt++) { try { fs.rmSync(dir, { recursive: true, force: true }); break; } catch { await sleep(500); } }
  }
}
const passed = h.checks.filter(check => check.passed).length;
const failed = h.checks.filter(check => !check.passed).length;
const summary = {
  recordedAt: new Date().toISOString(), firefox: h.browserVersion, binary: FIREFOX_BIN, package: pkg?.output, fingerprint: pkg?.fingerprint,
  total: h.checks.length, passed, failed, notRun: h.notRun, fatal: fatal ? String(fatal.message) : undefined,
  manifestWarnings: h.manifestWarnings, pageErrors: h.errors, consoleErrors: h.consoleErrors.slice(0, 40), backgroundErrors: h.backgroundErrors, screenshots: h.shots,
  checks: h.checks
};
console.log(JSON.stringify(summary, null, 2));
process.exitCode = fatal || failed || h.errors.length || h.backgroundErrors.length || h.manifestWarnings.length ? 1 : 0;
