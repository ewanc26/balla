import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  buildServicesExport,
  serialiseServicesExport,
} from '../src/lib/servicesExportModel.ts';
import {
  parseServicesImport,
  previewServicesImport,
  SERVICES_IMPORT_INVALID_DETAIL,
} from '../src/lib/servicesImportModel.ts';
import {
  DEFAULT_SERVICES_CONFIG,
  effectivePlaces,
  effectivePlcDirectory,
  effectiveResolver,
  isPlacesEnabled,
  normaliseServicesConfig,
} from '../src/lib/servicesModel.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const screen = read('../src/screens/ServicesScreen.tsx');
const configModule = read('../src/lib/servicesConfig.ts');
const importModel = read('../src/lib/servicesImportModel.ts');
const changelog = read('../CHANGELOG.md');
const compliance = read('../docs/bluesky-compliance.md');
const features = read('../site/features.html');
const metadata = JSON.parse(read('../oauth-client-metadata.json'));

const FIXED_TIME = '2026-11-25T04:00:00.000Z';
const SESSION = {
  did: 'did:plc:secretaccount',
  authorizationServer: 'https://auth.example/secret',
  resourceServer: 'https://pds.example/secret',
  scopeCount: 999,
};
const PROVIDER_PROSE = 'the provider said something untrusted';

function exportJson(config, session = SESSION) {
  const value = buildServicesExport(config, session, FIXED_TIME);
  value.notes.push(PROVIDER_PROSE);
  return serialiseServicesExport(value);
}

const CUSTOM_CONFIG = normaliseServicesConfig({
  handleResolver: 'https://resolver.example',
  plcDirectory: 'https://directory.example',
  places: 'https://places.example',
  placesEnabled: false,
});

function parseValid(config) {
  const parsed = parseServicesImport(exportJson(config));
  assert.equal(parsed.state, 'ok');
  return parsed.config;
}

test('a default Balla record imports back to the compiled defaults', () => {
  const parsed = parseServicesImport(exportJson(DEFAULT_SERVICES_CONFIG));
  assert.equal(parsed.state, 'ok');
  assert.deepEqual(parsed.config, DEFAULT_SERVICES_CONFIG);
  assert.doesNotMatch(JSON.stringify(parsed), /secretaccount|auth\.example|pds\.example|999|untrusted/i);
});

test('every changeable value survives an export/import round trip', () => {
  const parsed = parseServicesImport(exportJson(CUSTOM_CONFIG));
  assert.equal(parsed.state, 'ok');
  assert.deepEqual(parsed.config, CUSTOM_CONFIG);
  assert.equal(parsed.config.placesEnabled, false);
  assert.doesNotMatch(JSON.stringify(parsed), /secret|untrusted/i);
});

test('a hostile or broken record changes nothing and uses fixed Balla copy', () => {
  const valid = JSON.parse(exportJson(DEFAULT_SERVICES_CONFIG));
  const cases = [
    ['malformed JSON', '{'],
    ['wrong schema', JSON.stringify({ ...valid, schema: 'something.else.v9' })],
    ['missing changeable', JSON.stringify({ ...valid, changeable: undefined })],
    ['path in host', JSON.stringify({
      ...valid,
      changeable: { ...valid.changeable, handleResolver: 'https://resolver.example/path' },
    })],
    ['insecure host', JSON.stringify({
      ...valid,
      changeable: { ...valid.changeable, plcDirectory: 'http://directory.example' },
    })],
    ['credentials in host', JSON.stringify({
      ...valid,
      changeable: { ...valid.changeable, places: 'https://user@places.example' },
    })],
    ['default flag mismatch', JSON.stringify({
      ...valid,
      changeable: { ...valid.changeable, usingDefaultResolver: false },
    })],
    ['non-boolean switch', JSON.stringify({
      ...valid,
      changeable: { ...valid.changeable, placesEnabled: 'false' },
    })],
    ['oversized record', `{${'x'.repeat(64_001)}}`],
  ];
  for (const [name, json] of cases) {
    const result = parseServicesImport(json);
    assert.equal(result.state, 'invalid', name);
    assert.equal(result.detail, SERVICES_IMPORT_INVALID_DETAIL, name);
    assert.doesNotMatch(result.detail, /provider|secret|untrusted/i, name);
    assert.ok(!('config' in result), name);
  }
});

