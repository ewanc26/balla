import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SNOOZE_DAYS,
  SNOOZE_MS,
  SNOOZED_ACCOUNTS_KEY,
  activeSnoozes,
  addSnooze,
  filterSnoozedItems,
  isSnoozed,
  normaliseSnoozes,
  removeSnooze,
  snoozeRemainingDays,
  snoozeRemainingLabel,
} from '../src/lib/snoozeModel.ts';

const now = Date.parse('2026-11-23T12:00:00.000Z');
const alice = 'did:plc:alice';
const bob = 'did:plc:bob';

test('a snooze is exactly 30 days and stored under one device key', () => {
  assert.equal(SNOOZE_DAYS, 30);
  assert.equal(SNOOZE_MS, 30 * 24 * 60 * 60 * 1000);
  assert.equal(SNOOZED_ACCOUNTS_KEY, 'balla.snoozedAccounts.v1');
});

test('stored records are validated rather than trusted', () => {
  assert.deepEqual(normaliseSnoozes(null), {});
  assert.deepEqual(normaliseSnoozes([]), {});
  assert.deepEqual(
    normaliseSnoozes({
      'not-a-did': { until: now + SNOOZE_MS },
      [alice]: { until: now + SNOOZE_MS, handle: '@alice.test' },
      [bob]: { until: 'tomorrow', handle: 'bob.test' },
      'did:plc:junk': { until: -1 },
    }),
    { [alice]: { until: now + SNOOZE_MS, handle: 'alice.test' } }
  );
});

test('adding and ending a snooze keep only one record per account', () => {
  const first = addSnooze({}, alice, 'alice.test', now);
  assert.deepEqual(first, {
    [alice]: { until: now + SNOOZE_MS, handle: 'alice.test' },
  });
  assert.equal(isSnoozed(first, alice, now), true);
  assert.equal(isSnoozed(first, bob, now), false);

  const extended = addSnooze(first, alice, 'alice.test', now + 1000);
  assert.equal(Object.keys(extended).length, 1);
  assert.equal(extended[alice].until, now + 1000 + SNOOZE_MS);

  assert.deepEqual(removeSnooze(extended, alice), {});
  assert.deepEqual(removeSnooze(first, bob), first);
  assert.deepEqual(addSnooze({}, 'junk', 'x', now), {});
});

test('expiry is honest and the countdown has no hidden grace', () => {
  const until = now + SNOOZE_MS;
  assert.equal(isSnoozed({ [alice]: { until } }, alice, now), true);
  assert.equal(isSnoozed({ [alice]: { until } }, alice, until), false);
  assert.equal(snoozeRemainingDays(until, now), 30);
  assert.equal(snoozeRemainingLabel(until, now), '30 days left');
  assert.equal(
    snoozeRemainingLabel(now + 23 * 24 * 60 * 60 * 1000, now),
    '23 days left'
  );
  assert.equal(
    snoozeRemainingLabel(now + 24 * 60 * 60 * 1000, now),
    '1 day left'
  );
  assert.equal(snoozeRemainingLabel(now, now), 'ending now');
});

test('the inspectable list only includes live snoozes, soonest first', () => {
  const records = {
    [alice]: { until: now + 2 * 24 * 60 * 60 * 1000, handle: 'alice.test' },
    [bob]: { until: now + 10 * 24 * 60 * 60 * 1000, handle: 'bob.test' },
    'did:plc:old': { until: now - 1, handle: 'old.test' },
  };
  assert.deepEqual(
    activeSnoozes(records, now).map((item) => [item.did, item.daysLeft]),
    [
      [alice, 2],
      [bob, 10],
    ]
  );
});

test('Home filtering skips the author and reposts by a snoozed account only', () => {
  const records = { [alice]: { until: now + SNOOZE_MS } };
  const alicePost = { post: { author: { did: alice }, uri: 'alice-post' } };
  const bobPost = { post: { author: { did: bob }, uri: 'bob-post' } };
  const repostByAlice = {
    post: { author: { did: bob }, uri: 'bob-post' },
    reason: {
      $type: 'app.bsky.feed.defs#reasonRepost',
      by: { did: alice },
    },
  };
  const pinnedByAlice = {
    post: { author: { did: bob }, uri: 'bob-post' },
    reason: {
      $type: 'app.bsky.feed.defs#reasonPin',
      by: { did: alice },
    },
  };
  const items = [alicePost, repostByAlice, bobPost, pinnedByAlice];

  assert.deepEqual(
    filterSnoozedItems(items, records, now).map((item) => item.post.uri),
    ['bob-post', 'bob-post']
  );
  assert.deepEqual(
    filterSnoozedItems(items, {}, now).map((item) => item.post.uri),
    ['alice-post', 'bob-post', 'bob-post', 'bob-post']
  );
});
