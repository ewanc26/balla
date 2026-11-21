import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUOTE_UNAVAILABLE_COPY,
  externalFromEmbed,
  externalHost,
  firstWebUrl,
  normaliseWebUrl,
  quoteFromEmbed,
} from '../src/lib/embedModel.ts';

const author = { did: 'did:plc:author', handle: 'alice.bsky.social', displayName: 'Alice' };
const record = (extra = {}) => ({
  $type: 'app.bsky.embed.record#view',
  record: {
    $type: 'app.bsky.embed.record#viewRecord',
    uri: 'at://did:plc:author/app.bsky.feed.post/abc',
    cid: 'bafy-post',
    author,
    value: { $type: 'app.bsky.feed.post', text: 'Quoted words' },
    indexedAt: '2026-11-21T10:00:00.000Z',
    ...extra,
  },
});

test('a quoted post is read from a record view with its own author and text', () => {
  const quote = quoteFromEmbed(record());
  assert.equal(quote.kind, 'record');
  assert.equal(quote.uri, 'at://did:plc:author/app.bsky.feed.post/abc');
  assert.equal(quote.cid, 'bafy-post');
  assert.equal(quote.authorHandle, 'alice.bsky.social');
  assert.equal(quote.authorName, 'Alice');
  assert.equal(quote.text, 'Quoted words');
  assert.deepEqual(quote.labels, []);
  assert.equal(
    quoteFromEmbed(record({ labels: [{ val: 'spam', src: 'did:plc:labeler' }] })).labels.length,
    1
  );
});

test('recordWithMedia still exposes the quoted record', () => {
  const embed = {
    $type: 'app.bsky.embed.recordWithMedia#view',
    record: record(),
    media: { $type: 'app.bsky.embed.images#view', images: [] },
  };
  assert.equal(quoteFromEmbed(embed).text, 'Quoted words');
});

test('unavailable quotes get an honest reason instead of empty content', () => {
  for (const [type, flag, reason] of [
    ['viewNotFound', 'notFound', 'not-found'],
    ['viewBlocked', 'blocked', 'blocked'],
    ['viewDetached', 'detached', 'detached'],
  ]) {
    const quote = quoteFromEmbed({
      $type: 'app.bsky.embed.record#view',
      record: { $type: `app.bsky.embed.record#${type}`, uri: 'at://x', [flag]: true },
    });
    assert.equal(quote.kind, 'unavailable');
    assert.equal(quote.reason, reason);
    assert.ok(QUOTE_UNAVAILABLE_COPY[reason].length > 10);
  }
  assert.equal(
    quoteFromEmbed({
      $type: 'app.bsky.embed.record#view',
      record: { $type: 'app.bsky.feed.defs#generatorView', uri: 'at://x' },
    }).reason,
    'not-a-post'
  );
  assert.equal(quoteFromEmbed({ $type: 'app.bsky.embed.images#view' }), null);
});

test('external cards use real metadata and a readable host', () => {
  const embed = {
    $type: 'app.bsky.embed.external#view',
    external: {
      uri: 'https://www.example.com/story',
      title: 'A real headline',
      description: 'What the page says',
      thumb: 'https://example.com/thumb.jpg',
    },
  };
  const card = externalFromEmbed(embed);
  assert.equal(card.title, 'A real headline');
  assert.equal(card.description, 'What the page says');
  assert.equal(card.host, 'example.com');
  assert.ok(card.thumb);
});

test('only complete web URLs become link-card candidates', () => {
  assert.equal(normaliseWebUrl('https://example.com/story'), 'https://example.com/story');
  assert.equal(normaliseWebUrl('example.com/story'), null);
  assert.equal(normaliseWebUrl('javascript:alert(1)'), null);
  assert.equal(firstWebUrl('See https://example.com/a and http://example.org/b'), 'https://example.com/a');
  assert.equal(firstWebUrl('no link here'), null);
});

test('an untitled external card falls back to its host, never a made-up title', () => {
  const card = externalFromEmbed({
    $type: 'app.bsky.embed.recordWithMedia#view',
    media: {
      $type: 'app.bsky.embed.external#view',
      external: { uri: 'https://news.example.org/read', title: '   ', description: '' },
    },
  });
  assert.equal(card.host, 'news.example.org');
  assert.equal(card.title, 'news.example.org');
  assert.equal(card.description, '');
  assert.equal(externalHost('not a url'), 'Link');
  assert.equal(externalFromEmbed({ $type: 'app.bsky.embed.images#view' }), null);
});
