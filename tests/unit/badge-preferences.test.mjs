import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { getMatchTarget,matchesMode,parseUrlSafe } from '../../extension/src/core/url-utils.js';
import { STORAGE_KEYS,MATCH_MODES } from '../../extension/src/core/constants.js';
const source=fs.readFileSync(new URL('../../extension/background.js',import.meta.url),'utf8');
for(const mode of Object.values(MATCH_MODES))for(const ignoreQueryString of [true,false])for(const ignoreHashFragment of [true,false])test(`badge matches popup ${mode} query=${ignoreQueryString} hash=${ignoreHashFragment}`,async()=>{
  let text;const options={ignoreQueryString,ignoreHashFragment};const url='https://example.test/a?x=1#b';
  const urls=['https://example.test/a?x=2#b','https://example.test/a?x=1#c','https://sub.example.test/a','https://other.test/'];
  const expected=urls.filter(u=>matchesMode({parsed:parseUrlSafe(u,options)},getMatchTarget(url,options),mode)).length;
  const context=vm.createContext({console,STORAGE_KEYS,MATCH_MODES,getMatchTarget,matchesMode,getTab:async()=>({url}),getLocalStorage:async()=>({popupMode:mode,ignoreQueryString,ignoreHashFragment}),getNormalizedBookmarks:async p=>urls.map(u=>({parsed:parseUrlSafe(u,p)})),setBadgeBackgroundColor:async()=>{},setBadgeText:async value=>{text=value.text;}});
  vm.runInContext(source.slice(source.indexOf('async function setBadgeForActiveTab'),source.indexOf('async function refreshBadgeForCurrentTab')),context);
  await vm.runInContext('setBadgeForActiveTab(1)',context);assert.equal(text,expected?String(expected):'');
});
