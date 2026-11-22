import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HIDDEN_POSTS_KEY,
  addHiddenPost,
  isPostHidden,
  normaliseHiddenPosts,
  removeHiddenPost,
} from '../src/lib/hiddenPostsModel.ts';

const A = 'at://did:plc:author/app.bsky.feed.post/aaa';
const B = 'at://did:plc:author/app.bsky.feed.post/bbb';

test('only real AT-URIs are accepted, de-duplicated and stable', () => {
  assert.deepEqual(
    normaliseHiddenPosts([A, B, A, 'https://example.com/post', 42, null, '']),
    [A, B]
  );
  assert.deepEqual(normaliseHiddenPosts(undefined), []);
});

test('a hidden post is recognised only by its exact URI', () => {
  assert.equal(isPostHidden([A], A), true);
  assert.equal(isPostHidden([A], B), false);
  assert.equal(isPostHidden([A], undefined), false);
});

test('adding a hide is idempotent and ignores invalid URIs', () => {
  assert.deepEqual(addHiddenPost([], A), [A]);
  assert.deepEqual(addHiddenPost([A], A), [A]);
  assert.deepEqual(addHiddenPost([], ''), []);
  assert.deepEqual(addHiddenPost([], 'https://example.com'), []);
});

test('removing a hide keeps unrelated URIs', () => {
  assert.deepEqual(removeHiddenPost([A, B], A), [B]);
  assert.deepEqual(removeHiddenPost([A], B), [A]);
});

test('the store uses a versioned device-local key', () => {
  assert.equal(HIDDEN_POSTS_KEY, 'balla.hiddenPosts.v1');
});
