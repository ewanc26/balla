import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SERVICES_EXPORT_NOTES,
  SERVICES_EXPORT_SCHEMA,
  buildServicesExport,
  serialiseServicesExport,
  servicesExportName,
} from '../src/lib/servicesExportModel.ts';
import { DEFAULT_SERVICES } from '../src/lib/servicesModel.ts';

const AT = '2026-11-23T12:00:00.000Z';

test('the export records the effective resolver and whether it is the default', () => {
  const fallback = buildServicesExport({ handleResolver: null, plcDirectory: null }, null, AT);
  assert.equal(fallback.schema, SERVICES_EXPORT_SCHEMA);
  assert.equal(fallback.exportedAt, AT);
  assert.equal(fallback.changeable.handleResolver, DEFAULT_SERVICES.handleResolver);
  assert.equal(fallback.changeable.usingDefaultResolver, true);

  const override = buildServicesExport({ handleResolver: 'https://selfhosted.social', plcDirectory: null }, null, AT);
  assert.equal(override.changeable.handleResolver, 'https://selfhosted.social');
  assert.equal(override.changeable.usingDefaultResolver, false);
});

test('the export records the effective PLC directory and whether it is the default', () => {
  const fallback = buildServicesExport({ handleResolver: null, plcDirectory: null }, null, AT);
  assert.equal(fallback.changeable.plcDirectory, DEFAULT_SERVICES.plcDirectory);
  assert.equal(fallback.changeable.usingDefaultPlcDirectory, true);

  const override = buildServicesExport({ handleResolver: null, plcDirectory: 'https://plc.example' }, null, AT);
  assert.equal(override.changeable.plcDirectory, 'https://plc.example');
  assert.equal(override.changeable.usingDefaultPlcDirectory, false);

  // Config persisted before this field existed stays on the safe default.
  const legacy = buildServicesExport({ handleResolver: null }, null, AT);
  assert.equal(legacy.changeable.plcDirectory, DEFAULT_SERVICES.plcDirectory);
  assert.equal(legacy.changeable.usingDefaultPlcDirectory, true);
});

test('the export records whether typed place search is switched off', () => {
  const on = buildServicesExport({ handleResolver: null, plcDirectory: null }, null, AT);
  assert.equal(on.changeable.placesEnabled, true);

  const off = buildServicesExport({
    handleResolver: null,
    plcDirectory: null,
    places: 'https://places.example',
    placesEnabled: false,
  }, null, AT);
  assert.equal(off.changeable.placesEnabled, false);
  assert.equal(off.changeable.places, 'https://places.example');

  // Config persisted before the switch existed keeps its previous behaviour.
  const legacy = buildServicesExport({ handleResolver: null }, null, AT);
  assert.equal(legacy.changeable.placesEnabled, true);
  assert.ok(SERVICES_EXPORT_NOTES.some((note) => /switched off, which stops every place request/.test(note)));
});

test('grant-bound defaults are exported verbatim as facts', () => {
  const value = buildServicesExport({ handleResolver: null }, null, AT);
  assert.deepEqual(value.defaults, { ...DEFAULT_SERVICES });
  assert.equal(value.defaults.appviewAudience, 'did:web:api.eurosky.network#bsky_appview');
  assert.equal(value.defaults.chatAudience, 'did:web:api.bsky.chat#bsky_chat');
});

test('only non-secret session metadata is included', () => {
  const value = buildServicesExport(
    { handleResolver: null },
    {
      did: 'did:plc:abc123',
      authorizationServer: 'https://bsky.social',
      resourceServer: 'https://bsky.social',
      scopeCount: 111,
    },
    AT,
  );
  assert.deepEqual(value.session, {
    did: 'did:plc:abc123',
    authorizationServer: 'https://bsky.social',
    resourceServer: 'https://bsky.social',
    scopeCount: 111,
  });

  const empty = buildServicesExport({ handleResolver: null }, null, AT);
  assert.deepEqual(empty.session, {
    did: null,
    authorizationServer: null,
    resourceServer: null,
    scopeCount: null,
  });
  assert.equal(empty.session.scopeCount, null);
});

test('the export says plainly that it is not a credential or an editable grant', () => {
  assert.ok(SERVICES_EXPORT_NOTES.some((note) => /next sign-in/.test(note)));
  assert.ok(SERVICES_EXPORT_NOTES.some((note) => /new authorisation/.test(note)));
  assert.ok(SERVICES_EXPORT_NOTES.some((note) => /no access token/.test(note)));
  const json = serialiseServicesExport(buildServicesExport({ handleResolver: null }, null, AT));
  assert.ok(json.includes('not a credential'));
  assert.doesNotMatch(json, /refresh_token|access_token|appPassword|password\s*:/i);
  assert.ok(json.endsWith('\n'));
});

test('the filename is stable and contains no account identifier', () => {
  assert.equal(servicesExportName(), 'balla-services-config.json');
});
