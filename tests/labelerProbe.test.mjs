import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LABELER_PROBE_URI,
  checkingLabelerProbe,
  labelerEndpointFromDocument,
  labelerProbeText,
  probeLabeler,
} from '../src/lib/labelerProbe.ts';

const DID = 'did:plc:thirdpartylabeler';
const ENDPOINT = 'https://labels.example.org';

const document = {
  service: [
    { id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example.org' },
    { id: '#atproto_labeler', type: 'AtprotoLabeler', serviceEndpoint: ENDPOINT },
  ],
};

function jsonResponse(status, payload, onJson = () => {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      onJson();
      return payload;
    },
  };
}

test('a labeler endpoint comes only from the DID document', () => {
  assert.equal(labelerEndpointFromDocument(document), ENDPOINT);
  assert.equal(
    labelerEndpointFromDocument({
      service: [{ id: '#atproto_pds', serviceEndpoint: 'https://pds.example.org' }],
    }),
    null
  );
  assert.equal(labelerEndpointFromDocument(null), null);
});

test('a public canary query proves the advertised labeler is reachable', async () => {
  const calls = [];
  const result = await probeLabeler(DID, {
    resolveDocument: async (did) => {
      assert.equal(did, DID);
      return document;
    },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, { labels: [] });
    },
  });

  assert.equal(result.state, 'ok');
  assert.equal(result.status, 200);
  assert.equal(result.endpoint, ENDPOINT);
  assert.equal(typeof result.latencyMs, 'number');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /^https:\/\/labels\.example\.org\/xrpc\/com\.atproto\.label\.queryLabels\?/);
  assert.ok(calls[0].url.includes(encodeURIComponent(LABELER_PROBE_URI)));
  assert.equal(calls[0].init.headers.Accept, 'application/json');
  assert.match(labelerProbeText(result), /reachable · HTTP 200/);
});

test('invalid DIDs are rejected without a resolver or network call', async () => {
  let called = false;
  const result = await probeLabeler('labeler.example', {
    resolveDocument: async () => {
      called = true;
      return document;
    },
    fetchImpl: async () => {
      called = true;
      return jsonResponse(200, { labels: [] });
    },
  });
  assert.equal(result.state, 'invalid');
  assert.equal(result.status, null);
  assert.equal(called, false);
  assert.match(labelerProbeText(result), /not a valid DID/);
});

test('a missing DID document or labeler service is not called reachability', async () => {
  const missing = await probeLabeler(DID, {
    resolveDocument: async () => null,
    fetchImpl: async () => {
      assert.fail('no network call without a document');
    },
  });
  assert.equal(missing.state, 'unavailable');
  assert.match(missing.detail, /Could not read the labeler DID document/);

  const absent = await probeLabeler(DID, {
    resolveDocument: async () => ({ service: [] }),
    fetchImpl: async () => {
      assert.fail('no network call without a labeler endpoint');
    },
  });
  assert.equal(absent.state, 'unavailable');
  assert.match(absent.detail, /No labeler service in the DID document/);
});

test('a blocked or failed network request is reported as unmeasured', async () => {
  const result = await probeLabeler(DID, {
    resolveDocument: async () => document,
    fetchImpl: async () => {
      throw new Error('CORS blocked');
    },
  });
  assert.equal(result.state, 'unavailable');
  assert.equal(result.status, null);
  assert.match(result.detail, /Could not reach the public label endpoint from this device/);
  assert.match(labelerProbeText(result), /not reachable from this device/);
});

test('an error response is classified from status only, never response text', async () => {
  let jsonReads = 0;
  const result = await probeLabeler(DID, {
    resolveDocument: async () => document,
    fetchImpl: async () =>
      jsonResponse(503, { message: 'private provider detail' }, () => {
        jsonReads += 1;
      }),
  });
  assert.equal(result.state, 'unavailable');
  assert.equal(result.status, 503);
  assert.equal(jsonReads, 0);
  assert.ok(!JSON.stringify(result).includes('private provider detail'));
  assert.match(labelerProbeText(result), /HTTP 503/);
});

test('a successful response must still have the structured labels array', async () => {
  const malformed = await probeLabeler(DID, {
    resolveDocument: async () => document,
    fetchImpl: async () => jsonResponse(200, { unexpected: true }),
  });
  assert.equal(malformed.state, 'unavailable');
  assert.match(malformed.detail, /no labels array/);

  const valid = await probeLabeler(DID, {
    resolveDocument: async () => document,
    fetchImpl: async () => jsonResponse(200, { labels: [{ val: 'spam' }] }),
  });
  assert.equal(valid.state, 'ok');
});

test('UI copy distinguishes a pending check from a real result', () => {
  const checking = checkingLabelerProbe();
  assert.equal(checking.state, 'checking');
  assert.match(labelerProbeText(checking), /checking/);
  assert.match(labelerProbeText(null), /not checked yet/);
});
