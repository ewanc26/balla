import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadPdsDirectory } from '../src/lib/pdsDirectory.ts';
import { PDS_DIRECTORY_API } from '../src/lib/pdsDirectoryModel.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const payload = {
  meta: { updated_at: '2026-11-24T09:00:00.000Z', total_open: 164 },
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

function ok(body) {
  return { ok: true, json: async () => body };
}

/** One injected deadline, armed before the fetch and fired after it settles. */
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

test('a hung directory host is cancelled and fails closed', async () => {
  const timer = clock();
  let observed = null;
  const pending = loadPdsDirectory(
    (_url, init) => {
      observed = init.signal;
      return new Promise(() => {});
    },
    true,
    timer,
  );
  await timer.settle();
  timer.armLast();
  const result = await pending;
  assert.equal(result.state, 'unavailable');
  assert.equal(result.directory, null);
  assert.equal(observed.aborted, true, 'the real request is cancelled');
});

test('a timeout leaves a previously cached snapshot intact', async () => {
  const good = await loadPdsDirectory(async () => ok(payload), true);
  assert.equal(good.state, 'ok');

  const timer = clock();
  const hung = loadPdsDirectory(() => new Promise(() => {}), true, timer);
  await timer.settle();
  timer.armLast();
  assert.deepEqual(await hung, { state: 'unavailable', directory: null });

  let called = false;
  const cached = await loadPdsDirectory(async () => {
    called = true;
    return ok({});
  }, false);
  assert.equal(called, false, 'the cached read makes no request');
  assert.equal(cached.state, 'ok');
  assert.equal(cached.directory?.entries[0]?.host, 'selfhosted.social');
});

test('HTTP failure, malformed body and unusable payload keep distinct states', async () => {
  const http = await loadPdsDirectory(async () => ({ ok: false, status: 503 }), true);
  assert.equal(http.state, 'unavailable');

  const malformed = await loadPdsDirectory(
    async () => ({
      ok: true,
      json: async () => {
        throw new Error('secret provider text');
      },
    }),
    true,
  );
  assert.equal(malformed.state, 'invalid');
  assert.equal(JSON.stringify(malformed).includes('secret provider text'), false);

  const unusable = await loadPdsDirectory(async () => ok({ servers: [] }), true);
  assert.equal(unusable.state, 'invalid');
});

test('the directory read carries the deadline signal and uses the shared core', async () => {
  const calls = [];
  await loadPdsDirectory(async (url, init) => {
    calls.push({ url, init });
    return ok(payload);
  }, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, PDS_DIRECTORY_API);
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.deepEqual(calls[0].init.headers, { Accept: 'application/json' });

  const source = read('../src/lib/pdsDirectory.ts');
  assert.match(source, /readBoundedPublic<unknown>\(PDS_DIRECTORY_API,/);
  assert.match(source, /parse: \(response\) => response\.json\(\)/);
  assert.doesNotMatch(source, /await fetch\(/);
  assert.doesNotMatch(source, /fetchImpl\(PDS_DIRECTORY_API/);
  assert.doesNotMatch(source, /\.message\b/);
  assert.doesNotMatch(source, /console\./);
});

test('v0.95.0 records the bounded directory read with parity and unchanged metadata', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.97.8');
  assert.equal(appJson.expo.version, '0.97.8');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.97\.8<\/string>/);
  }

  const changelog = read('../CHANGELOG.md');
  const section = changelog.slice(changelog.indexOf('## 0.95.0'), changelog.indexOf('## 0.94.0'));
  assert.match(section, /PDS-directory read now matches the documented deadline claim/);
  assert.match(section, /#97\/#100, partial/);
  assert.match(section, /scope count stays 112/);

  const docs = read('../docs/bluesky-compliance.md');
  assert.match(docs, /the PDS directory read now goes through the one bounded public fetch core/);
  const site = read('../site/features.html');
  assert.match(site, /The public PDS directory used by Advanced → Accounts and Move account is bounded too/);

  const metadata = read('../oauth-client-metadata.json');
  assert.equal(
    createHash('sha256').update(metadata).digest('hex'),
    '62ed29fa0518cce5ba4fc6290459cde40e4e2b7bf81250216a8c2b48a671eb29',
  );
  assert.equal(JSON.parse(metadata).scope.split(/\s+/).filter(Boolean).length, 112);
});
