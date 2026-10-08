// Main browser checks: loads the extension from the repository's extension/ folder into a disposable Chromium profile.
// Only synthetic bookmarks are used; nothing is written into the repository.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { loadChromium, launchOptions } from './common.mjs';
import { runBrowserFeatures, waitForStorage } from './features.mjs';

const chromium = await loadChromium();
if (!chromium) { console.error('Playwright is not installed.'); process.exit(2); }
const profile = fs.mkdtempSync(path.join(os.tmpdir(),'bookmark-scope-acceptance-'));
const results = { recordedAt:new Date().toISOString(),browser:'',checks:[],errors:[],limits:['Chromium only; no Firefox/store acceptance','Real API mutations use synthetic bookmarks in a disposable profile','HTTP lifecycle is covered separately by controlled unit tests; host-grant prompt not exercised'] };
const appendCheck=results.checks.push.bind(results.checks);
results.checks.push=(...entries)=>{for(const entry of entries)console.error('PASS: '+entry.name);return appendCheck(...entries);};
let context;
const options = launchOptions({ viewport:{width:1440,height:1000} });
try {
  context = await chromium.launchPersistentContext(profile,options);
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker',{timeout:30000});
  results.browser = context.browser()?.version() || 'Chromium';
  const id = worker.url().split('/')[2];
  const origin = `chrome-extension://${id}/`;
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror',error=>results.errors.push(error.message));
  for (const name of ['popup','options','dashboard']) {
    await page.goto(origin+`pages/${name}/${name}.html`);
    await page.waitForFunction(name=>name==='options'
      ? document.querySelector('select')?.options.length>0
      : document.querySelector('#app')?.children.length>0,name);
    results.checks.push({name:`${name} initializes`,passed:true});
  }
  const realMutation = await page.evaluate(async () => {
    const api = await import(chrome.runtime.getURL('src/platform/browser-api.js'));
    const tags = await import(chrome.runtime.getURL('src/services/tag-service.js'));
    const { createActionTools } = await import(chrome.runtime.getURL('src/dashboard/action-tools.js'));
    const root = (await chrome.bookmarks.getTree())[0];
    const base = root.children.find(node=>!node.unmodifiable);
    const parent = await api.createBookmark({parentId:base.id,title:'Acceptance'});
    const p = await api.createBookmark({parentId:parent.id,title:'P'});
    const q = await api.createBookmark({parentId:parent.id,title:'Q'});
    const f = await api.createBookmark({parentId:p.id,title:'Folder'});
    const a = await api.createBookmark({parentId:p.id,title:'A',url:'https://a.test/'});
    const b = await api.createBookmark({parentId:p.id,title:'B',url:'https://b.test/'});
    const x = await api.createBookmark({parentId:q.id,title:'X',url:'https://x.test/'});
    const state = { allBookmarks:[a,b,x],tagsByBookmark:{},visibleBookmarks:[] };
    let toast;
    const tools = createActionTools({state,t:(text,vars={})=>text.replace(/\{\{(.*?)\}\}/g,(_,key)=>vars[key] ?? key),formatNumber:String,sendMessage:async()=>{},showConfirmDialog:async()=>true,setToast:(_text,options)=>{toast=options;},refreshData:async()=>{},renderListOnly(){},pushCleanupHistory:async()=>{},invalidateBookmarkCache(){},...api,deselectBookmarks(){}});
    await tools.handleDragDropMove([x],b,'before');
    const order = (await chrome.bookmarks.getChildren(p.id)).map(node=>node.title);
    await toast.action();
    const restoredParent = (await chrome.bookmarks.get(x.id))[0].parentId;
    await tags.updateTagsMap(map=>tags.setTagsForBookmark(map,a.id,['work']));
    await tools.handleDeleteMany([a],{skipConfirm:true});
    await toast.action();
    const restored = (await chrome.bookmarks.getChildren(p.id)).find(node=>node.title==='A');
    const restoredTags = (await tags.loadTagsMap())[restored.id];
    await chrome.bookmarks.removeTree(parent.id);
    return {order,restoredParent,expectedParent:q.id,restoredTags,newIdentity:restored.id!==a.id};
  });
  assert.deepEqual(realMutation.order,['Folder','A','X','B']);
  assert.equal(realMutation.restoredParent,realMutation.expectedParent);
  assert.deepEqual(realMutation.restoredTags,['work']); assert.equal(realMutation.newIdentity,true);
  results.checks.push({name:'real Chrome bookmark mixed-folder move, Undo, delete/tag recovery',passed:true,...realMutation});
  // Same-folder forward moves: index must mean the FINAL index on real Chromium
  // (the raw API reads it as a pre-removal index; moveBookmark normalises it).
  const sameFolder = await page.evaluate(async () => {
    const api = await import(chrome.runtime.getURL('src/platform/browser-api.js'));
    const { createActionTools } = await import(chrome.runtime.getURL('src/dashboard/action-tools.js'));
    const base = (await chrome.bookmarks.getTree())[0].children.find(node=>!node.unmodifiable);
    const parent = await api.createBookmark({parentId:base.id,title:'SameFolderAcceptance'});
    const names = ['a1','a2','a3','a4','a5'];
    const nodes = {};
    const order = async () => (await chrome.bookmarks.getChildren(parent.id)).map(node=>node.title);
    const reset = async () => { for (const child of await chrome.bookmarks.getChildren(parent.id)) await chrome.bookmarks.remove(child.id); for (const n of names) nodes[n] = await api.createBookmark({parentId:parent.id,title:n,url:'https://'+n+'.test/'}); };
    const out = { raw: {}, steps: [] };
    // Documents the raw engine behaviour the wrapper compensates for.
    await reset(); await chrome.bookmarks.move(nodes.a1.id,{parentId:parent.id,index:2}); out.raw.a1ToIndex2 = await order();
    // Direct wrapper calls: forward, last position, backward, same index.
    for (const [name,index] of [['a1',2],['a1',4],['a5',0],['a3',2]]) {
      await reset(); await api.moveBookmark(nodes[name].id,{parentId:parent.id,index});
      const result = await order(); const expected = names.filter(n=>n!==name); expected.splice(index,0,name);
      out.steps.push({kind:'moveBookmark',name,index,result,expected});
    }
    // Dashboard logic: drop + Undo through the real action tools.
    let toast;
    const state = { allBookmarks:[],tagsByBookmark:{},visibleBookmarks:[] };
    const tools = createActionTools({state,t:(text,vars={})=>text.replace(/\{\{(.*?)\}\}/g,(_,key)=>vars[key] ?? key),formatNumber:String,sendMessage:async()=>{},showConfirmDialog:async()=>true,setToast:(_text,options)=>{toast=options;},refreshData:async()=>{},renderListOnly(){},pushCleanupHistory:async()=>{},invalidateBookmarkCache(){},...api,deselectBookmarks(){}});
    const drops = [[['a1'],'a3','after',['a2','a3','a1','a4','a5']],[['a1'],'a4','before',['a2','a3','a1','a4','a5']],[['a1'],'a5','after',['a2','a3','a4','a5','a1']],[['a1','a2'],'a5','after',['a3','a4','a5','a1','a2']],[['a2','a4'],'a1','before',['a2','a4','a1','a3','a5']]];
    for (const [sources,target,position,expected] of drops) {
      await reset(); toast = null;
      const fresh = async id => (await chrome.bookmarks.get(nodes[id].id))[0];
      await tools.handleDragDropMove(await Promise.all(sources.map(fresh)),await fresh(target),position);
      const afterDrop = await order(); await toast.action(); const afterUndo = await order();
      out.steps.push({kind:'drop+undo',sources,target,position,afterDrop,expected,afterUndo});
    }
    await chrome.bookmarks.removeTree(parent.id);
    return out;
  });
  assert.deepEqual(sameFolder.raw.a1ToIndex2,['a2','a1','a3','a4','a5'],'raw Chromium bookmarks.move still uses pre-removal indexes; the wrapper normalisation is required');
  for (const step of sameFolder.steps) {
    if (step.kind === 'moveBookmark') assert.deepEqual(step.result,step.expected,'moveBookmark '+step.name+' -> '+step.index);
    else { assert.deepEqual(step.afterDrop,step.expected,'drop '+step.sources+' '+step.position+' '+step.target); assert.deepEqual(step.afterUndo,['a1','a2','a3','a4','a5'],'undo '+step.sources+' '+step.position+' '+step.target); }
  }
  results.checks.push({name:'real Chrome same-folder forward move uses final index (5 bookmarks, last position, Undo)',passed:true,rawPreRemovalBehaviour:sameFolder.raw.a1ToIndex2,steps:sameFolder.steps.length});


  // Exercise the actual scroller module in a real layout with variable heights,
  // gaps, scrolling, keyboard intent, updates, and density changes.
  for (const count of [151,1000,10000]) for (const density of ['normal','compact']) {
    const metrics = await page.evaluate(async ({count,density}) => {
      const {createVirtualScroller}=await import(chrome.runtime.getURL('src/dashboard/virtual-scroller.js'));
      const viewport=document.createElement('div');viewport.style.cssText='height:400px;overflow:auto;width:700px;overflow-anchor:none';
      const content=document.createElement('div');content.style.cssText='display:grid;align-content:start;row-gap:14px';viewport.append(content);document.body.replaceChildren(viewport);
      const items=Array.from({length:count},(_,i)=>({id:String(i),title:'Row '+i}));
      const renderItem=item=>{const node=document.createElement('div');node.dataset.id=item.id;node.textContent=item.title;node.style.cssText=`height:${(density==='compact'?32:64)+(Number(item.id)%3)*20}px;box-sizing:border-box`;return node;};
      const scroller=createVirtualScroller({container:content,viewport,items,renderItem});scroller.mount();
      const frame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      await frame();
      let maxNodes=content.children.length;
      for(const target of [0,Math.floor(count/2),count-1]) {
        scroller.scrollToItem(String(target));await frame();
        if(!scroller.getNode(String(target)))throw Error('Cannot reach row '+target);
        maxNodes=Math.max(maxNodes,content.children.length);
      }
      viewport.scrollTop=viewport.scrollHeight-viewport.clientHeight;viewport.dispatchEvent(new Event('scroll'));await frame();
      const lastNode=scroller.getNode(String(count-1));
      const lastRect=lastNode?.getBoundingClientRect();
      const viewportRect=viewport.getBoundingClientRect();
      const endVisible=!!lastRect && lastRect.bottom<=viewportRect.bottom+1 && lastRect.top>=viewportRect.top-1;
      // Actual keyboard event drives the documented scroll-to-item seam.
      viewport.tabIndex=0;viewport.addEventListener('keydown',event=>{if(event.key==='ArrowUp')scroller.scrollToItem(String(count-2));});viewport.focus();viewport.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp'}));await frame();
      const keyboardReach=!!scroller.getNode(String(count-2));
      scroller.update(items.map(item=>({...item,title:'Changed '+item.id})));await frame();
      const updated=scroller.getNode(String(count-1))?.textContent;
      scroller.destroy();return {count,density,maxNodes,endVisible,keyboardReach,updated,remainingNodes:content.children.length};
    },{count,density});
    assert.ok(metrics.endVisible);assert.ok(metrics.keyboardReach);assert.ok(metrics.maxNodes<100);assert.equal(metrics.updated,'Changed '+(count-1));assert.equal(metrics.remainingNodes,0);
    results.checks.push({name:'real layout virtual scroller',passed:true,...metrics});
  }

  // Two independent extension pages mutate the same shared storage key using
  // the real browser's origin-scoped locks (not a local promise queue).
  const page2=await context.newPage();await page2.goto(origin+'pages/options/options.html');
  const ids=await worker.evaluate(async()=>{
    const tree=await chrome.bookmarks.getTree();const parent=tree[0].children.find(node=>!node.unmodifiable).id;
    return Promise.all(['One','Two'].map(title=>chrome.bookmarks.create({parentId:parent,title,url:'https://example.test/'+title}))).then(nodes=>nodes.map(n=>n.id));
  });
  await Promise.all([page,page2].map((tab,index)=>tab.evaluate(async ({id,tag})=>{
    const tags=await import(chrome.runtime.getURL('src/services/tag-service.js'));
    await tags.updateTagsMap(map=>tags.addTagToBookmark(map,id,tag).map);
  },{id:ids[index],tag:['one','two'][index]})));
  const actualTags=await worker.evaluate(async()=> (await chrome.storage.local.get('tagsByBookmark')).tagsByBookmark);
  assert.deepEqual(actualTags[ids[0]],['one']);assert.deepEqual(actualTags[ids[1]],['two']);
  results.checks.push({name:'two extension pages preserve concurrent tag updates through native Web Locks',passed:true});
  await runBrowserFeatures({page,worker,origin,profile,results,ids});

  // Real dashboard wiring: scrolling the .list-scroll viewport must advance
  // rows, and a cross-context storage refresh must preserve that position.
  const lastId=await worker.evaluate(async()=>{
    const root=(await chrome.bookmarks.getTree())[0];const folder=await chrome.bookmarks.create({parentId:root.children.find(n=>!n.unmodifiable).id,title:'Large library'});
    let last;
    for(let i=0;i<1000;i++)last=await chrome.bookmarks.create({parentId:folder.id,title:'Z Row '+String(i).padStart(5,'0'),url:'https://example.test/'+i});
    return last.id;
  });
  await page.goto(origin+'pages/dashboard/dashboard.html');await page.waitForSelector('.vs-spacer',{state:'attached'});
  await page.locator('.list-scroll').evaluate(node=>{node.scrollTop=node.scrollHeight;});
  await page.waitForFunction(id=>{
    const node=document.querySelector(`[data-bookmark-id="${id}"]`);
    const viewport=document.querySelector('.list-scroll');
    if(!node || !viewport)return false;
    const row=node.getBoundingClientRect(),rect=viewport.getBoundingClientRect();
    return row.bottom<=rect.bottom+1 && row.top>=rect.top-1;
  },lastId).catch(async error=>{
    results.dashboardGeometry=await page.evaluate(id=>{
      const viewport=document.querySelector('.list-scroll');
      const node=document.querySelector(`[data-bookmark-id="${id}"]`);
      return {id,scrollTop:viewport?.scrollTop,scrollHeight:viewport?.scrollHeight,clientHeight:viewport?.clientHeight,viewport:viewport?.getBoundingClientRect().toJSON(),row:node?.getBoundingClientRect().toJSON(),rendered:[...document.querySelectorAll('[data-bookmark-id]')].map(n=>({id:n.dataset.bookmarkId,text:n.textContent.slice(0,100)}))};
    },lastId);throw error;
  });
  const before=await page.locator('.list-scroll').evaluate(node=>node.scrollTop);
  await page.evaluate(()=>{globalThis.acceptancePreviousViewport=document.querySelector('.list-scroll');});
  await page2.evaluate(async id=>{
    const tags=await import(chrome.runtime.getURL('src/services/tag-service.js'));await tags.updateTagsMap(map=>tags.addTagToBookmark(map,id,'updated').map);
  },ids[0]);
  await page.waitForFunction(()=>document.querySelector('.list-scroll')!==globalThis.acceptancePreviousViewport);
  await page.waitForFunction(previous=>Math.abs(document.querySelector('.list-scroll')?.scrollTop-previous)<=2,before);
  results.checks.push({name:'actual dashboard viewport reaches final row and preserves position on storage update',passed:true,before,after:await page.locator('.list-scroll').evaluate(node=>node.scrollTop)});

  const denied = await page.evaluate(async()=>{
    const scan=await import(chrome.runtime.getURL('src/services/scheduled-health-scan-service.js'));
    await chrome.storage.local.set({bgHealthScanEnabled:true,bgHealthScanIntervalDays:7});
    let fetches=0;const result=await scan.runScheduledHealthScan({runHealthFetch:async()=>{fetches++;throw Error('permission gate failed');}});
    const alarm=await chrome.alarms.get('bookmark-scope-scheduled-health-scan');
    await chrome.storage.local.set({bgHealthScanEnabled:false});
    return {reason:result.reason,fetches,periodInMinutes:alarm?.periodInMinutes};
  });
  assert.deepEqual(denied,{reason:'no-permission',fetches:0,periodInMinutes:7*1440});
  results.checks.push({name:'native optional-permission denial preserves scheduled alarm without fetching',passed:true,...denied});

  await worker.evaluate(()=>{
    globalThis.acceptanceOriginalFetch=globalThis.fetch;
    globalThis.fetch=async(url,options)=>{
      if(url!=='https://acceptance.test/cancel')return globalThis.acceptanceOriginalFetch(url,options);
      if(options.method==='HEAD')return new Response('',{status:405});
      await chrome.storage.local.set({acceptanceGetStarted:true});
      return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
    };
  });
  await page.evaluate(()=>{globalThis.acceptancePendingHealth=chrome.runtime.sendMessage({type:'FETCH_URL_HEALTH',url:'https://acceptance.test/cancel',timeoutMs:8000,requestId:'acceptance-cancel'});});
  await waitForStorage(worker,page,'acceptanceGetStarted',value=>value===true);
  const abort=await page.evaluate(()=>chrome.runtime.sendMessage({type:'ABORT_URL_HEALTH',requestId:'acceptance-cancel'}));
  const health=await page.evaluate(()=>globalThis.acceptancePendingHealth);
  assert.equal(abort.aborted,true);assert.equal(health.aborted,true);assert.equal(health.method,'GET');
  await worker.evaluate(()=>{globalThis.fetch=globalThis.acceptanceOriginalFetch;});
  results.checks.push({name:'native worker runtime-message GET cancellation with mocked fetch boundary',passed:true});

  await page.evaluate(async()=>{
    const cache=await import(chrome.runtime.getURL('src/services/health-cache-service.js'));
    await cache.writeHealthRecord('https://restart.test/',{status:'healthy',checkedAt:Date.now()},await cache.getHealthCacheGeneration());
    await chrome.storage.local.set({bgHealthScanCursor:'https://restart.test/'});
  });
  assert.deepEqual(results.errors,[]);
  await context.close();
  context=await chromium.launchPersistentContext(profile,options);
  const restarted=context.serviceWorkers()[0] || await context.waitForEvent('serviceworker',{timeout:30000});
  // A restarted worker can be listed before its chrome.* APIs are attached; wait for them.
  for(let attempt=0;attempt<100 && !await restarted.evaluate(()=>Boolean(globalThis.chrome?.storage?.local)).catch(()=>false);attempt++)await new Promise(resolve=>setTimeout(resolve,100));
  const persisted=await restarted.evaluate(()=>chrome.storage.local.get(['storageSchemaVersion','bgHealthScanCursor','healthCache']));
  assert.equal(persisted.storageSchemaVersion,7);assert.equal(persisted.bgHealthScanCursor,'https://restart.test/');assert.equal(persisted.healthCache['https://restart.test/'].status,'healthy');
  results.checks.push({name:'real browser/worker restart preserves schema, coverage cursor and health record',passed:true});
} catch(error) { results.errors.push(error.stack || String(error)); process.exitCode=1; }
finally {
  await context?.close();
  // Only the exact disposable directory created by this run may be removed.
  if(path.dirname(profile)!==os.tmpdir() || !path.basename(profile).startsWith('bookmark-scope-acceptance-'))throw Error('Unexpected profile path');
  fs.rmSync(profile,{recursive:true,force:true});
  console.log(JSON.stringify(results,null,2));
}
