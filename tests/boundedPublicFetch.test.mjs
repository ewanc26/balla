import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readBoundedPublic } from '../src/lib/boundedPublicFetch.ts';
import { translateText } from '../src/lib/translate.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

async function rejection(promise) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error('expected the read to reject');
}

function fakeFetch(calls, behaviour) {
  return async (url, init) => {
    calls.push({ url, init });
    return behaviour(url, init);
  };
}

test('the shared core passes an abort signal and reads the body inside the deadline', async () => {
  const calls = [];
  const result = await readBoundedPublic('https://service.example/data', {
    accept: 'image/*',
    fetchImpl: fakeFetch(calls, async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    })),
    parse: async (response) => new Uint8Array(await response.arrayBuffer()),
  });
  assert.deepEqual(result, { state: 'value', value: new Uint8Array([1, 2, 3]), status: 200 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].init.headers.Accept, 'image/*');
  assert.ok(calls[0].init.signal instanceof AbortSignal);
});

test('a hung body is cancelled and reported as a timeout, not provider prose', async () => {
  let fire = null;
  let observed = null;
  const pending = readBoundedPublic('https://hung.example/data', {
    fetchImpl: (_url, init) => {
      observed = init.signal;
      return new Promise(() => {});
    },
    parse: async () => ({}),
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
  assert.deepEqual(await pending, { state: 'timeout' });
  assert.equal(observed.aborted, true, 'the real request is cancelled');
});

test('transport, HTTP and parser failures stay separate structured states', async () => {
  const unreachable = await readBoundedPublic('https://service.example/x', {
    fetchImpl: async () => {
      throw new Error('provider said secret');
    },
    parse: async () => ({}),
  });
  assert.deepEqual(unreachable, { state: 'unavailable' });

  const http = await readBoundedPublic('https://service.example/x', {
    fetchImpl: async () => ({ ok: false, status: 429 }),
    parse: async () => ({}),
  });
  assert.deepEqual(http, { state: 'status', status: 429 });

  const invalid = await readBoundedPublic('https://service.example/x', {
    fetchImpl: async () => ({ ok: true, json: async () => [] }),
    parse: async (response) => {
      const body = await response.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid');
      return body;
    },
  });
  assert.deepEqual(invalid, { state: 'invalid' });

  let called = false;
  const empty = await readBoundedPublic('', {
    fetchImpl: async () => {
      called = true;
      return { ok: true };
    },
    parse: async () => ({}),
  });
  assert.deepEqual(empty, { state: 'unavailable' });
  assert.equal(called, false, 'an empty URL makes no request');
});

test('translation still parses the same public array with fixed failure copy', async () => {
  const calls = [];
  const payload = [[['Hello', 'Hallo', null, null, 0]], null, 'de'];
  const result = await translateText('Hallo', 'en', {
    fetchImpl: fakeFetch(calls, async () => ({ ok: true, json: async () => payload })),
  });
  assert.deepEqual(result, { text: 'Hello', sourceLanguage: 'de' });
  assert.match(calls[0].url, /client=gtx/);
  assert.match(calls[0].url, /tl=en/);
  assert.match(calls[0].url, /q=Hallo/);
  assert.equal(calls[0].init.headers.Accept, 'application/json');
  assert.ok(calls[0].init.signal instanceof AbortSignal);
});

test('a timed-out, unreachable or malformed translation never reads provider prose', async () => {
  let fire = null;
  let observed = null;
  const hung = translateText('Hallo', 'en', {
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
  fire();
  const timeout = await rejection(hung);
  assert.match(timeout.message, /Translation did not finish in time\./);
  assert.equal(observed.aborted, true);

  const unreachable = await rejection(translateText('Hallo', 'en', {
    fetchImpl: async () => {
      throw new Error('provider said secret');
    },
  }));
  assert.match(unreachable.message, /Could not reach the translation service\./);
  assert.doesNotMatch(String(unreachable), /provider said secret/);

  const http = await rejection(translateText('Hallo', 'en', {
    fetchImpl: async () => ({ ok: false, status: 503 }),
  }));
  assert.match(http.message, /Translation request failed \(503\)/);

  const body = await rejection(translateText('Hallo', 'en', {
    fetchImpl: async () => ({ ok: true, json: async () => ({ unexpected: true }) }),
  }));
  assert.match(body.message, /Unexpected translation response/);
});

test('JSON objects, translation arrays and blob bytes share the one fetch core', () => {
  for (const file of ['publicJsonRead.ts', 'translate.ts', 'blobOrigin.ts']) {
    const source = read(`../src/lib/${file}`);
    assert.match(source, /readBoundedPublic(?:<[^>]+>)?\(/, `${file} uses the shared core`);
    assert.doesNotMatch(source, /await fetch\(/, `${file} has no raw unbounded fetch`);
    assert.doesNotMatch(source, /\.message\b/, `${file} never reads provider prose`);
  }
  const core = read('../src/lib/boundedPublicFetch.ts');
  assert.match(core, /withDeadline\(async \(signal\)/);
  assert.match(core, /signal,/);
  assert.doesNotMatch(core, /\.message\b/);
});

test('v0.94.0 records the bounded read and keeps version and metadata parity', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.94.0');
  assert.equal(appJson.expo.version, '0.94.0');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.94\.0<\/string>/);
  }

  const changelog = read('../CHANGELOG.md');
  const section = changelog.slice(changelog.indexOf('## 0.94.0'), changelog.indexOf('## 0.91.1'));
  assert.match(section, /remaining token-free public reads are now bounded/);
  assert.match(section, /readBoundedPublic\(\)/);
  assert.match(section, /#96\/#97\/#100, partial/);
  assert.match(section, /scope count stays 112/);

  const compliance = read('../docs/bluesky-compliance.md');
  assert.match(compliance, /Translation read \|/);
  assert.match(compliance, /byte read now shares the one bounded public fetch core/);
  const site = read('../site/features.html');
  assert.match(site, /Translation is user-initiated and time-limited/);
  assert.match(site, /Direct image bytes and user-initiated translation now use the same bounded reader/);

  const metadata = read('../oauth-client-metadata.json');
  assert.equal(
    createHash('sha256').update(metadata).digest('hex'),
    '62ed29fa0518cce5ba4fc6290459cde40e4e2b7bf81250216a8c2b48a671eb29',
  );
  assert.equal(JSON.parse(metadata).scope.split(/\s+/).filter(Boolean).length, 112);
});
