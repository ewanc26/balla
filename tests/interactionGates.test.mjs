import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_INTERACTION_GATES,
  describeGates,
  gatesEqual,
  gatesFromRecords,
  hiddenRepliesFromRecord,
  hiddenReplyWrite,
  listUriFromRecord,
  normaliseGates,
  normaliseListUri,
  postRkey,
  postgateWrite,
  quoteAccessFromRecord,
  replyAccessFromRecord,
  threadgateWrite,
} from '../src/lib/interactionGates.ts';

const POST = 'at://did:plc:author/app.bsky.feed.post/3lxyz';
const AT = '2026-11-21T12:00:00.000Z';

test('gate writes reuse the post rkey and real lexicon record names', () => {
  const write = threadgateWrite(POST, { reply: 'mentioned', quote: 'everyone' }, AT);
  assert.deepEqual(write, {
    collection: 'app.bsky.feed.threadgate',
    rkey: '3lxyz',
    record: {
      $type: 'app.bsky.feed.threadgate',
      createdAt: AT,
      post: POST,
      allow: [{ $type: 'app.bsky.feed.threadgate#mentionRule' }],
    },
  });
  const quote = postgateWrite(POST, { reply: 'everyone', quote: 'nobody' }, AT);
  assert.equal(quote.collection, 'app.bsky.feed.postgate');
  assert.equal(quote.rkey, '3lxyz');
  assert.deepEqual(quote.record.embeddingRules, [
    { $type: 'app.bsky.feed.postgate#disableRule' },
  ]);
});

test('permissive settings write no record rather than an invented rule', () => {
  assert.equal(
    threadgateWrite(POST, DEFAULT_INTERACTION_GATES, AT),
    null
  );
  assert.equal(postgateWrite(POST, DEFAULT_INTERACTION_GATES, AT), null);
});

test('nobody rule is an empty allow list, not a missing one', () => {
  const write = threadgateWrite(POST, { reply: 'nobody', quote: 'everyone' }, AT);
  assert.deepEqual(write.record.allow, []);
});

test('all four reply rules map to published gate rule types', () => {
  const types = ['mentioned', 'following', 'followers', 'nobody'].map((reply) => {
    const write = threadgateWrite(POST, { reply, quote: 'everyone' }, AT);
    return write.record.allow;
  });
  assert.deepEqual(types[0], [{ $type: 'app.bsky.feed.threadgate#mentionRule' }]);
  assert.deepEqual(types[1], [{ $type: 'app.bsky.feed.threadgate#followingRule' }]);
  assert.deepEqual(types[2], [{ $type: 'app.bsky.feed.threadgate#followerRule' }]);
  assert.deepEqual(types[3], []);
});

test('invalid post URIs cannot become gate records', () => {
  assert.equal(postRkey(POST), '3lxyz');
  assert.equal(postRkey('https://example.com/post/1'), null);
  assert.equal(postRkey('at://did:plc:a/app.bsky.feed.like/1'), null);
  assert.equal(threadgateWrite('not-a-uri', { reply: 'nobody', quote: 'everyone' }, AT), null);
  assert.equal(postgateWrite('not-a-uri', { reply: 'everyone', quote: 'nobody' }, AT), null);
});

test('reading records round-trips to the same settings', () => {
  for (const reply of ['everyone', 'mentioned', 'following', 'followers', 'nobody']) {
    for (const quote of ['everyone', 'nobody']) {
      const gates = { reply, quote };
      const threadgate = threadgateWrite(POST, gates, AT);
      const postgate = postgateWrite(POST, gates, AT);
      assert.deepEqual(
        gatesFromRecords(threadgate?.record, postgate?.record),
        gates,
        `${reply}/${quote}`
      );
    }
  }
});

test('malformed records fall back to permissive settings', () => {
  assert.equal(replyAccessFromRecord({ allow: 'nope' }), 'everyone');
  assert.equal(replyAccessFromRecord({ allow: [{ $type: 'unknown#rule' }] }), 'everyone');
  assert.equal(quoteAccessFromRecord({ embeddingRules: [{ $type: 'unknown#rule' }] }), 'everyone');
  assert.deepEqual(gatesFromRecords(null, undefined), DEFAULT_INTERACTION_GATES);
});

test('untrusted gate values are normalised before display or writes', () => {
  assert.deepEqual(normaliseGates({ reply: 'banana', quote: 'maybe' }), DEFAULT_INTERACTION_GATES);
  assert.deepEqual(normaliseGates(null), DEFAULT_INTERACTION_GATES);
  assert.deepEqual(normaliseGates({ reply: 'followers', quote: 'nobody' }), {
    reply: 'followers',
    quote: 'nobody',
  });
  assert.equal(gatesEqual(DEFAULT_INTERACTION_GATES, normaliseGates({})), true);
});

