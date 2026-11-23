import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPLY_PREVIEW_CACHE_LIMIT,
  REPLY_PREVIEW_MAX_ACTIVE,
  directRepliesFromThread,
  firstReplyInOrder,
  replyAuthorGated,
  replyPreviewText,
} from '../src/lib/replyPreviewModel.ts';

function post(uri, createdAt, likeCount = 0, text = uri) {
  return {
    uri,
    likeCount,
    author: {
      did: `did:plc:${uri}`,
      handle: `${uri}.test`,
      displayName: uri,
    },
    record: { text, createdAt },
    indexedAt: createdAt,
  };
}

function node(uri, createdAt, likeCount = 0, replies = []) {
  return {
    $type: 'app.bsky.feed.defs#threadViewPost',
    post: post(uri, createdAt, likeCount),
    replies,
  };
}

const root = {
  $type: 'app.bsky.feed.defs#threadViewPost',
  post: post('root', '2026-11-23T12:00:00.000Z'),
  replies: [
    node('oldest', '2026-11-23T12:00:01.000Z', 1, [
      node('nested', '2026-11-23T12:00:00.000Z', 99),
    ]),
    node('newest', '2026-11-23T12:00:03.000Z', 2),
    node('liked', '2026-11-23T12:00:02.000Z', 20),
    { $type: 'app.bsky.feed.defs#notFoundPost' },
    { $type: 'app.bsky.feed.defs#threadViewPost', post: null },
  ],
};

test('only direct replies are candidates, never nested branches', () => {
  const replies = directRepliesFromThread(root);
  assert.deepEqual(
    replies.map((reply) => reply.post.uri),
    ['oldest', 'newest', 'liked']
  );
  assert.equal(
    replies.some((reply) => reply.post.uri === 'nested'),
    false
  );
});

test('the configured thread order selects the first direct reply', () => {
  const replies = directRepliesFromThread(root);
  assert.equal(firstReplyInOrder(replies, 'oldest').post.uri, 'oldest');
  assert.equal(firstReplyInOrder(replies, 'newest').post.uri, 'newest');
  assert.equal(firstReplyInOrder(replies, 'most-likes').post.uri, 'liked');
  assert.equal(firstReplyInOrder([], 'oldest'), null);
  assert.equal(firstReplyInOrder(null, 'oldest'), null);
});

test('preview text is a compact fallback, never invented content', () => {
  assert.equal(
    replyPreviewText({ record: { text: '  Hello\n   there  ' } }),
    'Hello there'
  );
  assert.equal(
    replyPreviewText({ embed: { $type: 'app.bsky.embed.images#view' } }),
    'A photo reply'
  );
  assert.equal(
    replyPreviewText({ embed: { $type: 'app.bsky.embed.video#view' } }),
    'A video reply'
  );
  assert.equal(
    replyPreviewText({ embed: { $type: 'app.bsky.embed.record#view' } }),
    'A quoted reply'
  );
  assert.equal(
    replyPreviewText({ embed: { $type: 'app.bsky.embed.external#view' } }),
    'A link reply'
  );
  assert.equal(replyPreviewText({ record: {} }), 'A reply without text');
});

test('mute, block and list-block states suppress the preview author', () => {
  const authorViewer = (viewer) => ({ post: { author: { viewer } } });
  assert.equal(replyAuthorGated(authorViewer({ muted: true })), true);
  assert.equal(replyAuthorGated(authorViewer({ blocking: 'at://block' })), true);
  assert.equal(replyAuthorGated(authorViewer({ blockedBy: true })), true);
  assert.equal(
    replyAuthorGated(authorViewer({ blockingByList: 'at://list' })),
    true
  );
  assert.equal(replyAuthorGated(authorViewer({})), false);

  const before = JSON.stringify(root);
  directRepliesFromThread(root);
  firstReplyInOrder(root.replies, 'oldest');
  assert.equal(JSON.stringify(root), before);
});

test('the session cache is capped and only two reads run at once', () => {
  assert.equal(REPLY_PREVIEW_CACHE_LIMIT, 40);
  assert.equal(REPLY_PREVIEW_MAX_ACTIVE, 2);
});
