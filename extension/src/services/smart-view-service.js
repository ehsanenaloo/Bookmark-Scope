/* Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License. */
import { CLEANUP_FILTERS, DASHBOARD_MODE, GROUP_BY_OPTIONS, GROUP_SORT_OPTIONS, SORT_OPTIONS, STORAGE_KEYS } from '../core/constants.js';
import { normaliseTagList } from './tag-service.js';
import { getLocalStorage, setLocalStorage, withStorageLock } from './storage-service.js';

export function validateSmartView(input) {
  if (!input || typeof input !== 'object') throw new Error('Invalid view.');
  if (input.version !== undefined && input.version !== 1) throw new Error('Unsupported view version.');
  const name = String(input.name || '').trim();
  if (!name || name.length > 80 || typeof input.query !== 'string' || input.query.length > 2000) throw new Error('Invalid view name or query.');
  for (const [field, values] of Object.entries({ sort:SORT_OPTIONS, cleanupFilter:CLEANUP_FILTERS, groupBy:GROUP_BY_OPTIONS, groupSort:GROUP_SORT_OPTIONS })) {
    if (!Object.values(values).includes(input[field])) throw new Error('Invalid view ' + field);
  }
  return { version:1, id:String(input.id || crypto.randomUUID()), name, query:input.query, sort:input.sort, cleanupFilter:input.cleanupFilter, groupBy:input.groupBy, groupSort:input.groupSort, activeTagFilter:normaliseTagList(input.activeTagFilter) };
}
export async function loadSmartViews() {
  const stored = await getLocalStorage([STORAGE_KEYS.SMART_VIEWS]);
  return Array.isArray(stored[STORAGE_KEYS.SMART_VIEWS]) ? stored[STORAGE_KEYS.SMART_VIEWS] : [];
}
export async function saveSmartView(input) {
  const view = validateSmartView(input);
  return withStorageLock(async()=>{
    const views = await loadSmartViews();
    const index = views.findIndex(item=>item.id === view.id);
    if (index < 0 && views.length >= 50) throw new Error('At most 50 saved views.');
    if (index < 0) views.push(view); else views[index] = view;
    await setLocalStorage({[STORAGE_KEYS.SMART_VIEWS]:views}); return view;
  });
}
export async function deleteSmartView(id) {
  return withStorageLock(async()=>setLocalStorage({[STORAGE_KEYS.SMART_VIEWS]:(await loadSmartViews()).filter(view=>view.id !== id)}));
}
export function applySmartView(view, state) {
  if (view?.version !== 1) throw new Error('Unsupported view version.');
  const valid = validateSmartView(view);
  for (const key of ['query','sort','cleanupFilter','groupBy','groupSort','activeTagFilter']) state[key] = valid[key];
  state.mode = DASHBOARD_MODE; state.duplicatesOnly = valid.cleanupFilter === CLEANUP_FILTERS.DUPLICATES;
  state.selectedIds.clear(); state.listScrollTop = 0;
}
