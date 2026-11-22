import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  feedItems,
  findSavedFeed,
  movePinnedFeed,
  normaliseSavedFeeds,
  pinnedFeedItems,
} from '../src/lib/feedPreferences.ts';

const items = [
  {
    id: 'following',
    type: 'timeline',
    value: 'following',
    pinned: true,
  },
  {
    id: 'feed-a',
    type: 'feed',
    value: 'at://did:plc:one/app.bsky.feed.generator/a',
    pinned: true,
  },
  {
    id: 'list-one',
    type: 'list',
    value: 'at://did:plc:one/app.bsky.graph.list/one',
    pinned: true,
  },
  {
    id: 'feed-b',
    type: 'feed',
    value: 'at://did:plc:one/app.bsky.feed.generator/b',
    pinned: true,
  },
  {
    id: 'feed-c',
    type: 'feed',
    value: 'at://did:plc:one/app.bsky.feed.generator/c',
    pinned: false,
  },
];

test('saved-feed parsing is defensive, preserves other preference types and de-duplicates ids', () => {
  const parsed = normaliseSavedFeeds([
    items[0],
    items[1],
    items[2],
    items[4],
    { id: 'broken', type: 'feed', value: 12, pinned: true },
    { id: '', type: 'feed', value: 'at://empty', pinned: true },
    { id: 'feed-a', type: 'feed', value: items[1].value, pinned: false },
    null,
  ]);

  assert.equal(parsed.length, 4);
  assert.equal(parsed.find((item) => item.id === 'feed-a')?.pinned, false);
  assert.equal(parsed.some((item) => item.type === 'list'), true);
  assert.deepEqual(normaliseSavedFeeds(undefined), []);
});

test('feed filters keep lists out of saved-feed and Home-tab surfaces', () => {
  const feeds = feedItems(items);
  assert.deepEqual(
    feeds.map((item) => item.id),
    ['feed-a', 'feed-b', 'feed-c']
  );
  assert.deepEqual(
    pinnedFeedItems(items).map((item) => item.id),
    ['feed-a', 'feed-b']
  );
  assert.equal(findSavedFeed(items, items[3].value)?.id, 'feed-b');
  assert.equal(
    findSavedFeed(items, 'at://did:plc:one/app.bsky.graph.list/one'),
    undefined
  );
});

test('pinned reordering changes only custom-feed positions', () => {
  const moved = movePinnedFeed(items, items[3].value, -1);
  assert.notEqual(moved, items);
  assert.equal(moved[0].id, 'following');
  assert.equal(moved[1].id, 'feed-b');
  assert.equal(moved[2].id, 'list-one');
  assert.equal(moved[3].id, 'feed-a');
  assert.equal(moved[4].id, 'feed-c');

  assert.equal(movePinnedFeed(items, items[1].value, -1), items);
  assert.equal(movePinnedFeed(items, items[3].value, 1), items);
  assert.equal(movePinnedFeed(items, items[4].value, -1), items);
});

test('the saved-feed feature adds exactly the generator batch scope', () => {
  const metadata = JSON.parse(
    readFileSync(new URL('../oauth-client-metadata.json', import.meta.url), 'utf8')
  );
  const tokens = metadata.scope.split(/\s+/).filter(Boolean);
  assert.equal(tokens.length, 106);
  assert.equal(
    tokens.includes(
      'rpc:app.bsky.feed.getFeedGenerators?aud=did:web:api.bsky.app#bsky_appview'
    ),
    true
  );
  assert.equal(/repo:\*|rpc:\*|blob:\*/.test(metadata.scope), false);
});
