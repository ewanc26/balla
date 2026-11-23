import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MAX_BLOB_CACHE_BYTES,
  blobCacheKey,
  blobFallbacksForPost,
  evictToCap,
  getBlobUrl,
  isValidCid,
  isValidDid,
  normaliseBlobOriginStrategy,
} from '../src/lib/blobOriginModel.ts';

const DID = 'did:plc:2mhtyiyaladxwqv2ubioyfbp';
const CID = 'bafkreidrtj4llkswtjgaf6fx4ujmsws4msnxylyenby5t4csmci76ryjqy';

test('blob refs come only from the raw record, never from AppView URLs', () => {
  const post = {
    author: { did: DID },
    embed: {
      $type: 'app.bsky.embed.images#view',
      images: [{ thumb: 'https://cdn.bsky.app/img/feed_thumbnail/x', fullsize: 'https://cdn.bsky.app/x' }],
    },
    record: {
      $type: 'app.bsky.feed.post',
      embed: {
        $type: 'app.bsky.embed.images',
        images: [
          { image: { $type: 'blob', ref: { $link: CID }, mimeType: 'image/png', size: 183757 } },
        ],
      },
    },
  };
  assert.deepEqual(blobFallbacksForPost(post), [{ did: DID, cid: CID, mimeType: 'image/png' }]);
  // A view-only post has no CID, so it must not claim a PDS fallback.
  assert.deepEqual(blobFallbacksForPost({ author: { did: DID }, embed: post.embed }), []);
});

test('gallery and recordWithMedia embeds keep blob order', () => {
  const base = (embed) => ({ author: { did: DID }, record: { embed } });
  assert.deepEqual(
    blobFallbacksForPost(
      base({
        $type: 'app.bsky.embed.gallery',
        items: [{ image: { ref: { $link: CID } } }, { alt: 'no blob' }],
      })
    ),
    [{ did: DID, cid: CID, mimeType: undefined }, null]
  );
  assert.deepEqual(
    blobFallbacksForPost(
      base({
        $type: 'app.bsky.embed.recordWithMedia',
        media: { $type: 'app.bsky.embed.images', images: [{ image: { ref: { $link: CID } } }] },
      })
    ),
    [{ did: DID, cid: CID, mimeType: undefined }]
  );
});

test('invalid dids and cids never produce a fallback', () => {
  assert.equal(isValidDid(DID), true);
  assert.equal(isValidDid('not-a-did'), false);
  assert.equal(isValidCid(CID), true);
  assert.equal(isValidCid('x'), false);
  assert.equal(isValidCid(undefined), false);
  const bad = { author: { did: 'javascript:alert(1)' }, record: { embed: {
    $type: 'app.bsky.embed.images', images: [{ image: { ref: { $link: 'x' } } }],
  } } };
  assert.deepEqual(blobFallbacksForPost(bad), []);
  assert.deepEqual(blobFallbacksForPost(null), []);
});

test('getBlob URL is built on the PDS origin with encoded parameters', () => {
  const url = getBlobUrl('https://morel.us-east.host.bsky.network/', DID, CID);
  assert.equal(
    url,
    `https://morel.us-east.host.bsky.network/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(DID)}&cid=${CID}`
  );
  assert.equal(blobCacheKey(DID, CID), `${DID}|${CID}`);
});

test('the cache evicts oldest entries until it fits the byte cap', () => {
  assert.equal(MAX_BLOB_CACHE_BYTES, 8 * 1024 * 1024);
  const entries = [
    { key: 'newest', bytes: 3_000_000 },
    { key: 'middle', bytes: 3_000_000 },
    { key: 'oldest', bytes: 3_000_000 },
  ];
  assert.deepEqual(evictToCap(entries), ['oldest']);
  assert.deepEqual(evictToCap(entries, 3_000_000), ['middle', 'oldest']);
  assert.deepEqual(evictToCap([], 10), []);
});

test('only real strategies are accepted', () => {
  assert.equal(normaliseBlobOriginStrategy('pds-first'), 'pds-first');
  assert.equal(normaliseBlobOriginStrategy('follow-url'), 'follow-url');
  assert.equal(normaliseBlobOriginStrategy('anything-else'), 'follow-url');
  assert.equal(normaliseBlobOriginStrategy(undefined), 'follow-url');
});

test('the runtime reads blobs from the PDS with a bounded cache and no new scope', () => {
  const runtime = readFileSync(new URL('../src/lib/blobOrigin.ts', import.meta.url), 'utf8');
  // The DID document read reuses the strategy-aware resolver so the configured
  // did:plc directory applies here too; no implicit Bluesky host remains.
  assert.match(runtime, /resolveDidDocument\(fallback\.did\)/);
  assert.doesNotMatch(runtime, /agent\.com\.atproto\.identity\.resolveDid/);
  assert.match(runtime, /atprotoPdsEndpoint\(document\)/);
  assert.match(runtime, /getBlobUrl\(endpoint/);
  const model = readFileSync(new URL('../src/lib/blobOriginModel.ts', import.meta.url), 'utf8');
  assert.match(model, /com\.atproto\.sync\.getBlob/);
  assert.match(runtime, /evictToCap/);
  assert.match(runtime, /clearBlobCache/);
  assert.match(runtime, /Platform\.OS === 'web'/);
  assert.doesNotMatch(runtime, /console\.(log|info|debug)/);
});
