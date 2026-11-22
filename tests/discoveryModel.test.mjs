import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISCOVERY_PAGE_SIZE,
  buildDiscoveryParams,
  discoveryCopy,
  discoveryError,
  emptyDiscoveryCopy,
  isValidTag,
  isValidTopic,
  modeFromRouteName,
  normaliseTag,
  normaliseTopic,
} from '../src/lib/discoveryModel.ts';

test('tags lose hashes and whitespace but keep their characters', () => {
  assert.equal(normaliseTag('  #BookFair  '), 'BookFair');
  assert.equal(normaliseTag('##tea'), 'tea');
  assert.equal(normaliseTag('tea time'), 'teatime');
  assert.equal(normaliseTag(null), '');
  assert.equal(isValidTag('BookFair'), true);
  assert.equal(isValidTag('tea time'), false);
  assert.equal(isValidTag(''), false);
});

test('topics keep interior spaces and drop a leading hash', () => {
  assert.equal(normaliseTopic('  #book  fair '), 'book fair');
  assert.equal(normaliseTopic('tea'), 'tea');
  assert.equal(isValidTopic('book fair'), true);
  assert.equal(isValidTopic('   '), false);
});

test('only the four explicit route names map to a discovery mode', () => {
  assert.equal(modeFromRouteName('Hashtag'), 'hashtag');
  assert.equal(modeFromRouteName('Topic'), 'topic');
  assert.equal(modeFromRouteName('VideoFeed'), 'video');
  assert.equal(modeFromRouteName('Discover'), 'discover');
  assert.equal(modeFromRouteName('Search'), null);
  assert.equal(modeFromRouteName(undefined), null);
});

test('hashtag and topic pages are newest first and carry pagination', () => {
  assert.deepEqual(buildDiscoveryParams('hashtag', '#tea', 'cursor-1'), {
    limit: DISCOVERY_PAGE_SIZE,
    excludeReplies: true,
    cursor: 'cursor-1',
    hashtags: ['tea'],
    sort: 'recent',
  });
  assert.deepEqual(buildDiscoveryParams('topic', 'book fair'), {
    limit: DISCOVERY_PAGE_SIZE,
    excludeReplies: true,
    query: 'book fair',
    sort: 'recent',
  });
});

test('video is newest first; only Discover is ranked', () => {
  const video = buildDiscoveryParams('video', undefined);
  assert.equal(video.hasVideo, true);
  assert.equal(video.sort, 'recent');
  assert.equal(video.hasMedia, undefined);
  const discover = buildDiscoveryParams('discover', undefined);
  assert.equal(discover.hasMedia, true);
  assert.equal(discover.sort, 'top');
  assert.equal(discover.hasVideo, undefined);
  assert.equal(discover.query, undefined);
});

test('invalid or missing identifiers never widen into a broad query', () => {
  assert.equal(buildDiscoveryParams('hashtag', ''), null);
  assert.equal(buildDiscoveryParams('hashtag', '   '), null);
  assert.equal(buildDiscoveryParams('topic', null), null);
  assert.equal(buildDiscoveryParams('topic', '  '), null);
  assert.equal(buildDiscoveryParams('unknown', 'tea'), null);
});

test('copy states ranking honestly and keeps discovery out of Following', () => {
  for (const mode of ['hashtag', 'topic', 'video']) {
    const copy = discoveryCopy(mode, mode === 'hashtag' ? 'tea' : undefined);
    assert.equal(copy.ranked, false);
    assert.match(copy.banner, /not ranked/i);
    assert.match(copy.banner, /does not change your Following feed/i);
  }
  const discover = discoveryCopy('discover', undefined);
  assert.equal(discover.ranked, true);
  assert.match(discover.banner, /ranked/i);
  assert.match(discover.banner, /not by who you follow/i);
  assert.match(discover.banner, /nothing here is added/i);
  assert.equal(discoveryCopy('hashtag', '#tea').title, '#tea');
  assert.equal(discoveryCopy('topic', ' book fair ').title, 'book fair');
});

test('errors and empty states are specific and honest', () => {
  assert.match(discoveryError('hashtag'), /hashtag/i);
  assert.match(discoveryError('topic'), /topic/i);
  assert.match(discoveryError('video'), /video/i);
  assert.match(discoveryError('discover'), /suggested/i);
  assert.match(emptyDiscoveryCopy('hashtag'), /hashtag/i);
  assert.match(emptyDiscoveryCopy('discover'), /suggested/i);
});
