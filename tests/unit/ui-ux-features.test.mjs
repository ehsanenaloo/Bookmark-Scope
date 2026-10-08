import test from 'node:test';
import assert from 'node:assert/strict';
import { domFixture } from '../helpers/dom.mjs';
import { fakeBrowser,folder,leaf,deferred } from '../helpers/browser.mjs';
import { createFeatureTools } from '../../extension/src/dashboard/feature-tools.js';
import { trapFocus } from '../../extension/src/ui/ui-utils.js';
import { buildScanTargets,createScanJob } from '../../extension/src/services/scan-job-service.js';
import { loadSmartViews } from '../../extension/src/services/smart-view-service.js';
import { createCommandRegistry } from '../../extension/src/dashboard/command-registry.js';

function setup(t,{rows=[leaf('A'),leaf('B')],stored={},selected=[],permission=true,permissionCalls=[],fetchHealth=async()=>({status:'healthy',checkedAt:Date.now()})}={}){
  const dom=domFixture();t.after(()=>{tools.closeDialog();dom.restore();});
  const browser=fakeBrowser([folder('P',rows)],stored);browser.api.permissionGranted=permission;
  const state={visibleBookmarks:rows,ignoreHashFragment:true,selectedIds:new Set(),query:'',sort:'title-asc',cleanupFilter:'all',groupBy:'flat',groupSort:'default',activeTagFilter:[],inspectControllers:new Set()};
  const downloads=[],toasts=[];const commands=createCommandRegistry(Object.fromEntries(['savedViews','bulkTags','duplicatePreview','deleteSelected','resumableScan','inspectVisible','repairRedirects','snapshotExport','snapshotRestore','importPreview','diagnosticExport','clearHealth'].map(name=>[name,{label:name,run(){}}])));
  const tools=createFeatureTools({state,create:dom.create,trapFocus,t:s=>s,setToast:(message,opts)=>toasts.push({message,opts}),downloadTextFile:(...args)=>downloads.push(args),refreshData:async()=>{},render(){},savePreferences:async()=>{},recalculateVisibleBookmarks(){},getSelectedBookmarks:()=>selected,handleDeleteMany:async()=>{},ensureHealthPermission:async()=>{permissionCalls.push(true);return permission;},inspectUrlHealth:fetchHealth,sendMessage:async()=>{},commands:()=>commands});
  const action=name=>dom.doc.body.querySelector(`[data-feature-action="${name}"]`);
  const labeled=name=>dom.doc.body.querySelectorAll('input').concat(dom.doc.body.querySelectorAll('select')).find(node=>node.getAttribute('aria-label')===name);
  return {...dom,...browser,state,tools,action,labeled,downloads,toasts};
}

test('saved view save retains identity/name and second Save updates instead of duplicating',async t=>{
  const f=setup(t);await f.tools.showSavedViews();assert.equal(f.action('Open view').disabled,true);assert.equal(f.action('Delete view').disabled,true);assert.equal(f.action('Save view').disabled,true);
  const name=f.labeled('View name');name.value='Work';await name.emit('input');await f.action('Save view').click();const choice=f.labeled('Saved views');const id=choice.value;assert.ok(id);assert.equal(name.value,'Work');assert.equal(f.action('Open view').disabled,false);assert.match(f.doc.body.textContent,/View saved: Work/);
  f.state.query='title:work';await f.action('Save view').click();const views=await loadSmartViews();assert.equal(views.length,1);assert.equal(views[0].id,id);assert.equal(views[0].query,'title:work');
  await f.action('Delete view').click();assert.equal((await loadSmartViews()).length,0);assert.equal(choice.value,'');assert.equal(f.action('Open view').disabled,true);
});

