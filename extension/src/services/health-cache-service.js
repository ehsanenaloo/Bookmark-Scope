/* Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License. */
import { getLocalStorage, setLocalStorage, withStorageLock } from './storage-service.js';
import { STORAGE_KEYS, HEALTH_CACHE_MAX_ENTRIES, HEALTH_CACHE_EVICTION_BATCH, HEALTH_CACHE_TTL_MS } from '../core/constants.js';

let _writeChain = Promise.resolve();
function enqueue(operation) {
  const result = _writeChain.then(operation, operation);
  _writeChain = result;
  // Prevent an unhandled rejection when a fire-and-forget caller defers its
  // explicit drain; awaitPendingHealthWrites still rejects on that failure.
  result.catch(error => console.warn('[BookmarkScope:health-cache]', error));
  return result;
}

// Writes that arrive while another storage write is in flight are merged into
// one read-modify-write of the record map. Each caller still gets its own
// result, generation fencing is checked per caller, and a delete or clear acts
// as a barrier: writes made after it are never applied before it.
let _seq = 0;
let _pending = [];
let _openFlush = null;

function closeOpenFlush() {
  if (!_openFlush) return;
  _openFlush.limit = _seq;
  _openFlush = null;
}

function queueWrite(entries, token) {
  return new Promise((resolve, reject) => {
    _pending.push({ seq: ++_seq, entries, token, resolve, reject });
    if (_openFlush) return;
    const flush = { limit: Infinity };
    _openFlush = flush;
    enqueue(() => runFlush(flush)).catch(() => {});
  });
}

async function runFlush(flush) {
  if (_openFlush === flush) _openFlush = null;
  const batch = _pending.filter(item => item.seq <= flush.limit);
  _pending = _pending.filter(item => item.seq > flush.limit);
  const groups = new Map();
  for (const item of batch) {
    let expected;
    try { expected = await item.token; } catch (error) { item.reject(error); continue; }
    if (!groups.has(expected)) groups.set(expected, []);
    groups.get(expected).push(item);
  }
  let firstError = null;
  for (const [expected, items] of groups) {
    try {
      const written = await withStorageLock(async () => {
        const stored = await getLocalStorage([STORAGE_KEYS.HEALTH_CACHE, STORAGE_KEYS.HEALTH_CACHE_GENERATION]);
        if (expected !== Number(stored[STORAGE_KEYS.HEALTH_CACHE_GENERATION] || 0)) return false;
        const current = { ...(stored[STORAGE_KEYS.HEALTH_CACHE] || {}) };
        for (const item of items) {
          for (const { key, record } of item.entries) {
            // The newer observation wins when two scans race for the same address.
            if (Number(current[key]?.checkedAt || 0) > Number(record.checkedAt || 0)) continue;
            current[key] = record;
          }
        }
        await setLocalStorage({ [STORAGE_KEYS.HEALTH_CACHE]: _evictIfOverLimit(current), [STORAGE_KEYS.HEALTH_CACHE_KEY_VERSION]: 2 });
        return true;
      });
      for (const item of items) item.resolve(written);
    } catch (error) {
      firstError = firstError || error;
      for (const item of items) item.reject(error);
    }
  }
  if (firstError) throw firstError;
}

function _evictIfOverLimit(records) {
  const entries = Object.entries(records);
  if (entries.length <= HEALTH_CACHE_MAX_ENTRIES) return records;

  // Sort by checkedAt ascending (oldest first) — entries without a timestamp
  // are treated as oldest so legacy / corrupted records get evicted first.
  entries.sort((a, b) => Number(a[1]?.checkedAt || 0) - Number(b[1]?.checkedAt || 0));

  const target = HEALTH_CACHE_MAX_ENTRIES - HEALTH_CACHE_EVICTION_BATCH;
  const dropCount = Math.max(0, entries.length - Math.max(0, target));
  const kept = entries.slice(dropCount);
  const result = {};
  for (const [key, record] of kept) result[key] = record;
  return result;
}

function _stripExpired(records, ttlMs = HEALTH_CACHE_TTL_MS, currentTime = Date.now()) {
  const cutoff = currentTime - ttlMs;
  const result = {};
  for (const [key, record] of Object.entries(records || {})) {
    if (Number(record?.checkedAt || 0) >= cutoff) {
      result[key] = record;
    }
  }
  return result;
}


export async function getHealthCacheGeneration() {
  const stored = await getLocalStorage([STORAGE_KEYS.HEALTH_CACHE_GENERATION]);
  return Number(stored[STORAGE_KEYS.HEALTH_CACHE_GENERATION] || 0);
}

export async function loadHealthCache(ttlMs = HEALTH_CACHE_TTL_MS) {
  const stored = await getLocalStorage([STORAGE_KEYS.HEALTH_CACHE, STORAGE_KEYS.HEALTH_CACHE_KEY_VERSION]);
  if (stored[STORAGE_KEYS.HEALTH_CACHE_KEY_VERSION] !== 2) return {};
  return _stripExpired(stored[STORAGE_KEYS.HEALTH_CACHE] || {}, ttlMs);
}

function validEntry(key, record) {
  return Boolean(key) && typeof key === 'string' && Boolean(record) && typeof record === 'object';
}

/** Writes one record. Resolves false when the cache generation changed (a clear happened), true otherwise. */
export function writeHealthRecord(key, record, generation) {
  return writeHealthRecords([{ key, record }], generation);
}

/**
 * Writes several records in one storage update. Entries that are not valid are
 * ignored; if none is valid the result is false. A record older than the one
 * already stored for the same address is skipped without error.
 */
export function writeHealthRecords(entries, generation) {
  const valid = (entries || []).filter(entry => validEntry(entry?.key, entry?.record));
  if (!valid.length) return Promise.resolve(false);
  const token = generation === undefined ? getHealthCacheGeneration() : Promise.resolve(generation);
  return queueWrite(valid, token);
}

export function deleteHealthRecord(key) {
  if (!key || typeof key !== 'string') return Promise.resolve();
  closeOpenFlush();
  return enqueue(() => withStorageLock(async () => {
    const stored = await getLocalStorage([STORAGE_KEYS.HEALTH_CACHE]);
    const current = { ...(stored[STORAGE_KEYS.HEALTH_CACHE] || {}) };
    delete current[key];
    await setLocalStorage({ [STORAGE_KEYS.HEALTH_CACHE]: current });
  }));
}

export function clearHealthCache() {
  closeOpenFlush();
  return enqueue(() => withStorageLock(async () => {
    const generation = await getHealthCacheGeneration();
    await setLocalStorage({ [STORAGE_KEYS.HEALTH_CACHE]: {}, [STORAGE_KEYS.HEALTH_CACHE_GENERATION]: generation + 1, [STORAGE_KEYS.HEALTH_CACHE_KEY_VERSION]: 2 });
  }));
}

export async function awaitPendingHealthWrites() { await _writeChain; }
export function _resetHealthCacheServiceForTesting() { _writeChain = Promise.resolve(); _pending = []; _openFlush = null; }
export const _internals = Object.freeze({ _evictIfOverLimit, _stripExpired });
