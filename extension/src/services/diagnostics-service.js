/*
 * Bookmark Scope - Domain & Page Manager
 * Copyright (c) 2026 Ehsan Enaloo. Released under the MIT License.
 *
 * diagnostics-service.js
 *
 * Provides structured, levelled logging that persists events to chrome.storage.local.
 *
 * Race-condition fix (was #18): all writes are serialised through a module-level
 * promise chain (_writeChain). No two write operations can interleave, so the
 * read-modify-write sequence is always atomic from this module's perspective.
 *
 * I/O reduction: rapid consecutive log() calls are coalesced — pending entries
 * are batched into a single read + write per microtask flush, not one per call.
 */

import { getLocalStorage, setLocalStorage, withStorageLock } from './storage-service.js';
import { STORAGE_KEYS } from '../core/constants.js';

const MAX_DIAGNOSTIC_EVENTS = 200;
const DEFAULT_LEVEL = 'info';
const LEVELS = new Set(['debug', 'info', 'warn', 'error']);

// In production (non-debug) builds, skip persisting debug-level events to
// storage to reduce read-modify-write cycles during busy operations like
// health scans where hundreds of debug() calls can fire in quick succession.
// debug() still prints to console; it just does not hit storage.
const PERSIST_DEBUG_TO_STORAGE = false;

// ─── Serialised write queue ───────────────────────────────────────────────────

/** Entries queued for the next flush. */
let _pendingEntries = [];

/** Tail of the serialised write chain. */
let _writeChain = Promise.resolve();

/** True when a microtask flush is already queued for this tick. Prevents
 *  the case where N synchronous log() calls each enqueue a flushPending
 *  microtask — only the first does any work, but scheduling N microtasks
 *  still costs N enqueues + N task transitions. With the flag, a burst
 *  of logs queues exactly one flush. */
let _flushScheduled = false;

function flushPending() {
  _flushScheduled = false;
  if (!_pendingEntries.length) return;
  const toWrite = _pendingEntries.splice(0); // drain atomically before any await
  _writeChain = _writeChain.then(async () => {
    try {
      await withStorageLock(async () => {
      const stored = await getLocalStorage([STORAGE_KEYS.DIAGNOSTIC_EVENTS]);
      const current = Array.isArray(stored[STORAGE_KEYS.DIAGNOSTIC_EVENTS])
        ? stored[STORAGE_KEYS.DIAGNOSTIC_EVENTS]
        : [];
      // Prepend newest-first, then cap at the limit in one slice.
      const next = [...toWrite, ...current].slice(0, MAX_DIAGNOSTIC_EVENTS);
      await setLocalStorage({ [STORAGE_KEYS.DIAGNOSTIC_EVENTS]: next });
      });
    } catch (error) {
      console.warn('[BookmarkScope:diagnostics] Failed to persist diagnostic events.', error);
    }
  });
}

function _scheduleFlush() {
  if (_flushScheduled) return;
  _flushScheduled = true;
  Promise.resolve().then(flushPending);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeLevel(level) {
  return LEVELS.has(level) ? level : DEFAULT_LEVEL;
}

function serializeDetails(details) {
  if (!details || typeof details !== 'object') return details ?? null;
  try {
    return JSON.parse(JSON.stringify(details));
  } catch {
    return { note: 'details_not_serializable' };
  }
}

function makeEntryId() {
  // Timestamp + random suffix — sufficient uniqueness without crypto overhead.
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a scoped logger. All loggers share the module-level write queue so
 * concurrent log() calls from different scopes never race each other.
 *
 * @param {string} scope  Short identifier shown in console output (e.g. 'popup').
 * @returns {{ debug, info, warn, error }}
 */
export function createLogger(scope) {
  const normalizedScope = String(scope || 'app');

  function record(level, event, details = null) {
    const entry = {
      id: makeEntryId(),
      ts: new Date().toISOString(),
      scope: normalizedScope,
      level: normalizeLevel(level),
      event: String(event || 'unknown_event'),
      details: serializeDetails(details)
    };

    const method = entry.level === 'error' ? 'error' : entry.level === 'warn' ? 'warn' : 'log';
    console[method](`[BookmarkScope:${entry.scope}] ${entry.event}`, entry.details || '');

    // Skip queueing debug events to storage in production to reduce I/O.
    if (entry.level === 'debug' && !PERSIST_DEBUG_TO_STORAGE) return entry;

    // Queue and schedule a single microtask flush per tick so a burst of
    // log() calls in one synchronous run produces one storage write, not N.
    _pendingEntries.push(entry);
    _scheduleFlush();

    return entry;
  }

  return Object.freeze({
    debug(event, details) { return record('debug', event, details); },
    info(event, details)  { return record('info',  event, details); },
    warn(event, details)  { return record('warn',  event, details); },
    error(event, details) { return record('error', event, details); }
  });
}

/**
 * Returns all persisted diagnostic events, newest first.
 * @returns {Promise<Array>}
 */
export async function getDiagnosticEvents() {
  const stored = await getLocalStorage([STORAGE_KEYS.DIAGNOSTIC_EVENTS]);
  return Array.isArray(stored[STORAGE_KEYS.DIAGNOSTIC_EVENTS])
    ? stored[STORAGE_KEYS.DIAGNOSTIC_EVENTS]
    : [];
}

export async function awaitPendingDiagnosticWrites() {
  await Promise.resolve(); // run the scheduled microtask flush first
  await _writeChain;
}
