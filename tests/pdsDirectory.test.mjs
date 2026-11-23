import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPdsDirectory } from '../src/lib/pdsDirectory.ts';

const payload = {
  meta: { updated_at: '2026-11-23T03:18:33.287Z', total_open: 164 },
  servers: [
    {
      url: 'https://selfhosted.social',
      did: 'did:web:selfhosted.social',
      is_open: true,
      user_count: 1000,
      country_name: 'United States',
      error_at: 'a provider error note that must not be retained',
    },
  ],
};

function response(body, ok = true) {
  return {
    ok,
    json: async () => body,
  };
}

test('a good directory response becomes a usable cached snapshot', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return response(payload);
  };
  const first = await loadPdsDirectory(fetchImpl, true);
  assert.equal(first.state, 'ok');
  assert.equal(first.directory?.entries[0]?.host, 'selfhosted.social');
  assert.equal(JSON.stringify(first).includes('provider error note'), false);

  const second = await loadPdsDirectory(fetchImpl, false);
  assert.equal(second.state, 'ok');
  assert.equal(calls, 1);

  await loadPdsDirectory(fetchImpl, true);
  assert.equal(calls, 2);
});

test('a fresh failure is reported without replacing a good snapshot', async () => {
  await loadPdsDirectory(async () => response(payload), true);
  const failed = await loadPdsDirectory(async () => response({}, false), true);
  assert.equal(failed.state, 'unavailable');
  assert.equal(failed.directory, null);
});

test('bad JSON, empty lists and network failures are classified without message text', async () => {
  const badJson = await loadPdsDirectory(
    async () => ({ ok: true, json: async () => { throw new Error('secret provider text'); } }),
    true,
  );
  assert.equal(badJson.state, 'invalid');
  assert.equal(JSON.stringify(badJson).includes('secret provider text'), false);

  const empty = await loadPdsDirectory(async () => response({ servers: [] }), true);
  assert.equal(empty.state, 'invalid');

  const closedOnly = await loadPdsDirectory(
    async () => response({ servers: [{ url: 'https://x.example', is_open: false }] }),
    true,
  );
  assert.equal(closedOnly.state, 'invalid');

  const offline = await loadPdsDirectory(async () => { throw new Error('offline detail'); }, true);
  assert.equal(offline.state, 'unavailable');
  assert.equal(JSON.stringify(offline).includes('offline detail'), false);
});
