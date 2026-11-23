import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RANKED_FEEDS,
  RANKED_FEED_SHELF_FOOTNOTE,
  RANKED_FEED_SHELF_INTRO,
  rankedFeedLabel,
} from '../src/lib/rankedFeeds.ts';

test('fu is the first ranked feed and names its real AT-URI and service', () => {
  const fu = RANKED_FEEDS[0];
  assert.equal(fu.name, 'fu');
  assert.equal(
    fu.uri,
    'at://did:plc:ooensn4mr5mhznzypvxelfa3/app.bsky.feed.generator/fu'
  );
  assert.equal(fu.creator, '@eurosky.social');
  assert.equal(fu.serviceDid, 'did:web:feed1.eurosky.network');
  assert.equal(fu.sourceUrl, 'https://github.com/eurosky-social/fu-feed');
});

test('every shelf entry is inspectable and discloses the third party', () => {
  for (const feed of RANKED_FEEDS) {
    assert.match(feed.uri, /^at:\/\/[^/]+\/app\.bsky\.feed\.generator\/[^/]+$/);
    assert.match(feed.sourceUrl, /^https:\/\//);
    assert.match(feed.serviceDid, /^did:(web|plc):/);
    assert.ok(feed.algorithm.length > 40);
    assert.match(feed.disclosure, /selects and ranks/i);
    assert.match(feed.disclosure, /likes/i);
    assert.match(feed.disclosure, /never changes Following or Home/i);
  }
});

test('the shelf says it is optional and never becomes Following', () => {
  assert.match(RANKED_FEED_SHELF_INTRO, /optional/i);
  assert.match(RANKED_FEED_SHELF_INTRO, /Home stays chronological/i);
  assert.match(RANKED_FEED_SHELF_FOOTNOTE, /never inserted into Following/i);
  assert.match(RANKED_FEED_SHELF_FOOTNOTE, /never become Home/i);
});

test('the one-tap action names the saved state', () => {
  assert.equal(rankedFeedLabel(false), 'Subscribe');
  assert.equal(rankedFeedLabel(true), 'Unsubscribe');
});

test('every shelf entry has a unique address', () => {
  const uris = RANKED_FEEDS.map((feed) => feed.uri);
  assert.equal(new Set(uris).size, uris.length);
});
