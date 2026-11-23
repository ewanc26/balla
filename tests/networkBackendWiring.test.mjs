import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { WEB_LINKING_CONFIG } from '../src/lib/webLinking.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const app = read('../App.tsx');
const advanced = read('../src/screens/AdvancedScreen.tsx');
const backendScreen = read('../src/screens/BackendScreen.tsx');
const model = read('../src/lib/networkBackendModel.ts');
const adapter = read('../src/lib/networkBackend.ts');
const feed = read('../src/screens/FeedScreen.tsx');
const thread = read('../src/screens/ThreadScreen.tsx');
const notifications = read('../src/screens/NotificationsScreen.tsx');
const profile = read('../src/screens/ProfileScreen.tsx');
const search = read('../src/screens/SearchScreen.tsx');
const discovery = read('../src/screens/DiscoveryScreen.tsx');
const changelog = read('../CHANGELOG.md');
const compliance = read('../docs/bluesky-compliance.md');
const metadata = JSON.parse(read('../oauth-client-metadata.json'));

test('Advanced exposes one real Backend screen with a stable web path', () => {
  assert.match(app, /import \{ BackendScreen \} from '\.\/src\/screens\/BackendScreen';/);
  assert.match(app, /<Stack\.Screen name="Backend" component=\{BackendScreen\} \/>/);
  assert.equal(WEB_LINKING_CONFIG.screens.Backend, 'settings/advanced/backend');
  assert.match(advanced, /navigation\.navigate\('Backend'\)/);
  assert.doesNotMatch(advanced, /onPress=\{\(\) => \{\}\}/);
});

test('the Backend screen is a read-only inventory, not a fake backend selector', () => {
  assert.match(backendScreen, /BACKEND_VERB_STATUS/);
  assert.match(backendScreen, /NETWORK_BACKEND_COPY/);
  assert.match(backendScreen, /NETWORK_BACKEND_ID/);
  assert.match(backendScreen, /NETWORK_BACKEND_COPY\.selected/);
  assert.doesNotMatch(backendScreen, /SettingSwitch|SettingChoice|SettingButton/);
  assert.doesNotMatch(backendScreen, /onPress|navigation\.navigate/);
  assert.doesNotMatch(backendScreen, /createRecord|deleteRecord|putRecord|agent\./);
});

test('the contract covers all nine verb groups without claiming full routing', () => {
  for (const group of [
    'session',
    'timeline',
    'thread',
    'notifications',
    'profile',
    'compose',
    'media',
    'moderation',
    'search',
  ]) {
    assert.match(model, new RegExp(`readonly ${group}:`));
  }
  assert.match(model, /The complete verb contract named by #98/);
  assert.match(model, /only the groups marked `routed`/);
  assert.match(model, /method here is not a claim that a screen uses it/);
  assert.doesNotMatch(model, /ActivityPub|Mastodon|Nostr|Bridgy|Mostr/);
});

test('the only registered adapter delegates to the existing ATProtocol path', () => {
  assert.match(adapter, /import \{[\s\S]*agent[\s\S]*\} from '\.\/agent';/);
  assert.match(adapter, /export const atprotoBackend: NetworkBackend/);
  assert.match(adapter, /export const networkBackend: NetworkBackend = atprotoBackend;/);
  assert.doesNotMatch(adapter, /new Agent\(|registerBackend|backends:\s*\[/);
  assert.doesNotMatch(adapter, /fetch\(|AsyncStorage|console\.|\.message\b/);
  assert.doesNotMatch(adapter, /readWithRetry|setTimeout|BASE_BACKOFF_MS/);

  for (const call of [
    'agent.getTimeline(',
    'agent.app.bsky.feed.getFeed(',
    'agent.app.bsky.feed.getListFeed(',
    'agent.getPostThread(',
    'agent.listNotifications(',
    'agent.getFollows(',
    'agent.getProfile(',
    'agent.getAuthorFeed(',
    'agent.getActorLikes(',
    'agent.post(',
    'agent.uploadBlob(',
    'agent.app.bsky.feed.searchPostsV2(',
    'agent.searchActors(',
    'agent.app.bsky.unspecced.getPopularFeedGenerators(',
    'agent.app.bsky.graph.searchStarterPacksV2(',
  ]) {
    assert.ok(adapter.includes(call), `adapter must delegate: ${call}`);
  }
  assert.match(adapter, /get did\(\)/);
});

test('routed screens keep retry and error copy while calling the seam', () => {
  const routed = [
    [feed, 'networkBackend.timeline.getTimeline('],
    [feed, 'networkBackend.timeline.getFeed('],
    [feed, 'networkBackend.timeline.getListFeed('],
    [thread, 'networkBackend.thread.getPostThread('],
    [notifications, 'networkBackend.notifications.listNotifications('],
    [notifications, 'networkBackend.notifications.getFollows('],
    [profile, 'networkBackend.profile.getProfile('],
    [profile, 'networkBackend.profile.getAuthorFeed('],
    [profile, 'networkBackend.profile.getActorLikes('],
    [search, 'networkBackend.search.searchPosts('],
    [search, 'networkBackend.search.searchActors('],
    [search, 'networkBackend.search.searchFeeds('],
    [search, 'networkBackend.search.searchStarterPacks('],
    [discovery, 'networkBackend.search.searchPosts('],
  ];
  for (const [source, call] of routed) {
    assert.ok(source.includes(call), `routed screen must call: ${call}`);
    assert.match(source, /readWithRetry\(/);
    assert.match(source, /describeFailure\(/);
  }

  assert.doesNotMatch(feed, /agent\.app\.bsky\.feed\.(getTimeline|getFeed|getListFeed)\(/);
  assert.doesNotMatch(thread, /agent\.getPostThread\(/);
  assert.doesNotMatch(notifications, /agent\.(listNotifications|getFollows)\(/);
  assert.doesNotMatch(profile, /agent\.(getProfile|getAuthorFeed|getActorLikes)\(/);
  assert.doesNotMatch(search, /agent\.app\.bsky\.feed\.searchPostsV2\(/);
  assert.doesNotMatch(discovery, /agent\.app\.bsky\.feed\.searchPostsV2\(/);
});

test('the seam introduces no scope, dependency or message-text path', () => {
  const scopes = metadata.scope.split(/\s+/).filter(Boolean);
  assert.equal(scopes.length, 111);
  assert.equal(/repo:\*|rpc:\*|blob:\*/.test(metadata.scope), false);
  const pkg = JSON.parse(read('../package.json'));
  const dependencyNames = Object.keys(pkg.dependencies || {});
  assert.ok(!dependencyNames.some((name) => /activity|nostr|mastodon|bridgy|mostr/i.test(name)));
  for (const source of [model, adapter, backendScreen]) {
    assert.doesNotMatch(source, /messageText|\.message\b|console\.log/);
  }
});

test('release notes describe the partial seam honestly', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  const plistPath = new URL('../ios/Balla/Info.plist', import.meta.url);
  assert.equal(pkg.version, '0.48.0');
  assert.equal(appJson.expo.version, '0.48.0');
  // Native projects are generated locally and are not tracked in this repo.
  if (existsSync(plistPath)) {
    assert.match(readFileSync(plistPath, 'utf8'), /<string>0\.48\.0<\/string>/);
  }
  assert.match(changelog, /^## 0\.39\.0$/m);
  assert.match(changelog, /partial seam/i);
  assert.match(changelog, /not a completed migration/i);
  assert.match(changelog, /only registered backend/i);
  assert.match(changelog, /scope count remains 111/);
  assert.match(compliance, /network backend seam/i);
  assert.match(compliance, /partial/i);
});
