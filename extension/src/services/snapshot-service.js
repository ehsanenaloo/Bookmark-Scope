/* Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License. */
import { createBookmark, getBookmarkTree, getManifest, removeBookmark } from '../platform/browser-api.js';
import { STORAGE_KEYS } from '../core/constants.js';
import { loadTagsMap, normaliseTagList, setTagsForBookmark, updateTagsMap } from './tag-service.js';
import { getLocalStorage, setLocalStorage, withStorageLock } from './storage-service.js';
import { writableFolders } from './maintenance-preview-service.js';

export async function createSnapshot() {
  const [tree,tags]=await Promise.all([getBookmarkTree(),loadTagsMap()]);
  // Firefox separators (type 'separator', url "data:") are layout markers, not bookmarks or folders; the snapshot omits them.
  const keep=nodes=>(nodes||[]).filter(node=>node.type!=='separator');
  const copy=node=>({sourceId:String(node.id),title:String(node.title||''),dateAdded:Number(node.dateAdded||0),...(node.url ? {type:'bookmark',url:node.url,tags:tags[node.id]||[]} : {type:'folder',children:keep(node.children).map(copy)})});
  return {format:'bookmark-scope-snapshot',version:1,createdAt:new Date().toISOString(),extensionVersion:getManifest().version,roots:keep(tree[0]?.children).map(copy)};
}
export function validateSnapshot(value) {
  if(value?.format!=='bookmark-scope-snapshot' || value.version!==1 || !Array.isArray(value.roots))throw new Error('Unsupported snapshot format/version.');
  if(typeof value.createdAt!=='string' || Number.isNaN(Date.parse(value.createdAt)) || new TextEncoder().encode(JSON.stringify(value)).length>10*1024*1024)throw new Error('Invalid timestamp or oversized snapshot.');
  const ids=new Set();let bookmarks=0,folders=0;const excluded=[];
  function visit(nodes,depth){
    if(depth>100)throw new Error('Snapshot exceeds maximum folder depth.');
    for(const node of nodes){
      if(!node || typeof node.sourceId!=='string' || !node.sourceId || ids.has(node.sourceId) || typeof node.title!=='string' || node.title.length>10000)throw new Error('Invalid or duplicate snapshot node.');
      ids.add(node.sourceId);if(ids.size>50000)throw new Error('Snapshot exceeds 50,000 nodes.');
      if(node.type==='folder') {if(!Array.isArray(node.children))throw new Error('Invalid folder.');folders++;visit(node.children,depth+1);}
      else if(node.type==='bookmark'){
        if(typeof node.url!=='string' || !Array.isArray(node.tags) || node.tags.length>20 || node.tags.some(tag=>typeof tag!=='string') || normaliseTagList(node.tags).length!==new Set(node.tags).size)throw new Error('Invalid bookmark metadata.');
        try{if(!['http:','https:'].includes(new URL(node.url).protocol))throw Error();bookmarks++;}catch{excluded.push(node.sourceId);}
      }else throw new Error('Invalid node type.');
    }
  }visit(value.roots,0);return {bookmarks,folders,excluded,total:ids.size};
}
export async function loadRestoreJournal() {
  return (await getLocalStorage([STORAGE_KEYS.SNAPSHOT_RESTORE_JOURNAL]))[STORAGE_KEYS.SNAPSHOT_RESTORE_JOURNAL] || [];
}
async function record(operation) {
  await withStorageLock(async()=>{
    const journal=await loadRestoreJournal();const index=journal.findIndex(item=>item.id===operation.id);
    if(index<0)journal.unshift(structuredClone(operation));else journal[index]=structuredClone(operation);
    const completed=journal.filter(item=>item.status==='completed').slice(0,20);
    await setLocalStorage({[STORAGE_KEYS.SNAPSHOT_RESTORE_JOURNAL]:[...journal.filter(item=>item.status!=='completed'),...completed]});
  });
}
export async function restoreSnapshot(snapshot,parentId) {
  snapshot=structuredClone(snapshot);
  const preview=validateSnapshot(snapshot);const excluded=new Set(preview.excluded);
  return navigator.locks.request('bookmark-scope-restore',async()=>{
    if(!(await writableFolders()).some(folder=>folder.id===parentId))throw new Error('Destination is unavailable or managed.');
    const operation={id:crypto.randomUUID(),startedAt:Date.now(),status:'running',items:[],excluded:preview.excluded,failed:0};
    await record(operation);
    const mapping=Object.create(null);let storageError='';
    async function create(node,parent){
      if(excluded.has(node.sourceId))return;
      const entry={sourceId:node.sourceId,type:node.type,status:'pending'};operation.items.push(entry);
      try{
        const created=await createBookmark({parentId:parent,title:node.title,...(node.type==='bookmark'?{url:node.url}:{})});
        entry.id=created.id;entry.status='created';mapping[node.sourceId]=created.id;await record(operation);
        if(node.type==='bookmark' && node.tags.length){
          try{await updateTagsMap(map=>setTagsForBookmark(map,created.id,node.tags));}
          catch(error){entry.error=error.message;try{await removeBookmark(created.id);entry.status='rolled-back';delete mapping[node.sourceId];}catch(rollbackError){entry.status='metadata-failed';entry.rollbackError=rollbackError.message;}operation.failed++;await record(operation);return;}
        }
        entry.status='completed';await record(operation);
        if(node.type==='folder')for(const child of node.children)await create(child,created.id);
      }catch(error){entry.error=error.message;entry.status=entry.id?'journal-failed':'failed';operation.failed++;if(entry.id){storageError=error.message;throw error;}await record(operation);}
    }
    try{
      const container=await createBookmark({parentId,title:'Bookmark Scope snapshot '+snapshot.createdAt?.slice(0,10)});
      operation.containerId=container.id;await record(operation);
      for(const node of snapshot.roots)await create(node,container.id);
    }catch(error){storageError ||= error.message;operation.status='interrupted';}
    operation.status=storageError?'interrupted':operation.failed?'partial':'completed';
    try{await record(operation);}catch(error){storageError=error.message;}
    return {operation,mapping,created:operation.items.filter(item=>item.id && item.status!=='rolled-back').length,failed:operation.failed,excluded:preview.excluded.length,storageError,notAttempted:preview.total-preview.excluded.length-operation.items.length};
  });
}
