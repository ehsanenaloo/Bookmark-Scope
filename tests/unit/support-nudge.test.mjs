import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fakeBrowser, folder, leaf } from '../helpers/browser.mjs';
import { setNowProviderForTesting } from '../../extension/src/platform/time.js';
import { STORAGE_KEYS } from '../../extension/src/core/constants.js';
import {
  SUPPORT_NUDGE_BADGE_COLOR,
  SUPPORT_NUDGE_BADGE_TEXT,
  isSupportNudgeDue,
  markSupportNudgeShown,
  normalizeSupportNudge,
  optOutSupportNudge,
  readSupportNudge,
  seedSupportNudge
} from '../../extension/src/services/support-nudge-service.js';

const DAY = 86400000;
const T0 = Date.UTC(2026, 0, 1);
const KEY = STORAGE_KEYS.SUPPORT_NUDGE;
test.afterEach(() => setNowProviderForTesting(null));

test('nothing is due before the 14-day grace period and again from day 14', () => {
  const nudge = { installedAt: T0 };
  assert.equal(isSupportNudgeDue(nudge, T0), false);
  assert.equal(isSupportNudgeDue(nudge, T0 + 14 * DAY - 1), false);
  assert.equal(isSupportNudgeDue(nudge, T0 + 14 * DAY), true);
});

test('after a display the next one is due 30 days later, not before', () => {
  const nudge = { installedAt: T0, lastShownAt: T0 + 20 * DAY, shownCount: 1 };
  assert.equal(isSupportNudgeDue(nudge, T0 + 20 * DAY), false);
  assert.equal(isSupportNudgeDue(nudge, T0 + 30 * DAY), false);
  assert.equal(isSupportNudgeDue(nudge, T0 + 50 * DAY - 1), false);
  assert.equal(isSupportNudgeDue(nudge, T0 + 50 * DAY), true);
});

test('opt out, missing state and corrupt state are never due', () => {
  assert.equal(isSupportNudgeDue({ installedAt: T0, optOut: true }, T0 + 400 * DAY), false);
  assert.equal(isSupportNudgeDue(null, T0 + 400 * DAY), false);
  assert.equal(isSupportNudgeDue('x', T0 + 400 * DAY), false);
  assert.equal(isSupportNudgeDue([], T0 + 400 * DAY), false);
  assert.equal(isSupportNudgeDue({ installedAt: 'soon' }, T0 + 400 * DAY), false);
  assert.deepEqual(normalizeSupportNudge({ installedAt: -5, lastShownAt: 'a', shownCount: 2.7, optOut: 'yes' }), { installedAt: 0, lastShownAt: 0, shownCount: 2, optOut: false });
});

test('seeding starts the grace period once and keeps existing state and opt out', async () => {
  const x = fakeBrowser([folder('P', [leaf('A')])]);
  setNowProviderForTesting(() => T0);
  await seedSupportNudge();
  assert.deepEqual(x.stored[KEY], { installedAt: T0, lastShownAt: 0, shownCount: 0, optOut: false });
  setNowProviderForTesting(() => T0 + 99 * DAY);
  await seedSupportNudge();
  assert.equal(x.stored[KEY].installedAt, T0);
  await optOutSupportNudge();
  await seedSupportNudge();
  assert.equal(x.stored[KEY].optOut, true);
  assert.equal(isSupportNudgeDue(await readSupportNudge(), T0 + 999 * DAY), false);
});

test('seeding repairs a stored value that lacks an install time without dropping the opt out', async () => {
  const x = fakeBrowser([folder('P', [leaf('A')])], { [KEY]: { optOut: true } });
  setNowProviderForTesting(() => T0);
  await seedSupportNudge();
  assert.deepEqual(x.stored[KEY], { installedAt: T0, lastShownAt: 0, shownCount: 0, optOut: true });
});

