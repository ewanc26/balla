import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ATPROTO_MIGRATION_GUIDE,
  buildPreferenceExport,
  GOAT_MIGRATION_TOOL,
  MIGRATION_OUTSIDE_GRANT,
  PDS_MIGRATION_GUIDE,
  PDS_MOOVER_TOOL,
  preferenceExportName,
  preferenceInventoryText,
  readPreferenceInventory,
} from '../src/lib/migrationPreflightModel.ts';

const preferences = [
  {
    $type: 'app.bsky.actor.defs#adultContentPref',
    enabled: true,
    privateNote: 'must not appear in inventory text',
  },
  { $type: 'app.bsky.actor.defs#contentLabelPref', label: 'nsfw', visibility: 'show' },
  null,
];

test('inventory counts entries and types without reading preference values', () => {
  const inventory = readPreferenceInventory(preferences);
  assert.deepEqual(inventory, {
    count: 3,
    kinds: ['adultContentPref', 'contentLabelPref', 'unknown'],
  });
  assert.equal(JSON.stringify(inventory).includes('privateNote'), false);
  assert.equal(JSON.stringify(inventory).includes('must not appear'), false);
  assert.equal(readPreferenceInventory({ preferences: [] }), null);
  assert.equal(readPreferenceInventory(null), null);
});

test('inventory copy never invents a read or a count', () => {
  assert.equal(preferenceInventoryText(null), 'Preferences: not read yet.');
  assert.equal(
    preferenceInventoryText(readPreferenceInventory([])),
    'Preferences: 0 entries.'
  );
  assert.match(
    preferenceInventoryText(readPreferenceInventory(preferences)),
    /3 entries across 3 types/
  );
});

test('export is a real local JSON document with a deterministic timestamp', () => {
  const json = buildPreferenceExport(
    preferences,
    'did:plc:example123',
    '2026-11-23T00:00:00.000Z'
  );
  assert.ok(json);
  const parsed = JSON.parse(json);
  assert.equal(parsed.format, 'balla.preferences.v1');
  assert.equal(parsed.did, 'did:plc:example123');
  assert.equal(parsed.exportedAt, '2026-11-23T00:00:00.000Z');
  assert.deepEqual(parsed.preferences, preferences);
  assert.equal(buildPreferenceExport({ preferences: [] }, 'did:plc:x', 'now'), null);
});

test('export file names are safe and tied to the account DID', () => {
  assert.equal(
    preferenceExportName('did:plc:abc_123'),
    'balla-preferences-did_plc_abc_123.json'
  );
  assert.equal(preferenceExportName(''), 'balla-preferences-account.json');
});

test('the pre-flight names the real migration operations and verified tools', () => {
  const methods = MIGRATION_OUTSIDE_GRANT.map((item) => item.method);
  for (const method of [
    'com.atproto.server.createAccount',
    'com.atproto.sync.getRepo',
    'com.atproto.repo.importRepo',
    'com.atproto.sync.listBlobs',
    'com.atproto.repo.listMissingBlobs',
    'com.atproto.server.checkAccountStatus',
    'PLC identity operations',
    'com.atproto.server.activateAccount',
  ]) {
    assert.ok(methods.includes(method), `${method} is disclosed`);
  }
  assert.match(ATPROTO_MIGRATION_GUIDE, /^https:\/\/atproto\.com\//);
  assert.match(PDS_MIGRATION_GUIDE, /^https:\/\/github\.com\/bluesky-social\/pds\//);
  assert.match(GOAT_MIGRATION_TOOL, /^https:\/\/github\.com\/bluesky-social\/goat/);
  assert.match(PDS_MOOVER_TOOL, /^https:\/\/pdsmoover\.com\//);
});
