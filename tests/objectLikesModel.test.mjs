import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canLike,
  isLiked,
  nextLikeCount,
} from '../src/lib/objectLikesModel.ts';

test('a likeable subject needs a real AT-URI and CID', () => {
  assert.equal(canLike({ uri: 'at://did:plc:abc/app.bsky.feed.generator/x', cid: 'bafy' }), true);
  assert.equal(canLike({ uri: 'https://example.com', cid: 'bafy' }), false);
  assert.equal(canLike({ uri: 'at://did:plc:abc/app.bsky.feed.generator/x', cid: '' }), false);
  assert.equal(canLike(null), false);
});

test('liked state comes from the viewer like URI', () => {
  assert.equal(isLiked({ likeUri: 'at://me/app.bsky.feed.like/1' }), true);
  assert.equal(isLiked({ likeUri: null }), false);
  assert.equal(isLiked({}), false);
});

test('optimistic like count never drops below zero', () => {
  assert.equal(nextLikeCount({ uri: '', cid: '', likeCount: 4 }, true), 5);
  assert.equal(nextLikeCount({ uri: '', cid: '', likeCount: 4 }, false), 3);
  assert.equal(nextLikeCount({ uri: '', cid: '', likeCount: 0 }, false), 0);
});
