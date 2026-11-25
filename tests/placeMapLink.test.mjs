import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { openStreetMapSearchUrl } from '../src/lib/mapLinks.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sheet = read('../src/components/PlacePickerSheet.tsx');
const events = read('../src/lib/eventsModel.ts');
const changelog = read('../CHANGELOG.md');
const compliance = read('../docs/bluesky-compliance.md');
const features = read('../site/features.html');

test('the shared map builder searches by name and never sends a position', () => {
  assert.equal(
    openStreetMapSearchUrl('  Olympiastadion  '),
    'https://www.openstreetmap.org/search?query=Olympiastadion'
  );
  assert.equal(
    openStreetMapSearchUrl('Leith Library, Edinburgh'),
    'https://www.openstreetmap.org/search?query=Leith%20Library%2C%20Edinburgh'
  );
  for (const empty of ['', '   ', null, undefined, 7, {}]) {
    assert.equal(openStreetMapSearchUrl(empty), null);
  }
  const url = openStreetMapSearchUrl('Berlin');
  assert.match(url, /^https:\/\/www\.openstreetmap\.org\/search\?query=/);
  assert.doesNotMatch(url, /lat|lng|position|accuracy/i);
});

test('Events and the Places picker share one OSM name-search builder', () => {
  assert.match(events, /import \{ openStreetMapSearchUrl \} from '\.\/mapLinks\.ts'/);
  assert.doesNotMatch(events, /function osmSearch/);
  assert.match(sheet, /import \{ openStreetMapSearchUrl \} from '\.\.\/lib\/mapLinks'/);
  assert.match(sheet, /openStreetMapSearchUrl\(hit\.name\)/);
  assert.match(sheet, /openExternalUrl\(url\)/);
});

test('the map button is visible, named and honest about its limits', () => {
  assert.match(sheet, /accessibilityLabel=\{`Search OpenStreetMap for \$\{hit\.name\} by name`\}/);
  assert.match(sheet, /searches OpenStreetMap by name in your browser/);
  assert.match(sheet, /is not an exact place match/);
  assert.match(sheet, /sends no position/);
  assert.match(sheet, /styles\.mapButton/);
  assert.match(sheet, /width: 44,\s*height: 44,/);
});

test('switching Places off clears stale results in the open sheet', () => {
  assert.match(sheet, /if \(!value\) \{\s*setState\('off'\);\s*setHits\(\[\]\);/);
  assert.match(sheet, /setEnabled\(false\);\s*setState\('off'\);\s*setHits\(\[\]\);/);
  assert.match(sheet, /if \(!allowed\) \{\s*setState\('off'\);\s*setHits\(\[\]\);/);
});

test('docs and release notes match the map link-out slice', () => {
  assert.match(changelog, /^## 0\.72\.0$/m);
  assert.match(changelog, /map link-out/);
  assert.match(changelog, /scope count remains 112/);
  assert.match(compliance, /44pt map button/);
  assert.match(compliance, /not an in-app map or an exact-place claim/);
  assert.match(features, /map button opening an OpenStreetMap search by name/);
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.72.0');
  assert.equal(appJson.expo.version, '0.72.0');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.72\.0<\/string>/);
  }
});
