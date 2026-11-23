import test from 'node:test';
import assert from 'node:assert/strict';
import {
  feedChoices,
  feedStillAvailable,
  generatorCreator,
  generatorName,
  listCreator,
  listName,
  selectedFeed,
} from '../src/lib/feedSwitcher.ts';

const listUri = 'at://did:plc:one/app.bsky.graph.list/one';
const saved = [
  { id: '1', type: 'feed', value: 'at://unpinned', pinned: false },
  { id: '2', type: 'feed', value: 'at://pinned-b', pinned: true },
  { id: '3', type: 'feed', value: 'at://pinned-a', pinned: true },
  { id: '4', type: 'list', value: listUri, pinned: true },
  { id: '5', type: 'list', value: 'at://list-unpinned', pinned: false },
];

const generators = {
  'at://pinned-a': {
    displayName: 'Local news',
    creator: { handle: 'news.example' },
  },
  'at://pinned-b': { displayName: '  Photography  ' },
};

const lists = {
  [listUri]: {
    name: '  Friends  ',
    creator: { handle: 'friends.example' },
  },
  'at://list-unpinned': { name: 'Reading' },
};

test('the switcher puts Following first, then pinned sources in saved order', () => {
  assert.deepEqual(
    feedChoices(saved, generators, lists).map((choice) => [
      choice.value,
      choice.label,
      choice.pinned,
      choice.kind,
    ]),
    [
      [null, 'Following', false, 'following'],
      ['at://pinned-b', 'Photography', true, 'feed'],
      ['at://pinned-a', 'Local news', true, 'feed'],
      [listUri, 'Friends', true, 'list'],
      ['at://unpinned', 'Saved feed', false, 'feed'],
      ['at://list-unpinned', 'Reading', false, 'list'],
    ]
  );
});

test('switcher rows use only returned metadata and mark Following honestly', () => {
  const [following, , local, friends] = feedChoices(saved, generators, lists);
  assert.equal(following.following, true);
  assert.equal(following.creator, null);
  assert.equal(local.creator, '@news.example');
  assert.equal(friends.creator, '@friends.example');
  assert.equal(generatorName(null), null);
  assert.equal(generatorName({ displayName: '   ' }), null);
  assert.equal(generatorCreator({ creator: { handle: 'a.example' } }), '@a.example');
  assert.equal(listName(null), null);
  assert.equal(listName({ name: '   ' }), null);
  assert.equal(listCreator({ creator: { handle: 'b.example' } }), '@b.example');
});

test('list feeds fall back honestly when list metadata is unavailable', () => {
  const choice = feedChoices(saved, generators, {}).find(
    (item) => item.value === listUri
  );
  assert.equal(choice?.label, 'List feed');
  assert.equal(choice?.creator, null);
  assert.equal(choice?.kind, 'list');
});

test('selected feed falls back to Following when its saved source is gone', () => {
  assert.deepEqual(
    selectedFeed(null, saved, generators, lists),
    feedChoices(saved, generators, lists)[0]
  );
  assert.equal(
    selectedFeed('at://pinned-a', saved, generators, lists).label,
    'Local news'
  );
  assert.equal(selectedFeed(listUri, saved, generators, lists).label, 'Friends');
  assert.equal(
    selectedFeed('at://removed', saved, generators, lists).value,
    null
  );
  assert.equal(feedStillAvailable('at://removed', saved), false);
  assert.equal(feedStillAvailable('at://pinned-a', saved), true);
  assert.equal(feedStillAvailable(listUri, saved), true);
  assert.equal(feedStillAvailable(null, saved), true);
});
