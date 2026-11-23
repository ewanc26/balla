import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEB_LINKING_CONFIG } from '../src/lib/webLinking.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../App.tsx');
const screen = read('../src/screens/DiscoveryScreen.tsx');
const postCard = read('../src/components/PostCard.tsx');
const search = read('../src/screens/SearchScreen.tsx');
const agent = read('../src/lib/agent.ts');
const metadata = JSON.parse(read('../oauth-client-metadata.json'));

test('all four discovery destinations are registered with stable web paths', () => {
  const expected = {
    Hashtag: 'hashtag/:tag',
    Topic: 'topic/:topic',
    VideoFeed: 'video',
    Discover: 'discover',
  };
  for (const [name, path] of Object.entries(expected)) {
    assert.match(app, new RegExp(`<Stack\\.Screen name="${name}" component={DiscoveryScreen}`));
    assert.equal(WEB_LINKING_CONFIG.screens[name], path);
  }
});

test('discovery uses only the already authorised searchPostsV2 scope', () => {
  const scopes = metadata.scope.split(/\s+/).filter(Boolean);
  assert.ok(scopes.includes('rpc:app.bsky.feed.searchPostsV2?aud=did:web:api.bsky.app#bsky_appview'));
  assert.ok(!scopes.some((scope) => /getTrendingTopics|getSuggested/.test(scope)));
  assert.match(screen, /networkBackend\.search\.searchPosts\(/);
  assert.match(read('../src/lib/networkBackend.ts'), /agent\.app\.bsky\.feed\.searchPostsV2\(/);
  assert.match(screen, /buildDiscoveryParams\(/);
  assert.doesNotMatch(screen, /getTrendingTopics|getSuggested/);
  assert.doesNotMatch(agent, /getTrendingTopics/);
});

test('ranked and newest-first surfaces are distinguished in the UI', () => {
  const model = read('../src/lib/discoveryModel.ts');
  assert.match(screen, /copy\.ranked \? 'SUGGESTED · RANKED' : 'NEWEST FIRST'/);
  assert.match(model, /does not change your Following feed/i);
  assert.match(model, /not by who you follow/i);
  assert.match(screen, /accessibilityLabel=\{`Retry loading \$\{copy\.title\}`\}/);
});

test('hashtag links reach their own page, not ranked search', () => {
  assert.match(postCard, /navigation\.navigate\('Hashtag', \{ tag: segment\.tag \}\)/);
  assert.doesNotMatch(postCard, /q: `#\$\{segment\.tag\}`/);
});

test('Discover is opt-in from Search and has back navigation', () => {
  assert.match(search, /navigation\.navigate\('Discover'\)/);
  assert.match(search, /accessibilityLabel="Open Discover"/);
  assert.match(search, /never in Following/i);
  assert.match(app, /<Stack\.Screen name="Discover" component=\{DiscoveryScreen\}/);
});

test('discovery pages paginate and handle hidden posts and failures', () => {
  assert.match(screen, /setCursor\(res\.data\.cursor\)/);
  assert.match(screen, /onEndReached=\{loadMore\}/);
  assert.match(screen, /readWithRetry\(/);
  assert.match(screen, /describeFailure\(/);
  assert.match(screen, /subscribeActorHidden\(/);
  assert.match(screen, /RefreshControl/);
});

test('mock fixtures expose all four destinations for preview checks', () => {
  const mock = read('../src/lib/mock.ts');
  for (const name of ['Hashtag', 'Topic', 'VideoFeed', 'Discover']) {
    assert.match(mock, new RegExp(`'${name}'`));
  }
});
