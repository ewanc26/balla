import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  DEFAULT_PLACES_ENDPOINT,
  PLACES_SEARCH_PATH,
  normalisePlacesEndpoint,
  parsePlacesSearch,
  placesSearchBody,
  placesSearchUrl,
} from '../src/lib/placesModel.ts';
import { probePlaces } from '../src/lib/placesProbe.ts';
import {
  DEFAULT_SERVICES,
  effectivePlaces,
  isDefaultPlaces,
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
        lat: 52.506935,
        lng: 13.397483,
      },
      { kind: 'place', name: 'Olympiastadion', category: 'Soccer Stadium', group: 'culture', checkins: { total: 9 } },
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
    },
  ]);
  assert.doesNotMatch(JSON.stringify(hits), /lat|lng|52\.506|checkins/i);
  assert.deepEqual(parsePlacesSearch(null), []);
  assert.deepEqual(parsePlacesSearch({ results: 'no' }), []);
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
  });
  assert.deepEqual(normaliseServicesConfig({ places: 'places.example' }), {
    handleResolver: null,
    plcDirectory: null,
    places: 'https://places.example',
  });
  assert.equal(effectivePlaces({ handleResolver: null, plcDirectory: null, places: null }), DEFAULT_PLACES_ENDPOINT);
  assert.equal(isDefaultPlaces({ handleResolver: null, plcDirectory: null, places: undefined }), true);
  assert.match(config, /getPlacesEndpoint/);
  assert.match(config, /setPlacesEndpoint/);
});

test('the screen, export and release notes describe the partial feature', () => {
  assert.match(screen, /Test typed search/);
  assert.match(screen, /probePlaces\(await getPlacesEndpoint\(\)\)/);
  assert.match(screen, /Balla sends only the words you type/);
  assert.match(screen, /check-in record is written/i);
  assert.match(exporter, /places: effectivePlaces\(config\)/);
  assert.match(exporter, /usingDefaultPlaces/);
  assert.match(changelog, /^## 0\.63\.0$/m);
  assert.match(changelog, /#156, partial/);
  assert.match(changelog, /scope count remains 112/);
  assert.match(compliance, /Places provider/);
  assert.match(features, /Places provider/);
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.63.0');
  assert.equal(appJson.expo.version, '0.63.0');
  const plistPath = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plistPath)) {
    assert.match(readFileSync(plistPath, 'utf8'), /<string>0\.63\.0<\/string>/);
  }
});
