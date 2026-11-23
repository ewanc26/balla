import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyHandleInput,
  didFromWellKnown,
  hostProbeCopy,
  normaliseHostUrl,
  serverFacts,
  wellKnownUrl,
  OPEN_PDS_DIRECTORY,
} from '../src/lib/hostingModel.ts';

const DID = 'did:plc:3434wfandtk52wlqq4u5g72a';

test('well-known URLs come from the handle’s own host', () => {
  assert.equal(
    wellKnownUrl('alice.selfhosted.social'),
    'https://alice.selfhosted.social/.well-known/atproto-did'
  );
  assert.equal(wellKnownUrl('@Bob.Example.com'), 'https://bob.example.com/.well-known/atproto-did');
  assert.equal(wellKnownUrl('alice'), null);
  assert.equal(wellKnownUrl('https://alice.example.com'), null);
  assert.equal(wellKnownUrl('alice.example.com/x'), null);
});

test('a DID is read from the first well-known line only', () => {
  assert.equal(didFromWellKnown(`${DID}\n<!DOCTYPE html>`), DID);
  assert.equal(didFromWellKnown(`  ${DID}  `), DID);
  assert.equal(didFromWellKnown('did:web:example.com'), 'did:web:example.com');
  assert.equal(didFromWellKnown('<!DOCTYPE html><html>'), null);
  assert.equal(didFromWellKnown('did:plc:not valid'), null);
  assert.equal(didFromWellKnown(null), null);
});

test('sign-in input is split into the three shapes OAuth accepts', () => {
  assert.deepEqual(classifyHandleInput(' @Alice.Example.com '), {
    kind: 'handle',
    value: 'alice.example.com',
  });
  assert.deepEqual(classifyHandleInput(DID), { kind: 'did', value: DID });
  // A bare domain is a valid handle and is classified as one; an explicit
  // URL is the unambiguous PDS-host form.
  assert.deepEqual(classifyHandleInput('selfhosted.social'), {
    kind: 'handle',
    value: 'selfhosted.social',
  });
  assert.deepEqual(classifyHandleInput('https://pds.example.com'), {
    kind: 'host',
    value: 'https://pds.example.com',
  });
  assert.deepEqual(classifyHandleInput(''), { kind: 'invalid' });
  assert.deepEqual(classifyHandleInput('has spaces'), { kind: 'invalid' });
});

test('host URLs are canonical https origins without paths or credentials', () => {
  assert.equal(normaliseHostUrl('selfhosted.social'), 'https://selfhosted.social');
  assert.equal(normaliseHostUrl('HTTPS://pds.example.com/'), 'https://pds.example.com');
  assert.equal(normaliseHostUrl('https://pds.example.com/path'), null);
  assert.equal(normaliseHostUrl('http://pds.example.com'), null);
  assert.equal(normaliseHostUrl('https://user@pds.example.com'), null);
  assert.equal(normaliseHostUrl('https://pds.example.com?q=1'), null);
});

test('server facts are read from structured fields, never from message text', () => {
  const facts = serverFacts({
    did: 'did:web:selfhosted.social',
    availableUserDomains: ['.selfhosted.social', ''],
    inviteCodeRequired: false,
    phoneVerificationRequired: true,
    links: { privacyPolicy: 'https://example.test/privacy' },
    message: 'private operator note',
  });
  assert.deepEqual(facts, {
    did: 'did:web:selfhosted.social',
    domains: ['.selfhosted.social'],
    inviteRequired: false,
    phoneRequired: true,
    hasPolicyLinks: true,
  });
  assert.equal(serverFacts({ message: 'did:web:fake.test' }), null);
  assert.equal(serverFacts(null), null);
});

test('host probe copy explains each state honestly', () => {
  for (const state of ['idle', 'checking', 'reachable', 'not-atproto', 'unreachable', 'invalid']) {
    assert.ok(hostProbeCopy(state).length > 10, state);
  }
  assert.match(hostProbeCopy('not-atproto'), /not with a valid AT Protocol/);
  assert.match(OPEN_PDS_DIRECTORY, /^https:\/\//);
});
