import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('list feeds use the published saved-feed type and list endpoints', () => {
  const context = read('../src/lib/feedsContext.tsx');
  assert.match(context, /type: 'list', value, pinned: true/);
  assert.match(context, /agent\.app\.bsky\.graph\.getList\(\{/);
  assert.match(context, /findSavedListItem/);

  const feed = read('../src/screens/FeedScreen.tsx');
  assert.match(feed, /networkBackend\.timeline\.getListFeed\(\{/);
  assert.match(read('../src/lib/networkBackend.ts'), /agent\.app\.bsky\.feed\.getListFeed\(/);
  assert.match(feed, /activeIsList/);
  assert.match(feed, /feedChoices\(homeFeeds, generators, lists\)/);
  assert.match(feed, /activeIsList\s*\? undefined/);
});

test('curation list detail exposes a visible Home pin control', () => {
  const screen = read('../src/screens/ListDetailScreen.tsx');
  assert.match(screen, /pinList\(list\.uri, !pinnedToHome\)/);
  assert.match(screen, /pinnedToHome \? 'Pinned to Home' : 'Pin to Home'/);
  assert.match(screen, /Following stays\s+chronological and unchanged/);
});

test('the Feeds manager opens and removes list-feed shortcuts', () => {
  const screen = read('../src/screens/FeedsScreen.tsx');
  assert.match(
    screen,
    /navigation\.navigate\('ListDetail', \{ uri: source\.value \}\)/
  );
  assert.match(screen, /removeSource\(source\.value\)/);
  assert.match(screen, /pinnedHomeFeeds/);
  assert.match(screen, /listName\(list\)/);
  assert.match(read('../src/screens/SettingsScreen.tsx'), /pinnedHomeFeeds/);
});

test('release copy records list-feed pinning', () => {
  assert.equal(
    JSON.parse(read('../package.json')).version,
    JSON.parse(read('../app.json')).expo.version,
  );

  const changelog = read('../CHANGELOG.md');
  assert.match(changelog, /## 0\.23\.0/);
  assert.match(changelog, /type: 'list'/);

  const lists = read('../docs/lists.md');
  assert.match(lists, /Home shortcuts/);
  assert.doesNotMatch(lists, /List feeds are not pinned/);
  assert.match(read('../docs/oauth-scopes.md'), /Pinning a curation list feed/);
  assert.match(read('../README.md'), /list feeds \(pinnable to Home\)/);
  assert.match(read('../AGENTS.md'), /curation list\s+feeds can be pinned/);

  const site = read('../site/features.html');
  assert.match(site, /issues\/85/);
  assert.match(site, /curation list’s feed beside them/);
});