test('bulk tags shows named before/after, operation-specific fields and accessible in-dialog Undo',async t=>{
  const f=setup(t,{stored:{tagsByBookmark:{A:['old']}},selected:[leaf('A')]});f.tools.showBulkTags();assert.match(f.doc.body.textContent,/Selected bookmarks: 1/);assert.equal(f.labeled('Source tag').parentElement.hidden,true);const target=f.labeled('Tag to add');target.value='work';assert.equal(f.action('Apply tag changes').disabled,true);
  await f.action('Preview').click();assert.equal(f.action('Apply tag changes').disabled,false);assert.match(f.doc.body.querySelector('.feature-preview-list').textContent,/A.*Before: old.*After: old, work/s);
  const apply=f.action('Apply tag changes');apply.focus();await apply.click();assert.deepEqual(f.stored.tagsByBookmark.A,['old','work']);assert.equal(apply.disabled,true);const undo=f.action('Undo tag changes');assert.equal(undo.disabled,false);assert.ok(f.doc.body.querySelector('section').contains(undo));assert.ok(f.doc.body.querySelector('section').contains(f.doc.activeElement));assert.equal(f.toasts.length,0);
  await undo.click();assert.deepEqual(f.stored.tagsByBookmark.A,['old']);assert.equal(undo.disabled,true);
  const operation=f.labeled('Bulk tags');operation.value='remove';await operation.emit('change');assert.equal(f.labeled('Tag to remove').parentElement.hidden,false);assert.equal(f.labeled('Target tag').parentElement.hidden,true);operation.value='rename';await operation.emit('change');assert.equal(f.labeled('Source tag').parentElement.hidden,false);assert.equal(f.labeled('Target tag').parentElement.hidden,false);
});

test('failed async Preview restores focused action and announces error without escaping modal',async t=>{
  const f=setup(t);f.tools.showBulkTags();const preview=f.action('Preview');preview.focus();await preview.click();assert.equal(preview.disabled,false);assert.equal(f.doc.activeElement,preview);assert.match(f.doc.body.querySelector('.feature-status').textContent,/Invalid tag/);f.doc.body.focus();assert.ok(f.doc.body.querySelector('section').contains(f.doc.activeElement));
});

test('snapshot has readable hierarchy and optional JSON; excludes unsafe URLs before application',async t=>{
  const f=setup(t);const snapshot={format:'bookmark-scope-snapshot',version:1,createdAt:'2026-10-06T00:00:00Z',roots:[{type:'folder',sourceId:'f',title:'Research <script>',children:[{type:'bookmark',sourceId:'a',title:'Article',url:'https://article.test/',tags:['work']},{type:'bookmark',sourceId:'b',title:'Unsafe',url:'javascript:alert(1)',tags:[]}]}]};await f.tools.showSnapshotRestore(snapshot);await new Promise(resolve=>setImmediate(resolve));assert.match(f.doc.body.querySelector('.feature-snapshot-tree').textContent,/Research <script>.*Article.*Excluded: unsupported URL/s);assert.ok(f.doc.body.querySelector('details'));assert.equal(f.doc.body.querySelectorAll('script').length,0);assert.equal(f.calls.creates.length,0);assert.equal(f.action('Restore into new folder').disabled,false);
});

test('import policy changes readable row actions and primary button remains unavailable for empty import',async t=>{
  const f=setup(t);await f.tools.showImportPreview([{title:'Article',url:'https://A.test/',tags:['work']},{title:'New',url:'https://new.test/',tags:[]}],['Parser warning'],2);await new Promise(resolve=>setImmediate(resolve));assert.match(f.doc.body.querySelector('.feature-preview-list').textContent,/Article.*Will skip match.*New.*Will create bookmark/s);const policy=f.labeled('Duplicate policy');policy.value='merge';await policy.emit('change');assert.match(f.doc.body.querySelector('.feature-preview-list').textContent,/Will merge tags/);assert.match(f.doc.body.textContent,/Parser warning/);assert.equal(f.calls.creates.length,0);await f.tools.showImportPreview([]);await new Promise(resolve=>setImmediate(resolve));assert.equal(f.action('Import bookmarks').disabled,true);
});

