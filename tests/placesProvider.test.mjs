import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  DEFAULT_PLACES_ENDPOINT,
  PLACES_SEARCH_PATH,
  normalisePlacesEndpoint,
  parsePlacesSearch,
  placeResultDetail,
  placesHostLabel,
  placesSearchBody,
  placesSearchUrl,
} from '../src/lib/placesModel.ts';
import { probePlaces } from '../src/lib/placesProbe.ts';
import {
  DEFAULT_SERVICES,
  effectivePlaces,
  isDefaultPlaces,
  isPlacesEnabled,
  normaliseServicesConfig,
} from '../src/lib/servicesModel.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const config = read('../src/lib/servicesConfig.ts');
const exporter = read('../src/lib/servicesExportModel.ts');
const screen = read('../src/screens/ServicesScreen.tsx');
const changelog = read('../CHANGELOG.md');
const compliance = read('../docs/bluesky-compliance.md');
const features = read('../site/features.html');

test('typed search sends only the words and never a position', () => {
  assert.equal(DEFAULT_PLACES_ENDPOINT, 'https://places.eurosky.tech');
  assert.equal(placesSearchUrl(DEFAULT_PLACES_ENDPOINT, 'Berlin'), `https://places.eurosky.tech${PLACES_SEARCH_PATH}`);
  const body = JSON.parse(placesSearchBody('  Brandenb  '));
  assert.deepEqual(Object.keys(body).sort(), ['limit', 'q']);
  assert.equal(body.q, 'Brandenb');
  assert.equal(body.limit, 10);
  assert.doesNotMatch(placesSearchBody('Berlin'), /lat|lng|position|accuracy/i);
  assert.equal(placesSearchUrl(DEFAULT_PLACES_ENDPOINT, '   '), null);
  assert.equal(placesSearchUrl('http://places.example', 'Berlin'), null);
  assert.equal(placesSearchUrl('https://places.example/path', 'Berlin'), null);
  assert.equal(normalisePlacesEndpoint('places.example'), 'https://places.example');
  assert.equal(normalisePlacesEndpoint('https://user@places.example'), null);
});

test('only structured display fields survive parsing', () => {
  const hits = parsePlacesSearch({
    results: [
      {
        kind: 'area',
        origin: 'urn:atgeo:overturemaps.org:division:59f212f3-4e73-45d4-aca6-a8c5cb0c2bfd',
        name: 'Berlin',
        subtype: 'region',
        cityState: true,
        country: 'DE',
        match: 'start',
        lat: 52.506935,
        lng: 13.397483,
      },
      {
        kind: 'place', name: 'Olympiastadion', category: 'Soccer Stadium', group: 'culture',
        match: 'other_name', matched: 'Olympia Stadium', checkins: { total: 9 },
      },
      { kind: 'other', name: 'Ignored' },
      { kind: 'place' },
    ],
  });
  assert.deepEqual(hits, [
    {
      kind: 'area',
      origin: 'urn:atgeo:overturemaps.org:division:59f212f3-4e73-45d4-aca6-a8c5cb0c2bfd',
      name: 'Berlin',
      category: null,
      group: null,
      subtype: 'region',
      cityState: true,
      country: 'DE',
      match: 'start',
      matched: null,
    },
    {
      kind: 'place',
      origin: null,
      name: 'Olympiastadion',
      category: 'Soccer Stadium',
      group: 'culture',
      subtype: null,
      cityState: false,
      country: null,
      match: 'other_name',
      matched: 'Olympia Stadium',
    },
  ]);
  assert.doesNotMatch(JSON.stringify(hits), /lat|lng|52\.506|checkins/i);
  assert.deepEqual(parsePlacesSearch(null), []);
  assert.deepEqual(parsePlacesSearch({ results: 'no' }), []);
});

test('result details use fixed labels from published fields only', () => {
  const base = {
    kind: 'area', origin: null, name: 'Berlin', category: null, group: null,
    subtype: 'region', cityState: false, country: 'DE', match: null, matched: null,
  };
  // A city-state is labelled as a city, not by Overture's raw region subtype.
  assert.equal(placeResultDetail({ ...base, cityState: true }), 'City · DE');
  assert.equal(placeResultDetail(base), 'region · DE');
  // A name found through another name says which one matched.
  assert.equal(
    placeResultDetail({ ...base, kind: 'place', category: 'Soccer Stadium', match: 'other_name', matched: 'Olympia Stadium' }),
    'Soccer Stadium · Matched: Olympia Stadium · DE',
  );
  // A result whose own name matched adds no noise; an approximate one says so.
  assert.equal(
    placeResultDetail({ ...base, kind: 'place', name: 'Café', category: 'Café', match: 'start', matched: 'Café' }),
    'Café · DE',
  );
  assert.equal(
    placeResultDetail({ ...base, kind: 'place', group: 'culture', match: 'approximate' }),
    'culture · Approximate match · DE',
  );
  assert.equal(
    placeResultDetail({ ...base, match: 'other_name' }),
    'region · Other name · DE',
  );
  // Unknown match kinds never echo provider text into the UI.
  const unknown = parsePlacesSearch({ results: [{ kind: 'place', name: 'X', match: 'provider secret', matched: 42 }] });
  assert.equal(unknown[0].match, null);
  assert.equal(unknown[0].matched, null);
  assert.equal(placeResultDetail(unknown[0]), 'Place');
  assert.doesNotMatch(placeResultDetail(unknown[0]), /secret/i);
});

