import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { AppBskyActorProfile, AppBskyFeedLike, AppBskyFeedPost, AppBskyGraphFollow } from '@atproto/api';
import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import * as raw from 'multiformats/codecs/raw';
import { minimatch } from 'minimatch';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const pkg = JSON.parse(read('../package.json'));
const lock = JSON.parse(read('../package-lock.json'));

test('patched transitive versions are pinned in package.json and the lockfile', () => {
  const expected = { minimatch: '11.0.9', zod: '4.6.6' };
  assert.deepEqual(pkg.overrides, expected);

  for (const [name, version] of Object.entries(expected)) {
    const entries = Object.entries(lock.packages).filter(([path]) => path.endsWith(`node_modules/${name}`));
    assert.ok(entries.length > 0, `${name} is missing from the lockfile`);
    for (const [path, entry] of entries) {
      assert.equal(entry.version, version, `${path} must resolve to the patched version`);
    }
  }
});

test('minimatch 11 remains usable at runtime', () => {
  assert.equal(minimatch('app/screens/FeedScreen.js', 'app/**/*.js'), true);
  assert.equal(minimatch('assets/icon.png', 'app/**/*.js'), false);
});

test('the installed zod validates real AT Protocol records', async () => {
  const cid = CID.createV1(raw.code, await sha256.digest(new TextEncoder().encode('hello'))).toString();
  const subject = { uri: `at://did:plc:abcdefghijklmnopqrstuvwxyz/app.bsky.feed.post/3lxyz`, cid };
  const createdAt = '2025-01-01T00:00:00.000Z';
  const cases = [
    [AppBskyFeedPost, { $type: 'app.bsky.feed.post', text: 'hello', createdAt }],
    [AppBskyFeedLike, { $type: 'app.bsky.feed.like', subject, createdAt }],
    [AppBskyGraphFollow, { $type: 'app.bsky.graph.follow', subject: 'did:plc:abcdefghijklmnopqrstuvwxyz', createdAt }],
    [AppBskyActorProfile, { $type: 'app.bsky.actor.profile', displayName: 'Balla' }],
  ];

  for (const [lexicon, record] of cases) {
    assert.equal(lexicon.validateRecord(record).success, true, `${record.$type} must validate`);
  }

  assert.equal(
    AppBskyFeedPost.validateRecord({ $type: 'app.bsky.feed.post', text: 12, createdAt }).success,
    false,
    'malformed records must still be rejected',
  );
});

test('release copy records the dependency overrides', () => {
  assert.equal(pkg.version, JSON.parse(read('../app.json')).expo.version);
  assert.match(read('../CHANGELOG.md'), /## 0\.23\.2/);
  assert.match(read('../CHANGELOG.md'), /minimatch 11\.0\.9 and zod 4\.6\.6/);
});
