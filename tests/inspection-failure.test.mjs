import test from 'node:test';
import assert from 'node:assert/strict';
import { runWithConcurrency } from '../extension/src/dashboard/health.js';
import { createInspectTools } from '../extension/src/dashboard/inspect-tools.js';
import { _resetHealthCacheServiceForTesting } from '../extension/src/services/health-cache-service.js';
import { fakeBrowser,deferred } from './helpers/browser.mjs';
test('worker failure drains active peers and stops queued work before returning',async()=>{
  const released=deferred();let settled=false;const seen=[];
  const run=runWithConcurrency([1,2,3],2,async item=>{seen.push(item);if(item===1)throw Error('failure');await released.promise;settled=true;});
  const asserted=assert.rejects(run,/failure/);await Promise.resolve();assert.equal(settled,false);released.resolve();await asserted;assert.deepEqual(seen,[1,2]);assert.equal(settled,true);
});
test('storage failure closes inspection state and preserves an explicit error',async()=>{
  const x=fakeBrowser([],{healthCacheKeyVersion:2});_resetHealthCacheServiceForTesting();x.failures.set=values=>'healthCache' in values;
  const state={inspectControllers:new Set(),inspectSessionId:0,healthByKey:{},visibleBookmarks:[],lastListScrollAt:0};const toasts=[];
  const tools=createInspectTools({state,t:s=>s,now:Date.now,formatNumber:String,makeStableId:()=> 'id',getHealthKey:b=>b.url,summarizeHealth:()=>({}),inspectUrlHealthRecord:async()=>({status:'healthy',checkedAt:Date.now()}),runWithConcurrency,sendMessage:async()=>{},render(){},rememberListScroll(){},setToast:(text,options)=>toasts.push({text,...options}),pushCleanupHistory:async()=>{},applyHealthRecordToBookmarks(){},getSelectionCount:()=>0,getActiveScopeLabel:()=> 'library'});
  await tools.inspectBookmarksHealth([{url:'https://a.test/'}]);assert.equal(state.isInspectingHealth,false);assert.equal(state.inspectStopPending,false);assert.equal(state.inspectControllers.size,0);assert.match(toasts.at(-1).text,/storage failure/);assert.equal(toasts.at(-1).error,true);
});
