#!/usr/bin/env node
// Dependency-free repository validation for Bookmark Scope.
// Run: node scripts/validate.mjs   (Node.js 24 or newer; no npm install needed)
//
// Checks:
//   1. manifest.json parses, has a Manifest V3 shape and a valid version string
//   2. every file the manifest, HTML pages and relative ES-module imports reference exists
//   3. every runtime JavaScript file passes `node --check`
//   4. every runtime JSON file (including all locale files) parses; locale messages are well formed
//   5. every __MSG_*__ placeholder in the manifest exists in the default locale
//   6. runtime directories contain only approved file types and no symbolic links
//   7. no forbidden files (keys, .env, _metadata, archives, node_modules) and no private-key text
//   8. leak guard: no internal working files, and no Markdown/YAML/JSON/HTML that points at them
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { listRuntimeFiles } from './list-runtime-files.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'runtime-files.json'), 'utf8'));
const errors = [];
const fail = (message) => errors.push(message);
const abs = (rel) => path.join(root, rel);
const exists = (rel) => fs.existsSync(abs(rel));
const readJson = (rel) => {
  try { return JSON.parse(fs.readFileSync(abs(rel), 'utf8')); }
  catch (error) { fail(`${rel}: invalid JSON (${error.message})`); return null; }
};

// 1. Manifest shape ---------------------------------------------------------
const manifest = readJson('manifest.json');
if (manifest) {
  if (manifest.manifest_version !== 3) fail('manifest.json: manifest_version must be 3');
  if (!/^\d+(\.\d+){0,3}$/.test(String(manifest.version))) fail(`manifest.json: version "${manifest.version}" is not 1-4 dot-separated integers`);
  for (const field of ['name', 'description', 'version']) if (!manifest[field]) fail(`manifest.json: missing "${field}"`);
  if (manifest.background && manifest.background.scripts) fail('manifest.json: MV3 background must use service_worker, not scripts');
  if (manifest.content_security_policy && JSON.stringify(manifest.content_security_policy).includes('unsafe-eval')) fail('manifest.json: unsafe-eval is not allowed');
  if (Array.isArray(manifest.permissions) && manifest.permissions.some((p) => /^(https?|\*):/.test(p) || p === '<all_urls>')) fail('manifest.json: host patterns must be optional_host_permissions, not permissions');
  if (manifest.host_permissions && manifest.host_permissions.length) fail('manifest.json: mandatory host_permissions are not expected; keep host access optional');

  // 2. Files referenced by the manifest
  const referenced = new Set();
  const add = (rel) => { if (rel) referenced.add(rel); };
  add(manifest.background && manifest.background.service_worker);
  add(manifest.action && manifest.action.default_popup);
  add(manifest.options_page);
  for (const group of [manifest.icons, manifest.action && manifest.action.default_icon]) {
    if (group) Object.values(group).forEach(add);
  }
  for (const rel of referenced) if (!exists(rel)) fail(`manifest.json references missing file: ${rel}`);

  // 5. Locale placeholders
  const defaultLocale = manifest.default_locale;
  if (!defaultLocale) fail('manifest.json: default_locale is required when __MSG_ placeholders are used');
  else {
    const messages = readJson(`_locales/${defaultLocale}/messages.json`);
    for (const match of JSON.stringify(manifest).matchAll(/__MSG_([A-Za-z0-9_@]+)__/g)) {
      if (messages && !messages[match[1]]) fail(`manifest.json: __MSG_${match[1]}__ is missing from _locales/${defaultLocale}/messages.json`);
    }
  }
}

// Runtime allowlist exists ---------------------------------------------------
for (const rel of spec.files) if (!exists(rel)) fail(`Runtime file listed in scripts/runtime-files.json is missing: ${rel}`);
for (const dir of spec.directories) if (!exists(dir)) fail(`Runtime directory is missing: ${dir}`);

let runtime = [];
try { runtime = listRuntimeFiles(); } catch (error) { fail(error.message); }

// 6. Runtime directory contents ------------------------------------------------
for (const rel of runtime) {
  if (!spec.directories.some((dir) => rel.startsWith(`${dir}/`))) continue;
  const base = path.posix.basename(rel);
  if (base.startsWith('.') || !spec.allowedDirectoryExtensions.includes(path.posix.extname(rel))) fail(`Unapproved file in runtime directory: ${rel}`);
}

