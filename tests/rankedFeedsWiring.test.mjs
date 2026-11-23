import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const screen = read('../src/screens/FeedsScreen.tsx');
const model = read('../src/lib/rankedFeeds.ts');

test('the shelf is wired into feed discovery, not Home', () => {
  assert.match(screen, /RANKED_FEED_SHELF_TITLE/);
  assert.match(screen, /<RankedFeedRow/);
  assert.match(screen, /findSavedFeed\(homeFeeds, feed\.uri\)/);
  assert.doesNotMatch(screen, /addSavedFeeds\(\[\{ type: 'feed', value: feed\.uri[^}]*pinned: true/);
});

test('subscribing and unsubscribing reuse the existing saved-feed calls', () => {
  assert.match(screen, /await saveFeed\(feed\.uri, false\)/);
  assert.match(screen, /await removeSource\(feed\.uri\)/);
});

test('the disclosure, source link and 44pt control are visible', () => {
  assert.match(screen, /feed\.algorithm/);
  assert.match(screen, /feed\.disclosure/);
  assert.match(screen, /Read the algorithm/);
  assert.match(screen, /openExternalUrl\(feed\.sourceUrl\)/);
  assert.match(screen, /accessible|accessibilityLabel/);
  assert.match(screen, /minHeight: 44/);
});

test('the shelf names the real operator and carries no invented metrics', () => {
  assert.match(model, /did:web:feed1\.eurosky\.network/);
  assert.match(model, /@eurosky\.social/);
  assert.doesNotMatch(model, /likeCount|score|popularity of|testimonial/i);
});
