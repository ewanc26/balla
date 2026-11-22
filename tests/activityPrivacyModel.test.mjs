import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOW_OPTIONS,
  DECLARATION_COLLECTION,
  DECLARATION_RKEY,
  declarationRecord,
  normaliseAllowSubscriptions,
} from '../src/lib/activityPrivacyModel.ts';

test('uses the published collection and self rkey', () => {
  assert.equal(DECLARATION_COLLECTION, 'app.bsky.notification.declaration');
  assert.equal(DECLARATION_RKEY, 'self');
});

test('exposes exactly the three published allow values', () => {
  assert.deepEqual(
    ALLOW_OPTIONS.map((option) => option.value),
    ['followers', 'mutuals', 'none']
  );
});

test('an absent or unknown value defaults to followers', () => {
  assert.equal(normaliseAllowSubscriptions(undefined), 'followers');
  assert.equal(normaliseAllowSubscriptions('something-else'), 'followers');
  assert.equal(normaliseAllowSubscriptions('mutuals'), 'mutuals');
  assert.equal(normaliseAllowSubscriptions('none'), 'none');
});

test('the declaration record uses the lexicon $type and normalised value', () => {
  assert.deepEqual(declarationRecord('mutuals'), {
    $type: 'app.bsky.notification.declaration',
    allowSubscriptions: 'mutuals',
  });
  assert.equal(declarationRecord('bogus').allowSubscriptions, 'followers');
});
