/* Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License. */
import { STORAGE_KEYS, OPTIONAL_HOST_PATTERNS, HEALTH_SCAN_LOCK_NAME } from '../core/constants.js';
import { containsPermissions } from '../platform/browser-api.js';
import { getLocalStorage, setLocalStorage, withStorageLock } from './storage-service.js';
import { getHealthCacheGeneration, writeHealthRecords } from './health-cache-service.js';
import { shouldSkipHealthCheck } from '../background/health-check.js';
import { urlIdentity } from './maintenance-preview-service.js';

/*
 * Resumable scan job.
 *
 * Format 2 keeps two storage records so progress is cheap to save:
 *   healthScanJob      small progress record, rewritten at every checkpoint:
 *                      { version: 2, id, createdAt, updatedAt, status, total,
 *                        cursor, counts, lastError, failedAt }
 *   healthScanTargets  { jobId, targets: [{ key, url }] }, written once when the
 *                      job is created and cleared when it completes or is canceled.
 * Targets are scanned in order and checkpoints advance a single cursor, so the
 * completed work is always the prefix targets[0..cursor). A job stored in the
 * earlier format 1 (targets, completed and outcomes in one record) is upgraded
 * the first time it is read.
 *
 * Statuses: ready, running, paused (user or stop request), failed (an
 * unexpected error; lastError and failedAt say why, resume retries), canceled,
 * completed. A job still marked running with no scan holding the lock was
 * interrupted (the page or worker ended); recoverInterruptedScan turns it into
 * paused.
 */

export const SCAN_JOB_VERSION = 2;
export const SCAN_MAX_TARGETS = 50000;
// Fetched records are saved together. A crash loses at most this many results
// (the addresses are checked again on resume); the cursor never passes a record
// that is not in the cache.
export const SCAN_CHECKPOINT_RECORDS = 20;
export const SCAN_CHECKPOINT_MS = 3000;
const STATUSES = ['ready', 'running', 'paused', 'failed', 'canceled', 'completed'];
const FINAL_STATUSES = ['canceled', 'completed'];

function validMeta(job) {
  return job && [1, 2].includes(job.version) && STATUSES.includes(job.status)
    && (job.version === 1 ? Array.isArray(job.targets) && Array.isArray(job.completed) : Number.isInteger(job.total) && Number.isInteger(job.cursor));
}

async function readJob() {
  const job = (await getLocalStorage([STORAGE_KEYS.HEALTH_SCAN_JOB]))[STORAGE_KEYS.HEALTH_SCAN_JOB];
  if (!job) return null;
  if (!validMeta(job)) throw new Error('Invalid scan job.');
  return job;
}

// Format 1 -> 2. Completed work stays a prefix: the cursor stops at the first
// target that was not completed, so nothing unchecked is ever skipped.
function upgradeJob(legacy) {
  const done = new Set(legacy.completed);
  let cursor = 0;
  while (cursor < legacy.targets.length && done.has(legacy.targets[cursor].key)) cursor += 1;
  const counts = {};
  for (const status of Object.values(legacy.outcomes || {})) counts[status] = (counts[status] || 0) + 1;
  const meta = {
    version: SCAN_JOB_VERSION, id: legacy.id, createdAt: legacy.createdAt, updatedAt: Date.now(), status: legacy.status,
    total: legacy.targets.length, cursor, counts, lastError: '', failedAt: 0
  };
  return { meta, targets: { jobId: legacy.id, targets: legacy.targets } };
}

async function upgradeIfNeeded(job, alreadyLocked) {
  if (!job || job.version !== 1) return job;
  const run = async () => {
    const fresh = await readJob();
    if (!fresh || fresh.version !== 1) return fresh;
    const { meta, targets } = upgradeJob(fresh);
    await setLocalStorage({ [STORAGE_KEYS.HEALTH_SCAN_JOB]: meta, [STORAGE_KEYS.HEALTH_SCAN_TARGETS]: targets });
    return meta;
  };
  return alreadyLocked ? run() : withStorageLock(run);
}

/** Progress record of the saved job (no targets), or null. */
export async function loadScanJob() {
  return upgradeIfNeeded(await readJob(), false);
}

export async function loadScanTargets(jobId) {
  const stored = (await getLocalStorage([STORAGE_KEYS.HEALTH_SCAN_TARGETS]))[STORAGE_KEYS.HEALTH_SCAN_TARGETS];
  if (!stored || stored.jobId !== jobId || !Array.isArray(stored.targets)) throw new Error('Scan targets are missing.');
  return stored.targets;
}

export function scanCoverage(job) {
  const total = job?.total ?? job?.targets?.length ?? 0;
  const completed = job?.cursor ?? new Set(job?.completed || []).size;
  return { total, completed, remaining: Math.max(0, total - completed), status: job?.status || 'none' };
}

async function mutateJob(id, mutate) {
  return withStorageLock(async () => {
    const job = await upgradeIfNeeded(await readJob(), true);
    if (job?.id !== id) throw new Error('Scan job changed.');
    await mutate(job);
    job.updatedAt = Date.now();
    const values = { [STORAGE_KEYS.HEALTH_SCAN_JOB]: job };
    // A finished or canceled job never resumes, so its target list is released.
    if (FINAL_STATUSES.includes(job.status)) values[STORAGE_KEYS.HEALTH_SCAN_TARGETS] = null;
    await setLocalStorage(values);
    return job;
  });
}

export function buildScanTargets(bookmarks, options = {}) {
  return [...new Map(bookmarks.filter(row => !shouldSkipHealthCheck(row.url)).map(row => {
    let valid = false;
    try { valid = ['http:', 'https:'].includes(new URL(row.url).protocol); } catch {}
    return valid ? [urlIdentity(row.url, options), { key: urlIdentity(row.url, options), url: row.url }] : ['', null];
  }).filter(([, row]) => row)).values()];
}

