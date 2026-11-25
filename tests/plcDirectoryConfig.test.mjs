import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { probePlcDirectory } from '../src/lib/servicesProbe.ts';
import { plcDocumentUrl } from '../src/lib/serviceHosts.ts';
import { plcDirectoryUrl, forgetPlcDidDocuments } from '../src/lib/identityModel.ts';
import { probeAccount } from '../src/lib/accountPreflight.ts';
import { DEFAULT_SERVICES } from '../src/lib/servicesModel.ts';

const CANARY = DEFAULT_SERVICES.labelerDid;
const CUSTOM = 'https://plc.example';
const screen = readFileSync(new URL('../src/screens/ServicesScreen.tsx', import.meta.url), 'utf8');
const config = readFileSync(new URL('../src/lib/servicesConfig.ts', import.meta.url), 'utf8');
const resolver = readFileSync(new URL('../src/lib/identityResolver.ts', import.meta.url), 'utf8');
const exporter = readFileSync(new URL('../src/lib/servicesExportModel.ts', import.meta.url), 'utf8');
const identityCache = readFileSync(new URL('../src/lib/identityCache.ts', import.meta.url), 'utf8');

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

test('a directory change forgets cached did:plc documents but keeps handles and did:web', () => {
  const now = Date.now();
  const plcDoc = { id: 'did:plc:abc123' };
  const webDoc = { id: 'did:web:example.com' };
  const entries = [
    { did: 'did:plc:abc123', handle: 'alice.example', didDoc: plcDoc, source: 'plc', updatedAt: now },
    { did: 'did:web:example.com', handle: null, didDoc: webDoc, source: 'web', updatedAt: now },
    { did: 'did:plc:offline', handle: 'bob.example', didDoc: null, source: null, updatedAt: now },
  ];

  const next = forgetPlcDidDocuments(entries);
  assert.notEqual(next, entries, 'a real change returns a new list');
  assert.deepEqual(next[0], { did: 'did:plc:abc123', handle: 'alice.example', didDoc: null, source: null, updatedAt: now });
  assert.equal(next[0].handle, 'alice.example', 'the offline handle mapping survives');
  assert.equal(next[1].didDoc, webDoc, 'did:web documents are unaffected');
  assert.equal(next[2].didDoc, null);

  assert.equal(forgetPlcDidDocuments(next), next, 'a no-op keeps the same list');
});

test('both DID-document URL helpers honour a configured https directory', () => {
  // The two helpers keep their existing path-encoding behaviour; only the host
  // becomes configurable, so no runtime request shape changes.
  assert.equal(plcDocumentUrl(CANARY, CUSTOM), `${CUSTOM}/${CANARY}`);
  assert.equal(plcDirectoryUrl(CANARY, CUSTOM), `${CUSTOM}/${encodeURIComponent(CANARY)}`);
  assert.equal(plcDocumentUrl(CANARY), `${DEFAULT_SERVICES.plcDirectory}/${CANARY}`);
  assert.equal(plcDirectoryUrl(CANARY), `${DEFAULT_SERVICES.plcDirectory}/${encodeURIComponent(CANARY)}`);
  // A persisted value with a path, query or credentials can never redirect the read.
  assert.equal(plcDocumentUrl(CANARY, 'https://plc.example/path'), null);
  assert.equal(plcDirectoryUrl(CANARY, 'http://plc.example'), null);
  assert.equal(plcDocumentUrl('did:web:example.com', CUSTOM), null);
});

