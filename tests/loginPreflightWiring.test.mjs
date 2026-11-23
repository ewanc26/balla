import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const login = read('../src/screens/LoginScreen.tsx');
const preflight = read('../src/lib/accountPreflight.ts');
const settings = read('../src/screens/AccountPreflightScreen.tsx');
const model = read('../src/lib/servicesConfig.ts');
const changelog = read('../CHANGELOG.md');
const compliance = read('../docs/bluesky-compliance.md');
const features = read('../site/features.html');

test('the login screen offers a real, read-only pre-sign-in check', () => {
  assert.match(login, /probeAccount\(input, \{/);
  assert.match(login, /resolver: await getHandleResolverEndpoint\(\)/);
  assert.match(login, /accessibilityLabel="Check this account"/);
  assert.match(login, /Check before you sign in/);
  assert.match(login, /ACCOUNT_PREFLIGHT_STATE_LABELS\[checkResult\.state\]/);
  assert.match(login, /Identity source:/);
  assert.match(login, /Authorization server:/);
  assert.match(login, /ACCOUNT_PREFLIGHT_COPY\.limits/);
  assert.doesNotMatch(login, /onPress=\{\(\) => \{\}\}/);
  assert.match(model, /getHandleResolverEndpoint/);
  assert.doesNotMatch(login, /login\(result|appPassword|secureTextEntry/i);
});

test('both pre-flight surfaces share the same result labels', () => {
  assert.match(preflight, /export const ACCOUNT_PREFLIGHT_STATE_LABELS/);
  assert.match(settings, /ACCOUNT_PREFLIGHT_STATE_LABELS\[result\.state\]/);
  assert.doesNotMatch(settings, /const STATE_LABELS/);
});

test('the login check shows the advertised capability count without a fake control', () => {
  assert.match(login, /OAUTH_CAPABILITY_LABELS/);
  assert.match(login, /checkResult\.oauthCapabilities\.supported\.length/);
  assert.match(login, /advertised/);
  assert.match(login, /oauthCapabilities: null/);
  assert.match(changelog, /OAuth capabilities/);
  assert.match(compliance, /advertised OAuth capabilities/);
  assert.match(features, /published OAuth capabilities/);
});

test('the release documents the login check as partial #100', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.54.0');
  assert.equal(appJson.expo.version, '0.54.0');
  assert.match(changelog, /^## 0\.53\.0$/m);
  assert.match(changelog, /#100, partial/);
  assert.match(changelog, /login screen/);
  assert.match(changelog, /scope count remains 111/);
  assert.match(compliance, /pre-login check on the login screen/);
  assert.match(features, /Pre-login check/);
  assert.match(features, /issues\/100/);
  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 111);
});
