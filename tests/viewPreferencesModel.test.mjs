import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_FEED_FILTERS,
  filterByContentLanguages,
  filterFeedItems,
  isQuoteItem,
  isReplyItem,
  isRepostItem,
  readFeedFilters,
  readThreadSort,
  sortReplies,
} from '../src/lib/viewPreferencesModel.ts';

const post = (uri, overrides = {}) => ({
  post: {
    uri,
    indexedAt: overrides.indexedAt || '2026-01-01T00:00:00.000Z',
    likeCount: overrides.likeCount || 0,
    record: {
      createdAt: overrides.createdAt || overrides.indexedAt || '2026-01-01T00:00:00.000Z',
      ...(overrides.langs ? { langs: overrides.langs } : {}),
      ...(overrides.reply ? { reply: overrides.reply } : {}),
    },
    ...(overrides.embed ? { embed: overrides.embed } : {}),
  },
  ...(overrides.reason ? { reason: overrides.reason } : {}),
});

test('feed filters read only the home feedViewPref and only honoured fields', () => {
  assert.deepEqual(readFeedFilters(undefined), DEFAULT_FEED_FILTERS);
  assert.deepEqual(
    readFeedFilters({
      feedViewPrefs: {
        other: { hideReplies: true },
        home: { hideReposts: true, hideQuotePosts: 1, hideRepliesByLikeCount: 5 },
      },
    }),
    { hideReplies: false, hideReposts: true, hideQuotePosts: false }
  );
});

test('filters use published embed and reason shapes without reordering', () => {
  const reply = post('reply', { reply: { root: {}, parent: {} } });
  const repost = post('repost', {
    reason: { $type: 'app.bsky.feed.defs#reasonRepost' },
  });
  const quote = post('quote', {
    embed: { $type: 'app.bsky.embed.record#view' },
  });
  const plain = post('plain');
  const items = [plain, reply, repost, quote];

  assert.equal(isReplyItem(reply), true);
  assert.equal(isRepostItem(repost), true);
  assert.equal(isQuoteItem(quote), true);
  assert.deepEqual(filterFeedItems(items, DEFAULT_FEED_FILTERS), items);
  assert.deepEqual(
    filterFeedItems(items, { hideReplies: true, hideReposts: false, hideQuotePosts: false }).map(
      (item) => item.post.uri
    ),
    ['plain', 'repost', 'quote']
  );
  assert.deepEqual(
    filterFeedItems(items, { hideReplies: false, hideReposts: true, hideQuotePosts: true }).map(
      (item) => item.post.uri
    ),
    ['plain', 'reply']
  );
});

test('content languages match the base language and keep untagged posts', () => {
  const english = post('en', { langs: ['en-GB'] });
  const french = post('fr', { langs: ['fr'] });
  const untagged = post('none');
  const items = [english, french, untagged];

  assert.deepEqual(filterByContentLanguages(items, []), items);
  assert.deepEqual(
    filterByContentLanguages(items, ['en']).map((item) => item.post.uri),
    ['en', 'none']
  );
  assert.deepEqual(
    filterByContentLanguages(items, ['en-GB']).map((item) => item.post.uri),
    ['en', 'none']
  );
});

test('thread sort accepts only the three explicit modes Balla can render', () => {
  assert.equal(readThreadSort({ threadViewPrefs: { sort: 'oldest' } }), 'oldest');
  assert.equal(readThreadSort({ threadViewPrefs: { sort: 'newest' } }), 'newest');
  assert.equal(readThreadSort({ threadViewPrefs: { sort: 'most-likes' } }), 'most-likes');
  assert.equal(readThreadSort({ threadViewPrefs: { sort: 'hotness' } }), 'oldest');
  assert.equal(readThreadSort(undefined), 'oldest');
});

test('reply sorting is stable and never applies a hidden ranking', () => {
  const nodes = [
    post('a', { createdAt: '2026-01-03T00:00:00.000Z', likeCount: 1 }),
    post('b', { createdAt: '2026-01-01T00:00:00.000Z', likeCount: 10 }),
    post('c', { createdAt: '2026-01-02T00:00:00.000Z', likeCount: 10 }),
  ];
  const uris = (list) => list.map((node) => node.post.uri);

  assert.deepEqual(uris(sortReplies(nodes, 'oldest')), ['b', 'c', 'a']);
  assert.deepEqual(uris(sortReplies(nodes, 'newest')), ['a', 'c', 'b']);
  assert.deepEqual(uris(sortReplies(nodes, 'most-likes')), ['b', 'c', 'a']);
  assert.deepEqual(uris(sortReplies(nodes, 'hotness')), ['a', 'b', 'c']);
  assert.deepEqual(nodes.map((node) => node.post.uri), ['a', 'b', 'c']);
});
