import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REQUEST_LESS,
  REQUEST_MORE,
  eventForKind,
  feedProxy,
  feedbackEnabled,
  feedbackInteraction,
} from '../src/lib/feedFeedbackModel.ts';

test('show more/less map to the published request events', () => {
  assert.equal(eventForKind('more'), REQUEST_MORE);
  assert.equal(eventForKind('less'), REQUEST_LESS);
  assert.ok(REQUEST_MORE.startsWith('app.bsky.feed.defs#'));
  assert.ok(REQUEST_LESS.startsWith('app.bsky.feed.defs#'));
});

test('feedback interaction uses the real lexicon type and post item', () => {
  const interaction = feedbackInteraction({
    postUri: 'at://did:plc:author/app.bsky.feed.post/abc',
    event: REQUEST_MORE,
    feedContext: 'ctx-1',
    reqId: 'req-1',
  });
  assert.equal(interaction.$type, 'app.bsky.feed.defs#interaction');
  assert.equal(interaction.event, REQUEST_MORE);
  assert.equal(interaction.item, 'at://did:plc:author/app.bsky.feed.post/abc');
  assert.equal(interaction.feedContext, 'ctx-1');
  assert.equal(interaction.reqId, 'req-1');
  assert.equal(interaction.viewContext, 'feed');
});

test('empty context fields are omitted, and a fake post URI is refused', () => {
  const interaction = feedbackInteraction({
    postUri: 'at://did:plc:author/app.bsky.feed.post/abc',
    event: REQUEST_LESS,
  });
  assert.equal('feedContext' in interaction, false);
  assert.equal('reqId' in interaction, false);
  assert.throws(() =>
    feedbackInteraction({ postUri: 'https://example.com/post', event: REQUEST_MORE })
  );
});

test('feedback is offered only for signed-in feeds that accept interactions', () => {
  const generator = { did: 'did:web:feed.example', acceptsInteractions: true };
  assert.equal(feedbackEnabled(generator, true), true);
  assert.equal(feedbackEnabled(generator, false), false);
  assert.equal(feedbackEnabled({ ...generator, acceptsInteractions: false }, true), false);
  assert.equal(feedbackEnabled(undefined, true), false);
});

test('feed proxy uses the generator service DID', () => {
  assert.equal(feedProxy('did:web:feed.example'), 'did:web:feed.example#bsky_fg');
  assert.throws(() => feedProxy('not-a-did'));
});
