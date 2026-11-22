import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VERIFICATION_COLLECTION,
  canVerifyProfile,
  issuedVerificationUris,
  recordKeyFromUri,
  verificationRecord,
  viewerIsVerifier,
} from '../src/lib/verificationActionsModel.ts';

const VIEWER = 'did:plc:verifier';
const SUBJECT = 'did:plc:subject';

test('verifier role covers valid and invalid trusted status, like the official client', () => {
  assert.equal(viewerIsVerifier({ verification: { trustedVerifierStatus: 'valid' } }), true);
  assert.equal(viewerIsVerifier({ verification: { trustedVerifierStatus: 'invalid' } }), true);
  assert.equal(viewerIsVerifier({ verification: { trustedVerifierStatus: 'unknown' } }), false);
  assert.equal(viewerIsVerifier(undefined), false);
});

test('a verifier can verify another account but never themselves', () => {
  const verifier = { did: VIEWER, verification: { trustedVerifierStatus: 'valid' } };
  assert.equal(canVerifyProfile(verifier, SUBJECT), true);
  assert.equal(canVerifyProfile(verifier, VIEWER), false);
  assert.equal(canVerifyProfile(verifier, undefined), false);
  assert.equal(canVerifyProfile(undefined, SUBJECT), false);
});

test('issued verification URIs are limited to the viewer as issuer', () => {
  const target = {
    verification: {
      verifications: [
        { issuer: VIEWER, uri: 'at://did:plc:verifier/app.bsky.graph.verification/abc' },
        { issuer: 'did:plc:other', uri: 'at://did:plc:other/app.bsky.graph.verification/def' },
        { issuer: VIEWER },
      ],
    },
  };
  assert.deepEqual(issuedVerificationUris(target, VIEWER), [
    'at://did:plc:verifier/app.bsky.graph.verification/abc',
  ]);
  assert.deepEqual(issuedVerificationUris({}, VIEWER), []);
});

test('a verification record uses the published lexicon and subject identity', () => {
  const record = verificationRecord(
    { did: SUBJECT, handle: 'subject.bsky.social', displayName: 'Subject' },
    '2026-01-01T00:00:00.000Z'
  );
  assert.equal(record.$type, VERIFICATION_COLLECTION);
  assert.equal(record.subject, SUBJECT);
  assert.equal(record.handle, 'subject.bsky.social');
  assert.equal(record.displayName, 'Subject');
  assert.equal(record.createdAt, '2026-01-01T00:00:00.000Z');
});

test('a subject without a DID or handle cannot be verified', () => {
  assert.equal(verificationRecord({ handle: 'a.test' }, '2026-01-01T00:00:00.000Z'), null);
  assert.equal(verificationRecord({ did: SUBJECT }, '2026-01-01T00:00:00.000Z'), null);
});

test('record keys are extracted only from AT-URIs', () => {
  assert.equal(recordKeyFromUri('at://did:plc:verifier/app.bsky.graph.verification/abc'), 'abc');
  assert.equal(recordKeyFromUri('https://example.com/abc'), null);
  assert.equal(recordKeyFromUri('at://did:plc:verifier/app.bsky.graph.verification/'), null);
});
