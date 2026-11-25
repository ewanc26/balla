import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const screen = read('../src/screens/StandardSiteScreen.tsx');
const model = read('../src/lib/standardSiteSocialModel.ts');
const loader = read('../src/lib/standardSiteSocial.ts');
const changelog = read('../CHANGELOG.md');
const compliance = read('../docs/bluesky-compliance.md');
const metadata = JSON.parse(read('../oauth-client-metadata.json'));

test('the article reader exposes one real social-signal check', () => {
  assert.match(screen, /loadStandardSiteSocialSignals\(result\.document\.uri, result\.publication\?\.uri \?\? null/);
  assert.match(screen, /agent\.app\.bsky\.graph\.getFollows\(\{ actor, limit: 100 \}\)/);
  assert.match(screen, /atprotoPdsEndpoint\(await resolveDidDocument\(did\)\)/);
  assert.match(screen, /accessibilityLabel=\{SOCIAL_SIGNAL_COPY\.action\}/);
  assert.match(screen, /socialSignalCounts\(social\)/);
  assert.match(screen, /social\.unreadableFollows/);
  assert.match(screen, /social\.limited/);
  assert.match(screen, /social\.firstPageOnly/);
  assert.ok(!/onPress=\{\(\) => \{\}\}/.test(screen));
});

test('the social check performs no graph writes or private reads', () => {
  assert.doesNotMatch(screen, /createRecord/);
  assert.doesNotMatch(screen, /deleteRecord/);
  assert.doesNotMatch(screen, /follow\(|unfollow\(/);
  assert.doesNotMatch(screen, /site\.standard\.graph\.(subscription|recommend).*write/);
  assert.doesNotMatch(loader, /console\.|messageText|\.message\b/);
  assert.match(loader, /unauthenticated `com\.atproto\.repo\.listRecords`/);
  assert.match(model, /matches exact AT-URIs from published fields/);
  assert.match(model, /never writes a record or reads a private message/);
});

test('the social check stays within the read-only lexicon set', () => {
  assert.match(model, /'site\.standard\.graph\.subscription'/);
  assert.match(model, /'pub\.leaflet\.graph\.subscription'/);
  assert.match(model, /'site\.standard\.graph\.recommend'/);
  assert.match(model, /'pub\.leaflet\.interactions\.recommend'/);
  assert.doesNotMatch(model, /putRecord|createRecord|deleteRecord/);
});

test('no new scope or dependency is introduced', () => {
  const scopes = metadata.scope.split(/\s+/).filter(Boolean);
  assert.equal(scopes.length, 112);
  assert.equal(
    scopes.some((scope) => /site\.standard|pub\.leaflet/i.test(scope)),
    false
  );
  const pkg = JSON.parse(read('../package.json'));
  assert.ok(!Object.keys(pkg.dependencies || {}).some((name) => /standard|leaflet|markdown/i.test(name)));
});

test('release notes describe the honest boundary', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.69.0');
  assert.equal(appJson.expo.version, '0.69.0');
  assert.match(changelog, /## 0\.38\.0/);
  assert.match(changelog, /social signals/);
  assert.match(changelog, /no graph writes/);
  assert.match(compliance, /social signals from followed accounts/);
});
