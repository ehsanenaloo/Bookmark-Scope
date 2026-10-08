/* Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License. */
import { createBookmark, removeBookmark } from '../platform/browser-api.js';
import { getLocalStorage, setLocalStorage, withStorageLock } from './storage-service.js';
import { updateTagsMap, setTagsForBookmark } from './tag-service.js';
import { STORAGE_KEYS } from '../constants.js';
import { flattenLiveTree, urlIdentity, writableFolders } from './maintenance-preview-service.js';
import { getBookmarkTree } from '../platform/browser-api.js';
import { normaliseTagList, normaliseTag } from './tag-service.js';

export async function loadImportJournal() {
  const stored = await getLocalStorage([STORAGE_KEYS.IMPORT_JOURNAL]);
  return stored[STORAGE_KEYS.IMPORT_JOURNAL] || {};
}

async function saveOperation(operation) {
  await withStorageLock(async () => {
    const journal = await loadImportJournal();
    journal[operation.id] = structuredClone(operation);
    const completed = Object.values(journal).filter(item => item.status === 'completed').sort((a,b) => b.startedAt - a.startedAt);
    for (const item of completed.slice(20)) delete journal[item.id];
    await setLocalStorage({ [STORAGE_KEYS.IMPORT_JOURNAL]: journal });
  });
}

// Flat exchange, not hierarchy restoration. Persist each applied identity and
// its metadata outcome so interrupted pages leave inspectable recovery data.
export async function importBookmarks(items, parentId, {policy='keep',parseOptions={},validateDestination=false}={}) {
  if(!['keep','skip','merge'].includes(policy))throw new Error('Invalid duplicate policy.');
  return navigator.locks.request('bookmark-scope-import', async () => {
    if(validateDestination && !(await writableFolders()).some(folder=>folder.id===parentId))throw new Error('Destination is unavailable or managed.');
    const operation = { id: crypto.randomUUID(), startedAt: Date.now(), status: 'running', items: [], failed: 0 };
    await saveOperation(operation);
    let storageFailure = null;
    for (const item of items) {
      const entry = { title: item.title || item.url, url: item.url, tags: Array.isArray(item.tags) ? item.tags : [], status: 'pending' };
      operation.items.push(entry);
      try {
        const url = new URL(item.url);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported import URL.');
        if(policy!=='keep'){
          const key=urlIdentity(item.url,parseOptions);
          const existing=flattenLiveTree(await getBookmarkTree()).find(node=>node.url && urlIdentity(node.url,parseOptions)===key);
          if(existing){
            entry.targetId=existing.id;
            if(policy==='merge'){
              if(existing.managed)throw new Error('Matched bookmark is managed.');
              await updateTagsMap(map=>{
                const tags=[...new Set([...(map[existing.id]||[]),...entry.tags].map(normaliseTag).filter(Boolean))];
                if(tags.length>20)throw new Error('Merged tags exceed the bookmark limit.');
                return setTagsForBookmark(map,existing.id,tags);
              });
            }
            entry.status=policy==='skip'?'skipped':'merged';await saveOperation(operation);continue;
          }
        }
        const created = await createBookmark({ parentId, title: entry.title, url: item.url });
        entry.id = created.id;
        entry.status = 'created';
        await saveOperation(operation);
        try {
          if (entry.tags.length) await updateTagsMap(map => setTagsForBookmark(map, entry.id, entry.tags));
          entry.status = 'completed';
        } catch (error) {
          entry.error = error.message;
          try { await removeBookmark(entry.id); entry.status = 'rolled-back'; }
          catch (rollbackError) { entry.status = 'metadata-failed'; entry.rollbackError = rollbackError.message; }
          operation.failed++;
        }
      } catch (error) {
        entry.error = error.message;
        entry.status = entry.id ? 'journal-failed' : 'failed';
        operation.failed++;
      }
      try { await saveOperation(operation); }
      catch (error) { storageFailure = error; break; }
    }
    operation.status = storageFailure ? 'interrupted' : operation.failed ? 'partial' : 'completed';
    try { await saveOperation(operation); } catch (error) { storageFailure = error; }
    return {
      operation,
      created: operation.items.filter(item => item.id && item.status !== 'rolled-back').length,
      failed: operation.failed,
      skipped: operation.items.filter(item=>item.status==='skipped').length,
      merged: operation.items.filter(item=>item.status==='merged').length,
      notAttempted: items.length - operation.items.length,
      storageFailure: storageFailure?.message || ''
    };
  });
}

export function buildImportPreview(items,bookmarks,parseOptions={}) {
  const existing=new Map();for(const node of bookmarks)if(node.url){const key=urlIdentity(node.url,parseOptions);if(!existing.has(key))existing.set(key,node);}
  const seen=new Set();const rows=[],excludedRows=[];let excluded=0,matches=0,repeated=0;
  for(const item of items){
    let valid=false;try{valid=['http:','https:'].includes(new URL(item.url).protocol);}catch{}
    if(!valid){excluded++;excludedRows.push({...item});continue;}
    const key=urlIdentity(item.url,parseOptions);const match=existing.get(key);
    if(match)matches++;if(seen.has(key))repeated++;seen.add(key);
    rows.push({...item,tags:normaliseTagList(item.tags),key,existingId:match?.id||'',repeated:rows.some(row=>row.key===key)});
  }return {rows,excludedRows,excluded,matches,repeated,total:items.length};
}
