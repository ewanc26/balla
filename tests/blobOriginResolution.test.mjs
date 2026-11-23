import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const blobOrigin = read('../src/lib/blobOrigin.ts');
const resolver = read('../src/lib/identityResolver.ts');
const changelog = read('../CHANGELOG.md');
const compliance = read('../docs/bluesky-compliance.md');
const features = read('../site/features.html');

test('the media fallback resolves DIDs through the strategy-aware resolver', () => {
  // Blob URLs must come from the author's PDS, so the DID document is read
  // first. That read must honour the configured directory like every other
  // public identity read, not an implicit Bluesky host.
  assert.match(blobOrigin, /resolveDidDocument\(fallback\.did\)/);
  assert.doesNotMatch(blobOrigin, /agent\.com\.atproto\.identity\.resolveDid/);
  assert.doesNotMatch(blobOrigin, /from '\.\/agent'/);
  assert.match(blobOrigin, /from '\.\/identityResolver'/);
  // The PDS endpoint still comes from the DID document's service entry.
  assert.match(blobOrigin, /atprotoPdsEndpoint\(document\)/);
});

test('the shared resolver reads the configured directory before falling back', () => {
  assert.match(resolver, /getPlcDirectoryEndpoint\(\)/);
  assert.match(resolver, /plcDirectoryUrl\(did, await getPlcDirectoryEndpoint\(\)\)/);
  assert.match(resolver, /isDid\(did\)/);
  // No scope or credential: these are public, unauthenticated reads.
  assert.doesNotMatch(resolver, /authorization/i);
});

test('release notes and public docs describe the media-path change honestly', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.60.4');
  assert.equal(appJson.expo.version, '0.60.4');
  const plistPath = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plistPath)) {
    assert.match(readFileSync(plistPath, 'utf8'), /<string>0\.60\.4<\/string>/);
  }
  assert.match(changelog, /^## 0\.60\.4$/m);
  assert.match(changelog, /#97, partial/);
  assert.match(changelog, /scope count remains 111/);
  assert.match(compliance, /Media fallback/);
  assert.match(features, /media fallback/i);
});
