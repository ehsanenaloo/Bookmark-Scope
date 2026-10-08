import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Microsoft Edge Add-ons rejects a package when a localized manifest description is longer than 190 characters.
const MAX_DESCRIPTION = 190;
const localesDir = new URL('../../extension/_locales/', import.meta.url);

test('every localized manifest description fits the Microsoft Edge Add-ons limit', () => {
  const folders = fs.readdirSync(localesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  assert.ok(folders.length >= 50, 'expected one folder per supported language');
  for (const folder of folders) {
    const messages = JSON.parse(fs.readFileSync(new URL(`${folder.name}/messages.json`, localesDir), 'utf8'));
    const description = messages.app_description?.message;
    assert.ok(description, `${folder.name} has no app_description`);
    assert.ok([...description].length <= MAX_DESCRIPTION, `${folder.name} app_description has ${[...description].length} characters (limit ${MAX_DESCRIPTION})`);
  }
});
