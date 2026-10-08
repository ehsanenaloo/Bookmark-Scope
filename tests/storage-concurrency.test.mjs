import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeBrowser, folder, leaf, deferred } from './helpers/browser.mjs';
import { getNormalizedBookmarks, invalidateBookmarkCache } from '../extension/src/bookmark-utils.js';
import { ensureStorageSchema } from '../extension/src/services/storage-schema.js';
import { updateTagsMap, addTagToBookmark, removeTagsForBookmark } from '../extension/src/services/tag-service.js';
import { writeHealthRecord, loadHealthCache, clearHealthCache, getHealthCacheGeneration, awaitPendingHealthWrites, _resetHealthCacheServiceForTesting, _internals } from '../extension/src/services/health-cache-service.js';

test('invalidating an outstanding tree read prevents stale publication and return',async()=>{
  const x=fakeBrowser([folder('P',[leaf('old')])]);const pending=deferred();let reads=0;
  x.api.bookmarks.getTree=async()=>{reads++;return reads===1?pending.promise:[folder('P',[leaf('fresh')])];};
  const result=getNormalizedBookmarks();invalidateBookmarkCache();pending.resolve([folder('P',[leaf('old')])]);
  assert.equal((await result)[0].id,'fresh');assert.equal((await getNormalizedBookmarks())[0].id,'fresh');assert.equal(reads,2);
});
test('schema migration invalidates ambiguous health keys but preserves bookmarks, tags, unknown keys and preferences',async()=>{
  const x=fakeBrowser([folder('P',[leaf('A')])],{storageSchemaVersion:5,healthCache:{ambiguous:{status:'healthy'}},tagsByBookmark:{A:['work']},ignoreQueryString:true,custom:'keep'});
  const results=await Promise.all([ensureStorageSchema(),ensureStorageSchema()]);
  assert.equal(x.stored.storageSchemaVersion,7);assert.deepEqual(x.stored.healthCache,{});assert.deepEqual(x.stored.tagsByBookmark,{A:['work']});assert.equal(x.stored.custom,'keep');assert.equal(x.stored.ignoreQueryString,true);assert.equal(results.filter(r=>r.migrated).length,1);
});
test('independent tag service instances preserve simultaneous updates',async()=>{
  const x=fakeBrowser([folder('P',[leaf('A'),leaf('B')])]);
  const other=await import('../extension/src/services/tag-service.js?second-page');
  await Promise.all([updateTagsMap(map=>addTagToBookmark(map,'A','work').map),other.updateTagsMap(map=>other.addTagToBookmark(map,'B','urgent').map)]);
  assert.deepEqual(x.stored.tagsByBookmark,{A:['work'],B:['urgent']});
});
test('same bookmark concurrent tag additions merge and deleted IDs cannot be resurrected',async()=>{
  const x=fakeBrowser([folder('P',[leaf('A')])]);
  await Promise.all(['one','two'].map(tag=>updateTagsMap(map=>addTagToBookmark(map,'A',tag).map)));
  assert.deepEqual(x.stored.tagsByBookmark.A,['one','two']);
  await x.api.bookmarks.remove('A');await updateTagsMap(map=>addTagToBookmark(map,'A','stale').map);assert.deepEqual(x.stored.tagsByBookmark,{});
});
test('clear orders behind an in-flight write and rejects late results from the old generation',async()=>{
  const x=fakeBrowser([],{healthCacheKeyVersion:2});_resetHealthCacheServiceForTesting();
  const entered=deferred(),release=deferred();const original=x.api.storage.local.set;
  x.api.storage.local.set=async values=>{if(values.healthCache?.old){entered.resolve();await release.promise;}return original(values);};
  const generation=await getHealthCacheGeneration();const write=writeHealthRecord('old',{checkedAt:Date.now(),status:'healthy'},generation);
  await entered.promise;const clearing=clearHealthCache();release.resolve();await write;await clearing;
  assert.deepEqual(await loadHealthCache(),{});
  assert.equal(await writeHealthRecord('late',{checkedAt:Date.now()},generation),false);
  assert.equal(await writeHealthRecord('fresh',{checkedAt:Date.now()},await getHealthCacheGeneration()),true);
  assert.deepEqual(Object.keys(await loadHealthCache()),['fresh']);
});
test('another context reset also rejects an old worker result',async()=>{
  const x=fakeBrowser([],{healthCacheKeyVersion:2});_resetHealthCacheServiceForTesting();
  const worker=await import('../extension/src/services/health-cache-service.js?worker');const generation=await getHealthCacheGeneration();
  await worker.writeHealthRecord('a',{checkedAt:Date.now()},generation);await clearHealthCache();
  assert.equal(await worker.writeHealthRecord('b',{checkedAt:Date.now()},generation),false);assert.deepEqual(x.stored.healthCache,{});
});
test('independent health writers preserve disjoint results',async()=>{
  const x=fakeBrowser([],{healthCacheKeyVersion:2});_resetHealthCacheServiceForTesting();
  const other=await import('../extension/src/services/health-cache-service.js?other-worker');
  await Promise.all([writeHealthRecord('A',{checkedAt:Date.now()}),other.writeHealthRecord('B',{checkedAt:Date.now()})]);
  assert.deepEqual(Object.keys(x.stored.healthCache).sort(),['A','B']);
});
test('health persistence failure is observable and a subsequent successful write recovers',async()=>{
  const x=fakeBrowser([],{healthCacheKeyVersion:2});_resetHealthCacheServiceForTesting();x.failures.set=()=>true;
  await assert.rejects(writeHealthRecord('a',{checkedAt:Date.now()}),/injected/);await assert.rejects(awaitPendingHealthWrites(),/injected/);
  x.failures.set=null;await writeHealthRecord('b',{checkedAt:Date.now()});await awaitPendingHealthWrites();assert.ok(x.stored.healthCache.b);
});
test('TTL and overflow eviction keep fresh records',()=>{
  assert.deepEqual(_internals._stripExpired({old:{checkedAt:1},fresh:{checkedAt:99}},10,100),{fresh:{checkedAt:99}});
  const records=Object.fromEntries(Array.from({length:5001},(_,i)=>[String(i),{checkedAt:i}]));const kept=_internals._evictIfOverLimit(records);
  assert.equal(Object.keys(kept).length,4500);assert.ok(kept['5000']);assert.equal(kept['0'],undefined);
});
