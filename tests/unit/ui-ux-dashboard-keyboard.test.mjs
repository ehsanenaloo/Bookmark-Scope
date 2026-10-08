import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { KEYBOARD_SHORTCUTS,MATCH_MODES } from '../../extension/src/core/constants.js';

function fixture(){
  const source=fs.readFileSync(new URL('../../extension/pages/dashboard/dashboard.js',import.meta.url),'utf8');
  const editable=source.slice(source.indexOf('function isEditableTarget('),source.indexOf('function getExportItems('));
  const shortcuts=source.slice(source.indexOf('function attachKeyboardShortcuts('),source.indexOf('const commands ='));
  let handler;const calls=[];const state={visibleBookmarks:[{id:'A',url:'https://A.test/'}],selectedIds:new Set()};
  const context=vm.createContext({state,KEYBOARD_SHORTCUTS,MATCH_MODES,document:{querySelector(){return null;},addEventListener(type,fn){handler=fn;}},featureTools:{isDialogOpen:()=>false,showPalette(){calls.push('palette');}},render(){calls.push('render');},selectAllVisible(){calls.push('selectAll');},getActiveBookmark:()=>state.visibleBookmarks[0],handleOpen:async()=>calls.push('open'),moveActiveBookmark:()=>calls.push('move'),toggleBookmarkSelection:()=>calls.push('select'),handleDeleteMany:async()=>calls.push('delete'),getSelectedBookmarks:()=>[],savePreferences:async()=>{},recalculateVisibleBookmarks(){}});
  vm.runInContext(editable+shortcuts+';attachKeyboardShortcuts();',context);
  return {calls,async press(key,{interactive=false,editable=false,...mods}={}){const target={tagName:editable?'INPUT':'DIV',isContentEditable:false,closest:()=>interactive?{}:null};const event={key,target,prevented:false,preventDefault(){this.prevented=true;},...mods};await handler(event);return event;}};
}

test('native controls retain Enter, Space, arrows and Delete without bookmark side effects',async()=>{const f=fixture();for(const key of ['Enter',' ','ArrowDown','ArrowUp','Delete']){const event=await f.press(key,{interactive:true});assert.equal(event.prevented,false,key);}assert.deepEqual(f.calls,[]);});
test('row keyboard commands remain available away from controls',async()=>{const f=fixture();assert.equal((await f.press('Enter')).prevented,true);assert.equal((await f.press('ArrowDown')).prevented,true);assert.equal((await f.press(' ')).prevented,true);assert.deepEqual(f.calls,['open','move','render','select']);});
test('input typing and modified/prevented Enter never open a bookmark',async()=>{const f=fixture();await f.press('Enter',{editable:true});await f.press('Enter',{ctrlKey:true});await f.press('Enter',{defaultPrevented:true});assert.deepEqual(f.calls,[]);});
test('command palette shortcut retains explicit activation from a native control',async()=>{const f=fixture();const event=await f.press('P',{interactive:true,ctrlKey:true,shiftKey:true});assert.equal(event.prevented,true);assert.deepEqual(f.calls,['palette']);});
