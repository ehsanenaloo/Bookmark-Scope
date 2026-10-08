// Repository sanity checks: footer links and the list of files shipped in the extension.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { readFooterNavConfig } from '../../extension/src/config/footer-config.js';

const file = (relative) => new URL(`../../${relative}`, import.meta.url); // path relative to the repository root
const ext = (relative) => file(`extension/${relative}`); // path relative to the extension/ folder
const REPO_URL = 'https://github.com/ehsanenaloo/Bookmark-Scope';

test('both the default and the classic override footer point to the public repository', () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(ext('pages/popup/footer-nav-config.js'), 'utf8'), context);
  for (const config of [readFooterNavConfig(), readFooterNavConfig(context.window.FOOTER_NAV_CONFIG)]) {
    assert.equal(config.items.find((item) => item.id === 'github').url, REPO_URL);
  }
});

test('the runtime file list holds only extension files and every listed file exists', () => {
  const spec = JSON.parse(fs.readFileSync(file('scripts/runtime-files.json'), 'utf8'));
  for (const name of spec.files) {
    assert.ok(fs.existsSync(ext(name)), `${name} is listed but missing in extension/`);
    assert.ok(!/^(?:tests|scripts|docs|\.github|\.git|node_modules)\//.test(name), `${name} is not an extension file`);
    assert.ok(!/\.(?:test\.mjs|md)$/.test(name) || name === 'THIRD_PARTY_NOTICES.md', `${name} should not ship`);
  }
  for (const directory of spec.directories) {
    assert.ok(fs.statSync(ext(directory)).isDirectory(), `${directory} is not a directory`);
    assert.ok(!/^(?:tests|scripts|docs|\.github)/.test(directory), `${directory} should not ship`);
  }
  for (const required of ['manifest.json', 'src/core/public-suffix-rules.js', 'THIRD_PARTY_NOTICES.md', 'vendor/MPL-2.0.txt', '_locales/en/messages.json']) {
    const covered = spec.files.includes(required) || spec.directories.some((directory) => required.startsWith(`${directory}/`));
    assert.ok(covered, `${required} must be part of the runtime file list`);
    assert.ok(fs.existsSync(ext(required)), `${required} is missing in extension/`);
  }
});

test('the license is MIT and the manifest declares no mandatory host access', () => {
  assert.ok(fs.readFileSync(file('LICENSE'), 'utf8').startsWith('MIT License'));
  const manifest = JSON.parse(fs.readFileSync(ext('manifest.json'), 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.ok(!(manifest.host_permissions || []).length, 'host access must stay optional');
});

test('the repository root stays small and the extension folder holds no project files', () => {
  const allowedRoot = new Set(['.editorconfig', '.git', '.gitattributes', '.github', '.gitignore', 'CHANGELOG.md', 'LICENSE', 'README.md', 'dist-firefox', 'docs', 'extension', 'node_modules', 'package.json', 'scripts', 'tests']);
  for (const name of fs.readdirSync(file('.'))) assert.ok(allowedRoot.has(name), `unexpected entry at the repository root: ${name}`);
  for (const name of fs.readdirSync(ext('.'))) {
    assert.ok(!/^(?:tests|scripts|docs|\.github|\.git|node_modules|README.*|CHANGELOG.*|package\.json)$/.test(name), `${name} must not live inside extension/`);
  }
});

test('the release zip needs the license: it is kept at the repository root for the workflow to add', () => {
  assert.ok(fs.existsSync(file('LICENSE')));
  assert.ok(!fs.existsSync(ext('LICENSE')), 'LICENSE is added to the zip by the release workflow, not stored twice');
});
