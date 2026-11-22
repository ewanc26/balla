import test from 'node:test';
import assert from 'node:assert/strict';
import {
  notificationTarget,
  notificationTargetAction,
} from '../src/lib/notificationModel.ts';

const URI = 'at://did:plc:author/app.bsky.feed.post/3kpost';
const DID = 'did:plc:follower';

test('reply, mention and quote notifications open their post thread', () => {
  for (const reason of ['reply', 'mention', 'quote']) {
    assert.deepEqual(notificationTarget({ reason, uri: URI }), {
      kind: 'thread',
      uri: URI,
    });
  }
});

test('like and repost notifications open the subject thread, including via-repost reasons', () => {
  for (const reason of [
    'like',
    'like_via_proxy',
    'repost',
    'repost_via_proxy',
    'like_via_repost',
    'repost_via_repost',
  ]) {
    assert.deepEqual(
      notificationTarget({ reason, uri: URI, reasonSubject: URI }),
      { kind: 'thread', uri: URI }
    );
  }
});

test('follow notifications open the displayed actor profile', () => {
  for (const reason of ['follow', 'follow_via_proxy']) {
    assert.deepEqual(
      notificationTarget(
        { reason, uri: URI, author: { did: 'did:plc:raw' } },
        { did: DID, handle: 'follower.test' }
      ),
      { kind: 'profile', did: DID }
    );
  }
});

test('follows fall back to the notification author when no actor was collected', () => {
  assert.deepEqual(notificationTarget({ reason: 'follow', author: { did: DID } }), {
    kind: 'profile',
    did: DID,
  });
});

test('a target is omitted rather than invented when the required id is missing', () => {
  assert.equal(notificationTarget({ reason: 'reply' }), undefined);
  assert.equal(notificationTarget({ reason: 'like', uri: URI }), undefined);
  assert.equal(notificationTarget({ reason: 'follow' }), undefined);
  assert.equal(notificationTarget(undefined), undefined);
});

test('unmapped reasons stay inert instead of guessing a destination', () => {
  assert.equal(
    notificationTarget(
      { reason: 'invite-code-use', uri: URI, author: { did: DID } },
      { did: DID }
    ),
    undefined
  );
});

test('the accessibility label names the destination for keyboard and screen-reader users', () => {
  assert.equal(
    notificationTargetAction({ kind: 'profile', did: DID }),
    ' Open profile.'
  );
  assert.equal(
    notificationTargetAction({ kind: 'thread', uri: URI }),
    ' Open thread.'
  );
  assert.equal(notificationTargetAction(undefined), '');
});
