/* Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License. */
import { createBookmark, removeBookmark, getBookmark } from '../platform/browser-api.js';
import { getLocalStorage, setLocalStorage, withStorageLock } from './storage-service.js';
import { updateTagsMap, setTagsForBookmark } from './tag-service.js';
import { STORAGE_KEYS } from '../core/constants.js';
import { flattenLiveTree, urlIdentity, writableFolders } from './maintenance-preview-service.js';
import { getBookmarkTree } from '../platform/browser-api.js';
import { normaliseTagList, normaliseTag } from './tag-service.js';

/*
 * Import journal.
 *
 * Creating a bookmark and writing extension storage are two separate steps that
 * cannot be made atomic, so the journal is built to be reconciled, not to be a
 * transaction:
 *   - Items are handled in chunks of IMPORT_INTENT_CHUNK. Before a chunk starts,
 *     its entries are saved as "pending" (the intent). A chunk is only started
 *     when that save worked, so no bookmark is created without a durable record
 *     that it may exist.
 *   - After the chunk the final statuses are saved. If the page or worker ends
 *     in between, the operation stays "running" with "pending" entries.
 *   - reconcileImportJournal compares those entries with the live tree and marks
 *     each one "not-created", "unverified" (one candidate bookmark, no proof) or
 *     "ambiguous" (several or unreliable candidates). It runs before every import,
 *     which does not start if the check fails, and can be called on its own.
 *
 * Entry statuses: pending, created (made, tags not yet saved), completed,
 * skipped, merged, failed, rolled-back (made, tags failed, removed again),
 * metadata-failed (made, tags failed, removal failed; the ID is kept),
 * journal-failed (made, but the journal could not be saved), unverified,
 * ambiguous, not-created. Operation statuses: running, completed (also when items were
 * skipped on purpose), partial (some entries failed), interrupted (the journal
 * could not be saved, or the operation was cut off and reconciled).
 */

export const IMPORT_INTENT_CHUNK = 25;
// The duplicate index is rebuilt from the live tree after this many items, so a
// bookmark added elsewhere during a long import is noticed within one window.
export const IMPORT_INDEX_REFRESH_ITEMS = 250;
const RECONCILE_CLOCK_SLACK_MS = 5000;

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

function buildUrlIndex(tree, parseOptions) {
  const index = new Map();
  for (const node of flattenLiveTree(tree)) {
    if (!node.url) continue;
    const key = urlIdentity(node.url, parseOptions);
    if (!index.has(key)) index.set(key, node);
  }
  return index;
}

/**
 * Settles operations that were cut off. A cut-off entry has no bookmark ID, so
 * a live bookmark with the same address in the same folder is only a candidate,
 * never proof: the user or a sync could have added the same address. Candidates
 * must carry a valid dateAdded at or after the operation start.
 *   - no candidate: not-created
 *   - as many candidates as entries for that address: unverified (candidateId)
 *   - anything else, or a candidate without a usable dateAdded: ambiguous
 *     (candidateIds)
 * No entry gets an id, so nothing later removes or edits a candidate as if it
 * belonged to the import. Returns counts.
 */
async function reconcileLocked() {
  const journal = await loadImportJournal();
  const stale = Object.values(journal).filter(operation => operation.status === 'running');
  const summary = { operations: stale.length, unverified: 0, ambiguous: 0, notCreated: 0 };
  if (!stale.length) return summary;
  const byParentAndUrl = new Map();
  for (const node of flattenLiveTree(await getBookmarkTree())) {
    if (!node.url) continue;
    const key = `${node.parentId}
${node.url}`;
    if (!byParentAndUrl.has(key)) byParentAndUrl.set(key, []);
    byParentAndUrl.get(key).push(node);
  }
  const claimed = new Set(Object.values(journal).flatMap(operation => operation.items.flatMap(entry => [entry.id, entry.candidateId, ...(entry.candidateIds || [])]).filter(Boolean)));
  const now = Date.now();
  for (const operation of stale) {
    const pendingByUrl = new Map();
    for (const entry of operation.items) {
      if (entry.status !== 'pending' && !(entry.status === 'created' && !entry.id)) continue;
      if (!pendingByUrl.has(entry.url)) pendingByUrl.set(entry.url, []);
      pendingByUrl.get(entry.url).push(entry);
    }
    for (const [url, entries] of pendingByUrl) {
      const live = (byParentAndUrl.get(`${operation.parentId}
${url}`) || []).filter(node => !claimed.has(node.id));
      const dated = live.filter(node => Number.isFinite(node.dateAdded) && node.dateAdded >= operation.startedAt && node.dateAdded <= now + RECONCILE_CLOCK_SLACK_MS);
      const undated = live.filter(node => !Number.isFinite(node.dateAdded));
      if (!dated.length && !undated.length) {
        for (const entry of entries) { entry.status = 'not-created'; summary.notCreated += 1; }
      } else if (dated.length === entries.length && !undated.length) {
        entries.forEach((entry, position) => { entry.status = 'unverified'; entry.candidateId = dated[position].id; claimed.add(dated[position].id); });
        summary.unverified += entries.length;
      } else {
        const ids = [...dated, ...undated].map(node => node.id);
        for (const entry of entries) { entry.status = 'ambiguous'; entry.candidateIds = ids; }
        ids.forEach(id => claimed.add(id));
        summary.ambiguous += entries.length;
      }
    }
    operation.status = 'interrupted';
    operation.reconciledAt = now;
    await saveOperation(operation);
  }
  return summary;
}