test('a preview names only effective changes and never carries record prose', () => {
  const next = parseValid(DEFAULT_SERVICES_CONFIG);
  const preview = previewServicesImport(CUSTOM_CONFIG, next);
  assert.deepEqual(preview.config, DEFAULT_SERVICES_CONFIG);
  assert.deepEqual(preview.changes, [
    {
      label: 'Handle resolver',
      from: effectiveResolver(CUSTOM_CONFIG),
      to: effectiveResolver(DEFAULT_SERVICES_CONFIG),
    },
    {
      label: 'PLC directory',
      from: effectivePlcDirectory(CUSTOM_CONFIG),
      to: effectivePlcDirectory(DEFAULT_SERVICES_CONFIG),
    },
    {
      label: 'Places provider',
      from: effectivePlaces(CUSTOM_CONFIG),
      to: effectivePlaces(DEFAULT_SERVICES_CONFIG),
    },
    {
      label: 'Places search',
      from: isPlacesEnabled(CUSTOM_CONFIG) ? 'On' : 'Off',
      to: isPlacesEnabled(DEFAULT_SERVICES_CONFIG) ? 'On' : 'Off',
    },
  ]);
  assert.doesNotMatch(JSON.stringify(preview), /secret|untrusted|provider said/i);
});

test('an unchanged record previews no writes and a partial change previews one row', () => {
  const same = previewServicesImport(CUSTOM_CONFIG, parseValid(CUSTOM_CONFIG));
  assert.deepEqual(same.changes, []);
  assert.deepEqual(same.config, CUSTOM_CONFIG);

  const partial = normaliseServicesConfig({
    ...CUSTOM_CONFIG,
    plcDirectory: null,
  });
  const preview = previewServicesImport(CUSTOM_CONFIG, parseValid(partial));
  assert.equal(preview.changes.length, 1);
  assert.equal(preview.changes[0].label, 'PLC directory');
  assert.equal(preview.changes[0].to, effectivePlcDirectory(DEFAULT_SERVICES_CONFIG));
});

test('the importer reads only changeable facts, never clipboard, storage or network', () => {
  assert.match(importModel, /parsed\.schema !== SERVICES_EXPORT_SCHEMA/);
  assert.match(importModel, /typeof changeable\.placesEnabled !== 'boolean'/);
  assert.match(importModel, /DEFAULT_SERVICES\.handleResolver/);
  assert.match(importModel, /DEFAULT_SERVICES\.plcDirectory/);
  assert.match(importModel, /DEFAULT_SERVICES\.places/);
  assert.match(importModel, /export function previewServicesImport/);
  assert.match(importModel, /effectiveResolver\(current\)/);
  assert.match(importModel, /candidate\.filter\(\(change\) => change\.from !== change\.to\)/);
  assert.doesNotMatch(importModel, /Clipboard|AsyncStorage|fetch\(|console\.|\.message\b/);

  assert.match(configModule, /export async function replaceServicesConfig/);
  assert.match(configModule, /forgetDirectoryDidDocuments\(\)/);
  assert.match(configModule, /await persist\(next\)/);

  assert.match(screen, /parseServicesImport\(importText\)/);
  assert.match(screen, /previewServicesImport\(current, parsed\.config\)/);
  assert.match(screen, /replaceServicesConfig\(importPreview\.config\)/);
  assert.doesNotMatch(screen, /replaceServicesConfig\(parsed\.config\)/);
  assert.match(screen, /Preview configuration/);
  assert.match(screen, /Apply previewed configuration/);
  assert.match(screen, /importText !== importPreviewSource/);
  assert.match(screen, /updateImportText/);
  assert.match(screen, /accessibilityLabel="Exported service configuration JSON"/);
  assert.match(screen, /multiline/);
  assert.match(screen, /Nothing is written until you\s+apply that preview/);
  assert.match(screen, /session\s+facts,\s+grant-bound services and every other field are ignored/);
  assert.match(screen, /a\s+malformed\s+record changes nothing/);
  assert.ok(!/onPress=\{\(\) => \{\}\}/.test(screen));
  assert.doesNotMatch(screen, /not an import/);
});

test('the release documents the preview as a partial #97 slice honestly', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.93.0');
  assert.equal(appJson.expo.version, '0.93.0');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.93\.0<\/string>/);
  }
  assert.match(changelog, /^## 0\.93\.0$/m);
  assert.match(changelog, /preview/i);
  assert.match(changelog, /#97, partial/);
  assert.match(compliance, /Configuration export and import/);
  assert.match(compliance, /Nothing is written until the person applies that preview/);
  assert.match(features, /Service configuration export and import/);
  assert.match(features, /preview/i);
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 112);
});
