import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const resolver = read('../src/lib/identityResolver.ts');
const native = read('../src/lib/nativeHandleResolver.ts');
const identityScreen = read('../src/screens/IdentitySettingsScreen.tsx');
const changelog = read('../CHANGELOG.md');
const compliance = read('../docs/bluesky-compliance.md');
const features = read('../site/features.html');

test('the public handle fallback uses the native-first configured resolver', () => {
  assert.match(resolver, /createNativeFirstHandleResolver/);
  assert.match(resolver, /resolveHandleWithDeadline\(publicHandleResolver, handle\)/);
  assert.match(resolver, /boundedHandleResolution\.ts/);
  assert.match(resolver, /DEFAULT_SERVICES\.handleResolver/);
  // The implicit Bluesky XRPC call is gone: a configured resolver must apply on
  // this path too, especially when the AppView is unreachable.
  assert.doesNotMatch(resolver, /agent\.com\.atproto\.identity\.resolveHandle/);
  // A DID from the resolver is still validated before it is cached or returned.
  assert.match(resolver, /isDid\(did\)/);
});

test('the native-first resolver reads the persisted endpoint on every resolve', () => {
  assert.match(native, /getHandleResolverEndpoint\(service\)/);
  assert.match(native, /wellKnownUrl\(handle\)/);
  assert.match(native, /redirect: 'error'/);
  assert.match(native, /signal: options\?\.signal/);
  assert.match(native, /resolver\.resolve\(handle, options\)/);
  assert.doesNotMatch(native, /authorization/i);
});

test('the identity strategy copy no longer hardcodes a directory host', () => {
  assert.doesNotMatch(identityScreen, /Read plc\.directory/);
  assert.match(identityScreen, /configured public identity directory/);
});

test('release notes and public docs describe the change honestly', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.97.3');
  assert.equal(appJson.expo.version, '0.97.3');
  const plistPath = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plistPath)) {
    assert.match(readFileSync(plistPath, 'utf8'), /<string>0\.97\.3<\/string>/);
  }
  assert.match(changelog, /^## 0\.72\.0$/m);
  assert.match(changelog, /#97, partial/);
  assert.match(changelog, /scope count remains 111/);
  assert.match(compliance, /native-first resolver/);
  assert.match(features, /configured handle resolver/);
});
