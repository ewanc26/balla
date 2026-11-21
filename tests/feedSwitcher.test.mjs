import test from 'node:test';
import assert from 'node:assert/strict';
import {
  feedChoices,
  feedStillAvailable,
  generatorCreator,
  generatorName,
  selectedFeed,
} from '../src/lib/feedSwitcher.ts';

const saved = [
  { id: '1', type: 'feed', value: 'at://unpinned', pinned: false },
  { id: '2', type: 'feed', value: 'at://pinned-b', pinned: true },
  { id: '3', type: 'feed', value: 'at://pinned-a', pinned: true },
];

const generators = {
  'at://pinned-a': {
    displayName: 'Local news',
    creator: { handle: 'news.example' },
  },
  'at://pinned-b': { displayName: '  Photography  ' },
};

test('the switcher puts Following first, then pinned feeds in saved order', () => {
  assert.deepEqual(
    feedChoices(saved, generators).map((choice) => [
      choice.value,
      choice.label,
      choice.pinned,
    ]),
    [
      [null, 'Following', false],
      ['at://pinned-b', 'Photography', true],
      ['at://pinned-a', 'Local news', true],
      ['at://unpinned', 'Saved feed', false],
    ]
  );
});

test('switcher rows use only returned metadata and mark Following honestly', () => {
  const [following, , local] = feedChoices(saved, generators);
  assert.equal(following.following, true);
  assert.equal(following.creator, null);
  assert.equal(local.creator, '@news.example');
  assert.equal(generatorName(null), null);
  assert.equal(generatorName({ displayName: '   ' }), null);
  assert.equal(generatorCreator({ creator: { handle: 'a.example' } }), '@a.example');
});

test('selected feed falls back to Following when its saved feed is gone', () => {
  assert.deepEqual(selectedFeed(null, saved, generators), feedChoices(saved, generators)[0]);
  assert.equal(selectedFeed('at://pinned-a', saved, generators).label, 'Local news');
  assert.equal(selectedFeed('at://removed', saved, generators).value, null);
  assert.equal(feedStillAvailable('at://removed', saved), false);
  assert.equal(feedStillAvailable('at://pinned-a', saved), true);
  assert.equal(feedStillAvailable(null, saved), true);
});
