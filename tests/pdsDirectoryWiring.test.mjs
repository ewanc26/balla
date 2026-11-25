import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEB_LINKING_CONFIG } from '../src/lib/webLinking.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../App.tsx');
const hosting = read('../src/screens/HostingScreen.tsx');
const screen = read('../src/screens/PdsDirectoryScreen.tsx');
const loader = read('../src/lib/pdsDirectory.ts');
const model = read('../src/lib/pdsDirectoryModel.ts');
const addAccount = read('../src/screens/AddAccountScreen.tsx');
const login = read('../src/screens/LoginScreen.tsx');

test('Hosting exposes a registered directory screen with a stable web path', () => {
  assert.match(app, /<Stack\.Screen name="PdsDirectory" component=\{PdsDirectoryScreen\} \/>/);
  assert.equal(WEB_LINKING_CONFIG.screens.PdsDirectory, 'settings/advanced/pds-directory');
  assert.match(hosting, /navigation\.navigate\('PdsDirectory'\)/);
  assert.match(hosting, /label="Browse PDS hosts"/);
  assert.match(hosting, /openExternalUrl\(OPEN_PDS_DIRECTORY\)/);
  assert.doesNotMatch(hosting, /onPress=\{\(\) => \{\}\}/);
});

test('the directory reads the public index and checks a chosen host for real', () => {
  assert.match(model, /PDS_DIRECTORY_API = 'https:\/\/openpds\.tijs\.org\/api\/servers'/);
  assert.match(model, /value\.is_open !== true/);
  assert.match(loader, /readBoundedPublic<unknown>\(PDS_DIRECTORY_API,/);
  assert.doesNotMatch(loader, /await fetch\(/);
  assert.match(loader, /normalisePdsDirectory\(outcome\.value\)/);
  assert.match(screen, /loadPdsDirectory\(fetch, fresh\)/);
  assert.match(screen, /probeHost\(chosen\.url\)/);
  assert.match(screen, /Check host compatibility/);
  assert.match(screen, /Refresh list/);
  assert.match(screen, /Filter by host, country, DID or software/);
  assert.doesNotMatch(loader, /\.message\b/);
  assert.doesNotMatch(model, /\.message\b/);
  assert.doesNotMatch(screen, /\.message\b/);
});

test('listed and custom hosts are handed to the existing OAuth sign-in as service URLs', () => {
  assert.match(screen, /navigation\.navigate\('AddAccount', \{ identifier: chosen\.url \}\)/);
  assert.match(screen, /Sign in with this host/);
  assert.match(screen, /normaliseHostUrl\(customHost\)/);
  assert.match(screen, /navigation\.navigate\('AddAccount', \{ identifier: customUrl \}\)/);
  assert.match(screen, /Sign in with custom host/);
  assert.match(screen, /Check custom host/);
  assert.match(screen, /Custom PDS host/);
  assert.match(addAccount, /route\?\.params\?\.identifier/);
  assert.match(addAccount, /initialIdentifier=\{initialIdentifier\}/);
  assert.match(login, /initialIdentifier = ''/);
  assert.match(login, /useState\(\(\) => normaliseIdentifier\(initialIdentifier\)\)/);
});

test('no inert control or invented health claim is present', () => {
  assert.match(screen, /not a health check or a sign-up promise/);
  assert.match(screen, /the approval page belongs to your server/);
  assert.match(screen, /No new scope or permission is requested here/);
  assert.doesNotMatch(screen, /onPress=\{\(\) => \{\}\}/);
  assert.doesNotMatch(screen, /health score|verified host|guaranteed/i);
});

test('release notes describe the real directory and its limits', () => {
  const changelog = read('../CHANGELOG.md');
  assert.match(changelog, /## 0\.33\.0/);
  assert.match(changelog, /OpenPDS/);
  assert.match(changelog, /describeServer/);
  assert.match(changelog, /scope count remains 111/);
});
