import { addStorageChangedListener, storageGet, storageSet } from '../platform/browser-api.js';
import { ensureStorageSchema } from './storage-schema.js';

let storageInitializationPromise = null;

export async function initializeStorageLayer() {
  if (!storageInitializationPromise) {
    storageInitializationPromise = ensureStorageSchema().catch((error) => {
      storageInitializationPromise = null;
      throw error;
    });
  }
  return storageInitializationPromise;
}

export async function getLocalStorage(keys) {
  return storageGet(keys);
}

export async function setLocalStorage(values) {
  return storageSet(values);
}

// One lock name for every shared read/modify/write, including schema migration.
// Web Locks span same-origin extension pages and their service worker.
export function withStorageLock(operation) {
  if (!globalThis.navigator?.locks?.request) {
    throw new Error('This browser requires Web Locks for safe shared storage writes.');
  }
  return globalThis.navigator.locks.request('bookmark-scope-storage', operation);
}

export function addLocalStorageListener(listener) {
  return addStorageChangedListener(listener);
}
