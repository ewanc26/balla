import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { placeRecordUrl } from '../src/lib/placeRecordLinks.ts';
import { atgeoUrn } from '../src/lib/placesModel.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sheet = read('../src/components/PlacePickerSheet.tsx');
const builder = read('../src/lib/placeRecordLinks.ts');
const model = read('../src/lib/placesModel.ts');
const changelog = read('../CHANGELOG.md');
const compliance = read('../docs/bluesky-compliance.md');
const features = read('../site/features.html');

const URN = 'urn:atgeo:openstreetmap.org:node:30353086';

test('the record link is built from the configured host and a real origin URN', () => {
  assert.equal(
    placeRecordUrl('https://places.eurosky.tech', URN),
    `https://places.eurosky.tech/xrpc/org.atgeo.getPlace?uri=${encodeURIComponent(URN)}`,
  );
  assert.equal(
    placeRecordUrl('places.eurosky.tech', URN),
    `https://places.eurosky.tech/xrpc/org.atgeo.getPlace?uri=${encodeURIComponent(URN)}`,
  );
  assert.equal(
    placeRecordUrl('https://places.example', 'urn:atgeo:foursquare.com:place:691f0b57dbce331e6465f8d0'),
    'https://places.example/xrpc/org.atgeo.getPlace?uri=urn%3Aatgeo%3Afoursquare.com%3Aplace%3A691f0b57dbce331e6465f8d0',
  );
  const url = placeRecordUrl('https://places.eurosky.tech', URN);
  assert.match(url, /^https:\/\/places\.eurosky\.tech\/xrpc\/org\.atgeo\.getPlace\?uri=/);
  assert.doesNotMatch(url, /lat|lng|position|accuracy|checkins/i);
});

test('an invalid host or origin fails closed with no link', () => {
  for (const endpoint of ['', null, undefined, 7, {}, 'http://places.example',
    'https://places.example/path', 'https://places.example?q=1',
    'https://user@places.example', 'places example']) {
    assert.equal(placeRecordUrl(endpoint, URN), null, `endpoint ${String(endpoint)}`);
  }
  for (const origin of ['', null, undefined, 7, {}, 'Olympiastadion',
    'urn:atgeo:openstreetmap.org', 'https://example.org/place/1',
    'provider secret detail', `urn:atgeo:openstreetmap.org:node:1 secret`]) {
    assert.equal(placeRecordUrl('https://places.eurosky.tech', origin), null, `origin ${String(origin)}`);
  }
  assert.equal(atgeoUrn(URN), URN);
  assert.equal(atgeoUrn('urn:atgeo:openstreetmap.org'), null);
});

test('parsing and link-outs share one ATGeo origin rule', () => {
  assert.match(builder, /import \{ atgeoUrn, normalisePlacesEndpoint \} from '\.\/placesModel\.ts'/);
  assert.match(model, /export function atgeoUrn\(value: unknown\)/);
  assert.match(model, /origin: atgeoUrn\(value\.origin\)/);
  assert.doesNotMatch(model, /\bfunction urn\(/);
  assert.match(builder, /const urn = atgeoUrn\(origin\)/);
  assert.doesNotMatch(builder, /^const [A-Z_]+_URN/m);
});

test('the info button opens details where the shared record link is built', () => {
  assert.match(sheet, /import \{ placeRecordUrl \} from '\.\.\/lib\/placeRecordLinks\.ts'/);
  assert.match(sheet, /placeRecordUrl\(placesEndpoint, detailHit\.origin\)/);
  assert.match(sheet, /onPress=\{\(\) => openDetails\(hit\)\}/);
  assert.match(sheet, /accessibilityLabel=\{`Show details for \$\{hit\.name\}`\}/);
  assert.match(sheet, /styles\.recordButton/);
  assert.match(sheet, /information-circle-outline/);
  assert.match(sheet, /accessibilityLabel="Open the public gazetteer record"/);
  assert.match(sheet, /openLink\(detailRecordUrl\)/);
  assert.match(sheet, /styles\.detailLink/);
  assert.match(sheet, /Opens the result's public record on the configured places host\./);
  // The raw saved endpoint is never rendered and never normalised in the sheet.
  assert.doesNotMatch(sheet, /normalisePlacesEndpoint/);
  assert.doesNotMatch(sheet, /\{placesEndpoint\}/);
  assert.match(features, /public gazetteer record in your browser/);
});

test('docs and release notes match the record link-out slice', () => {
  assert.match(changelog, /^## 0\.72\.0$/m);
  assert.match(changelog, /org\.atgeo\.getPlace/);
  assert.match(changelog, /scope count stays 112/);
  assert.match(compliance, /placeRecordUrl\(\)/);
  assert.match(compliance, /public `org\.atgeo\.getPlace` browser link/);
  assert.match(features, /public gazetteer record in your browser/);
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.89.0');
  assert.equal(appJson.expo.version, '0.89.0');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.89\.0<\/string>/);
  }
});
