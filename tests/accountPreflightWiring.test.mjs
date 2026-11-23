import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { WEB_LINKING_CONFIG } from '../src/lib/webLinking.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const app = read('../App.tsx');
const advanced = read('../src/screens/AdvancedScreen.tsx');
const screen = read('../src/screens/AccountPreflightScreen.tsx');
const model = read('../src/lib/accountPreflight.ts');
const changelog = read('../CHANGELOG.md');
const compliance = read('../docs/bluesky-compliance.md');
const siteFeatures = read('../site/features.html');

test('Advanced exposes one registered account pre-flight screen with a stable web path', () => {
  assert.match(app, /import \{ AccountPreflightScreen \} from '\.\/src\/screens\/AccountPreflightScreen';/);
  assert.match(app, /<Stack\.Screen name="AccountPreflight" component=\{AccountPreflightScreen\} \/>/);
  assert.equal(WEB_LINKING_CONFIG.screens.AccountPreflight, 'settings/advanced/account-preflight');
  assert.match(advanced, /label="Account pre-flight"/);
  assert.match(advanced, /navigation\.navigate\('AccountPreflight'\)/);
  assert.ok(!/onPress=\{\(\) => \{\}\}/.test(advanced));
});

test('the screen runs the real public check with the saved resolver and no inert control', () => {
  assert.match(screen, /Check account/);
  assert.match(screen, /probeAccount\(input, \{/);
  assert.match(screen, /resolver: await getHandleResolverEndpoint\(\)/);
  assert.match(screen, /plcDirectory: await getPlcDirectoryEndpoint\(\)/);
  assert.match(model, /documentUrl\(identity\.did, plcDirectory\)/);
  assert.match(screen, /ACCOUNT_PREFLIGHT_COPY\.limits/);
  assert.match(model, /No usable OAuth metadata/);
  assert.doesNotMatch(screen, /SettingSwitch|SettingChoice|secureTextEntry|onPress=\{\(\) => \{\}\}/);
});

test('the screen shows the published OAuth capability count and any missing labels', () => {
  assert.match(screen, /OAUTH_CAPABILITY_LABELS/);
  assert.match(screen, /result\.oauthCapabilities\.supported\.length/);
  assert.match(screen, /result\.oauthCapabilities\.missing/);
  assert.match(screen, /advertised/);
  assert.match(model, /export const OAUTH_CAPABILITY_LABELS/);
  assert.match(model, /classifyOAuthCapabilities\(metadata\)/);
  assert.match(model, /oauth-incompatible/);
  assert.match(model, /authorization_response_iss_parameter_supported === true/);
  assert.match(model, /pushed_authorization_request_endpoint/);
  assert.match(model, /dpop_signing_alg_values_supported\)\.includes\('ES256'\)/);
  assert.doesNotMatch(model, /require_pushed_authorization_requests === true/);
});

test('the pre-flight uses public identity, PDS and OAuth reads only', () => {
  assert.match(model, /wellKnownUrl\(/);
  assert.match(model, /com\.atproto\.identity\.resolveHandle/);
  assert.match(model, /plcDocumentUrl\(/);
  assert.match(model, /atprotoPdsEndpoint\(/);
  assert.match(model, /com\.atproto\.server\.describeServer/);
  assert.match(model, /\.well-known\/oauth-protected-resource/);
  assert.match(model, /\.well-known\/oauth-authorization-server/);
  assert.match(model, /serverFacts\(/);
  assert.doesNotMatch(model, /\.message\b|console\.|AsyncStorage|Authorization:/);
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

test('release notes and the compliance matrix describe the partial check', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.60.0');
  assert.equal(appJson.expo.version, '0.60.0');
  const plistPath = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plistPath)) {
    assert.match(readFileSync(plistPath, 'utf8'), /<string>0\.60\.0<\/string>/);
  }
  assert.match(changelog, /^## 0\.60\.0$/m);
  assert.match(changelog, /#100, partial/);
  assert.match(changelog, /not a login/i);
  assert.match(changelog, /scope count remains 111/);
  assert.match(compliance, /Account pre-flight/);
  assert.match(compliance, /no end-to-end login/i);
});

test('the public site describes the pre-flight without claiming sign-in was verified', () => {
  assert.match(siteFeatures, /Account pre-flight/);
  assert.match(siteFeatures, /does not sign in/);
});
