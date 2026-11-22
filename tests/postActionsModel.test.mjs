import test from 'node:test';
import assert from 'node:assert/strict';
import {
  POSTGATE_COLLECTION,
  detachedEmbeddingRecord,
  isQuoteDetached,
  profilePinUpdate,
  quotedUriFromEmbed,
  uriOwnedBy,
} from '../src/lib/postActionsModel.ts';

const POST = 'at://did:plc:viewer/app.bsky.feed.post/abc';
const QUOTE = 'at://did:plc:author/app.bsky.feed.post/xyz';

const quoteEmbed = (
  recordType = 'app.bsky.embed.record#viewRecord',
  extra = {}
) => ({
  $type: 'app.bsky.embed.record#view',
  record: { $type: recordType, uri: QUOTE, ...extra },
});

test('pin writes a strong ref into the profile record and unpin removes it', () => {
  const existing = { $type: 'app.bsky.actor.profile', displayName: 'Balla' };
  const pinned = profilePinUpdate(existing, POST, 'bafy-cid', true);
  assert.deepEqual(pinned.pinnedPost, { uri: POST, cid: 'bafy-cid' });
  assert.equal(pinned.displayName, 'Balla');
  const unpinned = profilePinUpdate(pinned, POST, 'bafy-cid', false);
  assert.equal(unpinned.pinnedPost, undefined);
});

test('pin refuses a post without a cid, so it cannot write a broken ref', () => {
  assert.equal(profilePinUpdate({}, POST, '', true), null);
  assert.equal(profilePinUpdate({}, '', 'bafy-cid', true), null);
});

test('quote URI extraction covers record and recordWithMedia embeds', () => {
  assert.equal(quotedUriFromEmbed(quoteEmbed()), QUOTE);
  assert.equal(
    quotedUriFromEmbed({
      $type: 'app.bsky.embed.recordWithMedia#view',
      record: quoteEmbed(),
      media: {},
    }),
    QUOTE
  );
  assert.equal(quotedUriFromEmbed({ $type: 'app.bsky.embed.images#view' }), null);
});

test('detached quotes are recognised from the published viewDetached type', () => {
  assert.equal(isQuoteDetached(quoteEmbed()), false);
  assert.equal(
    isQuoteDetached(quoteEmbed('app.bsky.embed.record#viewRecord', { detached: true })),
    true
  );
  assert.equal(
    isQuoteDetached(
      quoteEmbed('app.bsky.embed.record#viewDetached', { detached: true })
    ),
    true
  );
});

test('AT-URI ownership is decided by the host DID', () => {
  assert.equal(uriOwnedBy(POST, 'did:plc:viewer'), true);
  assert.equal(uriOwnedBy(POST, 'did:plc:other'), false);
  assert.equal(uriOwnedBy('https://bsky.app/post/1', 'did:plc:viewer'), false);
});

test('detach adds the embedding URI to a real postgate record', () => {
  const record = detachedEmbeddingRecord(undefined, QUOTE, POST, true, '2026-01-01T00:00:00.000Z');
  assert.equal(record.$type, POSTGATE_COLLECTION);
  assert.equal(record.post, QUOTE);
  assert.deepEqual(record.detachedEmbeddingUris, [POST]);
});

test('detach preserves existing embedding rules and other detached URIs', () => {
  const existing = {
    $type: POSTGATE_COLLECTION,
    post: QUOTE,
    createdAt: '2025-01-01T00:00:00.000Z',
    embeddingRules: [{ $type: 'app.bsky.feed.postgate#disableRule' }],
    detachedEmbeddingUris: ['at://did:plc:other/app.bsky.feed.post/old'],
  };
  const record = detachedEmbeddingRecord(existing, QUOTE, POST, true, '2026-01-01T00:00:00.000Z');
  assert.equal(record.createdAt, '2025-01-01T00:00:00.000Z');
  assert.deepEqual(record.embeddingRules, existing.embeddingRules);
  assert.deepEqual(new Set(record.detachedEmbeddingUris), new Set([
    POST,
    'at://did:plc:other/app.bsky.feed.post/old',
  ]));
});

test('reattach removes one URI and deletes the record when nothing remains', () => {
  const existing = {
    $type: POSTGATE_COLLECTION,
    post: QUOTE,
    detachedEmbeddingUris: [POST, 'at://did:plc:other/app.bsky.feed.post/old'],
  };
  const remaining = detachedEmbeddingRecord(existing, QUOTE, POST, false, '2026-01-01T00:00:00.000Z');
  assert.deepEqual(remaining.detachedEmbeddingUris, ['at://did:plc:other/app.bsky.feed.post/old']);
  const empty = detachedEmbeddingRecord(
    { ...existing, detachedEmbeddingUris: [POST] },
    QUOTE,
    POST,
    false,
    '2026-01-01T00:00:00.000Z'
  );
  assert.equal(empty, null);
});
