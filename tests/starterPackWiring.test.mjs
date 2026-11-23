import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const metadata = JSON.parse(read('../oauth-client-metadata.json'));

test('starter-pack writes add exactly one evidence-based repository scope', () => {
  const tokens = metadata.scope.split(/\s+/).filter(Boolean);
  assert.equal(tokens.length, 111);
  assert.equal(
    tokens.filter((token) => token.startsWith('repo:app.bsky.graph.starterpack')).length,
    1
  );
  assert.ok(
    tokens.includes(
      'repo:app.bsky.graph.starterpack?action=create&action=update&action=delete'
    )
  );
  assert.equal(/repo:\*|rpc:\*|blob:\*/.test(metadata.scope), false);
  assert.equal(
    tokens.some((token) => /account\.bsky|com\.atproto\.server/.test(token)),
    false
  );
  assert.equal(
    tokens.some((token) => /createStarterPack|editStarterPack/.test(token)),
    false
  );
});

test('the starter-pack page has explicit share and feed actions', () => {
  const screen = read('../src/screens/StarterPackScreen.tsx');
  assert.match(screen, /from 'react-native'[\s\S]*?Share/);
  assert.match(screen, /useFeeds\(\)/);
  assert.match(screen, /starterPackShareUrl\(uri, creator\)/);
  assert.match(screen, /Share\.share\(\{ message: url, url \}\)/);
  assert.match(screen, /isBlockedCreator\(creator\)/);
  assert.match(screen, /accessibilityLabel="Share starter pack"/);
  assert.match(screen, /accessibilityLabel={\n\s*saved\s*\n\s*\? `\$\{feed\.displayName \|\| 'Recommended'\} feed is saved`/);
  assert.match(screen, /await saveFeed\(feedUri, false\)/);
  assert.match(screen, /accessibilityRole="alert"/);
  assert.match(screen, /Bluesky supplies\s*\n\s*only this preview/);
});

test('starter-pack creation, editing and deletion use registered screens and real lexicons', () => {
  const app = read('../App.tsx');
  const linking = read('../src/lib/webLinking.ts');
  const profile = read('../src/screens/ProfileScreen.tsx');
  const data = read('../src/lib/starterPacks.ts');
  const screen = read('../src/screens/StarterPackScreen.tsx');
  const edit = read('../src/screens/StarterPackEditScreen.tsx');

  assert.match(app, /import \{ StarterPackEditScreen \}/);
  assert.match(app, /name="StarterPackEdit" component=\{StarterPackEditScreen\}/);
  assert.match(linking, /StarterPackEdit: 'starter-pack-edit\/:uri'/);
  assert.match(profile, /navigation\.navigate\('StarterPackEdit', \{ uri: 'new' \}\)/);
  assert.match(data, /app\.bsky\.graph\.starterpack\.create/);
  assert.match(data, /app\.bsky\.graph\.starterpack\.put/);
  assert.match(data, /app\.bsky\.graph\.listitem\.create/);
  assert.match(data, /app\.bsky\.graph\.listitem\.delete/);
  assert.match(data, /app\.bsky\.graph\.getFollows/);
  assert.match(edit, /useFeeds\(\)/);
  assert.match(edit, /accessibilityLabel="Starter pack name"/);
  assert.match(edit, /accessibilityLabel="Starter pack description"/);
  assert.doesNotMatch(data, /rpc:.?app\.bsky\.graph\.(create|edit)StarterPack/);

  assert.match(data, /export async function deleteStarterPack/);
  assert.match(data, /parseStarterPackListUri/);
  assert.match(data, /deleteListItems/);
  assert.match(data, /collection: 'app\.bsky\.graph\.list'/);
  assert.match(data, /collection: 'app\.bsky\.graph\.starterpack'/);
  assert.match(screen, /accessibilityLabel="Delete starter pack"/);
  assert.match(screen, /Delete “\{name\}”\?/);
  assert.match(screen, /This cannot\s+be undone/);
});

test('documentation and version copy state the re-authorisation requirement', () => {
  const scopes = read('../docs/oauth-scopes.md');
  const changelog = read('../CHANGELOG.md');
  const readme = read('../README.md');
  const site = read('../site/features.html');

  assert.match(scopes, /\*\*111 tokens\*\*/);
  assert.match(scopes, /repo:app\.bsky\.graph\.starterpack\?action=create&action=update&action=delete/);
  assert.match(scopes, /re-authorise/i);
  assert.match(scopes, /before 0\.20\.0/);
  assert.match(changelog, /## 0\.20\.0/);
  assert.match(changelog, /starter pack/i);
  assert.match(changelog, /rich-text facet/i);
  assert.match(readme, /starter[-\s]+pack/i);
  assert.match(readme, /creation, editing and deletion/);
  assert.match(readme, /rich-text facet/i);
  assert.match(site, /starter pack/i);
  assert.match(site, /creation, editing and deletion/);
  assert.match(site, /Rich text/);
  assert.equal(JSON.parse(read('../package.json')).version, '0.23.0');
});
