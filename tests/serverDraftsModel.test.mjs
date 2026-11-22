import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDraftBody,
  draftViewSummary,
  draftViewToChoices,
  sortDrafts,
} from '../src/lib/serverDraftsModel.ts';

const BASE = {
  text: 'Hello world',
  selfLabels: ['nudity'],
  languages: ['en', 'fr'],
  gates: { reply: 'everyone', quote: 'everyone' },
};

test('a draft body carries text, labels, languages and the real lexicon types', () => {
  const body = buildDraftBody(BASE);
  assert.equal(body.$type, 'app.bsky.draft.defs#draft');
  assert.equal(body.posts.length, 1);
  assert.equal(body.posts[0].$type, 'app.bsky.draft.defs#draftPost');
  assert.equal(body.posts[0].text, 'Hello world');
  assert.equal(body.posts[0].labels.$type, 'com.atproto.label.defs#selfLabels');
  assert.deepEqual(body.posts[0].labels.values, [{ val: 'nudity' }]);
  assert.deepEqual(body.langs, ['en', 'fr']);
});

test('gate rules are stored under the draft lexicon field names', () => {
  const body = buildDraftBody({
    ...BASE,
    gates: { reply: 'followers', quote: 'nobody' },
  });
  assert.equal(body.threadgateAllow[0].$type, 'app.bsky.feed.threadgate#followerRule');
  assert.equal(body.postgateEmbeddingRules[0].$type, 'app.bsky.feed.postgate#disableRule');
  assert.equal(body.threadgateAllowRules, undefined);
});

test('quote and external embeds only store complete, honest values', () => {
  const body = buildDraftBody({
    ...BASE,
    quote: { uri: 'at://did:plc:a/app.bsky.feed.post/abc', cid: 'bafy-cid' },
    externalUri: 'https://example.com',
  });
  assert.deepEqual(body.posts[0].embedRecords[0].record, {
    uri: 'at://did:plc:a/app.bsky.feed.post/abc',
    cid: 'bafy-cid',
  });
  assert.equal(body.posts[0].embedExternals[0].uri, 'https://example.com');

  const bad = buildDraftBody({ ...BASE, quote: { uri: 'https://fake', cid: '' } });
  assert.equal(bad.posts[0].embedRecords, undefined);
});

test('draft views summarise without trusting missing fields', () => {
  const view = {
    id: '3labc',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    draft: {
      posts: [
        {
          text: 'Saved text',
          labels: { values: [{ val: 'nudity' }] },
          embedRecords: [{ record: { uri: 'at://x', cid: 'c' } }],
        },
      ],
      langs: ['en'],
    },
  };
  const summary = draftViewSummary(view);
  assert.equal(summary.text, 'Saved text');
  assert.deepEqual(summary.labels, ['nudity']);
  assert.equal(summary.hasQuote, true);
  assert.equal(summary.hasExternal, false);
  assert.deepEqual(summary.languages, ['en']);
  assert.equal(draftViewSummary(null), null);
});

test('loading a draft restores gates through the record helpers', () => {
  const view = {
    id: '3labc',
    draft: {
      posts: [{ text: 'x' }],
      threadgateAllow: [{ $type: 'app.bsky.feed.threadgate#followerRule' }],
      postgateEmbeddingRules: [{ $type: 'app.bsky.feed.postgate#disableRule' }],
    },
  };
  const choices = draftViewToChoices(view);
  assert.equal(choices.gates.reply, 'followers');
  assert.equal(choices.gates.quote, 'nobody');
});

test('an invalid list rule never restores as a list rule', () => {
  const view = {
    id: '3labc',
    draft: {
      posts: [{ text: 'x' }],
      threadgateAllow: [
        {
          $type: 'app.bsky.feed.threadgate#listRule',
          list: 'https://not-a-list-uri',
        },
      ],
    },
  };
  const choices = draftViewToChoices(view);
  assert.equal(choices.gates.reply, 'everyone');
  assert.equal(choices.gates.listUri, undefined);
});

test('drafts sort newest-updated first with a deterministic tiebreak', () => {
  const views = [
    { id: 'a', updatedAt: '2026-01-01T00:00:00Z' },
    { id: 'c', updatedAt: '2026-03-01T00:00:00Z' },
    { id: 'b', updatedAt: '2026-02-01T00:00:00Z' },
    { id: 'broken' },
  ];
  assert.deepEqual(sortDrafts(views).map((v) => v.id), ['c', 'b', 'a', 'broken']);
});
