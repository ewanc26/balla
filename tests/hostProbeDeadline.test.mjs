import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { probeHost } from '../src/lib/hostingProbe.ts';
import {
  DEFAULT_TIMEOUT_MS,
  HOST_TIMEOUT_DETAIL,
} from '../src/lib/requestTimeout.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const DID = 'did:web:selfhosted.social';

function describeResponse(overrides = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ did: DID, availableUserDomains: ['.selfhosted.social'], ...overrides }),
  };
}

test('a reachable host still returns structured server facts', async () => {
  const calls = [];
  const result = await probeHost('https://selfhosted.social', {
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return describeResponse();
    },
  });
  assert.equal(result.state, 'reachable');
  assert.equal(result.host, 'https://selfhosted.social');
  assert.equal(result.facts.did, DID);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://selfhosted.social/xrpc/com.atproto.server.describeServer');
  assert.ok(calls[0].init.signal instanceof AbortSignal, 'the request gets an abort signal');
});

test('a hung host stops at the shared deadline with fixed Balla copy', async () => {
  let fire = null;
  let observed = null;
  const pending = probeHost('https://hung.example', {
    fetchImpl: (url, init) => {
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
  assert.ok(fire, 'the deadline is armed before the read starts');
  assert.equal(observed.aborted, false);
  fire();
  const result = await pending;
  assert.equal(result.state, 'unreachable');
  assert.equal(result.host, 'https://hung.example');
  assert.equal(result.facts, null);
  assert.equal(result.detail, HOST_TIMEOUT_DETAIL);
  assert.equal(observed.aborted, true, 'a real fetch is cancelled, not left running');
  assert.doesNotMatch(result.detail, /provider said|secret|aborted/i);
});

test('the deadline is the shared 12 second bound and copy is provider-neutral', () => {
  assert.equal(DEFAULT_TIMEOUT_MS, 12_000);
  assert.match(HOST_TIMEOUT_DETAIL, /did not answer in time/);
  assert.doesNotMatch(HOST_TIMEOUT_DETAIL, /provider|http|status/i);
});

test('invalid input fails before any request and a fetch error stays unreachable', async () => {
  let calls = 0;
  const invalid = await probeHost('https://pds.example/path', {
    fetchImpl: async () => {
      calls += 1;
      return describeResponse();
    },
  });
  assert.equal(invalid.state, 'invalid');
  assert.equal(invalid.host, null);
  assert.equal(calls, 0, 'no request is made for an invalid host');

  const thrown = await probeHost('https://offline.example', {
    fetchImpl: async () => {
      throw new Error('provider said offline');
    },
  });
  assert.equal(thrown.state, 'unreachable');
  assert.equal(thrown.host, 'https://offline.example');
  assert.doesNotMatch(JSON.stringify(thrown), /provider said/i, 'provider prose is never copied into state');
});

test('non-2xx and malformed descriptions keep their honest classification', async () => {
  const badGateway = await probeHost('https://pds.example', {
    fetchImpl: async () => ({ ok: false, status: 502, json: async () => ({}) }),
  });
  assert.equal(badGateway.state, 'unreachable');
  assert.equal(badGateway.facts, null);

  const notAtproto = await probeHost('https://pds.example', {
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }),
  });
  assert.equal(notAtproto.state, 'not-atproto');
});

test('one bounded deadline covers the host probe and every other public probe', () => {
  const host = read('../src/lib/hostingProbe.ts');
  assert.match(host, /withDeadline\(async \(signal\)/);
  assert.match(host, /HOST_TIMEOUT_DETAIL/);
  assert.match(host, /signal,/);
  assert.doesNotMatch(host, /setTimeout\(/);
  assert.doesNotMatch(host, /\.message\b/);
  assert.doesNotMatch(host, /response\.text\(\)/);

  for (const path of ['../src/lib/servicesProbe.ts', '../src/lib/placesProbe.ts', '../src/lib/appViewHealth.ts']) {
    assert.match(read(path), /withDeadline\(/, path);
  }
});

test('all three host-check screens keep using the shared probe', () => {
  assert.match(read('../src/screens/HostingScreen.tsx'), /await probeHost\(input\)/);
  assert.match(read('../src/screens/PdsDirectoryScreen.tsx'), /await probeHost\(chosen\.url\)/);
  assert.match(read('../src/screens/PdsDirectoryScreen.tsx'), /await probeHost\(customUrl\)/);
  assert.match(read('../src/screens/MigrationPreflightScreen.tsx'), /await probeHost\(chosen\.url\)/);
  assert.match(read('../src/screens/MigrationPreflightScreen.tsx'), /await probeHost\(customUrl\)/);
});

test('release documents the bounded host check honestly without changing the grant', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.92.0');
  assert.equal(appJson.expo.version, '0.92.0');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.92\.0<\/string>/);
  }

  const changelog = read('../CHANGELOG.md');
  assert.match(changelog, /^## 0\.92\.0$/m);
  assert.match(changelog, /bounded deadline/);
  assert.match(changelog, /#97\/#100, partial/);
  assert.match(read('../docs/bluesky-compliance.md'), /bounded deadline/);
  assert.match(read('../site/features.html'), /bounded deadline/);

  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 112);
});
