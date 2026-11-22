import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOT_SUBSCRIBED,
  isSubscribed,
  parseActivitySubscription,
  subscriptionPayload,
  subscriptionSummary,
  toggleActivitySubscription,
} from '../src/lib/activitySubscriptionsModel.ts';

test('absent or malformed subscriptions default to not subscribed', () => {
  assert.deepEqual(parseActivitySubscription(undefined), { post: false, reply: false });
  assert.deepEqual(parseActivitySubscription(null), { post: false, reply: false });
  assert.deepEqual(parseActivitySubscription('nope'), { post: false, reply: false });
  assert.deepEqual(parseActivitySubscription({ post: 'yes' }), { post: false, reply: false });
});

test('a reply is never honoured without a post', () => {
  assert.deepEqual(parseActivitySubscription({ post: false, reply: true }), { post: false, reply: false });
  assert.deepEqual(parseActivitySubscription({ post: true, reply: true }), { post: true, reply: true });
});

test('isSubscribed reflects either published boolean', () => {
  assert.equal(isSubscribed(undefined), false);
  assert.equal(isSubscribed({ post: true, reply: false }), true);
  assert.equal(isSubscribed({ post: true, reply: true }), true);
  assert.equal(isSubscribed({ post: false, reply: true }), false);
});

test('toggling posts off clears replies; toggling replies on forces posts', () => {
  const both = { post: true, reply: true };
  assert.deepEqual(toggleActivitySubscription(both, 'post', false), NOT_SUBSCRIBED);
  assert.deepEqual(toggleActivitySubscription(NOT_SUBSCRIBED, 'reply', true), both);
  assert.deepEqual(toggleActivitySubscription(both, 'reply', false), { post: true, reply: false });
  assert.deepEqual(toggleActivitySubscription({ post: true, reply: false }, 'post', true), { post: true, reply: false });
});

test('the RPC payload uses the published type and subject DID', () => {
  assert.deepEqual(subscriptionPayload('did:plc:subject', { post: true, reply: false }), {
    subject: 'did:plc:subject',
    activitySubscription: {
      $type: 'app.bsky.notification.defs#activitySubscription',
      post: true,
      reply: false,
    },
  });
});

test('summary describes the subscription for accessible labels', () => {
  assert.equal(subscriptionSummary(undefined), 'Not subscribed');
  assert.equal(subscriptionSummary({ post: true, reply: false }), 'Posts only');
  assert.equal(subscriptionSummary({ post: true, reply: true }), 'Posts and replies');
});
