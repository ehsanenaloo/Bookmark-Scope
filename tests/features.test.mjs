import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeBrowser,folder } from './helpers/browser.mjs';
import { createSnapshot,validateSnapshot,restoreSnapshot,loadRestoreJournal } from '../extension/src/services/snapshot-service.js';
import { applySmartView,loadSmartViews,saveSmartView,deleteSmartView,validateSmartView } from '../extension/src/services/smart-view-service.js';
import { buildTagPreview,applyTagPreview,buildDuplicatePreview,prepareDuplicateMerge,writableFolders } from '../extension/src/services/maintenance-preview-service.js';
import { buildImportPreview,importBookmarks } from '../extension/src/services/import-service.js';
import { createScanJob,loadScanJob,runScanJob,controlScanJob,scanCoverage } from '../extension/src/services/scan-job-service.js';
import { redactDiagnosticEvents } from '../extension/src/services/diagnostic-export-service.js';
import { createCommandRegistry } from '../extension/src/dashboard/command-registry.js';
import { FEATURE_MESSAGES } from '../extension/src/locales/feature-messages.js';
import { ensureStorageSchema } from '../extension/src/services/storage-schema.js';
import { parseImportedFilePreview } from '../extension/src/dashboard/import-export-tools.js';

const bookmark=(id,url='https://example.test/',extra={})=>({id,title:id,url,dateAdded:42,...extra});
const view={name:'Work',query:'title:a',sort:'newest',cleanupFilter:'duplicates',groupBy:'folder',groupSort:'alpha-asc',activeTagFilter:[' Work ']};
const snapshot=()=>({format:'bookmark-scope-snapshot',version:1,createdAt:'2026-10-06T00:00:00Z',roots:[{sourceId:'F',type:'folder',title:'Work',children:[{sourceId:'A',type:'bookmark',title:'A',url:'https://a.test/',tags:['work'],dateAdded:42},{sourceId:'B',type:'bookmark',title:'B',url:'https://b.test/',tags:[],dateAdded:42}]}]});

