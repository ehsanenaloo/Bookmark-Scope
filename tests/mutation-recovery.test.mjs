import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionTools } from '../src/dashboard/action-tools.js';
import { createBookmark,removeBookmark,moveBookmark } from '../src/platform/browser-api.js';
import { fakeBrowser, leaf, folder } from './helpers/browser.mjs';
import { planBatchMove } from '../src/dashboard/drag-drop-logic.js';

function setup(tree,stored={}) {
  const browser=fakeBrowser(tree,stored);const toasts=[],history=[];
  const state={allBookmarks:[],tagsByBookmark:{},visibleBookmarks:[]};
  const tools=createActionTools({state,t:(s,vars={})=>s.replace(/\{\{(.*?)\}\}/g,(_,k)=>vars[k] ?? k),formatNumber:String,sendMessage:async()=>{},showConfirmDialog:async()=>true,setToast:(message,options={})=>toasts.push({message,...options}),refreshData:async()=>{},renderListOnly(){},pushCleanupHistory:async e=>history.push(e),invalidateBookmarkCache(){},createBookmark,removeBookmark,moveBookmark,deselectBookmarks(){}});
  return {...browser,state,tools,toasts,history};
}
test('cross-folder insertion includes folder siblings rather than the leaf-only state',async()=>{
  const x=setup([folder('P',[folder('F'),leaf('A'),leaf('B')]),folder('Q',[leaf('X')])]);
  x.state.allBookmarks=[x.find('A'),x.find('B'),x.find('X')];
  await x.tools.handleDragDropMove([x.find('X')],x.find('B'),'before');
  assert.deepEqual(x.find('P').children.map(n=>n.id),['F','A','X','B']);
  await x.toasts.at(-1).action();
  assert.deepEqual(x.find('Q').children.map(n=>n.id),['X']);
});
for(const position of ['before','after'])for(const sourceIds of [['A'],['A','C'],['C','A'],['A','B','C']])test(`mixed sibling batch ${sourceIds} ${position}`,async()=>{
  const x=setup([folder('P',[leaf('A'),folder('F'),leaf('B'),leaf('C'),leaf('T')])]);
  const before=x.find('P').children.map(n=>n.id);
  const sources=sourceIds.map(id=>structuredClone(x.find(id)));
  await x.tools.handleDragDropMove(sources,x.find('T'),position);
  const remaining=before.filter(id=>!sourceIds.includes(id));const at=remaining.indexOf('T')+(position==='after'?1:0);remaining.splice(at,0,...sourceIds);
  assert.deepEqual(x.find('P').children.map(n=>n.id),remaining);
  if(x.toasts.at(-1)?.action)await x.toasts.at(-1).action();
  assert.deepEqual(x.find('P').children.map(n=>n.id),before);
});
for(const failAt of [0,1,2])test(`partial move failure at ${failAt} recovers only applied steps`,async()=>{
  const x=setup([folder('P',[folder('F'),leaf('T')]),folder('Q',[leaf('A'),leaf('B'),leaf('C')])]);
  x.failures.move.add(['A','B','C'][failAt]);
  await x.tools.handleDragDropMove(['A','B','C'].map(id=>structuredClone(x.find(id))),x.find('T'),'before');
  if(failAt){const undo=x.toasts.at(-1).action;await undo();await undo();assert.deepEqual(new Set(x.calls.moves.slice(failAt+1).map(n=>n.id)),new Set(['A','B'].slice(0,failAt)));}
  assert.deepEqual(x.find('Q').children.map(n=>n.id),['A','B','C']);
});
test('failed Undo remains retryable and successful steps are not repeated',async()=>{
  const x=setup([folder('P',[leaf('T')]),folder('Q',[leaf('A'),leaf('B')])]);
  await x.tools.handleDragDropMove(['A','B'].map(id=>structuredClone(x.find(id))),x.find('T'),'before');
  x.failures.move.add('B');await x.toasts.at(-1).action();
  assert.equal(x.find('A').parentId,'Q');assert.equal(x.find('B').parentId,'P');
  x.failures.move.clear();await x.toasts.at(-1).action();assert.equal(x.find('B').parentId,'Q');
  assert.deepEqual(x.find('Q').children.map(node=>node.id),['A','B']);
});
for(const failedId of ['A','B'])test(`Undo restores canonical sibling order after ${failedId} failed on the first recovery attempt`,async()=>{
  const x=setup([folder('P',[leaf('T')]),folder('Q',[leaf('A'),leaf('B'),leaf('C')])]);
  await x.tools.handleDragDropMove(['A','B'].map(id=>structuredClone(x.find(id))),x.find('T'),'before');
  x.failures.move.add(failedId);await x.toasts.at(-1).action();x.failures.move.clear();await x.toasts.at(-1).action();
  assert.deepEqual(x.find('Q').children.map(node=>node.id),['A','B','C']);
});
test('partial deletion offers Undo, preserves tags and never duplicates the failed survivor',async()=>{
  const x=setup([folder('P',[leaf('A'),folder('F'),leaf('B')])],{tagsByBookmark:{A:['work'],B:['keep']}});
  x.failures.remove.add('B');const result=await x.tools.handleDeleteMany([x.find('A'),x.find('B')],{skipConfirm:true});
  assert.deepEqual(result,{deleted:1,failed:1});assert.ok(x.toasts.at(-1).action);assert.equal(x.history.at(-1).count,1);
  const undo=x.toasts.at(-1).action;await undo();await undo();
  assert.equal(x.calls.creates.length,1);assert.equal(x.find('P').children[0].title,'A');assert.equal(x.find('P').children[2].id,'B');
  assert.deepEqual(x.stored.tagsByBookmark[x.find('P').children[0].id],['work']);
});
test('tag persistence failure during delete recovery retries metadata without recreating a bookmark',async()=>{
  const x=setup([folder('P',[leaf('A')])],{tagsByBookmark:{A:['work']}});
  await x.tools.handleDeleteMany([x.find('A')],{skipConfirm:true});
  x.failures.set=values=>'tagsByBookmark' in values;await x.toasts.at(-1).action();assert.equal(x.calls.creates.length,1);
  x.failures.set=null;await x.toasts.at(-1).action();assert.equal(x.calls.creates.length,1);assert.deepEqual(x.stored.tagsByBookmark['created-1'],['work']);
});
test('delete restoration preserves sibling order with intervening folders',async()=>{
  const x=setup([folder('P',[leaf('A'),folder('F'),leaf('B'),leaf('C')])]);
  await x.tools.handleDeleteMany(['A','B','C'].map(id=>structuredClone(x.find(id))),{skipConfirm:true});await x.toasts.at(-1).action();
  assert.deepEqual(x.find('P').children.map(n=>n.title),['A','F','B','C']);
});
test('retrying a failed early delete recovery restores ordering around surviving siblings',async()=>{
  const x=setup([folder('P',[leaf('A'),leaf('B'),leaf('C'),leaf('D')])]);
  await x.tools.handleDeleteMany(['A','B'].map(id=>structuredClone(x.find(id))),{skipConfirm:true});
  x.failures.create.add('https://A.test/');await x.toasts.at(-1).action();
  assert.deepEqual(x.find('P').children.map(node=>node.title),['B','C','D']);
  x.failures.create.clear();await x.toasts.at(-1).action();assert.deepEqual(x.find('P').children.map(node=>node.title),['A','B','C','D']);
});
test('planner no-op and invalid target produce no operations',()=>{
  const children=[{id:'A',parentId:'P',index:0},{id:'F',parentId:'P',index:1},{id:'B',parentId:'P',index:2}];
  assert.deepEqual(planBatchMove([children[0]],children[0],'before',children),[]);
  assert.equal(planBatchMove([children[0]],children[2],'before',children)[0].index,1);
});
