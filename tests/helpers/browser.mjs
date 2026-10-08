import { setChromeApiForTesting, _resetBrowserDetectionForTesting } from '../../extension/src/platform/browser-api.js';
import { invalidateBookmarkCache } from '../../extension/src/core/bookmark-utils.js';

export function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return { promise, resolve, reject }; }
// `semantics` selects how the fake interprets bookmarks.move for a same-parent
// forward move, matching the real engines (verified with Chromium 141 and
// Firefox 157): 'chromium' (default) treats the index as a PRE-removal index,
// 'firefox' treats it as the FINAL index.
export function fakeBrowser(children = [], initialStorage = {}, { semantics = 'chromium' } = {}) {
  if (semantics !== 'chromium' && semantics !== 'firefox') throw new Error('Unknown move semantics: ' + semantics);
  const stored = structuredClone(initialStorage);
  const root = { id:'0', title:'', children: structuredClone(children) };
  const calls = { creates:[], removes:[], moves:[], alarms:[], cleared:[], notifications:[], listeners:{} };
  const failures = { create:new Set(), remove:new Set(), move:new Set(), set:null };
  let createdCounter=0;
  const event = name => ({ addListener(fn){ (calls.listeners[name] ||= []).push(fn); }, removeListener(){} });
  function indexTree(node=root) { (node.children || []).forEach((child,index)=>{child.parentId=node.id;child.index=index;indexTree(child);}); }
  function find(id,node=root) { if(node.id===String(id))return node; for(const child of node.children || []) { const result=find(id,child); if(result)return result; } }
  indexTree();
  const api={
    storage:{local:{async get(keys){if(keys===null)return structuredClone(stored);const result={};for(const key of Array.isArray(keys)?keys:[keys])if(key in stored)result[key]=structuredClone(stored[key]);return result;},async set(values){if(failures.set?.(values))throw Error('injected storage failure');Object.assign(stored,structuredClone(values));}},onChanged:event('storage')},
    bookmarks:{async getTree(){return structuredClone([root]);},async create(details){calls.creates.push(details);if(failures.create.has(details.url))throw Error('injected create failure');const parent=find(details.parentId || 'P');if(!parent?.children)throw Error('missing parent');const node={...details,id:'created-'+(++createdCounter),...(!details.url?{children:[]}:{})};parent.children.splice(Math.min(details.index ?? parent.children.length,parent.children.length),0,node);indexTree();return structuredClone(node);},async remove(id){calls.removes.push(id);if(failures.remove.has(id))throw Error('injected remove failure');const node=find(id);if(!node)throw Error('missing node');find(node.parentId).children.splice(node.index,1);indexTree();},async get(id){const node=find(id);if(!node||node===root)throw Error('missing node');const {children,...rest}=structuredClone(node);return [rest];},async move(id,dest){calls.moves.push({id,...dest});if(failures.move.has(id))throw Error('injected move failure');const node=find(id);if(!node)throw Error('missing node');const parent=find(dest.parentId);if(!parent?.children)throw Error('missing parent');const sameParent=node.parentId===parent.id;const from=node.index;find(node.parentId).children.splice(node.index,1);let at=dest.index===undefined?parent.children.length:dest.index;if(semantics==='chromium'&&sameParent&&dest.index!==undefined&&at>from)at-=1;parent.children.splice(Math.min(at,parent.children.length),0,node);indexTree();return structuredClone(node);},onCreated:event('created'),onRemoved:event('removed'),onChanged:event('changed'),onMoved:event('moved'),onImportEnded:event('importEnded')},
    permissions:{async contains(){return api.permissionGranted;},async request(){return api.permissionGranted;}},permissionGranted:true,
    alarms:{async clear(name){calls.cleared.push(name);},async create(name,options){calls.alarms.push({name,...options});},onAlarm:event('alarm')},
    notifications:{async create(id,options){calls.notifications.push({id,...options});},async clear(){},onClicked:event('notificationClicked'),onClosed:event('notificationClosed')},
    runtime:{id:'test',getURL:p=>(semantics==='firefox'?'moz-extension://test/':'chrome-extension://test/')+p,getManifest:()=>({version:'4.44.0'}),onMessage:event('message'),onInstalled:event('installed'),onStartup:event('startup'),async sendMessage(){return {success:true};}},
    tabs:{async get(){return {id:1,url:'https://example.test/'};},async query(){return [{id:1,url:'https://example.test/'}];},async create(){},onActivated:event('tabActivated'),onUpdated:event('tabUpdated')},
    action:{async setBadgeText(){},async setBadgeBackgroundColor(){}},i18n:{getUILanguage:()=> 'en'},contextMenus:{onClicked:event('contextMenuClicked')}
  };
  setChromeApiForTesting(api); _resetBrowserDetectionForTesting(); invalidateBookmarkCache();
  return {api,root,stored,calls,failures,find};
}
export const leaf = (id,url='https://'+id+'.test/') => ({id,title:id,url});
export const folder = (id,children=[]) => ({id,title:id,children});
