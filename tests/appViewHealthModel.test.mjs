import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APPVIEW_HEALTH_AUDIENCE,
  APPVIEW_HEALTH_COPY,
  APPVIEW_HEALTH_DID,
  appViewHealthText,
  probeAppViewHealth,
} from '../src/lib/appViewHealth.ts';
import { DEFAULT_SERVICES } from '../src/lib/servicesModel.ts';

const DOCUMENT_URL = 'https://api.bsky.app/.well-known/did.json';
const PROFILE_URL = 'https://api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=did%3Aplc%3Aabc123';
const ACTOR = 'did:plc:abc123';

const document = {
  service: [{ id: '#bsky_appview', type: 'BskyAppView', serviceEndpoint: 'https://api.bsky.app' }],
};

function harness(routes) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const route = routes[url];
    if (!route) throw new Error(`unexpected URL ${url}`);
    return new Response(route.body ?? '{}', { status: route.status ?? 200 });
  };
  let tick = 0;
  return { fetchImpl, calls, now: () => (tick += 10) };
}

test('the health surface is bound to the grant, not a configurable provider', () => {
  assert.equal(APPVIEW_HEALTH_DID, DEFAULT_SERVICES.appviewDid);
  assert.equal(APPVIEW_HEALTH_AUDIENCE, DEFAULT_SERVICES.appviewAudience);
  assert.match(APPVIEW_HEALTH_COPY.limits, /sync lag/);
  assert.match(APPVIEW_HEALTH_COPY.limits, /failover/);
  assert.match(APPVIEW_HEALTH_COPY.limits, /#99 remains open/);
});

test('a signed-in check measures the document and the public profile canary', async () => {
  const { fetchImpl, calls, now } = harness({
    [DOCUMENT_URL]: { body: JSON.stringify(document) },
    [PROFILE_URL]: { body: JSON.stringify({ did: ACTOR }) },
  });
  const result = await probeAppViewHealth({ actorDid: ACTOR, fetchImpl, now });

  assert.equal(result.state, 'ok');
  assert.equal(result.status, 200);
  assert.equal(result.endpoint, 'https://api.bsky.app');
  assert.equal(result.documentLatencyMs, 10);
  assert.equal(result.profileLatencyMs, 10);
  assert.deepEqual(calls.map((call) => call.url), [DOCUMENT_URL, PROFILE_URL]);
  assert.deepEqual(calls[0].init, { headers: { Accept: 'application/json' } });
  assert.match(appViewHealthText(result), /OK · HTTP 200 · DID document 10 ms · profile read 10 ms/);
});

test('a signed-out check reports only the public document read', async () => {
  const { fetchImpl, calls, now } = harness({ [DOCUMENT_URL]: { body: JSON.stringify(document) } });
  const result = await probeAppViewHealth({ actorDid: null, fetchImpl, now });

  assert.equal(result.state, 'ok');
  assert.equal(result.profileLatencyMs, null);
  assert.match(result.detail, /Sign in for the profile canary/);
  assert.equal(calls.length, 1);
  assert.doesNotMatch(appViewHealthText(result), /profile read/);
});

test('a missing AppView advertisement is reported without a profile call', async () => {
  const { fetchImpl, calls, now } = harness({
    [DOCUMENT_URL]: { body: JSON.stringify({ service: [{ id: '#other', serviceEndpoint: 'https://other.test' }] }) },
  });
  const result = await probeAppViewHealth({ actorDid: ACTOR, fetchImpl, now });

  assert.equal(result.state, 'unavailable');
  assert.match(result.detail, /does not advertise #bsky_appview/);
  assert.equal(calls.length, 1);
});

test('a provider error is classified from status alone, never from prose', async () => {
  const { fetchImpl, calls, now } = harness({
    [DOCUMENT_URL]: { status: 503, body: JSON.stringify({ message: 'private provider detail' }) },
  });
  const result = await probeAppViewHealth({ actorDid: ACTOR, fetchImpl, now });

  assert.equal(result.state, 'unavailable');
  assert.equal(result.status, 503);
  assert.match(result.detail, /server error/);
  assert.ok(!JSON.stringify(result).includes('private provider detail'));
  assert.equal(calls.length, 1);
});

test('a malformed document or profile cannot be reported as healthy', async () => {
  const brokenDocument = harness({ [DOCUMENT_URL]: { body: 'not json' } });
  const broken = await probeAppViewHealth({ actorDid: ACTOR, fetchImpl: brokenDocument.fetchImpl, now: brokenDocument.now });
  assert.equal(broken.state, 'unavailable');
  assert.match(broken.detail, /was not JSON/);
  assert.equal(brokenDocument.calls.length, 1);

  const wrongProfile = harness({
    [DOCUMENT_URL]: { body: JSON.stringify(document) },
    [PROFILE_URL]: { body: JSON.stringify({ did: 'did:plc:someone-else' }) },
  });
  const mismatch = await probeAppViewHealth({ actorDid: ACTOR, fetchImpl: wrongProfile.fetchImpl, now: wrongProfile.now });
  assert.equal(mismatch.state, 'unavailable');
  assert.match(mismatch.detail, /different DID/);
});

test('an unsupported DID fails before any network call', async () => {
  const { fetchImpl, calls, now } = harness({});
  const result = await probeAppViewHealth({ did: 'did:plc:abc', fetchImpl, now });

  assert.equal(result.state, 'invalid');
  assert.equal(result.status, null);
  assert.equal(calls.length, 0);
  assert.equal(appViewHealthText(null), 'Not checked');
  assert.equal(appViewHealthText(result), result.detail);
});
