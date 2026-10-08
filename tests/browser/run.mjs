#!/usr/bin/env node
// Runs the optional browser checks against the extension in a real Chromium.
//
//   node tests/browser/run.mjs            run all checks (skips politely if Playwright is missing)
//   node tests/browser/run.mjs --require  fail instead of skipping when Playwright is missing
//   node tests/browser/run.mjs gaps       run only checks whose name contains "gaps"
//
// The checks load the extension from the repository root, use a disposable
// Chromium profile and synthetic bookmarks only, and write nothing into the repository.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChromium } from './common.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const require = args.includes('--require');
const filter = args.find((arg) => !arg.startsWith('--'));
const suites = [
  { name: 'acceptance', file: 'acceptance.mjs', about: 'popup, options, dashboard, mutations, undo, virtual list, locks, worker restart' },
  { name: 'gaps', file: 'gaps.mjs', about: 'dashboard sort, CSV export, bookmarks.html import' },
  { name: 'stop-inspection', file: 'stop-inspection.mjs', about: 'Stop inspect halts a long health scan' }
].filter((suite) => !filter || suite.name.includes(filter));

if (!suites.length) { console.error(`No browser check matches "${filter}".`); process.exit(1); }

const chromium = await loadChromium();
if (!chromium) {
  const message = 'Playwright is not installed. Run "npm i --no-save playwright" and "npx playwright install chromium", or set BOOKMARK_SCOPE_PLAYWRIGHT_MODULE (see tests/browser/README.md).';
  if (require) { console.error(`Browser checks cannot run: ${message}`); process.exit(1); }
  console.log(`Browser checks skipped. ${message}`);
  process.exit(0);
}

const summary = [];
for (const suite of suites) {
  console.error(`\n== ${suite.name}: ${suite.about}`);
  const started = Date.now();
  const child = spawnSync(process.execPath, [path.join(here, suite.file)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 64 * 1024 * 1024 });
  let report = null;
  try { report = JSON.parse(child.stdout); } catch { /* the check crashed before printing its report */ }
  const checks = report?.checks?.length ?? (report?.passed ? 1 : 0);
  const ok = child.status === 0 && !!report && !(report.errors?.length) && report.passed !== false;
  if (!ok && report?.errors?.length) console.error(report.errors.join('\n'));
  if (!ok && !report) console.error(child.stdout || 'The check produced no report.');
  summary.push({ name: suite.name, passed: ok, checks, seconds: Math.round((Date.now() - started) / 100) / 10, browser: report?.browser || '' });
}

const failed = summary.filter((entry) => !entry.passed);
console.log(JSON.stringify({ browser: summary.find((entry) => entry.browser)?.browser || '', suites: summary, passed: !failed.length }, null, 2));
console.error(`\n${summary.length - failed.length}/${summary.length} browser suites passed, ${summary.reduce((sum, entry) => sum + entry.checks, 0)} checks recorded.`);
process.exit(failed.length ? 1 : 0);