export async function createScanJob(bookmarks, options = {}) {
  return navigator.locks.request(HEALTH_SCAN_LOCK_NAME, { ifAvailable: true }, async lock => {
    if (!lock) throw new Error('A scan is already running.');
    const targets = buildScanTargets(bookmarks, options);
    if (!targets.length || targets.length > SCAN_MAX_TARGETS) throw new Error('Scan needs between 1 and 50,000 supported URLs.');
    const job = {
      version: SCAN_JOB_VERSION, id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now(), status: 'ready',
      total: targets.length, cursor: 0, counts: {}, lastError: '', failedAt: 0
    };
    await withStorageLock(() => setLocalStorage({ [STORAGE_KEYS.HEALTH_SCAN_JOB]: job, [STORAGE_KEYS.HEALTH_SCAN_TARGETS]: { jobId: job.id, targets } }));
    return job;
  });
}

export async function controlScanJob(id, status) {
  if (!['paused', 'canceled'].includes(status)) throw new Error('Invalid scan control.');
  return mutateJob(id, job => {
    if (FINAL_STATUSES.includes(job.status)) return;
    // A pause request must not hide the reason a job failed.
    if (status === 'paused' && job.status === 'failed') return;
    job.status = status;
  });
}

/**
 * A job still marked running while no scan holds the lock was cut off by a
 * closed page or a stopped worker. It becomes paused so it can be resumed.
 */
export async function recoverInterruptedScan() {
  const job = await loadScanJob();
  if (!job || job.status !== 'running') return job;
  const query = navigator.locks?.query;
  if (typeof query !== 'function') return job;
  const held = (await navigator.locks.query()).held || [];
  if (held.some(lock => lock.name === HEALTH_SCAN_LOCK_NAME)) return job;
  return mutateJob(job.id, current => { if (current.status === 'running') current.status = 'paused'; });
}

export async function runScanJob(id, { fetchHealth, onProgress = () => {}, shouldStop = () => false } = {}) {
  if (typeof fetchHealth !== 'function') throw new Error('Scan requires a health request function.');
  return navigator.locks.request(HEALTH_SCAN_LOCK_NAME, { ifAvailable: true }, async lock => {
    if (!lock) throw new Error('A scan is already running.');
    let job = await loadScanJob();
    if (job?.id !== id || job.status === 'canceled') throw new Error('Scan is unavailable or canceled.');
    if (job.status === 'completed') return job;
    if (!await containsPermissions({ origins: [...OPTIONAL_HOST_PATTERNS] })) throw new Error('Health scan permission is required.');
    const generation = await getHealthCacheGeneration();
    const targets = await loadScanTargets(id);
    if (targets.length !== job.total) throw new Error('Scan targets are missing.');
    job = await mutateJob(id, current => {
      if (current.status === 'canceled') throw new Error('Scan was canceled.');
      // Every target was already saved (a pause landed in the last checkpoint): nothing is left to run.
      current.status = current.cursor >= current.total ? 'completed' : 'running';
      current.lastError = '';
      current.failedAt = 0;
    });
    if (job.status === 'completed') return job;

    // Work done since the last checkpoint: fetched records and the position after them.
    let batch = [];
    let position = job.cursor;
    const counts = { ...job.counts };
    let lastCheckpoint = Date.now();

    async function checkpoint() {
      if (!batch.length) return true;
      const records = batch;
      batch = [];
      lastCheckpoint = Date.now();
      const written = await writeHealthRecords(records, generation);
      if (!written) { await controlScanJob(id, 'paused'); return false; }
      job = await mutateJob(id, latest => {
        if (FINAL_STATUSES.includes(latest.status)) return;
        latest.cursor = position;
        latest.counts = { ...counts };
        if (latest.cursor >= latest.total && ['running', 'paused'].includes(latest.status)) latest.status = 'completed';
      });
      return true;
    }

    try {
      for (let index = job.cursor; index < targets.length; index += 1) {
        const live = await readJob();
        if (live?.id !== id) throw new Error('Scan job changed.');
        if (live.status !== 'running' || shouldStop()) break;
        const target = targets[index];
        const record = await fetchHealth(target.url);
        const current = await readJob();
        if (current?.id !== id || current.status !== 'running' || shouldStop()) break;
        if (!record || record.aborted) { await controlScanJob(id, 'paused'); break; }
        batch.push({ key: target.key, record });
        position = index + 1;
        counts[record.status] = (counts[record.status] || 0) + 1;
        const last = position >= targets.length;
        if (last || batch.length >= SCAN_CHECKPOINT_RECORDS || Date.now() - lastCheckpoint >= SCAN_CHECKPOINT_MS) {
          if (!await checkpoint()) break;
        }
        await onProgress({ ...job, status: 'running', cursor: position, counts: { ...counts } });
      }
      await checkpoint();
    } catch (error) {
      try { await checkpoint(); } catch { /* the original error is the one to report */ }
      try {
        job = await mutateJob(id, latest => {
          if (FINAL_STATUSES.includes(latest.status) || latest.status === 'paused') return;
          latest.status = 'failed';
          latest.lastError = String(error?.message || error).slice(0, 300);
          latest.failedAt = Date.now();
        });
      } catch { /* the job was replaced or storage is unavailable */ }
      throw error;
    } finally {
      const latest = await loadScanJob().catch(() => null);
      if (latest?.id === id && latest.status === 'running') job = await controlScanJob(id, 'paused');
      else if (latest?.id === id) job = latest;
    }
    return job;
  });
}
