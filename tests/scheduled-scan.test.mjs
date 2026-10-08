import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeBrowser,folder,leaf } from './helpers/browser.mjs';
import { runScheduledHealthScan,selectScanCandidatesAfterCursor,selectScanCandidates,saveBgHealthScanSettings,countBrokenInCache } from '../src/services/scheduled-health-scan-service.js';
import { _resetHealthCacheServiceForTesting } from '../src/services/health-cache-service.js';

for(const scenario of ['empty','skipped','denied','throw','success','disabled'])test(`schedule preserves the intended alarm after ${scenario}`,async()=>{
  const children=scenario==='empty'?[]:[leaf('A',scenario==='skipped'?'chrome://bookmarks':'https://a.test/')];
  const x=fakeBrowser([folder('P',children)],{bgHealthScanEnabled:scenario!=='disabled',bgHealthScanIntervalDays:14,healthCacheKeyVersion:2});_resetHealthCacheServiceForTesting();
  if(scenario==='denied')x.api.permissionGranted=false;
  if(scenario==='throw')x.api.bookmarks.getTree=async()=>{throw Error('tree failure');};
  let fetches=0;const run=()=>runScheduledHealthScan({runHealthFetch:async()=>{fetches++;return {status:'healthy',checkedAt:Date.now()};}});
  if(scenario==='throw')await assert.rejects(run(),/tree failure/);else await run();
  assert.equal(x.calls.alarms.length,scenario==='disabled'?0:1);
  if(scenario!=='disabled'){assert.equal(x.calls.alarms[0].periodInMinutes,14*1440);assert.ok(x.calls.alarms[0].when>Date.now()+13*86400000);}
  assert.equal(fetches,scenario==='success'?1:0);
});
test('251 URLs eventually scan despite an expired cache and worker module restart',async()=>{
  const x=fakeBrowser([folder('P',Array.from({length:251},(_,i)=>leaf(String(i),'https://example.test/'+String(i).padStart(3,'0'))))],{bgHealthScanEnabled:true,bgHealthScanIntervalDays:14,healthCacheKeyVersion:2});_resetHealthCacheServiceForTesting();
  const seen=new Set();const fetch=async url=>{seen.add(url);return {status:'healthy',checkedAt:1};};
  await runScheduledHealthScan({runHealthFetch:fetch});assert.equal(seen.size,250);
  const restarted=await import('../src/services/scheduled-health-scan-service.js?restart');await restarted.runScheduledHealthScan({runHealthFetch:fetch});assert.equal(seen.size,251);
});
test('failed fetch advances cursor without starving later URLs',async()=>{
  const x=fakeBrowser([folder('P',[leaf('A'),leaf('B')])],{bgHealthScanEnabled:true,healthCacheKeyVersion:2});_resetHealthCacheServiceForTesting();
  const seen=[];await runScheduledHealthScan({runHealthFetch:async url=>{seen.push(url);throw Error('network failure');}});assert.equal(seen.length,2);assert.equal(x.stored.bgHealthScanCursor,'https://B.test/');
});
test('settings update does not overwrite unrelated scheduling preferences',async()=>{
  const x=fakeBrowser([],{bgHealthScanEnabled:true,bgHealthScanIntervalDays:14});await saveBgHealthScanSettings({lastRunAt:42});assert.equal(x.stored.bgHealthScanEnabled,true);assert.equal(x.stored.bgHealthScanIntervalDays,14);
});
test('selection dedupes URLs, skips unsupported schemes, and wraps cursor',()=>{
  const items=[leaf('A'),leaf('A2','https://A.test/'),leaf('B'),leaf('bad','file:///a')];
  assert.equal(selectScanCandidates(items,{},999).length,2);
  assert.deepEqual(selectScanCandidatesAfterCursor(items,'https://A.test/',1).map(x=>x.id),['B']);
  assert.deepEqual(selectScanCandidatesAfterCursor(items,'zzz',1).map(x=>x.id),['A']);
  assert.equal(countBrokenInCache({a:{status:'broken'},b:{status:'server-error'},c:{status:'unreachable'},d:{status:'redirected'}}),3);
});
