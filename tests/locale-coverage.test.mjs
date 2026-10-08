import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EN_TRANSLATION_ENTRIES } from '../src/locales/en.js';
import { LOCALE_REGISTRY } from '../src/locales/index.js';
const keys=EN_TRANSLATION_ENTRIES.map(([key])=>key);
const placeholders=value=>[...String(value).matchAll(/\{\{(.*?)\}\}/g)].map(m=>m[1]).sort();
test('English source keys are unique',()=>assert.equal(new Set(keys).size,keys.length));
for(const locale of LOCALE_REGISTRY.filter(locale=>locale.code!=='en'))test(`locale ${locale.code}: complete nonempty messages and matching placeholders`,()=>{
  const messages=JSON.parse(fs.readFileSync(new URL(`../src/locales/${locale.code}.json`,import.meta.url),'utf8'));
  for(const [key,source] of EN_TRANSLATION_ENTRIES){assert.equal(typeof messages[key],'string',`${locale.code}: ${key}`);assert.ok(messages[key].trim(),`${locale.code}: empty ${key}`);assert.deepEqual(placeholders(messages[key]),placeholders(source),`${locale.code}: ${key}`);}
});
