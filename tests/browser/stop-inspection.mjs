// Regression check: a human-length press on "Stop inspect" must stop a fast, long-running health scan.
// Disposable Chromium profile, local HTTP server and synthetic bookmarks only; no real sites are contacted.
// Run it through: node tests/browser/run.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { loadChromium, launchOptions } from './common.mjs';

const chromium = await loadChromium();
if (!chromium) { console.error('Playwright is not installed.'); process.exit(2); }

const hits = [];
const server = http.createServer((request, response) => {
  hits.push(request.url);
  setTimeout(() => { response.writeHead(200, { 'Access-Control-Allow-Origin': '*' }); response.end('ok'); }, 150);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'bookmark-scope-stop-'));
const context = await chromium.launchPersistentContext(profile, launchOptions({ viewport: { width: 1440, height: 900 } }));
const result = { recordedAt: new Date().toISOString(), browser: '', passed: false };
try {
  let worker = context.serviceWorkers().find(candidate => candidate.url().startsWith('chrome-extension'));
  if (!worker) worker = await context.waitForEvent('serviceworker', { predicate: candidate => candidate.url().startsWith('chrome-extension') });
  result.browser = context.browser()?.version() || 'Chromium';
  const origin = `chrome-extension://${worker.url().split('/')[2]}/`;
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto(origin + 'options.html');
  await page.waitForTimeout(800);
  await page.evaluate(async serverPort => {
    const bar = (await chrome.bookmarks.getTree())[0].children[0];
    for (let index = 1; index <= 600; index++) await chrome.bookmarks.create({ parentId: bar.id, title: 'Fast ' + index, url: `http://127.0.0.1:${serverPort}/f${index}` });
  }, port);
  await page.goto(origin + 'dashboard.html');
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    const platform = await import(chrome.runtime.getURL('src/platform/browser-api.js'));
    platform.setChromeApiForTesting({ ...chrome, permissions: { contains: async () => true, request: async () => true } });
  });
  const button = () => page.locator('.dashboard-inspect-button').first();
  const text = async () => (await button().innerText().catch(() => '')).replace(/\n/g, ' ');
  await button().click();
  await page.waitForTimeout(2000);
  assert.match(await text(), /Stop inspect/, 'scan did not start');
  const requestsBefore = hits.length;
  assert.ok(requestsBefore > 0, 'no health request reached the local server');

  // Press like a person: pointer down, hold ~120 ms, release, at the button's current position.
  const probe = await page.evaluate(() => {
    const element = document.querySelector('.dashboard-inspect-button');
    const rect = element.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  await page.mouse.move(probe.x, probe.y);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(1200);
  const requestsAtStop = hits.length;
  await page.waitForTimeout(2500);
  result.requestsBefore = requestsBefore;
  result.requestsAtStop = requestsAtStop;
  result.requestsLater = hits.length;
  result.labelAfter = await text();
  assert.match(result.labelAfter, /Inspect visible/, 'button did not return to its idle label');
  assert.ok(result.requestsLater - requestsAtStop <= 5, 'requests kept flowing after Stop');
  assert.ok(result.requestsLater < 300, 'scan ran close to completion instead of stopping');
  assert.deepEqual(pageErrors, []);
  result.passed = true;
} finally {
  await context.close();
  server.closeAllConnections?.();
  server.close();
  // Only the exact disposable directory created by this run is removed.
  if (path.dirname(profile) === os.tmpdir() && path.basename(profile).startsWith('bookmark-scope-stop-')) fs.rmSync(profile, { recursive: true, force: true });
}
console.log(JSON.stringify(result, null, 2));
