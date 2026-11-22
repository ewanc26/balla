import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ACCOUNT_PREFERENCES,
  gatesToInteractionPref,
  interactionPrefToGates,
  normaliseInterests,
  readAccountPreferences,
} from '../src/lib/accountPreferencesModel.ts';

const LIST = 'at://did:plc:owner/app.bsky.graph.list/3lxyz';

test('missing preferences map to published defaults', () => {
  assert.deepEqual(readAccountPreferences(undefined), DEFAULT_ACCOUNT_PREFERENCES);
  assert.deepEqual(readAccountPreferences({}), DEFAULT_ACCOUNT_PREFERENCES);
  assert.deepEqual(readAccountPreferences({ verificationPrefs: { hideBadges: 'yes' } }).hideVerificationBadges, false);
});

test('verification, interests and gate preferences are read from their published fields', () => {
  const prefs = {
    verificationPrefs: { hideBadges: true },
    interests: { tags: ['#Photography', 'photography', 'gd', 7] },
    postInteractionSettings: {
      threadgateAllowRules: [{ $type: 'app.bsky.feed.threadgate#followerRule' }],
      postgateEmbeddingRules: [{ $type: 'app.bsky.feed.postgate#disableRule' }],
    },
  };
  const result = readAccountPreferences(prefs);
  assert.equal(result.hideVerificationBadges, true);
  assert.deepEqual(result.interests, ['photography', 'gd']);
  assert.equal(result.defaultGates.reply, 'followers');
  assert.equal(result.defaultGates.quote, 'nobody');
});

test('list rules round-trip through the account preference', () => {
  const gates = { reply: 'list', quote: 'everyone', listUri: LIST };
  const pref = gatesToInteractionPref(gates);
  assert.deepEqual(pref.threadgateAllowRules, [
    { $type: 'app.bsky.feed.threadgate#listRule', list: LIST },
  ]);
  assert.equal(pref.postgateEmbeddingRules, undefined);
  assert.deepEqual(interactionPrefToGates(pref), gates);
});

test('open defaults write no rules, and closed rules are explicit', () => {
  assert.deepEqual(gatesToInteractionPref({ reply: 'everyone', quote: 'everyone' }), {
    threadgateAllowRules: undefined,
    postgateEmbeddingRules: undefined,
  });
  const closed = gatesToInteractionPref({ reply: 'nobody', quote: 'nobody' });
  assert.deepEqual(closed.threadgateAllowRules, []);
  assert.deepEqual(closed.postgateEmbeddingRules, [
    { $type: 'app.bsky.feed.postgate#disableRule' },
  ]);
});

test('interests are bounded, de-duplicated and never invented', () => {
  assert.deepEqual(normaliseInterests(null), []);
  assert.deepEqual(normaliseInterests(['#Tea', 'tea', '', '  ', 5]), ['tea']);
  assert.equal(normaliseInterests(Array.from({ length: 40 }, (_, i) => `tag${i}`)).length, 30);
});
