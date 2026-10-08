/* Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License. */
import { getBookmarkTree } from '../platform/browser-api.js';
import { parseUrlSafe } from '../core/url-utils.js';
import { TAG_MAX_PER_BOOKMARK } from '../core/constants.js';
import { loadTagsMap, normaliseTag, normaliseTagList, updateTagsMap } from './tag-service.js';

export function flattenLiveTree(tree) {
  const result=[];
  // The tree's top-level node is the invisible bookmark root (id '0' in Chromium, 'root________' in Firefox);
  // neither browser allows creating bookmarks directly under it. `unmodifiable` is only set by Chromium
  // (managed bookmarks); Firefox never sets it and its fixed roots (menu, toolbar, unfiled, mobile) are writable.
  const visit=(nodes,path='',managed=false,isRoot=true)=>{for(const node of nodes || []){
    const blocked=managed || Boolean(node.unmodifiable);
    result.push({...node,path,managed:blocked,isRoot});
    visit(node.children,[path,node.title].filter(Boolean).join(' / '),blocked,false);
  }};visit(tree);return result;
}
export function urlIdentity(url, options={}) { const parsed=parseUrlSafe(url,options); return parsed.valid ? parsed.normalizedPageKey : String(url); }
function checkedTags(tags) {
  const normalized=[...new Set(tags.map(normaliseTag).filter(Boolean))];
  if(normalized.length > TAG_MAX_PER_BOOKMARK) throw new Error('Tag limit exceeded; no changes applied.');
  return normalized;
}
export function buildDuplicatePreview(bookmarks,tags,options={},strategy='keep-newest') {
  const grouped=new Map();
  for(const bookmark of bookmarks){const key=urlIdentity(bookmark.url,options);const list=grouped.get(key)||[];list.push(bookmark);grouped.set(key,list);}
  return [...grouped].filter(([,rows])=>rows.length>1).map(([key,rows])=>({key,rows:rows.map(row=>({...row,tags:[...(tags[row.id]||[])]})),survivorId:[...rows].sort((a,b)=>(a.dateAdded||0)-(b.dateAdded||0))[strategy==='keep-oldest'?0:rows.length-1].id}));
}
export async function prepareDuplicateMerge(groups,options={}) {
  groups=structuredClone(groups);
  const toDelete=[];
  const map=await updateTagsMap(async current=>{
    const live=new Map(flattenLiveTree(await getBookmarkTree()).map(node=>[node.id,node]));
    const next={...current};
    for(const group of groups){
      if(!group.rows.some(row=>row.id===group.survivorId)) throw new Error('Invalid survivor.');
      for(const row of group.rows){const node=live.get(row.id);if(!node?.url || node.managed || urlIdentity(node.url,options)!==group.key || node.title!==row.title || (row.parentId && node.parentId!==row.parentId) || JSON.stringify(current[row.id]||[])!==JSON.stringify(row.tags))throw new Error('Preview changed; reopen it before merging.');}
      next[group.survivorId]=checkedTags(group.rows.flatMap(row=>row.tags));
      toDelete.push(...group.rows.filter(row=>row.id!==group.survivorId));
    }return next;
  });return {toDelete,map};
}

export function buildTagPreview(bookmarks,map,{operation,source='',target=''}) {
  if(!['add','remove','rename','merge'].includes(operation))throw new Error('Invalid tag operation.');
  const from=normaliseTag(source),to=normaliseTag(target);
  if(operation!=='add' && !from || operation!=='remove' && !to)throw new Error('Invalid tag.');
  return [...new Set(bookmarks.map(row=>row.id))].map(id=>{
    const before=[...(map[id]||[])];let after=[...before];
    if(operation==='remove')after=after.filter(tag=>tag!==from);
    else if(operation==='add')after.push(to);
    else if(after.includes(from))after=[...after.filter(tag=>tag!==from),to];
    after=checkedTags(after);return {id,before,after};
  }).filter(row=>JSON.stringify(row.before)!==JSON.stringify(row.after));
}
export async function applyTagPreview(preview,{undo=false}={}) {
  const result={changed:0,missing:0,conflicting:0,applied:[]};
  const map=await updateTagsMap(async current=>{
    const live=new Set(flattenLiveTree(await getBookmarkTree()).filter(node=>node.url).map(node=>node.id));
    const next={...current};
    for(const item of preview){
      if(!live.has(item.id)){result.missing++;continue;}
      const expected=undo?item.after:item.before;
      if(JSON.stringify(current[item.id]||[])!==JSON.stringify(expected)){result.conflicting++;continue;}
      const values=undo?item.before:item.after;
      if(values.length)next[item.id]=normaliseTagList(values);else delete next[item.id];
      result.changed++;result.applied.push(item);
    }return next;
  });return {...result,map};
}

export async function writableFolders() {
  return flattenLiveTree(await getBookmarkTree()).filter(node=>!node.url && node.type!=='separator' && !node.isRoot && !node.managed).map(node=>({id:node.id,title:[node.path,node.title].filter(Boolean).join(' / ') || node.id}));
}
