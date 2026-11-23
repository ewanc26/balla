import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEB_LINKING_CONFIG } from '../src/lib/webLinking.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../App.tsx');
const advanced = read('../src/screens/AdvancedScreen.tsx');
const agent = read('../src/lib/agent.ts');
const resolver = read('../src/lib/nativeHandleResolver.ts');
const probe = read('../src/lib/hostingProbe.ts');
const screen = read('../src/screens/HostingScreen.tsx');

test('Advanced exposes a registered Hosting screen with a stable web path', () => {
  assert.match(app, /<Stack\.Screen name="Hosting" component=\{HostingScreen\} \/>/);
  assert.equal(WEB_LINKING_CONFIG.screens.Hosting, 'settings/advanced/hosting');
  assert.match(advanced, /navigation\.navigate\('Hosting'\)/);
  assert.match(advanced, /label="Hosting"/);
  assert.ok(!/onPress=\{\(\) => \{\}\}/.test(advanced));
});

test('the OAuth client resolves handles from the host first, with an XRPC fallback', () => {
  assert.match(agent, /createNativeFirstHandleResolver\(DEFAULT_SERVICE\)/);
  assert.match(resolver, /new XrpcHandleResolver\(service\)/);
  assert.match(resolver, /wellKnownUrl\(handle\)/);
  assert.match(resolver, /redirect: 'error'/);
  assert.match(resolver, /isResolvedHandle\(did\)/);
  // isResolvedHandle(null) is true in the SDK: a host serving HTML must fall
  // back rather than report a successful "not found" resolution.
  assert.match(resolver, /did !== null && isResolvedHandle\(did\)/);
  assert.match(resolver, /options\?\.signal\?\.aborted\) throw err/);
  assert.match(resolver, /return this\.fallback\.resolve\(handle, options\)/);
  // No new dependency or scope: the resolver ships with the OAuth client.
  assert.match(resolver, /from '@atproto\/oauth-client-expo'/);
});

test('the host probe is read-only and classifies status and structured fields', () => {
  assert.match(probe, /com\.atproto\.server\.describeServer/);
  assert.match(probe, /response\.ok/);
  assert.match(probe, /serverFacts\(payload\)/);
  assert.match(probe, /response\.status >= 500 \? 'unreachable' : 'not-atproto'/);
  assert.doesNotMatch(probe, /\.message\b/);
  assert.doesNotMatch(probe, /response\.text\(\)/);
  assert.doesNotMatch(probe, /AsyncStorage/);
  assert.doesNotMatch(probe, /agent\./);
});

test('the Hosting screen reads real session facts and never shows token values', () => {
  assert.match(screen, /useSessionSummary\(\)/);
  assert.match(screen, /summary\?\.resourceServer/);
  assert.match(screen, /summary\?\.authorizationServer/);
  assert.match(screen, /summary\.scopeCount/);
  assert.match(screen, /getActiveDid\(\)/);
  assert.match(screen, /getAccounts\(\)/);
  assert.match(screen, /probeHost\(input\)/);
  assert.match(screen, /SettingButton label="Check host"/);
  assert.match(screen, /openExternalUrl\(OPEN_PDS_DIRECTORY\)/);
  assert.match(screen, /AppView, chat and\s+video service audiences are part of the OAuth grant/);
  assert.ok(!/onPress=\{\(\) => \{\}\}/.test(screen));
});

test('release notes describe native resolution and the read-only host check', () => {
  const changelog = read('../CHANGELOG.md');
  assert.match(changelog, /## 0\.31\.0/);
  assert.match(changelog, /well-known/);
  assert.match(changelog, /com\.atproto\.server\.describeServer/);
  assert.match(changelog, /scope count remains 111/);
});
