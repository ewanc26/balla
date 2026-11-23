import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describeFailure, readWithRetry } from '../src/lib/reliability.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const reliability = read('../src/lib/reliability.ts');
const features = read('../site/features.html');
const home = read('../site/index.html');
const compliance = read('../docs/bluesky-compliance.md');
const changelog = read('../CHANGELOG.md');

function xrpcError(status, headers) {
  const err = new Error('request failed');
  err.status = status;
  if (headers) err.headers = headers;
  return err;
}

test('shared failure copy names no provider, even for generic hosts', () => {
  assert.doesNotMatch(reliability, /Bluesky/);
  for (const err of [xrpcError(429), xrpcError(1), xrpcError(500)]) {
    assert.doesNotMatch(describeFailure(err, 'fallback'), /Bluesky/i);
  }
  assert.match(describeFailure(xrpcError(1), 'fallback'), /Could not reach the service/);
  assert.match(describeFailure(xrpcError(500), 'fallback'), /The service is having trouble/);
});

test('a long advertised wait is instruction to the person, never an early auto-retry', async () => {
  let calls = 0;
  const delays = [];
  await assert.rejects(
    readWithRetry(
      async () => {
        calls += 1;
        throw xrpcError(429, { 'retry-after': '60' });
      },
      { attempts: 5, delay: async (ms) => { delays.push(ms); } }
    )
  );
  assert.equal(calls, 1);
  assert.deepEqual(delays, []);
  assert.match(
    describeFailure(xrpcError(429, { 'retry-after': '60' }), 'fallback'),
    /Wait about 60 seconds before trying again/
  );
});

test('the public site no longer says the shipped hydration-source label is unimplemented', () => {
  assert.doesNotMatch(features, /A primary\/mirror picker, failover, a hydration-source label and per-function routing are not implemented/);
  assert.match(features, /names the grant-bound AppView as its hydration source/);
  assert.doesNotMatch(home, /<ul><li>Error-state polish<\/li><\/ul>/);
  assert.match(home, /Truthful failures and bounded retries/);
  assert.match(home, /AppView health and hydration source/);
});

test('the service-check fact row includes the shipped labeler endpoint', () => {
  assert.match(features, /resolver, AppView, chat, video and labeler endpoints/);
});

test('the release documents honest failure states with no new scope', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.57.0');
  assert.equal(appJson.expo.version, '0.57.0');
  assert.match(changelog, /^## 0\.57\.0$/m);
  assert.match(changelog, /instead of retrying early/);
  assert.match(changelog, /scope count remains 111/);
  assert.match(compliance, /Balla never retries earlier than the wait it describes/);
  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 112);
});
