#!/usr/bin/env node
// Runs the unit tests in tests/unit/*.test.mjs with the built-in Node test runner.
// Run: node scripts/test.mjs [filter]      (Node.js 24 or newer; no npm install needed)
//   filter  optional text; only test files whose name contains it are run
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const major = Number(process.versions.node.split('.')[0]);
if (major < 24) {
  console.error(`These tests need Node.js 24 or newer (they use navigator.locks). You are running ${process.version}.`);
  console.error('Install a current Node.js from https://nodejs.org and run the command again.');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filter = process.argv.slice(2).find((arg) => !arg.startsWith('-'));
const files = fs.readdirSync(path.join(root, 'tests', 'unit'))
  .filter((name) => name.endsWith('.test.mjs') && (!filter || name.includes(filter)))
  .sort()
  .map((name) => `tests/unit/${name}`);

if (!files.length) {
  console.error(filter ? `No test file name contains "${filter}".` : 'No test files found in tests/unit/.');
  process.exit(1);
}

const started = Date.now();
const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...files], { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const output = `${result.stdout || ''}${result.stderr || ''}`;
const count = (label) => Number((output.match(new RegExp(`^ℹ ${label} (\\d+)$`, 'm')) || [])[1] || 0);

if (result.status !== 0) process.stderr.write(output);
const seconds = ((Date.now() - started) / 1000).toFixed(1);
const passed = count('pass'), failed = count('fail'), skipped = count('skipped');
console.log(`${files.length} test files, ${count('tests')} tests: ${passed} passed, ${failed} failed, ${skipped} skipped (${seconds}s)`);
if (result.status !== 0) console.log('Some tests failed. The details are printed above.');
process.exit(result.status ?? 1);
