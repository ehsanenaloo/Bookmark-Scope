import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as constants from '../../extension/src/core/constants.js';
import { OPTION_PAGE_DEFAULTS } from '../../extension/src/services/storage-schema.js';
import { trapFocus } from '../../extension/src/ui/ui-utils.js';

// Explicit DOM bindings exercise the real page functions without a browser.
function optionsFixture() {
  class Select {
    constructor() { this.options=[];this.chosen=''; }
    set textContent(value) { this.options=[];this.chosen=''; }
    get value() { return this.chosen; }
    set value(value) { this.chosen=this.options.some(option=>option.value===value)?value:''; }
    append(option) { this.options.push(option);if(this.options.length===1)this.chosen=option.value; }
  }
  const elements=new Map();
  const ids=['default-mode','default-sort','popup-width','theme-mode','color-palette','locale-preference','merge-strategy'];
  for(const id of ids)elements.set(id,new Select());
  for(const id of ['settings-form','ignore-query','ignore-hash','bg-scan-enabled','bg-scan-interval','bg-scan-status','review-reminder-enabled','review-reminder-interval','reset-defaults','status'])elements.set(id,{checked:false,value:'',textContent:''});
  const stored={...OPTION_PAGE_DEFAULTS};const writes=[];let rejectWrite=false;
  let bgSettings={enabled:false,intervalDays:7};
  let reminder={enabled:false,intervalDays:14,lastReviewAt:0,nextReviewAt:0};const reminderWrites=[];const clock=1_700_000_000_000;
  const context=vm.createContext({
    ...constants,OPTION_PAGE_DEFAULTS,AUTO_LOCALE:'auto',
    document:{getElementById:id=>elements.get(id),createElement:()=>({value:'',textContent:''}),body:{}},
    window:{clearTimeout(){},setTimeout(){return 1;}},
    createLogger:()=>({info:async()=>{}}),
    initializeStorageLayer:async()=>({migrated:false,previousVersion:7}),
    getLocalStorage:async()=>({...stored}),
    setLocalStorage:async values=>{if(rejectWrite)throw new Error('storage write failed');writes.push({...values});Object.assign(stored,values);},
    setStoredLocalePreference:async value=>{stored[constants.STORAGE_KEYS.LOCALE_PREFERENCE]=value;},
    initI18n:async()=>{},t:text=>text,translateTree(){},
    getLocaleOptions:()=>[{value:'en',label:'English'},{value:'fa',label:'Persian'}],
    applyTheme(){},applyPalette(){},
    loadBgHealthScanSettings:async()=>({...bgSettings}),
    saveBgHealthScanSettings:async values=>{bgSettings={...bgSettings,...values};},
    containsPermissions:async()=>true,requestPermissions:async()=>true,
    DAY_MS:86_400_000,now:()=>clock,
    getReviewReminderSettings:async()=>({...reminder}),
    saveReviewReminderPreferences:async values=>{reminderWrites.push({...values});reminder={...reminder,...values};}
  });
  let source=fs.readFileSync(new URL('../../extension/pages/options/options.js',import.meta.url),'utf8');
  source=source.slice(0,source.indexOf("el.form.addEventListener('submit'"));
  source=source.replace(/import[\s\S]*?from\s+['"][^'"]+['"];?/g,'');
  const actions=vm.runInContext(source+';({load,save});',context);
  return {actions,elements,stored,writes,reminderWrites,clock,getReminder:()=>reminder,setReminder(values){reminder={...reminder,...values};},rejectWrites(){rejectWrite=true;}};
}

test('options repeated Save preserves all select choices across localized option rebuilding',async()=>{
  const fixture=optionsFixture();await fixture.actions.load();
  const choices={'default-mode':'host','default-sort':'oldest','popup-width':'compact','theme-mode':'dark','color-palette':'neutral','locale-preference':'fa','merge-strategy':'keep-oldest'};
  for(const [id,value] of Object.entries(choices))fixture.elements.get(id).value=value;
  await fixture.actions.save({preventDefault(){}});
  for(const [id,value] of Object.entries(choices))assert.equal(fixture.elements.get(id).value,value,id);
  await fixture.actions.save({preventDefault(){}});
  assert.deepEqual(fixture.writes[1],fixture.writes[0]);
  assert.equal(fixture.stored[constants.STORAGE_KEYS.LOCALE_PREFERENCE],'fa');
  assert.equal(fixture.stored[constants.STORAGE_KEYS.THEME_MODE],'dark');
});

test('options failed persistence retains the chosen form values for explicit retry',async()=>{
  const fixture=optionsFixture();await fixture.actions.load();
  fixture.elements.get('theme-mode').value='dark';fixture.elements.get('locale-preference').value='fa';fixture.rejectWrites();
  await assert.rejects(fixture.actions.save({preventDefault(){}}),/storage write failed/);
  assert.equal(fixture.elements.get('theme-mode').value,'dark');
  assert.equal(fixture.elements.get('locale-preference').value,'fa');
  assert.equal(fixture.writes.length,0);
});

