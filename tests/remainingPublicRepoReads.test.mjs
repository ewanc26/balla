import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('teal.fm plays are read through the bounded public JSON helper', () => {
  const source = read('../src/lib/teal.ts');
  assert.match(source, /import \{ fetchPublicJsonObject \} from '\.\/publicJsonRead\.ts'/);
  assert.match(source, /fetchPublicJsonObject\(/);
  assert.doesNotMatch(source, /await fetch\(/, 'no raw unbounded fetch remains');
  assert.match(source, /status === 400 \|\| status === 404/, 'a missing collection still ends the walk');
  assert.match(source, /if \(!result\) break/, 'a timeout fails closed to no plays');
  assert.match(source, /new Error\('teal\.fm read failed\.'\)/, 'teal keeps its fixed non-retryable error');
  assert.doesNotMatch(source, /\.message\b/, 'provider prose is never read');
});

test('reaction chips are read through the bounded public JSON helper', () => {
  const source = read('../src/lib/reactions.ts');
  assert.match(source, /import \{ fetchPublicJsonObject \} from '\.\/publicJsonRead\.ts'/);
  assert.match(source, /fetchPublicJsonObject\(/);
  assert.doesNotMatch(source, /await fetch\(/, 'no raw unbounded fetch remains');
  assert.match(source, /if \(!body\) return \{ records: \[\], missing: true \}/, 'a timeout fails closed');
  assert.match(source, /const status = \(err as \{ status\?: number \}\)\.status/, 'HTTP status still classifies');
  assert.doesNotMatch(source, /\.message\b/, 'provider prose is never read');
});

test('no public PDS JSON object reader makes a raw unbounded fetch', () => {
  const files = [
    'events.ts',
    'memories.ts',
    'identityProfile.ts',
    'identityDocumentRead.ts',
    'reactions.ts',
    'teal.ts',
  ];
  for (const file of files) {
    const source = read(`../src/lib/${file}`);
    assert.match(source, /fetchPublicJsonObject\(/, `${file} uses the shared reader`);
    assert.doesNotMatch(source, /await fetch\(/, `${file} has no raw fetch`);
  }

  const helper = read('../src/lib/publicJsonRead.ts');
  assert.match(helper, /readBoundedPublic<unknown>\(url/);
  assert.doesNotMatch(helper, /await fetch\(/);
  const core = read('../src/lib/boundedPublicFetch.ts');
  assert.match(core, /withDeadline\(async \(signal\)/);
  assert.match(core, /signal,/);
});

test('v0.95.0 records the correction and the completed reader coverage', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.97.1');
  assert.equal(appJson.expo.version, '0.97.1');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.97\.1<\/string>/);
  }

  const changelog = read('../CHANGELOG.md');
  const section = changelog.slice(
    changelog.indexOf('## 0.95.0'),
    changelog.indexOf('## 0.91.0'),
  );
  assert.match(section, /last raw public PDS JSON reads are now bounded/);
  assert.match(section, /Correction:/);
  assert.match(section, /too broad/);
  assert.match(section, /#96\/#97\/#100, partial/);

  const docs = read('../docs/bluesky-compliance.md');
  assert.match(docs, /reaction chips, teal\.fm play strips/);
  const site = read('../site/features.html');
  assert.match(site, /reaction chips, teal\.fm play strips/);

  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 112);
});
