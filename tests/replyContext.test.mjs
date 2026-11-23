import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  replyContextFor,
  replyContextForPost,
  withFeedReply,
} from '../src/lib/replyContext.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('a root post has no reply context', () => {
  assert.equal(replyContextFor(undefined, 'did:plc:me'), null);
  assert.equal(replyContextFor({}, 'did:plc:me'), null);
  assert.equal(replyContextFor({ author: {}, uri: undefined }, 'did:plc:me'), null);
  assert.equal(
    replyContextForPost({ author: { did: 'did:plc:me' }, record: {} }),
    null
  );
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

test('a post view with only a record parent still shows a truthful line', () => {
  const post = {
    uri: 'at://did:plc:ailsa/app.bsky.feed.post/reply-2',
    author: { did: 'did:plc:ailsa', handle: 'ailsa.balla.test' },
    record: {
      reply: {
        parent: { uri: 'at://did:plc:mum/app.bsky.feed.post/1' },
      },
    },
  };
  assert.deepEqual(replyContextForPost(post), {
    label: 'Replying to an earlier post',
    handle: null,
    parentUri: 'at://did:plc:mum/app.bsky.feed.post/1',
    self: false,
  });
});

test('feed metadata keeps the parent without mutating the response', () => {
  const post = { uri: 'at://did:plc:ailsa/app.bsky.feed.post/3', author: {} };
  const parent = {
    uri: 'at://did:plc:mum/app.bsky.feed.post/1',
    author: { did: 'did:plc:mum', handle: 'mum.balla.test' },
  };
  const stored = withFeedReply({ post, reply: { root: parent, parent } });
  assert.notEqual(stored, post);
  assert.equal(stored.feedReply.parent, parent);
  assert.equal(post.feedReply, undefined);
  assert.equal(withFeedReply({ post }), post);
});

test('Home, profile, list and search cards all carry the same line', () => {
  const feed = read('../src/screens/FeedScreen.tsx');
  const profile = read('../src/screens/ProfileScreen.tsx');
  const list = read('../src/screens/ListDetailScreen.tsx');
  const search = read('../src/screens/SearchScreen.tsx');
  const card = read('../src/components/PostCard.tsx');

  assert.match(feed, /replyParent=\{item\.reply\?\.parent\}/);
  assert.match(profile, /\.map\(withFeedReply\)/);
  assert.match(profile, /replyParent=\{item\.post\.feedReply\?\.parent\}/);
  assert.match(list, /\.map\(withFeedReply\)/);
  assert.match(list, /replyParent=\{item\.feedReply\?\.parent\}/);
  assert.match(search, /<PostCard[\s\S]{0,160}post=\{item\}/);
  assert.match(card, /replyContextForPost\(post, replyParent\)/);
  assert.match(card, /showReplyContext = true/);
  assert.match(card, /styles\.replyContext/);
  assert.match(card, /return-down-forward-outline/);
  assert.match(card, /numberOfLines=\{1\}/);
  assert.match(card, /minHeight: 24/);

  // The mock preview has a real reply with parent metadata.
  const mock = read('../src/lib/mock.ts');
  assert.match(mock, /reply: \{ root: posts\[0\], parent: posts\[0\] \}/);

  // A thread already labels and nests replies; do not stack a second label.
  const thread = read('../src/screens/ThreadScreen.tsx');
  assert.equal((thread.match(/showReplyContext=\{false\}/g) || []).length, 4);

  // The label comes from the response, never a second read or write.
  const model = read('../src/lib/replyContext.ts');
  assert.doesNotMatch(model, /fetch\(|agent\.|getPost|getTimeline/);
});
