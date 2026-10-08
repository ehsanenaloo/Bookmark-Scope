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

export function writeHealthRecord(key, record, generation) {
  if (!key || typeof key !== 'string' || !record || typeof record !== 'object') return Promise.resolve(false);
  const token = generation === undefined ? getHealthCacheGeneration() : Promise.resolve(generation);
  return enqueue(async () => {
    const expected = await token;
    return withStorageLock(async () => {
      const stored = await getLocalStorage([STORAGE_KEYS.HEALTH_CACHE, STORAGE_KEYS.HEALTH_CACHE_GENERATION]);
      if (expected !== Number(stored[STORAGE_KEYS.HEALTH_CACHE_GENERATION] || 0)) return false;
      const current = { ...(stored[STORAGE_KEYS.HEALTH_CACHE] || {}), [key]: record };
      await setLocalStorage({ [STORAGE_KEYS.HEALTH_CACHE]: _evictIfOverLimit(current), [STORAGE_KEYS.HEALTH_CACHE_KEY_VERSION]: 2 });
      return true;
    });
  });
}

export function deleteHealthRecord(key) {
  if (!key || typeof key !== 'string') return Promise.resolve();
  return enqueue(() => withStorageLock(async () => {
    const stored = await getLocalStorage([STORAGE_KEYS.HEALTH_CACHE]);
    const current = { ...(stored[STORAGE_KEYS.HEALTH_CACHE] || {}) };
    delete current[key];
    await setLocalStorage({ [STORAGE_KEYS.HEALTH_CACHE]: current });
  }));
}

export function clearHealthCache() {
  return enqueue(() => withStorageLock(async () => {
    const generation = await getHealthCacheGeneration();
    await setLocalStorage({ [STORAGE_KEYS.HEALTH_CACHE]: {}, [STORAGE_KEYS.HEALTH_CACHE_GENERATION]: generation + 1, [STORAGE_KEYS.HEALTH_CACHE_KEY_VERSION]: 2 });
  }));
}

export async function awaitPendingHealthWrites() { await _writeChain; }
export function _resetHealthCacheServiceForTesting() { _writeChain = Promise.resolve(); }
export const _internals = Object.freeze({ _evictIfOverLimit, _stripExpired });
