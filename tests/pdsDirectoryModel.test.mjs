import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PDS_DIRECTORY_API,
  directoryCopy,
  filterPdsEntries,
  normalisePdsDirectory,
  normalisePdsEntry,
} from '../src/lib/pdsDirectoryModel.ts';

const rawEntry = {
  url: 'https://selfhosted.social',
  did: 'did:web:selfhosted.social',
  version: '0.4.5051',
  pds_software: 'bluesky-pds',
  is_open: true,
  invite_code_required: false,
  phone_verification: false,
  user_domains: ['.selfhosted.social', 42, ''],
  user_count: 1000,
  country_name: 'United States',
  privacy_policy: 'https://selfhosted.social/privacy',
  terms_of_service: 'javascript:alert(1)',
  contact_email: 'host@example.com',
  last_seen: '2026-11-22T06:18:21.733Z',
  ip_address: '203.0.113.10',
  error_at: 'private provider note that must never be shown',
};

test('only open HTTPS hosts are kept, with structured fields only', () => {
  const entry = normalisePdsEntry(rawEntry);
  assert.deepEqual(entry, {
    url: 'https://selfhosted.social',
    host: 'selfhosted.social',
    did: 'did:web:selfhosted.social',
    version: '0.4.5051',
    software: 'bluesky-pds',
    userDomains: ['.selfhosted.social'],
    userCount: 1000,
    country: 'United States',
    inviteRequired: false,
    phoneRequired: false,
    privacyPolicy: 'https://selfhosted.social/privacy',
    termsOfService: null,
    contactEmail: 'host@example.com',
    lastSeen: '2026-11-22T06:18:21.733Z',
  });
  assert.equal(JSON.stringify(entry).includes('provider note'), false);
  assert.equal(JSON.stringify(entry).includes('203.0.113.10'), false);

  assert.equal(normalisePdsEntry({ ...rawEntry, is_open: false }), null);
  assert.equal(normalisePdsEntry({ ...rawEntry, url: 'http://selfhosted.social' }), null);
  assert.equal(normalisePdsEntry({ ...rawEntry, url: 'https://host.example/path' }), null);
  assert.equal(normalisePdsEntry(null), null);
});

test('malformed optional fields become not-stated values rather than shown text', () => {
  const entry = normalisePdsEntry({
    url: 'host.example',
    is_open: true,
    did: 'not-a-did',
    invite_code_required: 'yes',
    phone_verification: null,
    user_count: -4,
    user_domains: 'not-an-array',
    contact_email: 'not an email',
  });
  assert.equal(entry?.did, null);
  assert.equal(entry?.inviteRequired, null);
  assert.equal(entry?.phoneRequired, null);
  assert.equal(entry?.userCount, 0);
  assert.deepEqual(entry?.userDomains, []);
  assert.equal(entry?.contactEmail, null);
});

test('directory keeps the index timestamps and sorts usable hosts honestly', () => {
  const directory = normalisePdsDirectory({
    meta: { updated_at: '2026-11-23T03:18:33.287Z', total_open: 164 },
    servers: [
      { ...rawEntry, url: 'https://small.example', did: 'did:web:small.example', user_count: 12 },
      rawEntry,
      { ...rawEntry, url: 'https://closed.example', is_open: false },
      { ...rawEntry, url: 'ftp://bad.example' },
    ],
  });
  assert.equal(directory?.updatedAt, '2026-11-23T03:18:33.287Z');
  assert.equal(directory?.totalOpen, 164);
  assert.deepEqual(directory?.entries.map((entry) => entry.host), [
    'selfhosted.social',
    'small.example',
  ]);
  assert.equal(normalisePdsDirectory({ servers: 'nope' }), null);
});

test('filtering is explicit and never invents a match', () => {
  const entries = normalisePdsDirectory({ servers: [rawEntry] }).entries;
  assert.equal(filterPdsEntries(entries, '').length, 1);
  assert.equal(filterPdsEntries(entries, 'selfhosted')[0]?.host, 'selfhosted.social');
  assert.equal(filterPdsEntries(entries, 'United States')[0]?.host, 'selfhosted.social');
  assert.equal(filterPdsEntries(entries, 'bluesky-pds')[0]?.host, 'selfhosted.social');
  assert.equal(filterPdsEntries(entries, 'nowhere.example').length, 0);
});

test('copy states what the directory is and what a failure means', () => {
  assert.equal(PDS_DIRECTORY_API, 'https://openpds.tijs.org/api/servers');
  assert.match(directoryCopy('ok'), /not a health check/i.test(directoryCopy('ok')) ? /not a health check/i : /third-party/);
  assert.match(directoryCopy('unavailable'), /could not be reached/);
  assert.match(directoryCopy('invalid'), /unexpected response/);
  for (const state of ['idle', 'loading', 'ok', 'unavailable', 'invalid']) {
    assert.ok(directoryCopy(state).length > 20);
  }
});
