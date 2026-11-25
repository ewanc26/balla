import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEB_LINKING_CONFIG } from '../src/lib/webLinking.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../App.tsx');
const advanced = read('../src/screens/AdvancedScreen.tsx');
const agent = read('../src/lib/agent.ts');
const screen = read('../src/screens/ServicesScreen.tsx');
const config = read('../src/lib/servicesConfig.ts');
const probe = read('../src/lib/servicesProbe.ts');
const model = read('../src/lib/servicesModel.ts');
const hosts = read('../src/lib/serviceHosts.ts');

test('Advanced exposes a registered Services screen with a stable web path', () => {
  assert.match(app, /<Stack\.Screen name="Services" component={ServicesScreen} \/>/);
  assert.equal(WEB_LINKING_CONFIG.screens.Services, 'settings/advanced/services');
  assert.match(advanced, /navigation\.navigate\('Services'\)/);
  assert.match(advanced, /label="Services"/);
  assert.ok(!/onPress=\{\(\) => \{\}\}/.test(advanced));
});

test('the default hosts live in one services config module', () => {
  assert.match(hosts, /handleResolver: 'https:\/\/bsky\.social'/);
  assert.match(model, /handleResolver: SERVICE_HOSTS\.handleResolver/);
  assert.match(agent, /DEFAULT_SERVICE = DEFAULT_SERVICES\.handleResolver/);
  assert.match(agent, /APPVIEW_PROXY = DEFAULT_SERVICES\.appviewAudience/);
  assert.match(agent, /configureProxy\(/);
  assert.match(agent, /createNativeFirstHandleResolver\(DEFAULT_SERVICE\)/);
});

test('the resolver override is persisted, reversible and takes effect without restart', () => {
  assert.match(config, /AsyncStorage\.setItem\(SERVICES_STORAGE_KEY/);
  assert.match(config, /getHandleResolverEndpoint/);
  assert.match(config, /setHandleResolverEndpoint/);
  assert.match(config, /resetServicesConfig/);
  assert.match(config, /subscribeServicesConfig/);
  assert.match(screen, /setHandleResolverEndpoint\(valid\)/);
  assert.match(screen, /resetServicesConfig\(\)/);
  assert.match(screen, /Use default/);
  assert.match(screen, /takes effect on the next sign-in/);
});

test('connection checks are real public reads with no token or message text', () => {
  assert.match(probe, /com\.atproto\.identity\.resolveHandle/);
  assert.match(probe, /app\.bsky\.actor\.getProfile/);
  assert.match(probe, /\.well-known\/did\.json/);
  assert.match(probe, /advertisedEndpoint\(/);
  assert.match(probe, /response\.ok/);
  assert.doesNotMatch(probe, /\.message\b/);
  assert.doesNotMatch(probe, /AsyncStorage/);
  assert.doesNotMatch(probe, /authorization/);
  assert.match(screen, /Test resolver/);
  assert.match(screen, /Test AppView/);
  assert.match(screen, /Test chat service/);
});

test('grant-bound services are shown as facts, never as inert switches', () => {
  assert.match(screen, /Grant-bound services/);
  assert.match(screen, /DEFAULT_SERVICES\.appviewAudience/);
  assert.match(screen, /DEFAULT_SERVICES\.chatAudience/);
  assert.match(screen, /DEFAULT_SERVICES\.videoAudience/);
  assert.match(screen, /DEFAULT_SERVICES\.labelerAudience/);
  assert.match(screen, /DID document/);
  assert.equal((screen.match(/<SettingSwitch\b/g) || []).length, 1);
  assert.match(screen, /label="Places search"/);
  assert.doesNotMatch(screen, /onPress=\{\(\) => \{\}\}/);
});

test('release notes describe the changeable endpoint and the grant-bound ones', () => {
  const changelog = read('../CHANGELOG.md');
  assert.match(changelog, /## 0\.32\.0/);
  assert.match(changelog, /persisted choice: edit the host/);
  assert.match(changelog, /next sign-in without a restart/);
  assert.match(changelog, /Grant-bound/);
  assert.match(changelog, /scope count remains 111/);
});
