import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALL_PROFILE_TABS,
  AUTHOR_FEED_FILTERS,
  filterForTab,
  normaliseTab,
  tabLabel,
  usesActorLikes,
  visibleProfileTabs,
} from '../src/lib/profileTabsModel.ts';

test('all tabs map to published author-feed filters or the actor-likes RPC', () => {
  assert.equal(usesActorLikes('likes'), true);
  assert.equal(filterForTab('likes'), null);
  for (const tab of ALL_PROFILE_TABS.filter((t) => t !== 'likes')) {
    assert.ok(AUTHOR_FEED_FILTERS[tab], `missing filter for ${tab}`);
    assert.ok(filterForTab(tab));
    assert.equal(usesActorLikes(tab), false);
  }
  assert.equal(filterForTab('posts'), 'posts_and_author_threads');
  assert.equal(filterForTab('replies'), 'posts_and_replies_only');
  assert.equal(filterForTab('media'), 'posts_with_media');
  assert.equal(filterForTab('videos'), 'posts_with_video');
});

test('tab visibility follows the official profile rules', () => {
  const normal = visibleProfileTabs({ isSelf: true, isLabeler: false, hasSession: true });
  assert.deepEqual(normal, ['posts', 'replies', 'media', 'videos', 'likes']);

  const other = visibleProfileTabs({ isSelf: false, isLabeler: false, hasSession: true });
  assert.ok(!other.includes('likes'));
  assert.ok(other.includes('replies'));

  const labeler = visibleProfileTabs({ isSelf: true, isLabeler: true, hasSession: true });
  assert.ok(!labeler.includes('media'));
  assert.ok(!labeler.includes('videos'));
  assert.ok(labeler.includes('posts'));

  const loggedOut = visibleProfileTabs({ isSelf: false, isLabeler: false, hasSession: false });
  assert.deepEqual(loggedOut, ['posts', 'media', 'videos']);
});

test('a stale tab falls back to posts when it is no longer visible', () => {
  const visible = visibleProfileTabs({ isSelf: false, isLabeler: false, hasSession: true });
  assert.equal(normaliseTab('likes', visible), 'posts');
  assert.equal(normaliseTab('media', visible), 'media');
  assert.equal(normaliseTab('nonsense', visible), 'posts');
});

test('every tab has an accessible label', () => {
  for (const tab of ALL_PROFILE_TABS) {
    assert.equal(typeof tabLabel(tab), 'string');
    assert.ok(tabLabel(tab).length > 0);
  }
});