function focusFixture() {
  const listeners=new Map();
  const doc={activeElement:null,addEventListener(type,handler){const handlers=listeners.get(type)||new Set();handlers.add(handler);listeners.set(type,handlers);},removeEventListener(type,handler){listeners.get(type)?.delete(handler);}};
  function dispatch(type,event){for(const handler of [...(listeners.get(type)||[])])handler(event);}
  function node(name,{disabled=false,type='button',tabIndex=0,hidden=false}={}){
    const attributes=new Map();
    return {name,ownerDocument:doc,disabled,type,tabIndex,children:[],
      closest(selector){return hidden&&selector==='[hidden]'?{}:null;},
      focus(){doc.activeElement=this;dispatch('focusin',{target:this});},
      contains(target){return target===this || this.children.some(child=>child.contains(target));},
      querySelectorAll(){return this.children;},
      getAttribute(key){return attributes.get(key)??null;},
      setAttribute(key,value){attributes.set(key,value);},removeAttribute(key){attributes.delete(key);}
    };
  }
  const body=node('body');doc.activeElement=body;
  const tab=(shiftKey=false)=>{const event={key:'Tab',shiftKey,prevented:false,preventDefault(){this.prevented=true;}};dispatch('keydown',event);return event;};
  return {doc,node,body,tab,dispatch,listeners};
}

test('modal traps Tab after async disabling moves focus to body and rejects outside focus',()=>{
  const f=focusFixture();const modal=f.node('modal'),close=f.node('close'),apply=f.node('apply');modal.children=[close,apply];
  const release=trapFocus(modal);assert.equal(f.doc.activeElement,close);
  apply.focus();apply.disabled=true;f.doc.activeElement=f.body;
  assert.equal(f.tab().prevented,true);assert.equal(f.doc.activeElement,close);
  apply.disabled=false;f.doc.activeElement=f.body;
  assert.equal(f.tab(true).prevented,true);assert.equal(f.doc.activeElement,apply);
  f.body.focus();assert.equal(f.doc.activeElement,close);
  release();f.body.focus();assert.equal(f.doc.activeElement,f.body);
  assert.equal(f.listeners.get('keydown').size,0);assert.equal(f.listeners.get('focusin').size,0);
});

test('modal cycles endpoints and focuses container when all controls are unavailable',()=>{
  const f=focusFixture();const modal=f.node('modal'),first=f.node('first'),last=f.node('last'),hidden=f.node('hidden',{hidden:true});modal.children=[first,last,hidden];
  const release=trapFocus(modal);
  assert.equal(f.tab(true).prevented,true);assert.equal(f.doc.activeElement,last);
  assert.equal(f.tab().prevented,true);assert.equal(f.doc.activeElement,first);
  first.disabled=true;last.disabled=true;f.doc.activeElement=f.body;
  assert.equal(f.tab().prevented,true);assert.equal(f.doc.activeElement,modal);assert.equal(modal.getAttribute('tabindex'),'-1');
  release();assert.equal(modal.getAttribute('tabindex'),null);
});

test('newest modal owns focus until its trap is released without competing redirections',()=>{
  const f=focusFixture();const outer=f.node('outer'),outerButton=f.node('outer button'),inner=f.node('inner'),innerButton=f.node('inner button');outer.children=[outerButton];inner.children=[innerButton];
  const releaseOuter=trapFocus(outer),releaseInner=trapFocus(inner);
  assert.equal(f.doc.activeElement,innerButton);
  outerButton.focus();assert.equal(f.doc.activeElement,innerButton);
  releaseInner();f.body.focus();assert.equal(f.doc.activeElement,outerButton);
  releaseOuter();f.body.focus();assert.equal(f.doc.activeElement,f.body);
});

test('options review reminders: enabling schedules the next review, repeated Save keeps it, disabling clears it',async()=>{
  const fixture=optionsFixture();await fixture.actions.load();
  assert.equal(fixture.elements.get('review-reminder-enabled').checked,false);
  assert.equal(fixture.elements.get('review-reminder-interval').value,'14');
  fixture.elements.get('review-reminder-enabled').checked=true;fixture.elements.get('review-reminder-interval').value='30';
  await fixture.actions.save({preventDefault(){}});
  const first=fixture.getReminder();
  assert.equal(first.enabled,true);assert.equal(first.intervalDays,30);assert.equal(first.nextReviewAt,fixture.clock+30*86_400_000);
  await fixture.actions.save({preventDefault(){}});
  assert.equal(fixture.getReminder().nextReviewAt,first.nextReviewAt,'a second Save must not move the schedule');
  fixture.elements.get('review-reminder-enabled').checked=false;
  await fixture.actions.save({preventDefault(){}});
  assert.equal(fixture.getReminder().enabled,false);assert.equal(fixture.getReminder().nextReviewAt,0);
});

test('options review reminders: interval is clamped and a changed interval re-anchors on the last review',async()=>{
  const fixture=optionsFixture();
  fixture.setReminder({enabled:true,intervalDays:14,lastReviewAt:fixture.clock-2*86_400_000,nextReviewAt:fixture.clock+12*86_400_000});
  await fixture.actions.load();
  fixture.elements.get('review-reminder-interval').value='9999';
  await fixture.actions.save({preventDefault(){}});
  const saved=fixture.getReminder();
  assert.equal(saved.intervalDays,365);
  assert.equal(saved.nextReviewAt,fixture.clock-2*86_400_000+365*86_400_000);
  assert.equal(fixture.elements.get('review-reminder-interval').value,'365');
});