test('the reachability check is a real typed POST and fails closed', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return {
      status: 200,
      ok: true,
      json: async () => ({ results: [{ kind: 'place', name: 'Berlin', origin: 'urn:atgeo:x:y:z' }] }),
    };
  };
  const ok = await probePlaces(DEFAULT_PLACES_ENDPOINT, { fetchImpl });
  assert.equal(ok.state, 'ok');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://places.eurosky.tech/v1/search');
  assert.equal(calls[0].init.method, 'POST');
  assert.doesNotMatch(calls[0].init.body, /lat|lng/i);
  assert.match(ok.detail, /No position was sent/);

  const invalid = await probePlaces('https://places.example/path', { fetchImpl });
  assert.equal(invalid.state, 'invalid');
  assert.equal(calls.length, 1);

  const limited = await probePlaces(DEFAULT_PLACES_ENDPOINT, {
    fetchImpl: async () => ({ status: 429, ok: false, json: async () => { throw new Error('provider prose'); } }),
  });
  assert.equal(limited.state, 'unavailable');
  assert.equal(limited.status, 429);
});

test('the places host is a reversible persisted config override', () => {
  assert.equal(DEFAULT_SERVICES.places, DEFAULT_PLACES_ENDPOINT);
  assert.deepEqual(normaliseServicesConfig({ places: 'https://places.eurosky.tech' }), {
    handleResolver: null,
    plcDirectory: null,
    places: null,
    placesEnabled: true,
  });
  assert.deepEqual(normaliseServicesConfig({ places: 'places.example' }), {
    handleResolver: null,
    plcDirectory: null,
    places: 'https://places.example',
    placesEnabled: true,
  });
  assert.deepEqual(normaliseServicesConfig({ places: 'places.example', placesEnabled: false }), {
    handleResolver: null,
    plcDirectory: null,
    places: 'https://places.example',
    placesEnabled: false,
  });
  assert.equal(effectivePlaces({ handleResolver: null, plcDirectory: null, places: null }), DEFAULT_PLACES_ENDPOINT);
  assert.equal(isDefaultPlaces({ handleResolver: null, plcDirectory: null, places: undefined }), true);
  assert.equal(isPlacesEnabled({ placesEnabled: undefined }), true);
  assert.equal(isPlacesEnabled({ placesEnabled: false }), false);
  assert.match(config, /getPlacesEndpoint/);
  assert.match(config, /setPlacesEndpoint/);
  assert.match(config, /getPlacesEnabled/);
  assert.match(config, /setPlacesEnabled/);
});

test('the screen, export and release notes describe the partial feature', () => {
  assert.match(screen, /Test typed search/);
  assert.match(screen, /probePlaces\(await getPlacesEndpoint\(\)\)/);
  assert.match(screen, /Balla sends only the words you type/);
  assert.match(screen, /check-in record is written/i);
  assert.match(screen, /label="Places search"/);
  assert.match(screen, /const allowed = await getPlacesEnabled\(\)/);
  assert.match(screen, /import \{ placesHostLabel \} from '..\/lib\/placesModel\.ts'/);
  assert.match(screen, /value=\{placesHostLabel\(placesEndpoint, placesEnabled\)\}/);
  assert.equal(
    placesHostLabel('https://places.eurosky.tech', true),
    'Places host: https://places.eurosky.tech',
  );
  assert.equal(
    placesHostLabel('places.eurosky.tech', false),
    'Configured places host (off): https://places.eurosky.tech',
  );
  assert.equal(
    placesHostLabel('https://places.eurosky.tech/path', true),
    'Places host needs an https address',
  );
  assert.match(exporter, /places: effectivePlaces\(config\)/);
  assert.match(exporter, /usingDefaultPlaces/);
  assert.match(exporter, /placesEnabled: isPlacesEnabled\(config\)/);
  assert.match(changelog, /^## 0\.72\.0$/m);
  assert.match(changelog, /switched off/);
  assert.match(changelog, /#156, partial/);
  assert.match(changelog, /scope count stays 112/);
  assert.match(changelog, /placeResultDetail/);
  assert.match(compliance, /placeResultDetail/);
  assert.match(compliance, /cityState/);
  assert.match(features, /city-state/);
  assert.match(features, /switch typed search off/);
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.82.0');
  assert.equal(appJson.expo.version, '0.82.0');
  const plistPath = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plistPath)) {
    assert.match(readFileSync(plistPath, 'utf8'), /<string>0\.82\.0<\/string>/);
  }
});