test('the directory probe reads a known DID document and checks its structured id', async () => {
  const calls = [];
  const result = await probePlcDirectory(CUSTOM, {
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ id: CANARY, alsoKnownAs: ['at://verbose prose'] });
    },
  });

  assert.equal(result.state, 'ok');
  assert.equal(result.endpoint, CUSTOM);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${CUSTOM}/${CANARY}`);
  assert.deepEqual(calls[0].init.headers, { Accept: 'application/json' });
  assert.doesNotMatch(JSON.stringify(calls[0].init.headers), /authorization/i);
  assert.doesNotMatch(result.detail, /verbose prose/);
});

test('the directory probe classifies real failures without reading provider prose', async () => {
  const invalid = await probePlcDirectory('https://plc.example/path', {
    fetchImpl: async () => jsonResponse({}),
  });
  assert.equal(invalid.state, 'invalid');
  assert.match(invalid.detail, /https host/);

  const wrongDocument = await probePlcDirectory(CUSTOM, {
    fetchImpl: async () => jsonResponse({ id: 'did:plc:someoneelse', error_message: 'secret provider prose' }),
  });
  assert.equal(wrongDocument.state, 'unavailable');
  assert.doesNotMatch(wrongDocument.detail, /secret provider prose/);

  const notJson = await probePlcDirectory(CUSTOM, {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => { throw new Error('bad json'); } }),
  });
  assert.equal(notJson.state, 'unavailable');
  assert.match(notJson.detail, /not JSON/);

  const unreachable = await probePlcDirectory(CUSTOM, {
    fetchImpl: async () => { throw new Error('offline'); },
  });
  assert.equal(unreachable.state, 'unavailable');
  assert.equal(unreachable.status, null);
});

test('account pre-flight reads the DID document from the configured directory', async () => {
  const DID = 'did:plc:3434wfandtk52wlqq4u5g72a';
  const PDS = 'https://selfhosted.social';
  const calls = [];
  const routes = {
    [`${CUSTOM}/${DID}`]: JSON.stringify({
      service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }],
    }),
    [`${PDS}/xrpc/com.atproto.server.describeServer`]: JSON.stringify({ did: `did:web:selfhosted.social` }),
    [`${PDS}/.well-known/oauth-protected-resource`]: JSON.stringify({ resource: PDS, authorization_servers: [PDS] }),
    [`${PDS}/.well-known/oauth-authorization-server`]: JSON.stringify({
      issuer: PDS,
      authorization_endpoint: `${PDS}/oauth/authorize`,
      token_endpoint: `${PDS}/oauth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['atproto'],
      authorization_response_iss_parameter_supported: true,
      pushed_authorization_request_endpoint: `${PDS}/oauth/par`,
      dpop_signing_alg_values_supported: ['ES256'],
      client_id_metadata_document_supported: true,
    }),
  };
  const result = await probeAccount(DID, {
    plcDirectory: CUSTOM,
    fetchImpl: async (url) => {
      calls.push(url);
      return new Response(routes[url] ?? '{}', { status: routes[url] ? 200 : 404 });
    },
  });

  assert.equal(result.state, 'ok');
  assert.equal(result.did, DID);
  assert.equal(result.pds, PDS);
  assert.equal(calls[0], `${CUSTOM}/${DID}`);
  assert.ok(!calls.some((url) => url.startsWith(DEFAULT_SERVICES.plcDirectory)), 'the compiled default must not be read');
});

test('a directory change invalidates only cached did:plc documents', () => {
  assert.match(identityCache, /forgetPlcDidDocuments/);
  assert.match(identityCache, /forgetDirectoryDidDocuments\(\)/);
  assert.match(config, /forgetDirectoryDidDocuments/);
  assert.match(config, /effectivePlcDirectory\(after\) !== before/);
  assert.match(config, /if \(effectivePlcDirectory\(after\) !== before\) await forgetDirectoryDidDocuments\(\);/);
});

test('identity resolution, the UI and the export all use the configured directory', () => {
  assert.match(resolver, /plcDirectoryUrl\(did, await getPlcDirectoryEndpoint\(\)\)/);
  assert.match(config, /getPlcDirectoryEndpoint/);
  assert.match(config, /setPlcDirectoryEndpoint/);
  assert.match(exporter, /effectivePlcDirectory/);
  assert.match(exporter, /usingDefaultPlcDirectory/);
  assert.match(screen, /Save directory/);
  assert.match(screen, /Use default/);
  assert.match(screen, /Test directory/);
  assert.match(screen, /setPlcDirectoryEndpoint\(valid\)/);
  assert.match(screen, /probePlcDirectory\(await getPlcDirectoryEndpoint\(\)\)/);
  assert.match(screen, /takes effect on the next read/);
  assert.equal((screen.match(/<SettingSwitch\b/g) || []).length, 1);
  assert.match(screen, /label="Places search"/);
  assert.doesNotMatch(screen, /onPress=\{\(\) => \{\}\}/);
});
