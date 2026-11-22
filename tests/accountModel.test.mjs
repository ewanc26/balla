import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNTS_KEY,
  MOCK_ACCOUNTS,
  accountLabel,
  accountSubtitle,
  handleFromInput,
  isDid,
  isHandle,
  nextActiveDid,
  normaliseAccountHandle,
  parseAccounts,
  removeAccount,
  serialiseAccounts,
  shortenDid,
  upsertAccount,
} from '../src/lib/accountModel.ts';

const viewer = { did: 'did:plc:viewer123456789', handle: 'ewan.bsky.social' };
const other = { did: 'did:plc:other987654321', handle: 'mum.bsky.social' };

test('the registry key is versioned and holds no tokens', () => {
  assert.equal(ACCOUNTS_KEY, 'balla.oauth.accounts.v1');
  assert.doesNotMatch(ACCOUNTS_KEY, /token|session/i);
});

test('normalising input strips spaces and the at sign', () => {
  assert.equal(normaliseAccountHandle('  @ewan.bsky.social  '), 'ewan.bsky.social');
  assert.equal(normaliseAccountHandle('e wan.bsky.social'), 'ewan.bsky.social');
});

test('handle detection rejects DIDs, URLs and bare words', () => {
  assert.equal(isDid('did:plc:abc123'), true);
  assert.equal(isDid('ewan.bsky.social'), false);
  assert.equal(isHandle('ewan.bsky.social'), true);
  assert.equal(isHandle('@ewan.bsky.social'), true);
  assert.equal(isHandle('did:plc:abc123'), false);
  assert.equal(isHandle('https://bsky.social'), false);
  assert.equal(isHandle('bsky.social'), true);
  assert.equal(isHandle('hello'), false);
  assert.equal(handleFromInput('did:plc:abc123'), null);
  assert.equal(handleFromInput('@mum.bsky.social'), 'mum.bsky.social');
});

test('display labels prefer a handle but shorten a DID honestly', () => {
  assert.equal(accountLabel(viewer), '@ewan.bsky.social');
  assert.equal(accountLabel({ did: viewer.did, handle: null }), 'did:plc:viewer…6789');
  assert.equal(accountSubtitle(viewer), 'did:plc:viewer…6789');
  assert.equal(accountSubtitle({ did: viewer.did, handle: null }), 'AT Protocol account');
  assert.equal(shortenDid('did:web:example.com'), 'did:web:example.com');
});

test('parsing drops malformed and duplicate entries without inventing handles', () => {
  const raw = JSON.stringify([
    viewer,
    { ...viewer, handle: 'duplicate.test' },
    { did: 'not a did', handle: 'bad.test' },
    { handle: 'nodid.test' },
    { did: other.did, handle: 'did:plc:notahandle' },
    null,
  ]);
  assert.deepEqual(parseAccounts(raw), [viewer, { did: other.did, handle: null }]);
  assert.deepEqual(parseAccounts('not json'), []);
  assert.deepEqual(parseAccounts(null), []);
  assert.deepEqual(parseAccounts('{}'), []);
});

test('serialisation round-trips only DID and handle fields', () => {
  const raw = serialiseAccounts([viewer, other]);
  assert.deepEqual(JSON.parse(raw), [viewer, other]);
  assert.doesNotMatch(raw, /access_token|refresh_token|dpop/i);
});

test('upsert keeps one entry per DID and moves it to the end', () => {
  const start = [viewer, other];
  assert.deepEqual(upsertAccount(start, { ...viewer, handle: 'new.bsky.social' }), [
    other,
    { ...viewer, handle: 'new.bsky.social' },
  ]);
  assert.deepEqual(upsertAccount(start, { did: 'did:plc:third', handle: null }), [
    viewer,
    other,
    { did: 'did:plc:third', handle: null },
  ]);
});

test('removal picks a neighbour without leaving a stale active DID', () => {
  const entries = [viewer, other, { did: 'did:plc:third', handle: null }];
  assert.deepEqual(removeAccount(entries, other.did), [viewer, entries[2]]);
  assert.equal(nextActiveDid(entries, other.did), entries[2].did);
  assert.equal(nextActiveDid(entries, entries[2].did), other.did);
  assert.equal(nextActiveDid([viewer], viewer.did), null);
  assert.equal(nextActiveDid([], viewer.did), null);
});

test('preview fixtures are distinct DIDs with handles', () => {
  assert.ok(MOCK_ACCOUNTS.length >= 2);
  assert.equal(new Set(MOCK_ACCOUNTS.map((entry) => entry.did)).size, MOCK_ACCOUNTS.length);
  assert.ok(MOCK_ACCOUNTS.every((entry) => isDid(entry.did) && entry.handle));
});
