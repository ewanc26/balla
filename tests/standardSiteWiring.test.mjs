import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { WEB_LINKING_CONFIG } from '../src/lib/webLinking.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../App.tsx');
const postCard = read('../src/components/PostCard.tsx');
const embedModel = read('../src/lib/embedModel.ts');
const screen = read('../src/screens/StandardSiteScreen.tsx');
const model = read('../src/lib/standardSiteModel.ts');
const loader = read('../src/lib/standardSite.ts');
const metadata = JSON.parse(read('../oauth-client-metadata.json'));

test('the reader is a registered screen with one stable web path', () => {
  assert.match(app, /import \{ StandardSiteScreen \} from '\.\/src\/screens\/StandardSiteScreen'/);
  assert.match(app, /<Stack\.Screen name="StandardSite" component=\{StandardSiteScreen\} \/>/);
  assert.equal(WEB_LINKING_CONFIG.screens.StandardSite, 'standard-site/:uri');
  assert.match(postCard, /navigation\.navigate\('StandardSite', \{ uri: site\.documentUri \}\)/);
  assert.match(screen, /route\.params\?\.uri/);
});

test('enhanced cards open the reader and plain link cards keep the browser fallback', () => {
  assert.match(embedModel, /standardSiteFromEmbed/);
  assert.match(embedModel, /\.\.\.\(standardSite \? \{ standardSite \} : \{\}\)/);
  assert.match(postCard, /const site = card\.standardSite/);
  assert.match(postCard, /site\s*\?\s*navigation\.navigate\(['"]StandardSite['"]/);
  assert.match(postCard, /:\s*void openExternalUrl\(card\.uri\)/);
  assert.match(postCard, /Read in Balla/);
  assert.match(postCard, /site\.publicationName/);
  assert.match(postCard, /site\.readingTime \? `\$\{site\.readingTime\} min read` : null/);
  assert.match(postCard, /site\.createdAt \? formatDate\(site\.createdAt\) : null/);
});

test('the reader is read-only, honest about limits and keeps user-controlled styling', () => {
  assert.match(screen, /loadStandardSiteDocument\(uri, \{/);
  assert.match(screen, /resolveDidDocument\(did\)/);
  assert.match(screen, /atprotoPdsEndpoint/);
  assert.match(screen, /getBlobUrl\(pds, documentDid, document\.coverCid\)/);
  assert.match(screen, /getBlobUrl\(publicationPds, publicationDid, publication\.iconCid\)/);
  assert.match(screen, /getBlobUrl\(blobEndpoint, blobDid, block\.cid\)/);
  assert.match(screen, /STANDARD_SITE_COPY\.theme/);
  assert.match(screen, /STANDARD_SITE_COPY\.readLimit/);
  assert.match(screen, /STANDARD_SITE_COPY\.verification\[verification\]/);
  assert.match(screen, /STANDARD_SITE_COPY\.notRendered/);
  assert.match(screen, /Open the original/);
  assert.match(screen, /touchTargetStyle/);
  assert.doesNotMatch(screen, /backgroundColor:\s*theme\./);
  assert.doesNotMatch(screen, /fontSize:\s*\d+[,}]/);
  assert.doesNotMatch(model, /onPress/);
  assert.doesNotMatch(screen, /onPress=\{\(\) => \{\}\}/);
});

test('no new permission, dependency, dependency override or provider message text', () => {
  const pkg = JSON.parse(read('../package.json'));
  assert.equal(pkg.version, '0.62.0');
  assert.equal(JSON.parse(read('../app.json')).expo.version, '0.62.0');
  // Native projects are generated locally and are not tracked in this repo.
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.62\.0<\/string>/);
  }
  assert.deepEqual(pkg.overrides, { minimatch: '11.0.9', zod: '4.6.6' });
  assert.equal(metadata.scope.split(' ').filter(Boolean).length, 112);
  assert.doesNotMatch(model, /\.message\b/);
  assert.doesNotMatch(loader, /\.message\b/);
  assert.doesNotMatch(screen, /\.message\b/);
  assert.doesNotMatch(postCard, /\.message\b/);
});

test('release notes describe the real read-only slice and its limits', () => {
  const changelog = read('../CHANGELOG.md');
  assert.match(changelog, /## 0\.34\.0/);
  assert.match(changelog, /Standard\.site/);
  assert.match(changelog, /associatedRefs/);
  assert.match(changelog, /author’s PDS|author.s PDS/);
  assert.match(changelog, /new permission|new scope/i);
  assert.match(changelog, /not rendered|write/i);
});