for(const status of ['none','ready','paused','running','completed','canceled'])test(`scan controls reflect ${status} and disclose closure/scope`,async t=>{
  const f=setup(t,{rows:[leaf('A'),leaf('B','https://A.test/#fragment'),leaf('C','javascript:alert(1)')]});if(status!=='none'){const job=await createScanJob(f.state.visibleBookmarks);job.status=status;f.stored.healthScanJob=job;}await f.tools.showScan();assert.match(f.doc.body.textContent,/Visible bookmarks \(current filters\): 3/);assert.match(f.doc.body.textContent,/Unique supported URLs to check: 1/);assert.match(f.doc.body.textContent,/Closing this dialog pauses/);assert.equal(f.action('Resume scan').disabled,!['ready','paused'].includes(status));assert.equal(f.action('Pause scan').disabled,status!=='running');assert.equal(f.action('Cancel scan').disabled,!['ready','paused','running'].includes(status));assert.equal(f.action('Start new scan').disabled,['ready','paused','running'].includes(status));
});

test('closing a running scan persists pause and reopening exposes Resume and dashboard progress',async t=>{
  const request=deferred(),started=deferred();const f=setup(t,{fetchHealth:async()=>{started.resolve();return request.promise;}});await f.tools.showScan();const run=f.action('Start new scan').click();await started.promise;f.tools.closeDialog();request.resolve({status:'healthy',checkedAt:Date.now()});await run;assert.equal(f.stored.healthScanJob.status,'paused');assert.equal(f.stored.healthScanJob.completed.length,0);await f.tools.showScan();assert.equal(f.action('Resume scan').disabled,false);await f.tools.appendScanSummary(f.doc.body);assert.match(f.doc.body.querySelector('.feature-scan-summary').textContent,/0 \/ 2/);
});

test('permission denial has feedback with no new job or network request',async t=>{
  let requests=0;const f=setup(t,{permission:false,fetchHealth:async()=>{requests++;}});await f.tools.showScan();await f.action('Start new scan').click();assert.equal(f.stored.healthScanJob,undefined);assert.equal(requests,0);assert.match(f.doc.body.querySelector('.feature-status').textContent,/permission denied/);
});

test('Library tools groups commands and retains all twelve actions',t=>{const f=setup(t);f.tools.showLibraryTools();assert.equal(f.doc.body.querySelectorAll('.feature-command-group').length,4);assert.equal(f.doc.body.querySelectorAll('[data-feature-action="snapshotExport"]').length,1);assert.equal(f.doc.body.querySelectorAll('button').length,13);});

test('scan preview target builder matches persisted job targets',async()=>{const rows=[leaf('A'),leaf('B','https://A.test/#frag'),leaf('C','chrome://settings')];fakeBrowser([folder('P',rows)]);const targets=buildScanTargets(rows,{ignoreHashFragment:true});const job=await createScanJob(rows,{ignoreHashFragment:true});assert.deepEqual(job.targets,targets);assert.equal(targets.length,1);});

test('partial import displays individual success/failure and exposes recovery without enabling a second Apply',async t=>{
  const f=setup(t);f.failures.create.add('https://fail.test/');await f.tools.showImportPreview([{title:'Fails',url:'https://fail.test/',tags:[]},{title:'Works',url:'https://works.test/',tags:[]},{title:'Unsafe',url:'javascript:alert(1)',tags:[]}],[{message:'One parser warning'}]);await new Promise(resolve=>setImmediate(resolve));assert.match(f.doc.body.textContent,/One parser warning/);assert.match(f.doc.body.textContent,/Excluded items.*Unsafe/s);await f.action('Import bookmarks').click();const results=f.doc.body.querySelector('.feature-operation-results');assert.match(results.textContent,/Fails.*Failed.*Works.*Created/s);assert.equal(f.action('Import bookmarks').disabled,true);assert.ok(f.action('Recovery journal'));assert.match(f.doc.body.textContent,/Retrying may create additional copies/);
});

