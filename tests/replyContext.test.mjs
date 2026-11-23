import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { replyContextFor } from '../src/lib/replyContext.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('a root post has no reply context', () => {
  assert.equal(replyContextFor(undefined, 'did:plc:me'), null);
  assert.equal(replyContextFor({}, 'did:plc:me'), null);
  assert.equal(replyContextFor({ author: {}, uri: undefined }, 'did:plc:me'), null);
});

test('a reply names the parent handle carried by the feed response', () => {
  const parent = {
    uri: 'at://did:plc:mum/app.bsky.feed.post/1',
    author: { did: 'did:plc:mum', handle: 'mum.balla.test' },
  };
  assert.deepEqual(replyContextFor(parent, 'did:plc:ailsa'), {
    label: 'Replying to @mum.balla.test',
    handle: 'mum.balla.test',
    parentUri: parent.uri,
    self: false,
  });
});

test('a self-reply says so without pretending it is another account', () => {
  const parent = {
    uri: 'at://did:plc:me/app.bsky.feed.post/1',
    author: { did: 'did:plc:me', handle: 'me.balla.test' },
  };
  assert.equal(replyContextFor(parent, 'did:plc:me').label, 'Replying to their earlier post');
  assert.equal(replyContextFor(parent, 'did:plc:me').self, true);
});

test('a missing parent author stays honest instead of inventing a handle', () => {
  const context = replyContextFor(
    { uri: 'at://did:plc:someone/app.bsky.feed.post/1' },
    'did:plc:me'
  );
  assert.equal(context.label, 'Replying to an earlier post');
  assert.equal(context.handle, null);
});

test('the feed passes the parent through and the card renders one clear line', () => {
  const feed = read('../src/screens/FeedScreen.tsx');
  const card = read('../src/components/PostCard.tsx');
  const mock = read('../src/lib/mock.ts');
  assert.match(feed, /replyParent=\{item\.reply\?\.parent\}/);
  assert.match(card, /replyContextFor\(replyParent, author\.did\)/);
  assert.match(card, /styles\.replyContext/);
  assert.match(card, /return-down-forward-outline/);
  assert.match(card, /numberOfLines=\{1\}/);
  assert.match(card, /minHeight: 24/);
  assert.match(mock, /reply: \{ root: posts\[0\], parent: posts\[0\] \}/);
  // The label is derived from the feed response, not another read or write.
  const model = read('../src/lib/replyContext.ts');
  assert.doesNotMatch(model, /fetch\(|agent\.|getPost|getTimeline/);
});