test('F01 exports hierarchy, order and tags; restores additively with remapped identities',async()=>{
  const x=fakeBrowser([folder('P',[folder('F',[bookmark('A','https://a.test/'),bookmark('B','https://b.test/')])])],{tagsByBookmark:{A:['work']}});
  const exported=await createSnapshot();assert.equal(exported.roots[0].children[0].children[0].tags[0],'work');
  const result=await restoreSnapshot(exported,'P');assert.equal(result.failed,0);assert.equal(result.notAttempted,0);
  assert.notEqual(result.mapping.A,'A');assert.deepEqual(x.stored.tagsByBookmark[result.mapping.A],['work']);
  assert.equal(x.find('P').children[0].id,'F');assert.equal(x.find(result.mapping.F).children[0].title,'A');assert.equal(x.find(result.mapping.F).children[1].title,'B');
  assert.notEqual(x.find(result.mapping.A).dateAdded,42);assert.equal((await loadRestoreJournal())[0].status,'completed');
});
for(const mutate of [s=>s.version=2,s=>s.roots[0].children[1].sourceId='A',s=>s.roots[0].children=null,s=>s.roots[0].children[0].tags=Array(21).fill('work'),s=>s.createdAt='invalid'])test('F01 malformed snapshot rejects before creation',async()=>{
  const x=fakeBrowser([folder('P')]);const data=snapshot();mutate(data);await assert.rejects(restoreSnapshot(data,'P'));assert.equal(x.calls.creates.length,0);
});
test('F01 excessive nesting rejects and unsupported schemes are explicitly excluded',()=>{
  const data=snapshot();let node=data.roots[0];for(let i=0;i<102;i++){node.children=[{sourceId:'depth-'+i,type:'folder',title:'',children:[]}];node=node.children[0];}assert.throws(()=>validateSnapshot(data),/depth/);
  const unsafe=snapshot();unsafe.roots[0].children[0].url='javascript:alert(1)';assert.deepEqual(validateSnapshot(unsafe).excluded,['A']);
});
test('F01 failed branch preserves successful sibling and durable partial journal',async()=>{
  const x=fakeBrowser([folder('P')]);x.failures.create.add('https://a.test/');const result=await restoreSnapshot(snapshot(),'P');assert.equal(result.failed,1);assert.equal(result.operation.status,'partial');assert.ok(result.mapping.B);assert.equal((await loadRestoreJournal())[0].items.find(item=>item.sourceId==='A').status,'failed');
});
test('F01 tag write failure rolls back creation without losing siblings',async()=>{
  const x=fakeBrowser([folder('P')]);x.failures.set=value=>'tagsByBookmark' in value;const result=await restoreSnapshot(snapshot(),'P');assert.equal(result.failed,1);assert.equal(result.operation.items.find(item=>item.sourceId==='A').status,'rolled-back');assert.ok(result.mapping.B);
});
test('F01 journal failure stops subsequent creation and reports interrupted outcome',async()=>{
  const x=fakeBrowser([folder('P')]);let writes=0;x.failures.set=value=>'snapshotRestoreJournal' in value && ++writes>2;
  const result=await restoreSnapshot(snapshot(),'P');assert.equal(result.operation.status,'interrupted');assert.ok(result.storageError);assert.ok(result.notAttempted>0);assert.ok(x.find('P').children.length);
});
test('F01 managed destination rejects without mutation',async()=>{
  const x=fakeBrowser([{...folder('P'),unmodifiable:'managed'}]);assert.deepEqual(await writableFolders(),[]);await assert.rejects(restoreSnapshot(snapshot(),'P'),/managed/);assert.equal(x.calls.creates.length,0);
});
test('F01 adversarial source IDs cannot overwrite mapping prototype',async()=>{
  fakeBrowser([folder('P')]);const input=snapshot();input.roots[0].children[0].sourceId='__proto__';const result=await restoreSnapshot(input,'P');assert.equal(Object.getPrototypeOf(result.mapping),null);assert.equal(typeof result.mapping.__proto__,'string');
});
test('F01 failed tag rollback reports surviving identity for recovery',async()=>{
  const x=fakeBrowser([folder('P')]);x.failures.set=value=>'tagsByBookmark' in value;x.failures.remove.add('created-3');const result=await restoreSnapshot(snapshot(),'P');const item=result.operation.items.find(item=>item.sourceId==='A');assert.equal(item.status,'metadata-failed');assert.ok(x.find(item.id));assert.equal(result.failed,1);assert.ok(item.rollbackError);
});
test('F01 failed folder branch counts its descendants as unattempted',async()=>{
  const x=fakeBrowser([folder('P')]);const create=x.api.bookmarks.create;x.api.bookmarks.create=async details=>{if(details.title==='Work')throw new Error('folder failure');return create(details);};const result=await restoreSnapshot(snapshot(),'P');assert.equal(result.failed,1);assert.equal(result.notAttempted,2);assert.equal(result.operation.status,'partial');
});
test('F02 explicit survivor and tag union retain title and exact port identity',async()=>{
  const rows=[bookmark('A'),bookmark('B'),bookmark('C','https://example.test:8443/')];const x=fakeBrowser([folder('P',rows)],{tagsByBookmark:{A:['one'],B:['two']}});
  const groups=buildDuplicatePreview(rows,x.stored.tagsByBookmark);assert.equal(groups.length,1);groups[0].survivorId='A';const result=await prepareDuplicateMerge(groups);assert.deepEqual(result.toDelete.map(row=>row.id),['B']);assert.deepEqual(x.stored.tagsByBookmark.A,['one','two']);assert.equal(x.find('A').title,'A');assert.equal(x.calls.removes.length,0);
});
for(const mutation of ['tags','url','title','missing','survivor'])test(`F02 stale or invalid ${mutation} preview blocks merge`,async()=>{
  const rows=[bookmark('A'),bookmark('B')];const x=fakeBrowser([folder('P',rows)],{tagsByBookmark:{A:['one']}});const groups=buildDuplicatePreview(rows,x.stored.tagsByBookmark);
  if(mutation==='tags')x.stored.tagsByBookmark.A=['changed'];if(mutation==='url')x.find('A').url='https://changed.test/';if(mutation==='title')x.find('A').title='Changed';if(mutation==='missing')await x.api.bookmarks.remove('A');if(mutation==='survivor')groups[0].survivorId='absent';await assert.rejects(prepareDuplicateMerge(groups));
});
test('F02 over-limit tag union leaves metadata unchanged',async()=>{
  const rows=[bookmark('A'),bookmark('B')];const tags={A:Array.from({length:20},(_,i)=>'tag'+i),B:['extra']};const x=fakeBrowser([folder('P',rows)],{tagsByBookmark:tags});await assert.rejects(prepareDuplicateMerge(buildDuplicatePreview(rows,tags)),/limit/);assert.deepEqual(x.stored.tagsByBookmark,tags);
});
test('F04 views save/update/delete without stale bookmark projections and apply validated filters',async()=>{
  fakeBrowser([folder('P')]);const first=await saveSmartView({...view,allBookmarks:[{id:'secret'}]});await saveSmartView({...first,name:'Renamed'});
  const views=await loadSmartViews();assert.equal(views.length,1);assert.equal(views[0].name,'Renamed');assert.ok(!('allBookmarks' in first));
  const state={selectedIds:new Set(['old'])};applySmartView(first,state);assert.equal(state.mode,'library');assert.equal(state.query,'title:a');assert.deepEqual(state.activeTagFilter,['work']);assert.equal(state.selectedIds.size,0);await deleteSmartView(first.id);assert.equal((await loadSmartViews()).length,0);
});
for(const input of [{...view,name:''},{...view,sort:'random'},{...view,version:2},{...view,query:'x'.repeat(2001)}])test('F04 invalid view fails validation',()=>assert.throws(()=>validateSmartView(input)));
test('F04 simultaneous saves preserve both views and schema migration retains them',async()=>{
  const x=fakeBrowser([folder('P')],{storageSchemaVersion:6,healthCacheKeyVersion:2,tagsByBookmark:{},healthCache:{},custom:'keep'});await Promise.all([saveSmartView({...view,name:'One'}),saveSmartView({...view,name:'Two'})]);await ensureStorageSchema();assert.equal(x.stored.smartViews.length,2);assert.equal(x.stored.storageSchemaVersion,7);assert.equal(x.stored.custom,'keep');
});
for(const operation of ['add','remove','rename','merge'])test(`F05 ${operation} preview applies and Undo restores exact original tags`,async()=>{
  const x=fakeBrowser([folder('P',[bookmark('A')])],{tagsByBookmark:{A:['work','urgent']}});const preview=buildTagPreview([bookmark('A')],x.stored.tagsByBookmark,{operation,source:' Work ',target:' Project '});const result=await applyTagPreview(preview);assert.equal(result.changed,1);const undone=await applyTagPreview(result.applied,{undo:true});assert.equal(undone.changed,1);assert.deepEqual(x.stored.tagsByBookmark.A,['work','urgent']);
});
test('F05 stale preview, missing ID and Undo conflict are counted without overwriting edits',async()=>{
  const x=fakeBrowser([folder('P',[bookmark('A'),bookmark('B')])],{tagsByBookmark:{A:['work'],B:['work']}});const preview=buildTagPreview([bookmark('A'),bookmark('B')],x.stored.tagsByBookmark,{operation:'add',target:'new'});x.stored.tagsByBookmark.A=['concurrent'];await x.api.bookmarks.remove('B');const result=await applyTagPreview(preview);assert.equal(result.conflicting,1);assert.equal(result.missing,1);assert.equal(result.changed,0);assert.deepEqual(x.stored.tagsByBookmark.A,['concurrent']);
  x.stored.tagsByBookmark.A=['work'];const applied=await applyTagPreview(preview.slice(0,1));x.stored.tagsByBookmark.A=['another'];const undo=await applyTagPreview(applied.applied,{undo:true});assert.equal(undo.conflicting,1);assert.deepEqual(x.stored.tagsByBookmark.A,['another']);
});
test('F05 tag overflow rejects during preview',()=>assert.throws(()=>buildTagPreview([bookmark('A')],{A:Array.from({length:20},(_,i)=>'tag'+i)},{operation:'add',target:'extra'}),/limit/));
for(const policy of ['keep','skip','merge'])test(`F06 ${policy} policy handles existing and in-file matches with accurate outcomes`,async()=>{
  const x=fakeBrowser([folder('P',[bookmark('A')])],{tagsByBookmark:{A:['original']}});const items=[{title:'Existing',url:'https://example.test/',tags:['imported']},{title:'New',url:'https://new.test/',tags:['new']},{title:'Again',url:'https://new.test/',tags:['second']}];
  const preview=buildImportPreview(items,[bookmark('A')]);assert.equal(preview.matches,1);assert.equal(preview.repeated,1);assert.equal(x.calls.creates.length,0);
  const result=await importBookmarks(items,'P',{policy,validateDestination:true});assert.equal(result.failed,0);
  assert.equal(result.created,policy==='keep'?3:1);assert.equal(result.skipped,policy==='skip'?2:0);assert.equal(result.merged,policy==='merge'?2:0);
  assert.deepEqual(x.stored.tagsByBookmark.A,policy==='merge'?['original','imported']:['original']);
  if(policy==='merge'){const newId=result.operation.items.find(item=>item.id)?.id;assert.deepEqual(x.stored.tagsByBookmark[newId],['new','second']);}
});
test('F06 preview excludes unsafe URLs and execution rechecks newly created matches',async()=>{
  const x=fakeBrowser([folder('P')]);assert.equal(buildImportPreview([{url:'javascript:alert(1)'},{url:'https://a.test/'}],[]).excluded,1);
  const items=[{title:'A',url:'https://a.test/'}];const preview=buildImportPreview(items,[]);assert.equal(preview.matches,0);await x.api.bookmarks.create({parentId:'P',title:'Other',url:'https://a.test/'});const result=await importBookmarks(items,'P',{policy:'skip'});assert.equal(result.created,0);assert.equal(result.skipped,1);
});
test('F06 invalid policy and managed destination fail before import',async()=>{
  const x=fakeBrowser([{...folder('P'),unmodifiable:'managed'}]);await assert.rejects(importBookmarks([], 'P',{policy:'unknown'}));await assert.rejects(importBookmarks([], 'P',{validateDestination:true}));assert.equal(x.calls.creates.length,0);
});
for(const [name,text] of [['import.json',JSON.stringify([{url:'https://a.test/'},{url:'javascript:bad'}])],['import.csv','Title,URL\nA,https://a.test/\nBad,javascript:bad'],['import.txt','https://a.test/\njavascript:bad']])test(`F06 parser preview counts excluded input records in ${name}`,()=>{
  const result=parseImportedFilePreview(text,name);assert.equal(result.items.length,1);assert.equal(result.excluded,1);assert.equal(result.sourceCount,2);assert.match(result.warnings[0].message,/Excluded 1/);
});
test('F06 malformed JSON reports parse warning rather than pretending an empty valid file',()=>{const result=parseImportedFilePreview('{','import.json');assert.equal(result.items.length,0);assert.equal(result.warnings.length,1);});
test('F06 merged tag write failure reports failed without deleting existing identity',async()=>{
  const x=fakeBrowser([folder('P',[bookmark('A')])],{tagsByBookmark:{A:['original']}});x.failures.set=value=>'tagsByBookmark' in value;const result=await importBookmarks([{url:'https://example.test/',tags:['new']}],'P',{policy:'merge'});assert.equal(result.failed,1);assert.equal(result.merged,0);assert.ok(x.find('A'));assert.equal(x.calls.removes.length,0);
});
test('F07 field allowlist removes free text, URLs, IDs and nested secrets even under metric keys',()=>{
  const entries=[{id:'secret-id',scope:'https://private.test/',event:'secret-title',level:'error',ts:'2026-10-06',details:{count:3,failed:'https://private.test/',url:'private',message:'password',tags:['secret'],scanned:{url:'secret'},removed:true}}, {scope:'dashboard',event:'import_succeeded',ts:'https://private.test/',details:{count:Infinity,notAttempted:2}}];
  const redacted=redactDiagnosticEvents(entries);assert.equal(redacted[0].scope,'other');assert.deepEqual(redacted[0].metrics,{count:3,removed:true});assert.equal(redacted[1].ts,null);const text=JSON.stringify(redacted);for(const secret of ['private','secret','password','Infinity'])assert.ok(!text.includes(secret));
});
test('F08 registry exposes only explicitly labeled commands and runs existing handlers',async()=>{
  let called=0;const registry=createCommandRegistry({plain:()=>{},chosen:{label:'Saved views',run:()=>called++}});assert.deepEqual(registry.list(),[{name:'chosen',label:'Saved views'}]);await registry.run('chosen');assert.equal(called,1);await assert.rejects(registry.run('unknown'));
});
test('feature copy has explicit nonempty Persian translations rather than English copies',()=>{for(const [key,value] of Object.entries(FEATURE_MESSAGES)){assert.ok(value.trim());assert.notEqual(key,value);assert.match(value,/[\u0600-\u06ff]/);}});
test('F03 pause/resume checkpoints coverage independently of expired or cleared cache',async()=>{
  const x=fakeBrowser([folder('P')],{healthCacheKeyVersion:2});const job=await createScanJob([bookmark('A','https://a.test/'),bookmark('B','https://b.test/'),bookmark('C','https://c.test/')]);let calls=0;
  await runScanJob(job.id,{fetchHealth:async()=>({status:'healthy',checkedAt:Date.now()}),onProgress:async current=>{calls++;if(calls===1)await controlScanJob(current.id,'paused');}});
  assert.equal((await loadScanJob()).status,'paused');assert.equal(scanCoverage(await loadScanJob()).remaining,2);x.stored.healthCache={};
  const completed=await runScanJob(job.id,{fetchHealth:async()=>{calls++;return {status:'healthy',checkedAt:Date.now()};}});assert.equal(completed.status,'completed');assert.equal(calls,3);assert.equal(scanCoverage(completed).completed,3);
});
test('F03 denied permission, cancellation and empty scans prevent network work',async()=>{
  const x=fakeBrowser([folder('P')]);const job=await createScanJob([bookmark('A')]);x.api.permissionGranted=false;let calls=0;await assert.rejects(runScanJob(job.id,{fetchHealth:async()=>{calls++;}}),/permission/);assert.equal(calls,0);
  await controlScanJob(job.id,'canceled');x.api.permissionGranted=true;await assert.rejects(runScanJob(job.id,{fetchHealth:async()=>{calls++;}}),/canceled/);assert.equal(calls,0);await assert.rejects(createScanJob([{url:'javascript:bad'}]));
});
test('F03 cancellation during request does not checkpoint or resurrect a canceled job',async()=>{
  fakeBrowser([folder('P')],{healthCacheKeyVersion:2});const job=await createScanJob([bookmark('A')]);const result=await runScanJob(job.id,{fetchHealth:async()=>{await controlScanJob(job.id,'canceled');return {status:'healthy',checkedAt:Date.now()};}});assert.equal(result.status,'canceled');assert.equal(result.completed.length,0);
});
test('F03 storage/request failure leaves retryable progress; successful targets do not repeat',async()=>{
  fakeBrowser([folder('P')],{healthCacheKeyVersion:2});const job=await createScanJob([bookmark('A','https://a.test/'),bookmark('B','https://b.test/')]);await assert.rejects(runScanJob(job.id,{fetchHealth:async url=>{if(url.includes('b.test'))throw new Error('interrupted');return {status:'healthy',checkedAt:Date.now()};}}),/interrupted/);assert.equal((await loadScanJob()).completed.length,1);let calls=0;await runScanJob(job.id,{fetchHealth:async()=>{calls++;return {status:'healthy',checkedAt:Date.now()};}});assert.equal(calls,1);
});
test('F03 origin execution lock rejects competing runs and new jobs',async()=>{
  fakeBrowser([folder('P')],{healthCacheKeyVersion:2});const job=await createScanJob([bookmark('A')]);let release,started;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve);const running=runScanJob(job.id,{fetchHealth:async()=>{started();await gate;return {status:'healthy',checkedAt:Date.now()};}});await ready;
  await assert.rejects(runScanJob(job.id,{fetchHealth:async()=>null}),/already/);await assert.rejects(createScanJob([bookmark('B')]),/already/);release();await running;
});
