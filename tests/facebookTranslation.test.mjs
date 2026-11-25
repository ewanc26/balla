import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const mapPath = new URL('../docs/facebook-translation.md', import.meta.url);
const map = existsSync(mapPath) ? readFileSync(mapPath, 'utf8') : '';
const changelog = read('../CHANGELOG.md');
const compliance = read('../docs/bluesky-compliance.md');
const features = read('../site/features.html');
const metadata = JSON.parse(read('../oauth-client-metadata.json'));

test('the concept map is a shipped repository document tied to its epic', () => {
  assert.ok(existsSync(mapPath), 'docs/facebook-translation.md exists');
  assert.match(map, /^# Facebook-era translation map$/m);
  assert.match(map, /https:\/\/github\.com\/ewanc26\/balla\/issues\/149/);
  assert.match(map, /not a\s*claim of affiliation with Meta or Facebook/);
});

test('every translation row reflects shipped state, with #156 explicitly partial', () => {
  for (const row of [
    /app\.bsky\.feed\.getTimeline.*News Feed.*Shipped: Home is newest-first cards with no ranking/,
    /app\.bsky\.feed\.post.*Wall posts.*Shipped: the card is the Wall/,
    /getPostThread.*\(#153\).*\(#155\)/,
    /app\.bsky\.feed\.like.*\(#150\)/,
    /app\.bsky\.feed\.repost.*Shipped: the repost action on cards/,
    /Post share sheet.*Shipped: share, copy link and translate \(#39\)/,
    /Saved posts.*private off-protocol/,
    /Conversations.*\(#26, #27\)/,
    /Notifications.*\(#36\)/,
    /Profile record.*\(#23\)/,
    /Verification lexicon.*\(#25\)/,
    /Lists.*\(#19, #85\)/,
    /Starter packs.*\(#20, #76\)/,
    /Labels and muted words.*\(#38, #107\)/,
    /Own-repository history.*\(#152\)/,
    /Temporary muting.*\(#151\)/,
    /Following activity.*\(#154\)/,
    /community\.lexicon\.calendar\.event.*\(#157\)/,
    /Ranked feed generators.*\(#158\)/,
    /Publisher account bundles.*\(#159\)/,
    /Post versioning.*\(#160\)/,
  ]) {
    assert.match(map, row);
  }
  assert.match(map, /\| Places via the eurosky-places service \|.*\*\*Partial \(#156\):\*\*/);
  assert.match(map, /no granularity choice, check-in record, place chip or per-media binding/);
  assert.match(map, /writes no place record and claims no ATGeo interoperability/);
});

test('the map keeps the dark-pattern prohibitions and does not invent provider switches', () => {
  assert.match(map, /Engagement ranking of feeds, threads, replies or reactions/);
  assert.match(map, /"Top comments"\s+selection/);
  assert.match(map, /"People You May Know"\s+loops beyond user-initiated discovery/);
  assert.match(map, /Stories-style expiry pressure/);
  assert.match(map, /anything that hides a louder action behind a swipe/);
  assert.match(map, /the opt-in For You shelf/);
  assert.match(map, /AppView, chat, video and label services\s+remain grant-bound/);
  assert.match(map, /\(#97, #99, #100\)[\s\S]*remains partial/);
  assert.match(map, /scope count stays 112/);
  for (const issue of [161, 162, 163]) {
    assert.ok(map.includes(`#${issue} —`), `issue ${issue} is recorded outside the map`);
  }
});

test('release copy links the canonical map without changing the contract', () => {
  assert.match(changelog, /^## 0\.77\.0$/m);
  assert.match(changelog, /concept map is now a shipped document/);
  assert.match(changelog, /No new request, write, provider switch, dependency or OAuth scope/);
  assert.match(compliance, /docs\/facebook-translation\.md/);
  assert.match(features, /translation map/);
  assert.match(features, /issues\/149/);
  assert.match(features, /#156.*partial/);
});

test('version parity and unchanged OAuth metadata', () => {
  const pkg = JSON.parse(read('../package.json'));
  assert.equal(pkg.version, '0.92.0');
  assert.equal(JSON.parse(read('../app.json')).expo.version, '0.92.0');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.92\.0<\/string>/);
  }
  assert.equal(metadata.scope.split(' ').filter(Boolean).length, 112);
  assert.deepEqual(pkg.overrides, { minimatch: '11.0.9', zod: '4.6.6' });
});
