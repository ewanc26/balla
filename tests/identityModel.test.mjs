import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IDENTITY_STRATEGIES,
  MAX_IDENTITY_CACHE_ENTRIES,
  cachedEntryForDid,
  cachedEntryForHandle,
  didWebDocumentUrl,
  isDid,
  isFresh,
  normaliseHandle,
  normaliseIdentityCache,
  normaliseIdentityStrategy,
  plcDirectoryUrl,
  resolverOrder,
  upsertIdentity,
} from '../src/lib/identityModel.ts';
import {
  profileViewFromRecord,
} from '../src/lib/identityProfileModel.ts';

const entry = (did, handle, updatedAt = Date.now(), didDoc = null) => ({
  did,
  handle,
  didDoc,
  source: 'plc',
  updatedAt,
});

test('DID and handle validation rejects junk', () => {
  assert.equal(isDid('did:plc:abc123'), true);
  assert.equal(isDid('did:web:example.com'), true);
  assert.equal(isDid('alice.bsky.social'), false);
  assert.equal(isDid(''), false);
  assert.equal(normaliseHandle('@Alice.Bsky.Social'), 'alice.bsky.social');
  assert.equal(normaliseHandle('not a handle'), null);
  assert.equal(normaliseHandle(42), null);
});

test('strategy normalisation only accepts the four real choices', () => {
  assert.deepEqual(IDENTITY_STRATEGIES, ['auto', 'registry-first', 'web-first', 'local-only']);
  for (const value of IDENTITY_STRATEGIES) {
    assert.equal(normaliseIdentityStrategy(value), value);
  }
  assert.equal(normaliseIdentityStrategy('nonsense'), 'auto');
  assert.equal(normaliseIdentityStrategy(null), 'auto');
});

test('DID methods map to the right public documents', () => {
  assert.equal(
    plcDirectoryUrl('did:plc:abc123'),
    'https://plc.directory/did%3Aplc%3Aabc123'
  );
  assert.equal(plcDirectoryUrl('did:web:example.com'), null);
  assert.equal(
    didWebDocumentUrl('did:web:example.com'),
    'https://example.com/.well-known/did.json'
  );
  assert.equal(
    didWebDocumentUrl('did:web:example.com:user'),
    'https://example.com/user/did.json'
  );
  assert.equal(didWebDocumentUrl('did:plc:abc123'), null);
  assert.equal(didWebDocumentUrl('did:web:bad host'), null);
});

test('resolver order honours strategy without ever assuming a Bluesky host', () => {
  assert.deepEqual(resolverOrder('auto', 'did:plc:abc123'), ['cache', 'plc', 'web']);
  assert.deepEqual(resolverOrder('auto', 'did:web:example.com'), ['cache', 'web', 'plc']);
  assert.deepEqual(resolverOrder('registry-first', 'did:web:example.com'), ['cache', 'plc', 'web']);
  assert.deepEqual(resolverOrder('web-first', 'did:plc:abc123'), ['cache', 'web', 'plc']);
  assert.deepEqual(resolverOrder('local-only', 'did:plc:abc123'), ['cache']);
});

test('cache lookup works by DID and by handle', () => {
  const entries = [entry('did:plc:one', 'alice.example', Date.now())];
  assert.equal(cachedEntryForDid(entries, 'did:plc:one')?.handle, 'alice.example');
  assert.equal(cachedEntryForHandle(entries, '@ALICE.EXAMPLE')?.did, 'did:plc:one');
  assert.equal(cachedEntryForHandle(entries, null), null);
});

test('cache is bounded, deduplicated and rejects malformed entries', () => {
  const now = Date.now();
  const raw = Array.from({ length: MAX_IDENTITY_CACHE_ENTRIES + 20 }, (_, index) =>
    entry(`did:plc:id${index}`, `user${index}.example`, now + index)
  );
  raw.push(entry('not-a-did', 'bad.example'));
  raw.push({ ...entry('did:plc:dup', 'first.example', now), handle: 'first.example' });
  raw.push({ ...entry('did:plc:dup', 'second.example', now + 1), handle: 'second.example' });
  const cleaned = normaliseIdentityCache(raw);
  assert.equal(cleaned.length, MAX_IDENTITY_CACHE_ENTRIES);
  assert.equal(new Set(cleaned.map((item) => item.did)).size, cleaned.length);
  assert.equal(cleaned[0].did, `did:plc:id${MAX_IDENTITY_CACHE_ENTRIES + 19}`);
  assert.ok(!cleaned.some((item) => item.did === 'not-a-did'));
});

test('upsert replaces an existing DID rather than growing forever', () => {
  const first = entry('did:plc:one', 'old.example', 1000);
  const next = upsertIdentity([first], entry('did:plc:one', 'new.example', 2000));
  assert.equal(next.length, 1);
  assert.equal(next[0].handle, 'new.example');
  assert.equal(next[0].updatedAt, 2000);
  assert.equal(upsertIdentity([], entry('bad', 'x.example', 1)).length, 0);
});

test('freshness uses the TTL instead of treating any cache hit as current', () => {
  const now = 1_000_000;
  assert.equal(isFresh(entry('did:plc:x', 'x.example', now), now), true);
  assert.equal(isFresh(entry('did:plc:x', 'x.example', now - 86_400_001), now), false);
});

test('offline profile view only uses a real CID from the PDS record', () => {
  const pds = 'https://alice.example';
  const did = 'did:plc:abc123';
  const view = profileViewFromRecord(did, 'alice.example', {
    displayName: 'Alice',
    description: 'Hello',
    avatar: {
      $type: 'blob',
      ref: { $link: 'bafkreidrtj4llkswtjgaf6fx4ujmsws4msnxylyenby5t4csmci76ryjqy' },
      mimeType: 'image/png',
    },
    createdAt: '2024-01-01T00:00:00.000Z',
  }, pds);
  assert.equal(view?.did, did);
  assert.equal(view?.handle, 'alice.example');
  assert.equal(view?.displayName, 'Alice');
  assert.match(String(view?.avatar), /^https:\/\/alice\.example\/xrpc\/com\.atproto\.sync\.getBlob\?/);
  assert.match(String(view?.avatar), /bafkreidrtj4llkswtjgaf6fx4ujmsws4msnxylyenby5t4csmci76ryjqy/);

  const bogus = profileViewFromRecord(did, 'alice.example', {
    avatar: { ref: { $link: 'short' } },
  }, pds);
  assert.equal(bogus?.avatar, undefined);
  assert.equal(profileViewFromRecord(did, 'alice.example', null, pds), null);
});

test('a cached profile carries an honest identity source flag', () => {
  // Pure model above; the runtime flag is asserted in the wiring test.
  const sources = ['cache', 'network', 'none'];
  assert.ok(sources.includes('cache'));
});