test('the full cycle: day 13 nothing, day 15 shown, 10 days later quiet, 31 days later shown again', async () => {
  const x = fakeBrowser([folder('P', [leaf('A')])]);
  setNowProviderForTesting(() => T0);
  await seedSupportNudge();
  const dueAt = async (offset) => { setNowProviderForTesting(() => T0 + offset * DAY); return isSupportNudgeDue(await readSupportNudge()); };
  assert.equal(await dueAt(13), false);
  assert.equal(await dueAt(15), true);
  setNowProviderForTesting(() => T0 + 15 * DAY);
  await markSupportNudgeShown();
  assert.equal(x.stored[KEY].shownCount, 1);
  assert.equal(await dueAt(15), false);
  assert.equal(await dueAt(25), false);
  assert.equal(await dueAt(46), true);
  setNowProviderForTesting(() => T0 + 46 * DAY);
  await markSupportNudgeShown();
  assert.equal(x.stored[KEY].shownCount, 2);
});

test('simultaneous writers from two pages do not lose a count or an opt out', async () => {
  const x = fakeBrowser([folder('P', [leaf('A')])]);
  setNowProviderForTesting(() => T0);
  const other = await import('../../extension/src/services/support-nudge-service.js?second-page');
  await seedSupportNudge();
  await Promise.all([markSupportNudgeShown(), other.markSupportNudgeShown(), optOutSupportNudge()]);
  assert.equal(x.stored[KEY].shownCount, 2);
  assert.equal(x.stored[KEY].optOut, true);
});

test('schema initialization and the options reset leave the reminder state alone', async () => {
  const { ensureStorageSchema, OPTION_PAGE_DEFAULTS } = await import('../../extension/src/services/storage-schema.js');
  const x = fakeBrowser([folder('P', [leaf('A')])], { [KEY]: { installedAt: T0, optOut: true, shownCount: 3 } });
  await ensureStorageSchema();
  assert.deepEqual(x.stored[KEY], { installedAt: T0, optOut: true, shownCount: 3 });
  assert.equal(Object.hasOwn(OPTION_PAGE_DEFAULTS, KEY), false);
});

const source = fs.readFileSync(new URL('../../extension/background.js', import.meta.url), 'utf8');
async function badge({ due, count, url = 'https://example.test/a' }) {
  const calls = {};
  const context = vm.createContext({
    console, STORAGE_KEYS, SUPPORT_NUDGE_BADGE_COLOR, SUPPORT_NUDGE_BADGE_TEXT,
    MATCH_MODES: { PAGE: 'page', HOST: 'host', DOMAIN: 'domain' },
    getMatchTarget: (u) => ({ valid: /^https?:/.test(u), url: u }),
    matchesMode: () => true,
    getTab: async () => ({ url }),
    getLocalStorage: async () => ({}),
    getNormalizedBookmarks: async () => Array.from({ length: count }, () => ({})),
    isSupportHeartDue: async () => due,
    setBadgeBackgroundColor: async (value) => { calls.color = value.color; },
    setBadgeText: async (value) => { calls.text = value.text; }
  });
  vm.runInContext(source.slice(source.indexOf('async function setBadgeForActiveTab'), source.indexOf('async function refreshBadgeForCurrentTab')), context);
  await vm.runInContext('setBadgeForActiveTab(1)', context);
  return calls;
}

test('the toolbar badge shows the heart before the count only while the reminder is due', async () => {
  assert.deepEqual(await badge({ due: true, count: 12 }), { color: SUPPORT_NUDGE_BADGE_COLOR, text: '♥12' });
  assert.deepEqual(await badge({ due: true, count: 0 }), { color: SUPPORT_NUDGE_BADGE_COLOR, text: '♥' });
  assert.deepEqual(await badge({ due: false, count: 12 }), { color: '#2563eb', text: '12' });
  assert.deepEqual(await badge({ due: false, count: 0 }), { color: '#2563eb', text: '' });
});

test('pages that are not valid web pages never get the heart', async () => {
  const calls = await badge({ due: true, count: 3, url: 'chrome://extensions/' });
  assert.equal(calls.text, '');
});
