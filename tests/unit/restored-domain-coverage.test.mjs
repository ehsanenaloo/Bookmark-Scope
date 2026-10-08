// Rebuilt from current contracts and changelog areas; not the lost original suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliseTag,normaliseTagList,setTagsForBookmark,addTagToBookmark,removeTagFromBookmark,summariseTags,filterBookmarksByTags,pruneOrphanedTags } from '../../extension/src/services/tag-service.js';
import { fuzzyScore,fuzzySearchBookmarks } from '../../extension/src/core/fuzzy-match.js';
import { searchScopedBookmarks } from '../../extension/src/core/bookmark-utils.js';
import { buildDashboardContextUrl,parseDashboardContextParams,CONTEXT_MENU_ACTIONS } from '../../extension/src/services/context-menu-service.js';
import { computeNextReviewTimestamp,scheduleReviewReminderAlarm } from '../../extension/src/services/review-reminder-service.js';
import { createSelectionTools } from '../../extension/src/dashboard/selection-tools.js';
import { createLogger,awaitPendingDiagnosticWrites } from '../../extension/src/services/diagnostics-service.js';
import { fakeBrowser,folder,leaf } from '../helpers/browser.mjs';
for(const [raw,expected] of [[null,null],[42,null],['',null],['   ',null],[' Work ','work'],['a\n b','a b'],['a\u0000b','ab'],['x'.repeat(33),null],['x'.repeat(32),'x'.repeat(32)],['ab\u200bcd','abcd']])test(`tag normalization ${JSON.stringify(raw)}`,()=>assert.equal(normaliseTag(raw),expected));
test('tag lists dedupe, normalize and cap at 20',()=>{
  assert.deepEqual(normaliseTagList(['Work',' work ','urgent',null]),['work','urgent']);assert.equal(normaliseTagList(Array.from({length:30},(_,i)=>'tag'+i)).length,20);
});
test('tag mutations are pure and remove empty entries',()=>{
  const original={A:['work']};const result=addTagToBookmark(original,'A','urgent');assert.deepEqual(original,{A:['work']});assert.deepEqual(result.map.A,['work','urgent']);assert.equal(addTagToBookmark(original,'A','WORK').added,false);assert.deepEqual(removeTagFromBookmark(original,'A','work').map,{});
});
test('tag aggregation, AND filtering and orphan pruning compose',()=>{
  const map={A:['work','urgent'],B:['work'],missing:['work']};const items=[{id:'A'},{id:'B'}];
  assert.deepEqual(filterBookmarksByTags(items,map,['work','urgent']).map(item=>item.id),['A']);assert.equal(summariseTags(map)[0].count,3);assert.equal(pruneOrphanedTags(map,items).removed,1);
});
test('tag setters reject scalar input and preserve unrelated IDs',()=>assert.deepEqual(setTagsForBookmark({B:['keep']},'A','invalid'),{B:['keep']}));
for(const [query,text,match] of [['git','GitHub',true],['gh','GitHub',true],['zzz','GitHub',false],['','GitHub',false],['git','',false]])test(`fuzzy subsequence ${query}/${text}`,()=>assert.equal(fuzzyScore(query,text).score>0,match));
test('fuzzy ranking favors precise title matches',()=>{
  const items=[{id:'1',title:'GitHub',url:'https://github.com/',path:''},{id:'2',title:'Other',url:'https://x.test/github',path:''}];assert.equal(fuzzySearchBookmarks('github',items)[0].bookmark.id,'1');
});
test('fuzzy rescue respects cleanup and tag restrictions and never rescues explicit operators',()=>{
  const items=[{id:'A',title:'GitHub',url:'https://a.test/',path:'',parsed:{hostname:'a.test'},isDuplicate:true},{id:'B',title:'GitHub',url:'https://b.test/',path:'',parsed:{hostname:'b.test'},isDuplicate:false}];
  const result=searchScopedBookmarks(items,'gh',{duplicatesOnly:true,tagsByBookmark:{A:['work'],B:['work']},requiredTags:['work']});assert.deepEqual(result.items.map(item=>item.id),['A']);assert.equal(result.fuzzy,true);assert.equal(searchScopedBookmarks(items,'title:gh').items.length,0);
});
for(const action of Object.values(CONTEXT_MENU_ACTIONS))test(`context-menu round trip ${action}`,()=>{
  const url='https://example.test:8443/a?x=1&y=2#frag';const built=buildDashboardContextUrl(action,url);assert.deepEqual(parseDashboardContextParams(built.slice(built.indexOf('?'))),{action,url});
});
for(const url of ['javascript:alert(1)','file:///a','invalid'])test(`context parameters reject unsafe target ${url}`,()=>assert.equal(parseDashboardContextParams('?cm=show-domain&url='+encodeURIComponent(url)).url,''));
test('unknown context action is ignored',()=>assert.equal(parseDashboardContextParams('?cm=unknown'),null));
for(const [settings,now,expected] of [
  [{enabled:false},100,0],
  [{enabled:true,intervalDays:14,lastReviewAt:100},200,100+14*86400000],
  [{enabled:true,intervalDays:14,nextReviewAt:42},200,42],
  [{enabled:true,intervalDays:1},200,200+86400000]
])test(`review next date ${JSON.stringify(settings)}`,()=>assert.equal(computeNextReviewTimestamp(settings,now),expected));
test('disabled reminder clears alarm; overdue reminder schedules after one minute',async()=>{
  const x=fakeBrowser();await scheduleReviewReminderAlarm({enabled:false},100);assert.equal(x.calls.alarms.length,0);await scheduleReviewReminderAlarm({enabled:true,nextReviewAt:42,intervalDays:14},100);assert.equal(x.calls.alarms[0].when,60100);
});
test('selection cleanup and range toggles keep only known IDs',()=>{
  const state={selectedIds:new Set(['missing']),visibleBookmarks:[{id:'A'},{id:'B'}]};const selection=createSelectionTools({state,render(){}});selection.cleanupSelection();assert.equal(state.selectedIds.size,0);selection.selectAllVisible();assert.equal(selection.getSelectedCount(),2);selection.toggleBookmarkSelection('A');assert.deepEqual(selection.getSelectedBookmarks().map(item=>item.id),['B']);
});
test('independent diagnostics contexts retain both event batches',async()=>{
  const x=fakeBrowser();const other=await import('../../extension/src/services/diagnostics-service.js?other-page');
  createLogger('one').info('first');other.createLogger('two').warn('second');await Promise.all([awaitPendingDiagnosticWrites(),other.awaitPendingDiagnosticWrites()]);assert.equal(x.stored.diagnosticEvents.length,2);assert.deepEqual(new Set(x.stored.diagnosticEvents.map(item=>item.event)),new Set(['first','second']));
});
