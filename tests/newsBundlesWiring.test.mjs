import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../App.tsx');
const linking = read('../src/lib/webLinking.ts');
const discovery = read('../src/screens/DiscoveryScreen.tsx');
const picker = read('../src/screens/NewsScreen.tsx');
const bundle = read('../src/screens/NewsBundleScreen.tsx');
const model = read('../src/lib/newsBundles.ts');
const write = read('../src/lib/newsBundleWrite.ts');
const mock = read('../src/lib/mock.ts');

test('News is an explicit Discover destination with web addresses', () => {
  assert.match(app, /<Stack\.Screen name="News" component=\{NewsScreen\} \/>/);
  assert.match(app, /<Stack\.Screen\s+name="NewsBundle"/);
  assert.match(linking, /News: 'news'/);
  assert.match(linking, /NewsBundle: 'news\/:topic\/:region'/);
  assert.match(discovery, /navigation\.navigate\('News'\)/);
  assert.match(discovery, /mode === 'discover'/);
  assert.match(discovery, /News bundles/);
});

test('the picker shows the roster before any write', () => {
  assert.match(picker, /publishersForBundle\(/);
  assert.match(picker, /Review the \$\{topic\.name\} bundle/);
  assert.match(bundle, /publishers\.map\(/);
  assert.match(bundle, /These are the exact accounts that will be put on the list/);
  assert.match(bundle, /Create bundle/);
  assert.doesNotMatch(bundle, /createNewsBundle\([^)]*\)\s*;\s*setCreatedUri/);
});

test('one atomic applyWrites creates the curation list and its members', () => {
  assert.match(write, /com\.atproto\.repo\.applyWrites/);
  assert.match(write, /CURATE_LIST/);
  assert.match(write, /app\.bsky\.graph\.listitem/);
  assert.match(write, /com\.atproto\.repo\.applyWrites#create/);
  assert.match(write, /TID\.nextStr\(\)/);
  assert.match(write, /validate: true/);
  assert.doesNotMatch(write, /graph\.follow|feed\.like|graph\.block/);
});

test('creating a bundle changes no follow, feed or ranking state', () => {
  for (const source of [picker, bundle, write]) {
    assert.doesNotMatch(source, /app\.bsky\.graph\.follow/);
    assert.doesNotMatch(source, /putPreferences|addSavedFeeds|saveFeed/);
    assert.doesNotMatch(source, /searchPosts|sort: 'top'|getFeedGenerator|getFeed\(/);
  }
});

test('the transparency copy and empty state are visible', () => {
  assert.match(bundle, /NEWS_TRANSPARENCY/);
  assert.match(bundle, /NEWS_NO_RANKING/);
  assert.match(model, /follows nobody/i);
  assert.match(model, /No ranking at any point/i);
  assert.match(bundle, /Nothing\s+is followed or subscribed/);
  assert.match(bundle, /No publisher accounts are listed/);
  assert.match(bundle, /published news pack/);
  assert.match(picker, /NEWS_CURATION_ERROR|state\.error/);
});

test('every bundle control is a visible target of at least 44 points', () => {
  assert.match(picker, /minHeight: 44/);
  assert.match(bundle, /minHeight: 44/);
  assert.match(bundle, /minHeight: 48/);
  assert.match(bundle, /accessibilityRole="button"/);
  assert.match(picker, /accessibilityRole="radio"/);
});

test('an existing bundle is opened or removed, never duplicated', () => {
  assert.match(bundle, /loadLists\(/);
  assert.match(bundle, /list\?\.name === name/);
  assert.match(bundle, /Already in your lists/);
  assert.match(bundle, /deleteList\(existing\.uri\)/);
  assert.match(bundle, /Remove bundle/);
  assert.match(bundle, /Creation stays off until Balla can check your lists/);
});

test('the mock preview has both news screens', () => {
  assert.match(mock, /'News',\n\s+'NewsBundle',/);
  assert.match(app, /screen === 'News'/);
  assert.match(app, /screen === 'NewsBundle'/);
});
