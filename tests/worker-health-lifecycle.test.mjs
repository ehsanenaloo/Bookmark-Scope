import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { HEALTH_STATUSES } from '../extension/src/constants.js';
import { classifyHealthResponse,createHealthFailure,shouldSkipHealthCheck } from '../extension/src/background/health-check.js';
import { deferred } from './helpers/browser.mjs';

const source=fs.readFileSync(new URL('../extension/background.js',import.meta.url),'utf8');
function harness(head,get) {
  const timers=new Map();let timerId=0;const getStarted=deferred();const methods=[];
  const context=vm.createContext({AbortController,Map,now:Date.now,HEALTH_STATUSES,classifyHealthResponse,createHealthFailure,shouldSkipHealthCheck,
    setTimeout(fn,ms){timers.set(++timerId,{fn,ms});return timerId;},clearTimeout(id){timers.delete(id);},
    async fetch(url,options){methods.push(options.method);if(options.method==='HEAD')return head(options);getStarted.resolve();return get(options);}
  });
  vm.runInContext(source.slice(source.indexOf('const activeHealthRequests ='),source.indexOf('// ─── Message handler')),context);
  return {timers,methods,getStarted,call:(id='r')=>vm.runInContext(`fetchHealthStatusInBackground('https://example.test/',8000,${JSON.stringify(id)})`,context),abort:()=>vm.runInContext("abortActiveHealthRequest('r')",context),active:()=>vm.runInContext('activeHealthRequests.size',context)};
}
function pendingFetch(options) { return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(new Error('Aborted'),{name:'AbortError'})),{once:true})); }
for(const head of [async()=>({status:405}),async()=>{throw Error('405 method not allowed');}])test('pending GET remains cancellable with its deadline registered',async()=>{
  const h=harness(head,pendingFetch);const run=h.call();await h.getStarted.promise;
  assert.equal(h.active(),1);assert.equal(h.timers.size,1);assert.equal([...h.timers.values()][0].ms,5000);
  assert.equal(h.abort(),true);const result=await run;assert.equal(result.aborted,true);assert.equal(result.method,'GET');assert.equal(h.active(),0);assert.equal(h.timers.size,0);
});
for(const id of ['r',''])test(`GET deadline aborts and cleans timers with request ID ${JSON.stringify(id)}`,async()=>{
  const h=harness(async()=>({status:405}),pendingFetch);const run=h.call(id);await h.getStarted.promise;[...h.timers.values()][0].fn();
  const result=await run;assert.equal(result.timedOut,true);assert.equal(result.status,'unreachable');assert.equal(h.timers.size,0);assert.equal(h.active(),0);
});
for(const id of ['r',''])test(`successful HEAD cleans timer with request ID ${JSON.stringify(id)}`,async()=>{
  const h=harness(async()=>({status:200,url:'https://example.test/',redirected:false}),pendingFetch);
  assert.equal((await h.call(id)).status,'healthy');assert.equal(h.timers.size,0);assert.equal(h.active(),0);assert.deepEqual(h.methods,['HEAD']);
});
for(const kind of ['timeout','cancel','network'])test(`HEAD ${kind} never starts GET and releases all registrations`,async()=>{
  const started=deferred();const h=harness(options=>{started.resolve();return kind==='network'?Promise.reject(Error('offline')):pendingFetch(options);},pendingFetch);
  const run=h.call();await started.promise;
  if(kind==='timeout')[...h.timers.values()][0].fn();if(kind==='cancel')h.abort();const result=await run;
  assert.equal(result.method,'HEAD');assert.equal(h.methods.length,1);assert.equal(h.timers.size,0);assert.equal(h.active(),0);
  if(kind==='timeout')assert.equal(result.timedOut,true);if(kind==='cancel')assert.equal(result.aborted,true);
});
test('network failure in GET cleans its timer and does not leak the request',async()=>{
  const h=harness(async()=>({status:405}),async()=>{throw Error('offline');});const result=await h.call();assert.equal(result.method,'GET');assert.equal(result.status,'unreachable');assert.equal(h.active(),0);assert.equal(h.timers.size,0);
});