export async function reconcileImportJournal() {
  return navigator.locks.request('bookmark-scope-import', { ifAvailable: true }, async lock => {
    if (!lock) return { operations: 0, unverified: 0, ambiguous: 0, notCreated: 0, skipped: true };
    return reconcileLocked();
  });
}

// Flat exchange, not hierarchy restoration. See the header for the journal contract.
export async function importBookmarks(items, parentId, {policy='keep',parseOptions={},validateDestination=false}={}) {
  if(!['keep','skip','merge'].includes(policy))throw new Error('Invalid duplicate policy.');
  return navigator.locks.request('bookmark-scope-import', async () => {
    if(validateDestination && !(await writableFolders()).some(folder=>folder.id===parentId))throw new Error('Destination is unavailable or managed.');
    // An interrupted import that cannot be checked blocks a new one: its entries stay
    // pending in the journal and are settled by the next successful check.
    try { await reconcileLocked(); }
    catch (error) { throw new Error(`An earlier interrupted import could not be checked, so no new import was started: ${error.message}`); }
    const operation = { id: crypto.randomUUID(), startedAt: Date.now(), status: 'running', parentId, policy, items: [], failed: 0 };
    await saveOperation(operation);
    let storageFailure = null;

    // One read of the tree per window of items, not one per item.
    let index = policy === 'keep' ? null : buildUrlIndex(await getBookmarkTree(), parseOptions);
    let sinceRefresh = 0;
    async function findExisting(key) {
      if (!index) return null;
      if (sinceRefresh >= IMPORT_INDEX_REFRESH_ITEMS) {
        index = buildUrlIndex(await getBookmarkTree(), parseOptions);
        sinceRefresh = 0;
      }
      const hit = index.get(key);
      if (!hit) return null;
      // A match is confirmed against the browser before it is used.
      const node = await getBookmark(hit.id).catch(() => null);
      if (!node || !node.url || urlIdentity(node.url, parseOptions) !== key) {
        index.delete(key);
        return null;
      }
      return hit;
    }

    for (let start = 0; start < items.length && !storageFailure; start += IMPORT_INTENT_CHUNK) {
      const chunk = items.slice(start, start + IMPORT_INTENT_CHUNK);
      const entries = chunk.map(item => ({ title: item.title || item.url, url: item.url, tags: Array.isArray(item.tags) ? item.tags : [], status: 'pending' }));
      const firstEntry = operation.items.length;
      operation.items.push(...entries);
      try { await saveOperation(operation); }
      catch (error) {
        // Nothing of this chunk was created, so it is not part of the operation.
        operation.items.length = firstEntry;
        storageFailure = error;
        break;
      }
      for (const entry of entries) {
        sinceRefresh += 1;
        try {
          const url = new URL(entry.url);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported import URL.');
          if(policy!=='keep'){
            const key=urlIdentity(entry.url,parseOptions);
            const existing=await findExisting(key);
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
              entry.status=policy==='skip'?'skipped':'merged';
              continue;
            }
          }
          const created = await createBookmark({ parentId, title: entry.title, url: entry.url });
          entry.id = created.id;
          entry.status = 'created';
          if (index) index.set(urlIdentity(entry.url, parseOptions), { ...created, url: entry.url, managed: false });
          try {
            if (entry.tags.length) await updateTagsMap(map => setTagsForBookmark(map, entry.id, entry.tags));
            entry.status = 'completed';
          } catch (error) {
            entry.error = error.message;
            try { await removeBookmark(entry.id); entry.status = 'rolled-back'; if (index) index.delete(urlIdentity(entry.url, parseOptions)); }
            catch (rollbackError) { entry.status = 'metadata-failed'; entry.rollbackError = rollbackError.message; }
            operation.failed++;
          }
        } catch (error) {
          entry.error = error.message;
          entry.status = entry.id ? 'journal-failed' : 'failed';
          operation.failed++;
        }
      }
      try { await saveOperation(operation); }
      catch (error) {
        // The bookmarks of this chunk exist; only the journal missed their final status.
        storageFailure = error;
      }
    }
    operation.status = storageFailure ? 'interrupted' : operation.failed ? 'partial' : 'completed';
    try { await saveOperation(operation); } catch (error) { storageFailure = storageFailure || error; }
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