test('copy states exactly what the records do', () => {
  assert.equal(
    describeGates(DEFAULT_INTERACTION_GATES),
    'Anyone can reply · Anyone can quote'
  );
  assert.equal(
    describeGates({ reply: 'nobody', quote: 'nobody' }),
    'Nobody can reply · Quoting is off'
  );
});

const LIST = 'at://did:plc:owner/app.bsky.graph.list/3lxyz';

test('a list rule is written only for a real list AT-URI', () => {
  assert.equal(normaliseListUri(LIST), LIST);
  assert.equal(normaliseListUri('at://did:plc:owner/app.bsky.feed.post/1'), null);
  assert.equal(normaliseListUri('https://bsky.app/profile/x/lists/1'), null);
  const gates = { reply: 'list', quote: 'everyone', listUri: LIST };
  const write = threadgateWrite(POST, gates, AT);
  assert.deepEqual(write.record.allow, [
    { $type: 'app.bsky.feed.threadgate#listRule', list: LIST },
  ]);
  assert.deepEqual(gatesFromRecords(write.record, undefined), gates);
  assert.equal(threadgateWrite(POST, { ...gates, listUri: 'not-a-list' }, AT), null);
});

test('an unknown or missing list falls back to open replies', () => {
  assert.deepEqual(normaliseGates({ reply: 'list', quote: 'everyone' }), DEFAULT_INTERACTION_GATES);
  assert.deepEqual(
    normaliseGates({ reply: 'list', quote: 'everyone', listUri: 'nonsense' }),
    DEFAULT_INTERACTION_GATES
  );
  assert.equal(replyAccessFromRecord({ allow: [{ $type: 'app.bsky.feed.threadgate#listRule' }] }), 'everyone');
  assert.equal(listUriFromRecord({ allow: [{ $type: 'app.bsky.feed.threadgate#listRule', list: LIST }] }), LIST);
  assert.equal(
    describeGates({ reply: 'list', quote: 'everyone', listUri: LIST }),
    'Only members of a list can reply · Anyone can quote'
  );
});

test('hidden replies use the published threadgate field and keep replies open', () => {
  const HIDDEN = 'at://did:plc:author/app.bsky.feed.post/hidden';
  const write = threadgateWrite(POST, DEFAULT_INTERACTION_GATES, AT, [HIDDEN]);
  assert.equal(write.collection, 'app.bsky.feed.threadgate');
  assert.equal('allow' in write.record, false);
  assert.deepEqual(write.record.hiddenReplies, [HIDDEN]);
  assert.deepEqual(hiddenRepliesFromRecord(write.record), [HIDDEN]);
  assert.deepEqual(hiddenRepliesFromRecord(null), []);
  assert.deepEqual(hiddenRepliesFromRecord({ hiddenReplies: [HIDDEN, 3, ''] }), [HIDDEN]);
  assert.equal(threadgateWrite(POST, DEFAULT_INTERACTION_GATES, AT), null);
});

test('toggling a hidden reply preserves existing allow rules and other hidden replies', () => {
  const FIRST = 'at://did:plc:author/app.bsky.feed.post/first';
  const SECOND = 'at://did:plc:author/app.bsky.feed.post/second';
  const existing = {
    $type: 'app.bsky.feed.threadgate',
    post: POST,
    createdAt: AT,
    allow: [{ $type: 'app.bsky.feed.threadgate#followerRule' }],
    hiddenReplies: [FIRST],
  };

  const hidden = hiddenReplyWrite(POST, existing, SECOND, 'hide', AT);
  assert.deepEqual(hidden.record.allow, existing.allow);
  assert.deepEqual(hidden.record.hiddenReplies, [FIRST, SECOND]);
  assert.equal(hidden.collection, 'app.bsky.feed.threadgate');
  assert.equal(hidden.rkey, '3lxyz');

  const shown = hiddenReplyWrite(POST, hidden.record, SECOND, 'show', AT);
  assert.deepEqual(shown.record.allow, existing.allow);
  assert.deepEqual(shown.record.hiddenReplies, [FIRST]);

  // Removing the last hidden reply from an open thread removes the record.
  assert.equal(hiddenReplyWrite(POST, { post: POST, hiddenReplies: [FIRST] }, FIRST, 'show', AT), null);
  // A gate that still restricts replies stays, even with no hidden replies.
  const restricted = hiddenReplyWrite(POST, existing, FIRST, 'show', AT);
  assert.deepEqual(restricted.record.allow, existing.allow);
  assert.equal('hiddenReplies' in restricted.record, false);
  // Invalid inputs never produce a write.
  assert.equal(hiddenReplyWrite('nonsense', existing, SECOND, 'hide', AT), null);
  assert.equal(hiddenReplyWrite(POST, existing, '', 'hide', AT), null);
});
