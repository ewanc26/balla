import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolveHandleWithDeadline } from '../src/lib/boundedHandleResolution.ts';
import { DEFAULT_TIMEOUT_MS } from '../src/lib/requestTimeout.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const DID = 'did:plc:3434wfandtk52wlqq4u5g72a';
const makeResolver = (resolve) => ({ resolve });

test('a live handle resolution passes an abort signal and keeps the typed DID', async () => {
  const calls = [];
  const result = await resolveHandleWithDeadline(
    makeResolver(async (handle, options) => {
      calls.push({ handle, options });
      return DID;
    }),
    'alice.example',
  );
  assert.equal(result, DID);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].handle, 'alice.example');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.equal(calls[0].options.signal.aborted, false);
});

test('a hung handle host stops at the shared deadline and cancels its request', async () => {
  let fire = null;
  let observed = null;
  const pending = resolveHandleWithDeadline(
    makeResolver((handle, options) => {
      observed = options.signal;
      return new Promise(() => {});
    }),
    'hung.example',
    {
      timeoutMs: 25,
      setTimeoutImpl: (fn) => {
        fire = fn;
        return 1;
      },
      clearTimeoutImpl: () => {},
    },
  );
  assert.ok(fire, 'the deadline is armed before the resolver starts');
  assert.ok(observed instanceof AbortSignal);
  assert.equal(observed.aborted, false);
  fire();
  assert.equal(await pending, null, 'a timeout is an unavailable source, not a copy-worthy event');
  assert.equal(observed.aborted, true, 'the real request is cancelled');
});

test('structured resolver errors still reach the retry classifier', async () => {
  const sentinel = Object.assign(new Error('rate limited'), { status: 429 });
  await assert.rejects(
    resolveHandleWithDeadline(
      makeResolver(async () => {
        throw sentinel;
      }),
      'alice.example',
    ),
    (err) => err === sentinel,
    'the helper does not swallow the status a retry decision needs',
  );
});

test('an empty handle makes no request', async () => {
  let called = false;
  const result = await resolveHandleWithDeadline(
    makeResolver(async () => {
      called = true;
      return DID;
    }),
    '',
  );
  assert.equal(result, null);
  assert.equal(called, false);
});

test('one shared deadline now covers the in-app public handle fallback', () => {
  assert.equal(DEFAULT_TIMEOUT_MS, 12_000);
  const helper = read('../src/lib/boundedHandleResolution.ts');
  assert.match(helper, /withDeadline\(/);
  assert.match(helper, /resolver\.resolve\(handle, \{ signal \}\)/);
  assert.doesNotMatch(helper, /\.message\b/);
  assert.doesNotMatch(helper, /response\.text\(\)/);

  const resolver = read('../src/lib/identityResolver.ts');
  assert.match(
    resolver,
    /import \{ resolveHandleWithDeadline \} from '\.\/boundedHandleResolution\.ts'/,
  );
  assert.match(resolver, /resolveHandleWithDeadline\(publicHandleResolver, handle\)/);
  assert.doesNotMatch(resolver, /publicHandleResolver\.resolve\(handle\)/);
});

test('public copy and version parity match the bounded handle-resolution slice', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.97.7');
  assert.equal(appJson.expo.version, '0.97.7');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.97\.7<\/string>/);
  }

  const changelog = read('../CHANGELOG.md');
  assert.match(changelog, /^## 0\.95\.0$/m);
  assert.match(changelog, /bounded handle resolution/);
  assert.match(changelog, /#96\/#97\/#100, partial/);
  assert.match(
    read('../docs/bluesky-compliance.md'),
    /Handle resolution now shares the one bounded deadline/,
  );
  assert.match(
    read('../site/features.html'),
    /Handle resolution now shares the one bounded deadline/,
  );

  const metadata = read('../oauth-client-metadata.json');
  assert.equal(
    createHash('sha256').update(metadata).digest('hex'),
    '62ed29fa0518cce5ba4fc6290459cde40e4e2b7bf81250216a8c2b48a671eb29',
  );
  const client = JSON.parse(metadata);
  assert.equal(client.scope.split(/\s+/).filter(Boolean).length, 112);
});
