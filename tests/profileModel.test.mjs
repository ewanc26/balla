import test from 'node:test';
import assert from 'node:assert/strict';
import {
  profileAssociatedCounts,
  profileIsLabeler,
  profilePinnedUri,
  profileVerification,
  verificationBadgeLabel,
} from '../src/lib/profileModel.ts';

const verifier = (issuer, overrides = {}) => ({
  issuer,
  issuerDisplayName: issuer,
  uri: `at://${issuer}/app.bsky.graph.verification/1`,
  isValid: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

test('verification only shows badges for valid lexicon statuses', () => {
  assert.deepEqual(
    profileVerification({
      verification: {
        verifiedStatus: 'valid',
        trustedVerifierStatus: 'valid',
        verifications: [],
      },
    }),
    { verified: true, verifier: true, verifiers: [] }
  );

  const none = profileVerification({
    verification: { verifiedStatus: 'none', trustedVerifierStatus: 'invalid' },
  });
  assert.equal(none.verified, false);
  assert.equal(none.verifier, false);
  assert.deepEqual(none.verifiers, []);

  const missing = profileVerification({});
  assert.equal(missing.verified, false);
  assert.equal(missing.verifier, false);
});

test('verifier list keeps valid entries, one per issuer, with honest names', () => {
  const summary = profileVerification({
    verification: {
      verifiedStatus: 'valid',
      trustedVerifierStatus: 'none',
      verifications: [
        verifier('did:plc:one', { issuerDisplayName: 'One', issuerHandle: 'one.test' }),
        verifier('did:plc:one', { issuerDisplayName: 'One again' }),
        verifier('did:plc:invalid', { isValid: false }),
        verifier('did:plc:two', { issuerDisplayName: '', issuerHandle: 'two.test' }),
        { issuer: '', isValid: true },
      ],
    },
  });

  assert.deepEqual(
    summary.verifiers.map((item) => [item.did, item.name, item.handle]),
    [
      ['did:plc:one', 'One', 'one.test'],
      ['did:plc:two', 'two.test', 'two.test'],
    ]
  );
  assert.equal(summary.verifiers[0].uri, 'at://did:plc:one/app.bsky.graph.verification/1');
  assert.equal(summary.verifiers[0].createdAt, '2026-01-01T00:00:00.000Z');
});

test('badge copy names the state without overclaiming', () => {
  assert.equal(
    verificationBadgeLabel(profileVerification({ verification: { verifiedStatus: 'valid' } })),
    'Verified account'
  );
  assert.equal(
    verificationBadgeLabel(
      profileVerification({ verification: { trustedVerifierStatus: 'valid' } })
    ),
    'Trusted verifier'
  );
  assert.equal(
    verificationBadgeLabel(
      profileVerification({
        verification: { verifiedStatus: 'valid', trustedVerifierStatus: 'valid' },
      })
    ),
    'Verified account and trusted verifier'
  );
  assert.equal(verificationBadgeLabel(profileVerification({})), '');
});

test('labeler state comes from the associated lexicon field', () => {
  assert.equal(profileIsLabeler({ associated: { labeler: true } }), true);
  assert.equal(profileIsLabeler({ associated: { labeler: false } }), false);
  assert.equal(profileIsLabeler({}), false);
});

test('associated counts are non-negative integers with honest zero defaults', () => {
  assert.deepEqual(
    profileAssociatedCounts({
      associated: { lists: 2, feedgens: 3, starterPacks: 1 },
    }),
    { lists: 2, feeds: 3, starterPacks: 1 }
  );
  assert.deepEqual(
    profileAssociatedCounts({
      associated: { lists: -4, feedgens: 1.9, starterPacks: 'lots' },
    }),
    { lists: 0, feeds: 1, starterPacks: 0 }
  );
  assert.deepEqual(profileAssociatedCounts({}), { lists: 0, feeds: 0, starterPacks: 0 });
});

test('pinned post is used only when it is a real AT-URI', () => {
  assert.equal(
    profilePinnedUri({ pinnedPost: { uri: 'at://did:plc:a/app.bsky.feed.post/1', cid: 'x' } }),
    'at://did:plc:a/app.bsky.feed.post/1'
  );
  assert.equal(profilePinnedUri({ pinnedPost: { uri: 'https://example.com' } }), undefined);
  assert.equal(profilePinnedUri({}), undefined);
});
