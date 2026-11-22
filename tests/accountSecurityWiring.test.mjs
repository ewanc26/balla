import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEB_LINKING_CONFIG } from '../src/lib/webLinking.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const compact = (source) => source.replace(/\s+/g, ' ');
const app = read('../App.tsx');
const settings = read('../src/screens/SettingsScreen.tsx');
const account = read('../src/screens/AccountSettingsScreen.tsx');
const privacy = read('../src/screens/PrivacySecurityScreen.tsx');
const session = read('../src/screens/SessionSecurityScreen.tsx');
const agentModule = read('../src/lib/agent.ts');
const metadata = JSON.parse(read('../oauth-client-metadata.json'));

function rowBlock(source, label) {
  const start = source.indexOf(`label="${label}"`);
  assert.notEqual(start, -1, `${label} is present`);
  return source.slice(start, start + 900);
}

test('account, privacy and session screens are registered with stable web paths', () => {
  for (const [name, path] of [
    ['AccountSettings', 'settings/account'],
    ['PrivacySecurity', 'settings/privacy-security'],
    ['SessionSecurity', 'settings/session'],
  ]) {
    assert.match(app, new RegExp(`<Stack\\.Screen name="${name}"`));
    assert.equal(WEB_LINKING_CONFIG.screens[name], path);
  }
});

test('Settings opens the real editors instead of static security topics', () => {
  assert.match(settings, /navigation\.navigate\('AccountSettings'\)/);
  assert.match(settings, /navigation\.navigate\('PrivacySecurity'\)/);
  assert.match(settings, /navigation\.navigate\('SessionSecurity'\)/);
  assert.doesNotMatch(settings, /openInfo\('security'/);
  assert.doesNotMatch(settings, /openInfo\('session'/);
});

test('provider-owned account fields are external links, not fake controls', () => {
  for (const label of ['Email', 'Password', 'Change handle']) {
    const block = rowBlock(account, label);
    assert.match(block, /external/);
    assert.doesNotMatch(block, /SettingSwitch/);
  }
  assert.ok(compact(account).includes('agent .getPreferences()'));
  assert.ok(compact(account).includes('agent.setPersonalDetails('));
  assert.ok(compact(account).includes('useProfileSelfLabel(BOT_LABEL)'));
});

test('provider-owned privacy fields are external links, not fake switches', () => {
  for (const label of [
    'Two-factor authentication',
    'App passwords',
    'Activity privacy',
    'Algorithmic recommendations',
  ]) {
    const block = rowBlock(privacy, label);
    assert.match(block, /external/);
    assert.doesNotMatch(block, /SettingSwitch/);
  }
  assert.match(privacy, /useProfileSelfLabel\(LOGGED_OUT_PRIVACY_LABEL\)/);
  assert.match(privacy, /navigation\.navigate\('NotificationSettings'\)/);
});

test('session copy reads non-secret metadata and never renders token values', () => {
  assert.match(agentModule, /getTokenInfo\(false\)/);
  assert.match(session, /useSessionSummary\(\)/);
  for (const label of [
    'Account DID',
    'Authorization server',
    'Resource server (PDS)',
    'Access token expires',
    'OAuth grant',
  ]) {
    assert.ok(session.includes(`label="${label}"`), `${label} is shown`);
  }
  assert.doesNotMatch(session, /access_token|refresh_token|id_token/);
  assert.match(session, /<SignOutControl \/>/);
});

test('account and privacy settings do not widen the OAuth grant', () => {
  const tokens = metadata.scope.split(/\s+/).filter(Boolean);
  assert.equal(tokens.length, 61);
  assert.equal(
    tokens.some((token) => /com\.atproto\.server\.(requestEmailUpdate|updateEmail|createAppPassword|listAppPasswords|revokeAppPassword|deleteAccount|deactivateAccount)/.test(token)),
    false
  );
  assert.equal(tokens.some((token) => /chat\.bsky/.test(token)), false);
});
