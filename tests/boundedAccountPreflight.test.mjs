import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { probeAccount } from '../src/lib/accountPreflight.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

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
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code', 'refresh_token'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'],
  scopes_supported: ['atproto'],
  authorization_response_iss_parameter_supported: true,
  pushed_authorization_request_endpoint: `${PDS}/oauth/par`,
  dpop_signing_alg_values_supported: ['ES256'],
  client_id_metadata_document_supported: true,
};

const goodRoutes = {
  [DID_DOC]: { body: JSON.stringify(didDocument) },
  [DESCRIBE]: { body: JSON.stringify(serverDescription) },
  [PROTECTED]: { body: JSON.stringify(protectedResource) },
  [AS_METADATA]: { body: JSON.stringify(authorizationServer) },
};

/**
 * An injected clock. Every read arms its own deadline, so the test settles the
 * successful reads first and then fires only the latest (hung) deadline.
 */
function clock() {
  const callbacks = [];
  return {
    timeoutMs: 25,
    setTimeoutImpl: (fn) => {
      callbacks.push(fn);
      return callbacks.length;
    },
    clearTimeoutImpl: () => {},
    settle: async () => {
      await new Promise((resolve) => setImmediate(resolve));
    },
    armLast: () => {
      const fire = callbacks[callbacks.length - 1];
      assert.ok(fire, 'the deadline is armed before the fetch starts');
      fire();
    },
  };
}

function fetchWith(routes, observed) {
  return async (url, init) => {
    if (observed && Object.prototype.hasOwnProperty.call(routes, url)) {
      observed.push({ url, signal: init.signal });
    }
    const route = routes[url];
    if (!route) return new Response('{}', { status: 404 });
    if (route.hang) return new Promise(() => {});
    return new Response(route.body ?? '{}', { status: route.status ?? 200 });
  };
}

test('a hung DID directory read is cancelled and fails closed', async () => {
  const timer = clock();
  const observed = [];
  const routes = { ...goodRoutes, [DID_DOC]: { hang: true } };
  const pending = probeAccount(DID, {
    fetchImpl: fetchWith(routes, observed),
    ...timer,
  });
  await timer.settle();
  timer.armLast();
  const result = await pending;
  assert.equal(result.state, 'unresolved');
  assert.equal(result.did, DID);
  assert.equal(observed.length, 1);
  assert.equal(observed[0].signal.aborted, true, 'the real request is cancelled');
});

test('a hung well-known file falls through to the configured resolver', async () => {
  const timer = clock();
  const routes = {
    ...goodRoutes,
    [WELL_KNOWN]: { hang: true },
    [RESOLVER]: { body: JSON.stringify({ did: DID }) },
  };
  const pending = probeAccount(HANDLE, { fetchImpl: fetchWith(routes), ...timer });
  await timer.settle();
  timer.armLast();
  const result = await pending;
  assert.equal(result.state, 'ok');
  assert.equal(result.source, 'resolver', 'a timeout is an unavailable source, not a failed login');
});

test('a hung describeServer is reported as incompatible, never a spinner', async () => {
  const timer = clock();
  const observed = [];
  const routes = { ...goodRoutes, [DESCRIBE]: { hang: true } };
  const pending = probeAccount(DID, {
    fetchImpl: fetchWith(routes, observed),
    ...timer,
  });
  await timer.settle();
  timer.armLast();
  const result = await pending;
  assert.equal(result.state, 'incompatible');
  assert.equal(result.did, DID);
  assert.equal(result.pds, PDS);
  const describeCall = observed.find((call) => call.url === DESCRIBE);
  assert.equal(describeCall?.signal.aborted, true);
});

test('a hung OAuth metadata read keeps the no-oauth state and fixed copy', async () => {
  const timer = clock();
  const routes = { ...goodRoutes, [AS_METADATA]: { hang: true } };
  const pending = probeAccount(DID, { fetchImpl: fetchWith(routes), ...timer });
  await timer.settle();
  timer.armLast();
  const result = await pending;
  assert.equal(result.state, 'no-oauth');
  assert.match(result.detail, /metadata could not be read/);
  assert.ok(!JSON.stringify(result).includes('provider said'));
});

test('every pre-auth read uses the one bounded core and reads no provider prose', () => {
  const source = read('../src/lib/accountPreflight.ts');
  assert.match(source, /readBoundedPublic\(url,/);
  assert.match(source, /parse: \(response\) => response\.text\(\)/);
  assert.match(source, /parse: \(response\) => response\.json\(\)/);
  assert.doesNotMatch(source, /await fetch\(/);
  assert.doesNotMatch(source, /fetchImpl\(url/);
  assert.doesNotMatch(source, /\.message\b/);
  assert.doesNotMatch(source, /console\./);
});

test('v0.95.0 records the bounded pre-flight reads with parity and unchanged metadata', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.97.0');
  assert.equal(appJson.expo.version, '0.97.0');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.97\.0<\/string>/);
  }

  const changelog = read('../CHANGELOG.md');
  const section = changelog.slice(changelog.indexOf('## 0.95.0'), changelog.indexOf('## 0.93.0'));
  assert.match(section, /pre-auth public reads are now bounded/);
  assert.match(section, /#100\/#97, partial/);
  assert.match(section, /scope count stays 112/);

  const docs = read('../docs/bluesky-compliance.md');
  assert.match(docs, /Pre-flight reads now share the one bounded public fetch core/);
  const site = read('../site/features.html');
  assert.match(site, /Pre-flight account checks are bounded too/);

  const metadata = read('../oauth-client-metadata.json');
  assert.equal(
    createHash('sha256').update(metadata).digest('hex'),
    '62ed29fa0518cce5ba4fc6290459cde40e4e2b7bf81250216a8c2b48a671eb29',
  );
  assert.equal(JSON.parse(metadata).scope.split(/\s+/).filter(Boolean).length, 112);
});
