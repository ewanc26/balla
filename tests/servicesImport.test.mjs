import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  buildServicesExport,
  serialiseServicesExport,
} from '../src/lib/servicesExportModel.ts';
import {
  parseServicesImport,
  SERVICES_IMPORT_INVALID_DETAIL,
} from '../src/lib/servicesImportModel.ts';
import {
  DEFAULT_SERVICES_CONFIG,
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

test('a default Balla record imports back to the compiled defaults', () => {
  const parsed = parseServicesImport(exportJson(DEFAULT_SERVICES_CONFIG));
  assert.equal(parsed.state, 'ok');
  assert.deepEqual(parsed.config, DEFAULT_SERVICES_CONFIG);
  assert.doesNotMatch(JSON.stringify(parsed), /secretaccount|auth\.example|pds\.example|999|untrusted/i);
});

test('every changeable value survives an export/import round trip', () => {
  const config = normaliseServicesConfig({
    handleResolver: 'https://resolver.example',
    plcDirectory: 'https://directory.example',
    places: 'https://places.example',
    placesEnabled: false,
  });
  const parsed = parseServicesImport(exportJson(config));
  assert.equal(parsed.state, 'ok');
  assert.deepEqual(parsed.config, config);
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

test('the importer reads only changeable facts, never clipboard, storage or network', () => {
  assert.match(importModel, /parsed\.schema !== SERVICES_EXPORT_SCHEMA/);
  assert.match(importModel, /typeof changeable\.placesEnabled !== 'boolean'/);
  assert.match(importModel, /DEFAULT_SERVICES\.handleResolver/);
  assert.match(importModel, /DEFAULT_SERVICES\.plcDirectory/);
  assert.match(importModel, /DEFAULT_SERVICES\.places/);
  assert.doesNotMatch(importModel, /Clipboard|AsyncStorage|fetch\(|console\.|\.message\b/);

  assert.match(configModule, /export async function replaceServicesConfig/);
  assert.match(configModule, /forgetDirectoryDidDocuments\(\)/);
  assert.match(configModule, /await persist\(next\)/);

  assert.match(screen, /parseServicesImport\(importText\)/);
  assert.match(screen, /replaceServicesConfig\(parsed\.config\)/);
  assert.match(screen, /Import configuration/);
  assert.match(screen, /accessibilityLabel="Exported service configuration JSON"/);
  assert.match(screen, /multiline/);
  assert.match(screen, /Session facts,\s+grant-bound services and every other field are ignored/);
  assert.match(screen, /A malformed\s+record changes nothing/);
  assert.doesNotMatch(screen, /not an import/);
});

test('the release documents the import as a partial #97 slice honestly', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.82.0');
  assert.equal(appJson.expo.version, '0.82.0');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.82\.0<\/string>/);
  }
  assert.match(changelog, /^## 0\.82\.0$/m);
  assert.match(changelog, /import/i);
  assert.match(changelog, /#97, partial/);
  assert.match(compliance, /Configuration export and import/);
  assert.match(compliance, /valid Balla record/);
  assert.match(features, /Service configuration export and import/);
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 112);
});
