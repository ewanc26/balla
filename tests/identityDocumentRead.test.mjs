import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fetchIdentityDocument } from '../src/lib/identityDocumentRead.ts';
import { DEFAULT_TIMEOUT_MS } from '../src/lib/requestTimeout.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const DID_DOC = { id: 'did:plc:3434wfandtk52wlqq4u5g72a', alsoKnownAs: ['at://alice.example.com'] };

test('a live DID document returns structured JSON with an abort signal', async () => {
  const calls = [];
  const result = await fetchIdentityDocument('https://plc.directory/did:plc:3434wfandtk52wlqq4u5g72a', {
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, json: async () => DID_DOC };
    },
  });
  assert.deepEqual(result, DID_DOC);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://plc.directory/did:plc:3434wfandtk52wlqq4u5g72a');
  assert.match(calls[0].init.headers.Accept, /application\/did\+ld\+json/);
  assert.ok(calls[0].init.signal instanceof AbortSignal, 'the read gets an abort signal');
});

test('a hung DID host stops at the shared deadline and cancels its request', async () => {
  let fire = null;
  let observed = null;
  const pending = fetchIdentityDocument('https://hung.example/did:plc:x', {
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
  assert.ok(fire, 'the deadline is armed before the fetch starts');
  assert.equal(observed.aborted, false);
  fire();
  assert.equal(await pending, null, 'a timeout is an unavailable source, not a copy-worthy event');
  assert.equal(observed.aborted, true, 'the real fetch is cancelled');
});

test('non-2xx, invalid JSON and provider prose all fail closed to null', async () => {
  const serverError = await fetchIdentityDocument('https://plc.directory/did:plc:x', {
    fetchImpl: async () => ({ ok: false, status: 500, json: async () => { throw new Error('provider said secret'); } }),
  });
  assert.equal(serverError, null);

  const invalid = await fetchIdentityDocument('https://plc.directory/did:plc:x', {
    fetchImpl: async () => ({ ok: true, json: async () => 'provider said secret' }),
  });
  assert.equal(invalid, null, 'only structured objects can be a DID document');

  const thrown = await fetchIdentityDocument('https://plc.directory/did:plc:x', {
    fetchImpl: async () => {
      throw new Error('provider said secret');
    },
  });
  assert.equal(thrown, null);
  assert.equal(await fetchIdentityDocument(''), null, 'an empty URL makes no request');
});

test('DID documents use the one bounded public JSON reader on both routes', () => {
  assert.equal(DEFAULT_TIMEOUT_MS, 12_000);
  const helper = read('../src/lib/identityDocumentRead.ts');
  assert.match(helper, /import \{ fetchPublicJsonObject \} from '\.\/publicJsonRead\.ts'/);
  assert.match(helper, /accept: DID_ACCEPT/);
  assert.doesNotMatch(helper, /fetch\(/);
  assert.doesNotMatch(helper, /setTimeout\(/);
  assert.doesNotMatch(helper, /response\.text\(\)/);
  assert.doesNotMatch(helper, /\.message\b/);

  const resolver = read('../src/lib/identityResolver.ts');
  assert.match(resolver, /import \{ fetchIdentityDocument \} from '\.\/identityDocumentRead\.ts'/);
  assert.equal((resolver.match(/fetchIdentityDocument\(url\)/g) ?? []).length, 2, 'both plc: and did:web: use the helper');
  assert.doesNotMatch(resolver, /fetch\(url/, 'the resolver no longer makes a raw unbounded request');
});

test('public copy and version parity match the bounded identity-read slice', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.97.2');
  assert.equal(appJson.expo.version, '0.97.2');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.97\.2<\/string>/);
  }

  const changelog = read('../CHANGELOG.md');
  assert.match(changelog, /^## 0\.95\.0$/m);
  assert.match(changelog, /bounded deadline/);
  assert.match(changelog, /#96\/#97\/#100, partial/);
  assert.match(read('../docs/bluesky-compliance.md'), /DID-document reads now share the one bounded deadline/);
  assert.match(read('../site/features.html'), /DID-document reads now share the one bounded deadline/);

  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 112);
});
