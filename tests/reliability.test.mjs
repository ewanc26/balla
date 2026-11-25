import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_BACKOFF_MS,
  MAX_READ_ATTEMPTS,
  classifyFailure,
  describeFailure,
  readWithRetry,
  retryAfterMsFrom,
  withOptimisticRollback,
} from '../src/lib/reliability.ts';

function xrpcError(status, options = {}) {
  const err = new Error(options.message || 'request failed');
  err.status = status;
  if (options.headers) err.headers = options.headers;
  return err;
}

test('rate limits, offline errors, auth failures and server errors are distinguished', () => {
  assert.equal(classifyFailure(xrpcError(429)), 'rate-limited');
  assert.equal(classifyFailure(xrpcError(1)), 'offline');
  assert.equal(classifyFailure(xrpcError(401)), 'auth-expired');
  assert.equal(classifyFailure(xrpcError(403)), 'auth-expired');
  assert.equal(classifyFailure(xrpcError(500)), 'server');
  assert.equal(classifyFailure(xrpcError(503)), 'server');
  assert.equal(classifyFailure({ error: 'NetworkError' }), 'offline');
  assert.equal(classifyFailure({ error: 'InsufficientScope' }), 'auth-expired');
  assert.equal(classifyFailure({ error: 'RateLimitExceeded' }), 'rate-limited');
  assert.equal(classifyFailure(new Error('something odd')), 'unknown');
});

test('retry-after is read from seconds, HTTP dates and header maps', () => {
  assert.equal(retryAfterMsFrom({ headers: { 'retry-after': '12' } }), 12000);
  assert.equal(retryAfterMsFrom({ headers: { get: (key) => (key === 'Retry-After' ? '2' : null) } }), 2000);
  assert.equal(
    retryAfterMsFrom({ headers: { 'retry-after': 'Wed, 21 Oct 2015 07:29:00 GMT' } }, Date.parse('Wed, 21 Oct 2015 07:28:48 GMT')),
    12000
  );
  assert.equal(retryAfterMsFrom({ headers: { 'retry-after': 'garbage' } }), null);
  assert.equal(retryAfterMsFrom(new Error('no headers')), null);
});

test('descriptions tell the truth, include rate-limit waits and name no provider', () => {
  assert.match(
    describeFailure(xrpcError(429, { headers: { 'retry-after': '9' } }), 'fallback'),
    /Wait about 9 seconds before trying again/
  );
  assert.match(describeFailure(xrpcError(1), 'fallback'), /Check your connection/);
  assert.match(describeFailure(xrpcError(401), 'fallback'), /Sign out, sign in again/);
  assert.match(describeFailure(xrpcError(500), 'fallback'), /service is having trouble/);
  assert.equal(describeFailure(new Error('weird'), 'Custom fallback'), 'Custom fallback');
  for (const err of [xrpcError(429), xrpcError(1), xrpcError(500)]) {
    assert.doesNotMatch(describeFailure(err, 'fallback'), /Bluesky/i);
  }
});

test('reads retry transient failures with bounded exponential backoff', async () => {
  const delays = [];
  let calls = 0;
  const value = await readWithRetry(
    async () => {
      calls += 1;
      if (calls < 3) throw xrpcError(503);
      return 'ok';
    },
    { delay: async (ms) => { delays.push(ms); } }
  );
  assert.equal(value, 'ok');
  assert.equal(calls, 3);
  assert.deepEqual(delays, [BASE_BACKOFF_MS, BASE_BACKOFF_MS * 2]);
});

test('a 429 with a long advertised wait stops instead of retrying too early', async () => {
  const delays = [];
  let calls = 0;
  await assert.rejects(
    readWithRetry(
      async () => {
        calls += 1;
        throw xrpcError(429, { headers: { 'retry-after': '30' } });
      },
      { attempts: 3, delay: async (ms) => { delays.push(ms); } }
    )
  );
  assert.equal(calls, 1);
  assert.deepEqual(delays, []);
});

test('a 429 with a short advertised wait is honoured exactly', async () => {
  const delays = [];
  let calls = 0;
  await assert.rejects(
    readWithRetry(
      async () => {
        calls += 1;
        throw xrpcError(429, { headers: { 'retry-after': '3' } });
      },
      { attempts: 2, delay: async (ms) => { delays.push(ms); } }
    )
  );
  assert.equal(calls, 2);
  assert.deepEqual(delays, [3000]);
});

test('auth failures are never retried and attempts stay bounded', async () => {
  let calls = 0;
  await assert.rejects(
    readWithRetry(
      async () => {
        calls += 1;
        throw xrpcError(401);
      },
      { delay: async () => {} }
    )
  );
  assert.equal(calls, 1);

  calls = 0;
  await assert.rejects(
    readWithRetry(
      async () => {
        calls += 1;
        throw xrpcError(503);
      },
      { delay: async () => {} }
    )
  );
  assert.equal(calls, MAX_READ_ATTEMPTS);
});

test('optimistic changes roll back and rethrow on failure', async () => {
  const events = [];
  await assert.rejects(
    withOptimisticRollback(
      () => events.push('apply'),
      async () => {
        events.push('request');
        throw new Error('failed');
      },
      () => events.push('rollback')
    ),
    /failed/
  );
  assert.deepEqual(events, ['apply', 'request', 'rollback']);

  events.length = 0;
  await withOptimisticRollback(
    () => events.push('apply'),
    async () => events.push('request'),
    () => events.push('rollback')
  );
  assert.deepEqual(events, ['apply', 'request']);
});
