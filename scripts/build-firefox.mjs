#!/usr/bin/env node
// Builds the Firefox package from the files in extension/.
// extension/manifest.json (the Chrome manifest) is never changed: this script reads it and writes a
// rewritten copy into dist-firefox/<fingerprint>/, together with the runtime files listed in
// scripts/runtime-files.json (the same list the Chrome zip uses).
//
//   node scripts/build-firefox.mjs          build and print a JSON summary
//   node scripts/build-firefox.mjs --list   print the file list (one path per line, relative to the
//                                           output folder) so a release step can zip from inside it
//   node scripts/build-firefox.mjs --dir    print the output folder path
//
// Set EXTENSION_DIR to build from a different extension folder.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { listRuntimeFiles } from './list-runtime-files.mjs';

export const FIREFOX_EXTENSION_ID = 'bookmark-scope@enaloo.com';
export const FIREFOX_MIN_VERSION = '140.0';
// Chrome-only permissions that Firefox does not define (it reports a warning for unknown permissions).
// "favicon" backs Chrome's /_favicon/ endpoint.
export const CHROME_ONLY_PERMISSIONS = ['favicon'];

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function resolveExtensionDir() {
  if (process.env.EXTENSION_DIR) return path.resolve(process.env.EXTENSION_DIR);
  const dir = path.join(repoRoot, 'extension');
  if (!fs.existsSync(path.join(dir, 'manifest.json'))) throw new Error('No extension/manifest.json found. Set EXTENSION_DIR to the extension folder.');
  return dir;
}

/** Pure transformation of the Chrome manifest object into the Firefox manifest object. */
export function toFirefoxManifest(chromeManifest) {
  const manifest = structuredClone(chromeManifest);
  if (manifest.manifest_version !== 3) throw new Error('Expected a Manifest V3 source manifest.');
  const worker = manifest.background?.service_worker;
  if (!worker) throw new Error('Source manifest has no background.service_worker to convert.');
  const background = { scripts: [worker] };
  if (manifest.background.type) background.type = manifest.background.type;
  manifest.background = background;
  if (manifest.options_page) {
    manifest.options_ui = { page: manifest.options_page, open_in_tab: true };
    delete manifest.options_page;
  }
  manifest.permissions = (manifest.permissions || []).filter((permission) => !CHROME_ONLY_PERMISSIONS.includes(permission));
  manifest.browser_specific_settings = {
    gecko: {
      id: FIREFOX_EXTENSION_ID,
      strict_min_version: FIREFOX_MIN_VERSION,
      data_collection_permissions: { required: ['none'] }
    }
  };
  return manifest;
}

/** The runtime file list for the extension folder, relative to it. Uses scripts/list-runtime-files.mjs for the default folder. */
export function runtimeFilesFor(extensionDir) {
  if (path.resolve(extensionDir) === path.join(repoRoot, 'extension')) return listRuntimeFiles();
  const spec = JSON.parse(fs.readFileSync(path.join(repoRoot, 'scripts', 'runtime-files.json'), 'utf8'));
  const out = [...spec.files];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(extensionDir, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Symbolic link not allowed in runtime directory: ${rel}`);
      if (entry.isDirectory()) walk(rel);
      else if (entry.isFile()) out.push(rel);
    }
  };
  for (const dir of spec.directories) walk(dir);
  return out.sort();
}

export function buildFirefox({ extensionDir = resolveExtensionDir(), outRoot = path.join(repoRoot, 'dist-firefox') } = {}) {
  const chromeManifest = JSON.parse(fs.readFileSync(path.join(extensionDir, 'manifest.json'), 'utf8'));
  const firefoxManifest = toFirefoxManifest(chromeManifest);
  const manifestText = JSON.stringify(firefoxManifest, null, 2) + '\n';
  const files = runtimeFilesFor(extensionDir);
  if (!files.includes('manifest.json')) throw new Error('The runtime file list does not include manifest.json.');
  const contents = new Map(files.map((file) => [file, file === 'manifest.json' ? Buffer.from(manifestText) : fs.readFileSync(path.join(extensionDir, file))]));
  const hashes = Object.fromEntries([...contents].map(([file, data]) => [file, crypto.createHash('sha256').update(data).digest('hex')]));
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(hashes)).digest('hex');
  const output = path.join(outRoot, fingerprint);
  fs.rmSync(output, { recursive: true, force: true });
  for (const [file, data] of contents) {
    const target = path.join(output, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
  }
  const metadata = { target: 'firefox', manifestVersion: firefoxManifest.version, geckoId: FIREFOX_EXTENSION_ID, strictMinVersion: FIREFOX_MIN_VERSION, fingerprint, files: hashes, output };
  fs.writeFileSync(path.join(outRoot, `${fingerprint}.json`), JSON.stringify(metadata, null, 2) + '\n');
  return { files: files.length, fileList: files, fingerprint, output, manifest: firefoxManifest, extensionDir };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = buildFirefox();
  if (process.argv.includes('--dir')) {
    process.stdout.write(result.output + '\n');
  } else if (process.argv.includes('--list')) {
    process.stdout.write(result.fileList.join('\n') + '\n');
    console.error(`Firefox package: ${result.output}`);
  } else {
    const { files, fileList, fingerprint, output, manifest } = result;
    console.log(JSON.stringify({ files, fingerprint, output, manifest, fileList }, null, 2));
  }
}
