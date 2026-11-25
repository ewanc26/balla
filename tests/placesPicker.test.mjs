import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  insertPlaceName,
  normalisePlaceName,
} from '../src/lib/placesModel.ts';
import {
  placesSearchCopy,
  searchPlaces,
} from '../src/lib/placesSearch.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const composer = read('../src/screens/ComposeScreen.tsx');
const sheet = read('../src/components/PlacePickerSheet.tsx');
const changelog = read('../CHANGELOG.md');
const compliance = read('../docs/bluesky-compliance.md');
const features = read('../site/features.html');

test('a picked place is inserted as plain text at the cursor', () => {
  assert.equal(normalisePlaceName('  Olympiastadion  '), 'Olympiastadion');
  assert.equal(normalisePlaceName('  two\nlines '), 'two lines');
  assert.equal(normalisePlaceName('   '), null);
  assert.deepEqual(insertPlaceName('Met at ', { start: 7, end: 7 }, 'Berlin'), {
    text: 'Met at Berlin ',
    cursor: 13,
  });
  assert.deepEqual(insertPlaceName('Met at Berlin today', { start: 7, end: 13 }, 'Paris'), {
    text: 'Met at Paris today',
    cursor: 12,
  });
  // The caret stays after the name itself, before any separator that was
  // already present in the draft or added by the insertion.
  assert.deepEqual(insertPlaceName('Hello, world', { start: 6, end: 6 }, 'Berlin'), {
    text: 'Hello, Berlin world',
    cursor: 13,
  });
  assert.deepEqual(insertPlaceName('Keep text', { start: 0, end: 0 }, ''), {
    text: 'Keep text',
    cursor: 0,
  });
  const inserted = insertPlaceName('', { start: 0, end: 0 }, 'Berlin');
  assert.doesNotMatch(inserted.text, /urn:atgeo|lat|lng|checkin/i);
});

test('typed search sends only the words and never a position', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return {
      status: 200,
      ok: true,
      json: async () => ({
        results: [
          {
            kind: 'place',
            origin: 'urn:atgeo:foursquare.com:place:1',
            name: 'Olympiastadion',
            category: 'Soccer Stadium',
            lat: 52.5,
            lng: 13.2,
            checkins: { total: 7 },
          },
        ],
      }),
    };
  };
  const result = await searchPlaces('Olympia', 'https://places.eurosky.tech', { fetchImpl });
  assert.equal(result.state, 'ready');
  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://places.eurosky.tech/v1/search');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(Object.keys(JSON.parse(calls[0].init.body)).sort(), ['limit', 'q']);
  assert.doesNotMatch(calls[0].init.body, /lat|lng|position|accuracy/i);
  assert.deepEqual(result.hits, [
    {
      kind: 'place',
      origin: 'urn:atgeo:foursquare.com:place:1',
      name: 'Olympiastadion',
      category: 'Soccer Stadium',
      group: null,
      subtype: null,
      cityState: false,
      country: null,
    },
  ]);
  assert.doesNotMatch(JSON.stringify(result.hits), /52\.5|checkins/i);
});

test('search fails closed with fixed copy and no provider prose', async () => {
  const invalid = await searchPlaces('Berlin', 'https://places.example/path');
  assert.deepEqual(invalid, { state: 'invalid', status: null, hits: [] });
  assert.match(placesSearchCopy(invalid.state), /Advanced → Services/);

  const down = await searchPlaces('Berlin', 'https://places.example', {
    fetchImpl: async () => {
      throw new Error('provider secret detail');
    },
  });
  assert.deepEqual(down, { state: 'unavailable', status: null, hits: [] });
  assert.match(placesSearchCopy(down.state), /still add the name you typed/);
  assert.doesNotMatch(placesSearchCopy(down.state), /provider secret/i);

  const refused = await searchPlaces('Berlin', 'https://places.example', {
    fetchImpl: async () => ({ status: 429, ok: false, json: async () => ({ error: 'secret' }) }),
  });
  assert.equal(refused.state, 'unavailable');
  assert.equal(refused.status, 429);
  assert.deepEqual(refused.hits, []);
});

test('the composer exposes a visible, honest place-name control', () => {
  assert.match(composer, /PlacePickerSheet/);
  assert.match(composer, /onPick=\{choosePlace\}/);
  assert.match(composer, /insertPlaceName\(text, selection, name\)/);
  assert.match(composer, /accessibilityLabel="Add a place name to this post"/);
  assert.match(composer, /minHeight: 44/);
  assert.match(composer, /No check-in was written/);
  assert.match(sheet, /No device position, no nearby/);
  assert.match(sheet, /no check-in record while the place-pin lexicon is a draft/);
  assert.match(sheet, /Use typed name as plain text/);
  assert.match(sheet, /minHeight: 44/);
});

test('docs and release notes match the partial place picker', () => {
  assert.match(changelog, /^## 0\.63\.0$/m);
  assert.match(changelog, /typed place-name picker/);
  assert.match(changelog, /scope count remains 112/);
  assert.match(compliance, /The composer adds a visible typed place-name picker/);
  assert.match(compliance, /no granularity choice, check-in record, place chip/);
  assert.match(features, /place-name picker/);
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.63.0');
  assert.equal(appJson.expo.version, '0.63.0');
  const plistPath = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plistPath)) {
    assert.match(readFileSync(plistPath, 'utf8'), /<string>0\.63\.0<\/string>/);
  }
});