test('scan request failure persists pause and leaves Resume available with error feedback',async t=>{
  const f=setup(t,{fetchHealth:async()=>{throw Error('Injected request failure');}});await f.tools.showScan();await f.action('Start new scan').click();assert.equal(f.stored.healthScanJob.status,'paused');assert.equal(f.action('Resume scan').disabled,false);assert.match(f.doc.body.querySelector('.feature-status').textContent,/Injected request failure/);
});

test('bulk tag concurrent conflict keeps current tags and retains an available retryable Undo',async t=>{
  const f=setup(t,{selected:[leaf('A')]});f.tools.showBulkTags();f.labeled('Tag to add').value='work';await f.action('Preview').click();await f.action('Apply tag changes').click();f.stored.tagsByBookmark.A=['concurrent'];await f.action('Undo tag changes').click();assert.deepEqual(f.stored.tagsByBookmark.A,['concurrent']);assert.equal(f.action('Undo tag changes').disabled,false);assert.match(f.doc.body.querySelector('.feature-status').textContent,/Changed \/ missing \/ conflicting: 0 \/ 0 \/ 1/);
});

for(const dismissal of ['close','escape','backdrop'])test(`scan ${dismissal} dismissal persists paused progress`,async t=>{
  const started=deferred(),request=deferred();const f=setup(t,{fetchHealth:async()=>{started.resolve();return request.promise;}});await f.tools.showScan();const run=f.action('Start new scan').click();await started.promise;const overlay=f.doc.body.querySelector('.feature-overlay');if(dismissal==='close')await f.doc.body.querySelector('button').click();else if(dismissal==='escape')await overlay.emit('keydown',{key:'Escape'});else await overlay.emit('click');request.resolve({status:'healthy',checkedAt:Date.now()});await run;assert.equal(f.tools.isDialogOpen(),false);assert.equal(f.stored.healthScanJob.status,'paused');assert.equal(f.stored.healthScanJob.completed.length,0);
});

test('diagnostic primary JSON preview equals the downloaded data and excludes private fields',async t=>{
  const f=setup(t,{stored:{diagnosticEvents:[{scope:'dashboard',event:'import_succeeded',level:'info',ts:'2026-10-06T00:00:00Z',details:{count:2,url:'https://private.test/',title:'Secret'}}]}});await f.tools.showDiagnostics();const exact=f.doc.body.querySelector('pre').textContent;assert.doesNotMatch(exact,/private|Secret/);await f.action('Download').click();assert.equal(f.downloads[0][1],exact);assert.match(f.doc.body.textContent,/Excludes bookmark URLs, titles, IDs, tags and error text/);
});

test('focus trap includes visible disclosure summary but skips descendants of closed folders',t=>{
  const f=setup(t),modal=f.create('section'),close=f.create('button'),outer=f.create('details'),outerSummary=f.create('summary'),inner=f.create('details'),innerSummary=f.create('summary');inner.append(innerSummary);outer.append(outerSummary,inner);modal.append(close,outer);f.doc.body.append(modal);const release=trapFocus(modal);try{f.dispatch('keydown',{key:'Tab',shiftKey:true,preventDefault(){}});assert.equal(f.doc.activeElement,outerSummary);outer.open=true;close.focus();f.dispatch('keydown',{key:'Tab',shiftKey:true,preventDefault(){}});assert.equal(f.doc.activeElement,innerSummary);}finally{release();}
});

test('Start new scan requests the optional permission once per click (Firefox rejects a second request after the handler awaited)',async t=>{
  const permissionCalls=[];const f=setup(t,{permissionCalls});await f.tools.showScan();await f.action('Start new scan').click();
  assert.equal(permissionCalls.length,1);assert.equal(f.stored.healthScanJob.status,'completed');
  await f.action('Start new scan').click();assert.equal(permissionCalls.length,2,'one request per click');
});
