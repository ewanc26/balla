import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { WEB_LINKING_CONFIG } from '../src/lib/webLinking.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const app = read('../App.tsx');
const advanced = read('../src/screens/AdvancedScreen.tsx');
const screen = read('../src/screens/AppViewScreen.tsx');
const model = read('../src/lib/appViewHealth.ts');
const compliance = read('../docs/bluesky-compliance.md');
const changelog = read('../CHANGELOG.md');
const siteIndex = read('../site/index.html');
const siteFeatures = read('../site/features.html');

test('Advanced exposes one registered AppView screen with a stable web path', () => {
  assert.match(app, /import \{ AppViewScreen \} from '\.\/src\/screens\/AppViewScreen';/);
  assert.match(app, /<Stack\.Screen name="AppView" component=\{AppViewScreen\} \/>/);
  assert.equal(WEB_LINKING_CONFIG.screens.AppView, 'settings/advanced/appview');
  assert.match(advanced, /label="AppView"/);
  assert.match(advanced, /navigation\.navigate\('AppView'\)/);
  assert.ok(!/onPress=\{\(\) => \{\}\}/.test(advanced));
});

test('the AppView screen offers a real public check, not a provider picker', () => {
  assert.match(screen, /Check AppView health/);
  assert.match(screen, /probeAppViewHealth\(\{ actorDid: getActiveDid\(\) \}\)/);
  assert.match(screen, /appViewHealthText\(probe\)/);
  assert.match(screen, /APPVIEW_HEALTH_COPY\.limits/);
  assert.match(screen, /no picker, mirror, failover/i);
  assert.doesNotMatch(screen, /SettingSwitch|SettingChoice/);
  assert.doesNotMatch(screen, /onPress=\{\(\) => \{\}\}/);
});

test('the probe uses public reads, structured fields and status-only failures', () => {
  assert.match(model, /didWebDocumentUrl/);
  assert.match(model, /advertisedEndpoint\([^\n]*#bsky_appview/);
  assert.match(model, /app\.bsky\.actor\.getProfile/);
  assert.match(model, /serviceStatusDetail/);
  assert.match(model, /APPVIEW_HEALTH_DID = DEFAULT_SERVICES\.appviewDid/);
  assert.match(model, /APPVIEW_HEALTH_AUDIENCE = DEFAULT_SERVICES\.appviewAudience/);
  assert.doesNotMatch(model, /\.message\b|console\.|AsyncStorage|authorization|Authorization/);
});

test('no OAuth scope, dependency or message-text path was added', () => {
  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 112);
  const pkg = JSON.parse(read('../package.json'));
  assert.deepEqual(Object.keys(pkg.devDependencies).sort(), ['@types/react', 'typescript']);
  for (const source of [model, screen]) {
    assert.doesNotMatch(source, /messageText|\.message\b|console\.log/);
  }
});

test('release notes and the compliance matrix describe the partial slice', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.94.0');
  assert.equal(appJson.expo.version, '0.94.0');
  const plistPath = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plistPath)) {
    assert.match(readFileSync(plistPath, 'utf8'), /<string>0\.94\.0<\/string>/);
  }
  assert.match(changelog, /^## 0\.72\.0$/m);
  assert.match(changelog, /#99, partial/);
  assert.match(changelog, /no failover/i);
  assert.match(changelog, /sync lag/i);
  assert.match(changelog, /scope count remains 111/);
  assert.match(compliance, /AppView health/);
  assert.match(compliance, /no failover/i);
});

test('the public site does not list shipped starter packs as planned', () => {
  assert.doesNotMatch(siteIndex, /Starter pack discovery/);
  assert.match(siteIndex, /Starter packs/);
  assert.match(siteIndex, /AppView health and hydration source/);
  assert.match(siteFeatures, /AppView health check/);
  assert.match(siteFeatures, /does not measure sync lag/);
  assert.match(siteFeatures, /Network backend seam/);
});
