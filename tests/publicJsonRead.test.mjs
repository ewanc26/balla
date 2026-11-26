import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fetchPublicJsonObject } from '../src/lib/publicJsonRead.ts';
import { classifyStructuredFailure } from '../src/lib/failureCopyModel.ts';
import { DEFAULT_TIMEOUT_MS } from '../src/lib/requestTimeout.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

async function rejection(promise) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected the read to reject');
}

test('a live public object is read with a JSON Accept type and an abort signal', async () => {
  const calls = [];
  const body = { records: [{ uri: 'at://alice.example/app.bsky.feed.post/abc' }], cursor: 'next' };
  const result = await fetchPublicJsonObject(
    'https://pds.example/xrpc/com.atproto.repo.listRecords',
    {
      fetchImpl: async (url, init) => {
        calls.push({ url, init });
        return { ok: true, json: async () => body };
      },
    },
  );
  assert.deepEqual(result, body);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers.Accept, 'application/json');
  assert.ok(calls[0].init.signal instanceof AbortSignal, 'the read gets an abort signal');
});

test('a custom Accept type lets DID documents share the one reader', async () => {
  let accept = null;
  const doc = { id: 'did:plc:3434wfandtk52wlqq4u5g72a' };
  const result = await fetchPublicJsonObject('https://plc.directory/did:plc:x', {
    accept: 'application/did+ld+json, application/json',
    fetchImpl: async (_url, init) => {
      accept = init.headers.Accept;
      return { ok: true, json: async () => doc };
    },
  });
  assert.deepEqual(result, doc);
  assert.match(accept, /application\/did\+ld\+json/);
});

test('a hung PDS stops at the shared deadline and cancels its request', async () => {
  let fire = null;
  let observed = null;
  const pending = fetchPublicJsonObject('https://hung.example/xrpc/com.atproto.repo.listRecords', {
    fetchImpl: (_url, init) => {
      observed = init.signal;
      return new Promise(() => {});
    },
    timeoutMs: 25,
    setTimeoutImpl: (fn) => {
      fire = fn;
      return 1;
    },
    clearTimeoutImpl: () => {},
  });
  assert.ok(fire, 'the deadline is armed before the fetch starts');
  assert.equal(observed.aborted, false);
  fire();
  assert.equal(await pending, null, 'a timeout is unavailable, not a copy-worthy event');
  assert.equal(observed.aborted, true, 'the real request is cancelled');
});

test('structured HTTP status still reaches the existing retry classifier', async () => {
  for (const [status, kind] of [[500, 'server'], [503, 'server'], [429, 'rate-limited']]) {
    await assert.rejects(
      fetchPublicJsonObject('https://pds.example/x', {
        fetchImpl: async () => ({ ok: false, status }),
      }),
      (err) => err.status === status && classifyStructuredFailure(err) === kind,
      `HTTP ${status} keeps its ${kind} classification`,
    );
  }
  await assert.rejects(
    fetchPublicJsonObject('https://pds.example/x', {
      fetchImpl: async () => ({ ok: false, status: 404 }),
    }),
    (err) => err.status === 404 && classifyStructuredFailure(err) === 'unknown',
    'a missing collection stays a caller-handled status',
  );
});

test('network and body failures use fixed errors and never read provider prose', async () => {
  const network = await rejection(fetchPublicJsonObject('https://pds.example/x', {
    fetchImpl: async () => {
      throw new Error('provider said secret');
    },
  }));
  assert.match(network.message, /Could not reach the public service\./);
  assert.doesNotMatch(String(network), /provider said secret/);
  assert.equal(classifyStructuredFailure(network), 'unknown', 'network failure stays non-retryable');

  const unreadable = await rejection(fetchPublicJsonObject('https://pds.example/x', {
    fetchImpl: async () => ({
      ok: true,
      json: async () => {
        throw new Error('provider said secret');
      },
    }),
  }));
  assert.match(unreadable.message, /Public read returned an invalid body\./);
  assert.doesNotMatch(String(unreadable), /provider said secret/);
  assert.equal(classifyStructuredFailure(unreadable), 'unknown');

  const array = await rejection(fetchPublicJsonObject('https://pds.example/x', {
    fetchImpl: async () => ({ ok: true, json: async () => [] }),
  }));
  assert.match(array.message, /Public read returned an invalid body\./);
  assert.equal(classifyStructuredFailure(array), 'unknown');
});

test('an empty URL makes no request', async () => {
  let called = false;
  const result = await fetchPublicJsonObject('', {
    fetchImpl: async () => {
      called = true;
      return { ok: true, json: async () => ({}) };
    },
  });
  assert.equal(result, null);
  assert.equal(called, false);
});

test('every public JSON read now uses the one bounded helper', () => {
  const helper = read('../src/lib/publicJsonRead.ts');
  const core = read('../src/lib/boundedPublicFetch.ts');
  assert.equal(DEFAULT_TIMEOUT_MS, 12_000);
  assert.match(helper, /readBoundedPublic<unknown>\(url/);
  assert.doesNotMatch(helper, /await fetch\(/);
  assert.doesNotMatch(helper, /\.message\b/);
  assert.match(core, /withDeadline\(async \(signal\)/);
  assert.match(core, /signal,/);
  assert.doesNotMatch(core, /setTimeout\(/);
  assert.doesNotMatch(core, /response\.text\(\)/);
  assert.doesNotMatch(core, /\.message\b/);

  for (const file of [
    'events.ts',
    'memories.ts',
    'identityProfile.ts',
    'identityDocumentRead.ts',
    'reactions.ts',
    'teal.ts',
  ]) {
    const source = read(`../src/lib/${file}`);
    assert.match(source, /fetchPublicJsonObject\(/, `${file} uses the bounded helper`);
    assert.doesNotMatch(source, /await fetch\(/, `${file} has no raw unbounded fetch`);
    assert.doesNotMatch(source, /\.message\b/, `${file} never reads provider prose`);
  }
});

test('v0.95.0 copy and version parity match the bounded public reads', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.97.0');
  assert.equal(appJson.expo.version, '0.97.0');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.97\.0<\/string>/);
  }

  const changelog = read('../CHANGELOG.md');
  const section = changelog.slice(
    changelog.indexOf('## 0.95.0'),
    changelog.indexOf('## 0.90.0'),
  );
  assert.match(section, /Public PDS repository reads can no longer hang forever/);
  assert.match(section, /#96\/#97\/#100, partial/);
  assert.match(section, /fetchPublicJsonObject\(\)/);
  assert.match(
    read('../docs/bluesky-compliance.md'),
    /Public repository reads \| Events, Memories/,
  );
  assert.match(read('../site/features.html'), /<dt>Public repository reads<\/dt>/);

  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 112);
});
