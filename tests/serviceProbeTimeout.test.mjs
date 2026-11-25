import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  DEFAULT_TIMEOUT_MS,
  SERVICE_TIMEOUT_DETAIL,
} from '../src/lib/requestTimeout.ts';
import {
  probeAppView,
  probeChat,
  probePlcDirectory,
  probeResolver,
  probeVideoEndpoint,
} from '../src/lib/servicesProbe.ts';
import { probeAppViewHealth } from '../src/lib/appViewHealth.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const changelog = read('../CHANGELOG.md');
const compliance = read('../docs/bluesky-compliance.md');
const features = read('../site/features.html');

/** A timer that only fires when the test says so; no real waiting. */
function fakeClock() {
  const fires = [];
  const signals = [];
  const deps = {
    timeoutMs: 25,
    setTimeoutImpl: (fn) => {
      fires.push(fn);
      return fires.length;
    },
    clearTimeoutImpl: () => {},
    fetchImpl: (url, init) => {
      signals.push(init?.signal);
      return new Promise(() => {});
    },
  };
  return { deps, fires, signals, expire: () => fires[fires.length - 1]() };
}

function jsonResponse(body) {
  return new Response(JSON.stringify(body), { status: 200 });
}

test('every Advanced public check reports a hung provider in fixed copy', async () => {
  const cases = [
    ['resolver', (deps) => probeResolver('https://resolver.example', deps)],
    ['directory', (deps) => probePlcDirectory('https://plc.example', deps)],
    ['appview', (deps) => probeAppView(null, deps)],
    ['video', (deps) => probeVideoEndpoint(deps)],
    ['chat', (deps) => probeChat(deps)],
  ];
  for (const [name, run] of cases) {
    const { deps, expire, signals } = fakeClock();
    const pending = run(deps);
    expire();
    const result = await pending;
    assert.equal(result.state, 'unavailable', name);
    assert.equal(result.status, null, name);
    assert.equal(result.detail, SERVICE_TIMEOUT_DETAIL, name);
    assert.ok(typeof result.latencyMs === 'number', name);
    assert.equal(signals[0].aborted, true, `${name} aborts the in-flight fetch`);
    assert.doesNotMatch(result.detail, /secret|provider said/i, name);
  }
});

test('the AppView health check bounds both public reads', async () => {
  const documentUrl = 'https://api.eurosky.network/.well-known/did.json';
  const document = {
    service: [{ id: '#bsky_appview', type: 'BskyAppView', serviceEndpoint: 'https://api.eurosky.network' }],
  };

  const hungDocument = fakeClock();
  const pendingDocument = probeAppViewHealth({ ...hungDocument.deps, now: () => 10 });
  hungDocument.expire();
  const documentResult = await pendingDocument;
  assert.equal(documentResult.state, 'unavailable');
  assert.equal(documentResult.status, null);
  assert.equal(documentResult.detail, SERVICE_TIMEOUT_DETAIL);
  assert.equal(hungDocument.signals[0].aborted, true);

  // The profile hang fires the second timer after the document read succeeds.
  const hungProfile = fakeClock();
  let tick = 0;
  hungProfile.deps.fetchImpl = (url, init) => {
    hungProfile.signals.push(init?.signal);
    if (url === documentUrl) return Promise.resolve(jsonResponse(document));
    return new Promise(() => {});
  };
  const pendingProfile = probeAppViewHealth({
    ...hungProfile.deps,
    actorDid: 'did:plc:abc123',
    now: () => (tick += 10),
  });
  // Drain microtasks so the document read finishes and the profile timer arms.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(hungProfile.fires.length, 2);
  hungProfile.expire();
  const profileResult = await pendingProfile;
  assert.equal(profileResult.state, 'unavailable');
  assert.equal(profileResult.status, null);
  assert.equal(profileResult.detail, SERVICE_TIMEOUT_DETAIL);
  assert.equal(profileResult.endpoint, 'https://api.eurosky.network');
  assert.ok(typeof profileResult.documentLatencyMs === 'number');
  assert.equal(hungProfile.signals[hungProfile.signals.length - 1].aborted, true);
});

test('one shared deadline covers places and every service check', () => {
  assert.equal(DEFAULT_TIMEOUT_MS, 12_000);
  const probe = read('../src/lib/servicesProbe.ts');
  const health = read('../src/lib/appViewHealth.ts');
  const places = read('../src/lib/placesSearch.ts');
  for (const source of [probe, health, places]) {
    assert.match(source, /withDeadline\(/);
    assert.doesNotMatch(source, /setTimeout\(/);
  }
  assert.match(probe, /SERVICE_TIMEOUT_DETAIL/);
  assert.match(health, /SERVICE_TIMEOUT_DETAIL/);
  assert.doesNotMatch(changelog, /service checks are unbounded/i);
});

test('docs and version parity match the bounded-check slice', () => {
  assert.match(changelog, /^## 0\.84\.0$/m);
  assert.match(changelog, /bounded deadline/);
  assert.match(compliance, /bounded deadline/);
  assert.match(features, /bounded deadline/);
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.84.0');
  assert.equal(appJson.expo.version, '0.84.0');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.84\.0<\/string>/);
  }
});
