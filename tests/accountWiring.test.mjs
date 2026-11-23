import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEB_LINKING_CONFIG } from '../src/lib/webLinking.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const compact = (source) => source.replace(/\s+/g, ' ');
const app = read('../App.tsx');
const settings = read('../src/screens/SettingsScreen.tsx');
const accounts = read('../src/screens/AccountsScreen.tsx');
const addAccount = read('../src/screens/AddAccountScreen.tsx');
const agentModule = read('../src/lib/agent.ts');

test('account screens are registered with stable web paths', () => {
  for (const [name, path] of [
    ['Accounts', 'settings/accounts'],
    ['AddAccount', 'settings/accounts/add'],
  ]) {
    assert.match(app, new RegExp(`<Stack\\.Screen name="${name}"`));
    assert.equal(WEB_LINKING_CONFIG.screens[name], path);
  }
});

test('Settings offers a quick account list', () => {
  assert.match(settings, /navigation\.navigate\('Accounts'\)/);
  assert.match(settings, /label="Accounts"/);
});

test('switching rebuilds the authenticated tree from the active DID', () => {
  assert.match(app, /setOnAccountChanged\(/);
  assert.match(app, /key=\{activeDid \?\? 'none'\}/);
  assert.match(app, /setActiveDid\(did\)/);
  assert.match(agentModule, /accountChangedCb\?\.\(did\)/);
  assert.match(agentModule, /new Agent\(next\)/);
  assert.match(agentModule, /configureProxy\(/);
});

test('the account registry stores only non-secret DID and handle metadata', () => {
  assert.match(agentModule, /ACCOUNTS_KEY/);
  assert.match(agentModule, /getAccounts\(\)/);
  assert.match(agentModule, /rememberAccount\(/);
  assert.match(agentModule, /removeAccountEntry\(/);
  assert.match(agentModule, /nextActiveDid\(/);
  assert.match(agentModule, /oauthClient\.restore\(did, false\)/);
  assert.doesNotMatch(agentModule, /AsyncStorage\.setItem\([^)]*token/i);
  assert.doesNotMatch(compact(addAccount), /new Agent\(/);
});

test('removal revokes the grant and a stale session cannot be carried forward', () => {
  assert.match(agentModule, /current\.signOut\(\)/);
  assert.match(agentModule, /oauthClient\.revoke\(did\)/);
  assert.match(agentModule, /const removing = new Set<string>\(\)/);
  assert.match(agentModule, /onSessionDeleted:/);
  assert.match(agentModule, /session = null;\s*agent = createAgent\(DEFAULT_SERVICE\);/);
});

test('sign-out clears every account and asks each server to revoke', () => {
  assert.match(agentModule, /export async function logout/);
  assert.match(agentModule, /AsyncStorage\.removeItem\(ACCOUNTS_KEY\)/);
  assert.match(agentModule, /for \(const did of dids\)/);
});

test('account controls are labelled, visible and honest about previews', () => {
  for (const label of ['Switch to ${label}', 'Remove ${label}']) {
    assert.ok(accounts.includes(`accessibilityLabel={\`${label}\`}`), `${label} is labelled`);
  }
  assert.ok(accounts.includes('accessibilityLabel="Add account"'));
  assert.match(accounts, /touchTargetStyle/);
  assert.match(accounts, /MOCK_MODE/);
  assert.match(accounts, /Preview accounts only/);
  assert.match(accounts, /nothing from the previous account carries over/i);
  assert.match(addAccount, /<LoginScreen/);
});
