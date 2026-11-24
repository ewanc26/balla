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
  assert.equal(hydrationSourceText(), 'did:web:api.eurosky.network');
  assert.equal(hydrationSourceText('did:web:other.test'), 'did:web:other.test');
  assert.match(HYDRATION_SOURCE_COPY.note, /not a live check/);
});

test('the Home feed does not repeat a hydration-source banner', () => {
  assert.doesNotMatch(feed, /hydrationSource|HYDRATION_SOURCE/);
  assert.doesNotMatch(feed, /AppView source details/);
  assert.doesNotMatch(feed, /navigation\.navigate\('AppView'\)/);
});

test('Advanced → AppView is the one place that lists the hydration source', () => {
  assert.match(appViewScreen, /from '\.\.\/lib\/hydrationSource\.ts'/);
  assert.match(appViewScreen, /HYDRATION_SOURCE_COPY\.label/);
  assert.match(appViewScreen, /hydrationSourceText\(\)/);
  assert.match(appViewScreen, /Home timeline no longer/);
  assert.match(appViewScreen, /No picker, mirror, failover or per-function routing/);
  assert.match(health, /shown only on this screen/);
  assert.match(health, /not a switch or a live check/);
});

test('the release and public copy describe the settings-only facts', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  const changelog = read('../CHANGELOG.md');
  const compliance = read('../docs/bluesky-compliance.md');
  const features = read('../site/features.html');
  assert.equal(pkg.version, '0.61.0');
  assert.equal(appJson.expo.version, '0.61.0');
  assert.match(changelog, /^## 0\.61\.0$/m);
  assert.match(changelog, /#99, partial/);
  assert.match(compliance, /Home feed no longer repeats/);
  assert.match(features, /Home feed no longer repeats/);
  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 112);
});
