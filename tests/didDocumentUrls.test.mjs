import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  APPVIEW_DID_DOCUMENT_URL,
  CHAT_DID_DOCUMENT_URL,
  SERVICE_HOSTS,
  didWebDocumentUrl,
} from '../src/lib/serviceHosts.ts';
import { didWebDocumentUrl as identityDocumentUrl } from '../src/lib/identityModel.ts';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const sourceFiles = (dir) =>
  readdirSync(join(root.pathname, dir), { recursive: true })
    .map((entry) => `${dir}/${String(entry).replaceAll('\\', '/')}`)
    .filter((entry) => /\.(ts|tsx)$/.test(entry));

test('one builder maps did:web identifiers to document URLs', () => {
  assert.equal(didWebDocumentUrl('did:web:example.com'), 'https://example.com/.well-known/did.json');
  assert.equal(didWebDocumentUrl('did:web:example.com:user'), 'https://example.com/user/did.json');
  assert.equal(didWebDocumentUrl('did:web:api.eurosky.network'), 'https://api.eurosky.network/.well-known/did.json');
  for (const bad of ['did:plc:abc123', 'did:web:', 'did:web:bad host', '', null, undefined, 7]) {
    assert.equal(didWebDocumentUrl(bad), null);
  }
  assert.equal(identityDocumentUrl, didWebDocumentUrl, 'identity callers re-export the one builder');
});

test('published DID document URLs derive from the same host facts', () => {
  assert.equal(APPVIEW_DID_DOCUMENT_URL, `https://api.eurosky.network/.well-known/did.json`);
  assert.equal(CHAT_DID_DOCUMENT_URL, `https://api.bsky.chat/.well-known/did.json`);
  assert.equal(APPVIEW_DID_DOCUMENT_URL, didWebDocumentUrl(SERVICE_HOSTS.appviewDid));
  assert.equal(CHAT_DID_DOCUMENT_URL, didWebDocumentUrl(SERVICE_HOSTS.chatDid));
});

test('only the host module writes the document path literal', () => {
  for (const file of sourceFiles('src').filter((file) => file !== 'src/lib/serviceHosts.ts')) {
    assert.doesNotMatch(
      read(file),
      /\.well-known\/did\.json/,
      `${file} must use the shared builder`
    );
  }
  for (const file of [
    'src/lib/appViewHealth.ts',
    'src/lib/accountPreflight.ts',
    'src/lib/servicesProbe.ts',
    'src/lib/identityResolver.ts',
  ]) {
    assert.match(read(file), /didWebDocumentUrl/);
  }
});

test('release notes and versions match the consolidation slice', () => {
  const changelog = read('CHANGELOG.md');
  const compliance = read('docs/bluesky-compliance.md');
  const pkg = JSON.parse(read('package.json'));
  const appJson = JSON.parse(read('app.json'));
  assert.match(changelog, /^## 0\.72\.0$/m);
  assert.match(changelog, /one did:web document URL builder/);
  assert.match(changelog, /scope count stays 112/);
  assert.match(compliance, /one shared `did:web` document URL builder/);
  assert.equal(pkg.version, '0.97.2');
  assert.equal(appJson.expo.version, '0.97.2');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) assert.match(readFileSync(plist, 'utf8'), /<string>0\.97\.2<\/string>/);
});