// 4. JSON files ----------------------------------------------------------------
for (const rel of runtime.filter((f) => f.endsWith('.json'))) {
  const data = readJson(rel);
  if (data && rel.startsWith('_locales/') && rel.endsWith('/messages.json')) {
    for (const [key, entry] of Object.entries(data)) {
      if (!entry || typeof entry.message !== 'string') fail(`${rel}: "${key}" must have a string "message"`);
    }
  }
}
const localeDirs = exists('_locales')
  ? fs.readdirSync(abs('_locales'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : [];
for (const locale of localeDirs) if (!exists(`_locales/${locale}/messages.json`)) fail(`_locales/${locale} has no messages.json`);

// 3. JavaScript syntax -----------------------------------------------------------
const jsFiles = runtime.filter((f) => f.endsWith('.js'));
for (const rel of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', abs(rel)], { encoding: 'utf8' });
  if (result.status !== 0) fail(`${rel}: syntax error\n${(result.stderr || '').trim()}`);
}

// 2 (continued). HTML references and relative ES-module imports -------------------
for (const rel of runtime.filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(abs(rel), 'utf8');
  for (const match of html.matchAll(/\b(?:src|href)\s*=\s*["']([^"'#?]+)(?:[?#][^"']*)?["']/g)) {
    const target = match[1];
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) { fail(`${rel}: external or absolute reference is not allowed in extension pages: ${target}`); continue; }
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(rel), target));
    if (!exists(resolved)) fail(`${rel} references missing file: ${target}`);
  }
}
const importPattern = /(?:^|[;\s}])(?:import|export)\s+(?:[^'"`;]*?\s+from\s+)?["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/gm;
for (const rel of jsFiles) {
  const source = fs.readFileSync(abs(rel), 'utf8');
  for (const match of source.matchAll(importPattern)) {
    const target = match[1] || match[2];
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(rel), target.split(/[?#]/)[0]));
    if (!exists(resolved)) fail(`${rel} imports missing module: ${target}`);
  }
}

// 7. Forbidden files and secrets ---------------------------------------------------
const forbiddenName = [
  /^_metadata$/, /^\.env(\..*)?$/i, /\.(pem|key|p12|pfx|crx|zip|tgz|jks|keystore)$/i,
  /^id_(rsa|ed25519|ecdsa)/, /^node_modules$/, /^dist$/, /\.log$/i, /^\.DS_Store$/, /^Thumbs\.db$/i,
  /^technical-docs$/i, /^AGENTS\.md$/i, /^evidence$/i
];
// A local node_modules folder (for example from `npm i --no-save playwright`) is fine when .gitignore
// excludes it, because it can never be committed. Without that rule it is still rejected.
const gitignore = exists('.gitignore') ? fs.readFileSync(abs('.gitignore'), 'utf8').split(/\r?\n/).map((line) => line.trim()) : [];
const nodeModulesIgnored = gitignore.some((line) => line === 'node_modules' || line === 'node_modules/' || line === '/node_modules/');
// Leak guard: Markdown, YAML, JSON and HTML must not point at files that live outside this repository.
const leakExtensions = new Set(['.md', '.yml', '.yaml', '.json', '.html']);
const leakPattern = /technical-docs\/|AGENTS\.md/;
const textExtensions = new Set(['.js', '.json', '.md', '.html', '.css', '.yml', '.yaml', '.mjs', '.txt', '.dat', '.svg', '']);
const walkAll = (dir) => {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const rel = dir ? `${dir}/${entry.name}` : entry.name;
    if (dir === '' && entry.name === 'node_modules' && nodeModulesIgnored) continue;
    if (forbiddenName.some((re) => re.test(entry.name))) { fail(`Forbidden file or directory present: ${rel}`); continue; }
    if (entry.isDirectory()) walkAll(rel);
    else if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) {
      if (fs.statSync(abs(rel)).size > 8 * 1024 * 1024) continue;
      const text = fs.readFileSync(abs(rel), 'utf8');
      if (/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/.test(text)) fail(`Private key material found in ${rel}`);
      if (leakExtensions.has(path.extname(entry.name).toLowerCase()) && leakPattern.test(text)) fail(`Leak guard: ${rel} mentions an internal file path (technical-docs/ or AGENTS.md)`);
    }
  }
};
walkAll('');

// Report ----------------------------------------------------------------------------
if (errors.length) {
  console.error(`Validation failed with ${errors.length} problem${errors.length === 1 ? '' : 's'}:`);
  for (const message of errors) console.error(` - ${message}`);
  process.exit(1);
}
console.log(`OK: Bookmark Scope ${manifest.version}`);
console.log(`    ${runtime.length} runtime files, ${jsFiles.length} JavaScript files, ${localeDirs.length} locales checked`);
