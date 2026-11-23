import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  HYDRATION_SOURCE_AUDIENCE,
  HYDRATION_SOURCE_COPY,
  HYDRATION_SOURCE_DID,
  hydrationSourceText,
} from '../src/lib/hydrationSource.ts';
import { APPVIEW_HEALTH_DID } from '../src/lib/appViewHealth.ts';
import { DEFAULT_SERVICES } from '../src/lib/servicesModel.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const feed = read('../src/screens/FeedScreen.tsx');
const appViewScreen = read('../src/screens/AppViewScreen.tsx');
const health = read('../src/lib/appViewHealth.ts');

test('the hydration source is the one audited grant-bound AppView, with no second host', () => {
  assert.equal(HYDRATION_SOURCE_DID, DEFAULT_SERVICES.appviewDid);
  assert.equal(HYDRATION_SOURCE_AUDIENCE, DEFAULT_SERVICES.appviewAudience);
  assert.equal(HYDRATION_SOURCE_DID, APPVIEW_HEALTH_DID);
  assert.equal(hydrationSourceText(), 'did:web:api.bsky.app');
  assert.equal(hydrationSourceText('did:web:other.test'), 'did:web:other.test');
  assert.match(HYDRATION_SOURCE_COPY.note, /not a live check/);
});

test('the feed shows the real DID as a tappable source label, not a fake control', () => {
  assert.match(feed, /from '\.\.\/lib\/hydrationSource\.ts'/);
  assert.match(feed, /HYDRATION_SOURCE_COPY\.label/);
  assert.match(feed, /hydrationSourceText\(\)/);
  assert.match(feed, /navigation\.navigate\('AppView'\)/);
  assert.match(feed, /HYDRATION_SOURCE_COPY\.buttonLabel/);
  assert.match(feed, /accessibilityRole="button"/);
  assert.doesNotMatch(feed, /onPress=\{\(\) => \{\}\}/);
});

test('the AppView and health copy now name the label without claiming failover', () => {
  assert.match(appViewScreen, /No picker, mirror, failover or per-function routing/);
  assert.match(appViewScreen, /hydration-source/);
  assert.match(health, /static hydration-source label/);
  assert.match(health, /not a switch or a live check/);
});

test('the release documents the partial #99 slice without new scope', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  const changelog = read('../CHANGELOG.md');
  const compliance = read('../docs/bluesky-compliance.md');
  const features = read('../site/features.html');
  assert.equal(pkg.version, '0.55.0');
  assert.equal(appJson.expo.version, '0.55.0');
  assert.match(changelog, /^## 0\.55\.0$/m);
  assert.match(changelog, /#99, partial/);
  assert.match(changelog, /hydration-source/);
  assert.match(changelog, /scope count remains 111/);
  assert.match(compliance, /hydration-source/);
  assert.match(features, /hydration source/);
  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 111);
});
