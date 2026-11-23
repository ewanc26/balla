import test from 'node:test';
import assert from 'node:assert/strict';
import { probeAccount, ACCOUNT_PREFLIGHT_COPY } from '../src/lib/accountPreflight.ts';

const DID = 'did:plc:3434wfandtk52wlqq4u5g72a';
const HANDLE = 'selfhosted.social';
const PDS = 'https://selfhosted.social';
const WELL_KNOWN = `${PDS}/.well-known/atproto-did`;
const RESOLVER = `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${HANDLE}`;
const DID_DOC = `https://plc.directory/${DID}`;
const DESCRIBE = `${PDS}/xrpc/com.atproto.server.describeServer`;
const PROTECTED = `${PDS}/.well-known/oauth-protected-resource`;
const AS_METADATA = `${PDS}/.well-known/oauth-authorization-server`;

const didDocument = {
  service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }],
};
const serverDescription = { did: 'did:web:selfhosted.social', availableUserDomains: ['selfhosted.social'] };
const protectedResource = { resource: PDS, authorization_servers: [PDS] };
const authorizationServer = {
  issuer: PDS,
  authorization_endpoint: `${PDS}/oauth/authorize`,
  token_endpoint: `${PDS}/oauth/token`,
};

function harness(routes) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const route = routes[url];
    if (!route) return new Response('{}', { status: 404 });
    return new Response(route.body ?? '{}', { status: route.status ?? 200 });
  };
  return { fetchImpl, calls };
}

test('the copy says a public check is not a login or a grant', () => {
  assert.match(ACCOUNT_PREFLIGHT_COPY.detail, /does not sign you in/);
  assert.match(ACCOUNT_PREFLIGHT_COPY.limits, /does not grant any scope/);
  assert.match(ACCOUNT_PREFLIGHT_COPY.limits, /new authorisation/);
});

test('a handle on an independent PDS passes every public check', async () => {
  const { fetchImpl, calls } = harness({
    [WELL_KNOWN]: { body: DID },
    [DID_DOC]: { body: JSON.stringify(didDocument) },
    [DESCRIBE]: { body: JSON.stringify(serverDescription) },
    [PROTECTED]: { body: JSON.stringify(protectedResource) },
    [AS_METADATA]: { body: JSON.stringify(authorizationServer) },
  });
  const result = await probeAccount(HANDLE, { fetchImpl });

  assert.equal(result.state, 'ok');
  assert.equal(result.source, 'well-known');
  assert.equal(result.did, DID);
  assert.equal(result.pds, PDS);
  assert.equal(result.authorizationServer, PDS);
  assert.equal(result.facts?.did, serverDescription.did);
  assert.deepEqual(calls.map((call) => call.url), [WELL_KNOWN, DID_DOC, DESCRIBE, PROTECTED, AS_METADATA]);
  assert.deepEqual(calls[0].init, { headers: { Accept: 'application/json' } });
});

test('a DNS-only handle falls back to the configured public resolver', async () => {
  const { fetchImpl, calls } = harness({
    [WELL_KNOWN]: { status: 404 },
    [RESOLVER]: { body: JSON.stringify({ did: DID }) },
    [DID_DOC]: { body: JSON.stringify(didDocument) },
    [DESCRIBE]: { body: JSON.stringify(serverDescription) },
    [PROTECTED]: { body: JSON.stringify(protectedResource) },
    [AS_METADATA]: { body: JSON.stringify(authorizationServer) },
  });
  const result = await probeAccount(HANDLE, { fetchImpl });

  assert.equal(result.state, 'ok');
  assert.equal(result.source, 'resolver');
  assert.ok(calls.some((call) => call.url === RESOLVER));
});

test('a did:web identity is read from its own well-known document', async () => {
  const webDid = 'did:web:alice.example.com';
  const webDoc = 'https://alice.example.com/.well-known/did.json';
  const { fetchImpl, calls } = harness({
    [webDoc]: { body: JSON.stringify(didDocument) },
    [DESCRIBE]: { body: JSON.stringify(serverDescription) },
    [PROTECTED]: { body: JSON.stringify(protectedResource) },
    [AS_METADATA]: { body: JSON.stringify(authorizationServer) },
  });
  const result = await probeAccount(webDid, { fetchImpl });

  assert.equal(result.state, 'ok');
  assert.equal(result.source, 'did');
  assert.equal(calls[0].url, webDoc);
});

test('missing PDS, an invalid description and absent OAuth metadata stay distinct', async () => {
  const noPds = harness({ [DID_DOC]: { body: JSON.stringify({ service: [] }) } });
  assert.equal((await probeAccount(DID, { fetchImpl: noPds.fetchImpl })).state, 'no-pds');

  const badServer = harness({
    [DID_DOC]: { body: JSON.stringify(didDocument) },
    [DESCRIBE]: { body: JSON.stringify({ message: 'private provider detail' }) },
  });
  const incompatible = await probeAccount(DID, { fetchImpl: badServer.fetchImpl });
  assert.equal(incompatible.state, 'incompatible');
  assert.ok(!JSON.stringify(incompatible).includes('private provider detail'));

  const noOauth = harness({
    [DID_DOC]: { body: JSON.stringify(didDocument) },
    [DESCRIBE]: { body: JSON.stringify(serverDescription) },
    [PROTECTED]: { body: '{}' },
  });
  const noOauthResult = await probeAccount(DID, { fetchImpl: noOauth.fetchImpl });
  assert.equal(noOauthResult.state, 'no-oauth');
  assert.match(noOauthResult.detail, /authorization server/);

  const badAs = harness({
    [DID_DOC]: { body: JSON.stringify(didDocument) },
    [DESCRIBE]: { body: JSON.stringify(serverDescription) },
    [PROTECTED]: { body: JSON.stringify(protectedResource) },
    [AS_METADATA]: { body: JSON.stringify({ issuer: 'https://other.example' }) },
  });
  assert.match((await probeAccount(DID, { fetchImpl: badAs.fetchImpl })).detail, /authorization server metadata/);
});

test('a host without an account is rejected before any network call', async () => {
  const { fetchImpl, calls } = harness({});
  const result = await probeAccount('https://pds.example.com', { fetchImpl });

  assert.equal(result.state, 'invalid');
  assert.match(result.detail, /Check a host/);
  assert.equal(calls.length, 0);
});
