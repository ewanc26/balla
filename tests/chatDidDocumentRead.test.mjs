import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { readChatDidAdvertises } from '../src/lib/chatServiceRead.ts';
import { CHAT_DID_DOCUMENT_URL } from '../src/lib/serviceHosts.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('a chat DID document is read once through the bounded identity reader', async () => {
  const calls = [];
  const document = {
    service: [{ id: '#bsky_chat', serviceEndpoint: 'https://api.bsky.chat' }],
  };
  const result = await readChatDidAdvertises({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, json: async () => document };
    },
  });
  assert.equal(result, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, CHAT_DID_DOCUMENT_URL);
  assert.match(calls[0].init.headers.Accept, /application\/did\+ld\+json/);
  assert.ok(calls[0].init.signal instanceof AbortSignal);
});

test('a document without a chat service fails closed without an advertisement claim', async () => {
  const result = await readChatDidAdvertises({
    fetchImpl: async () => ({ ok: true, json: async () => ({ service: [] }) }),
  });
  assert.equal(result, false);
});

test('a hung chat DID document is cancelled and fails closed', async () => {
  let fire = null;
  let observed = null;
  const pending = readChatDidAdvertises({
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
  assert.equal(await pending, null);
  assert.equal(observed.aborted, true, 'the real request is cancelled');
});

test('HTTP and body failures never read or repeat provider prose', async () => {
  const status = await readChatDidAdvertises({
    fetchImpl: async () => ({ ok: false, status: 503 }),
  });
  assert.equal(status, null);

  const body = await readChatDidAdvertises({
    fetchImpl: async () => ({
      ok: true,
      json: async () => {
        throw new Error('provider said secret');
      },
    }),
  });
  assert.equal(body, null);
});

test('the chat screen has no raw public fetch and delegates the DID read', () => {
  const screen = read('../src/screens/ChatServiceScreen.tsx');
  assert.match(screen, /readChatDidAdvertises\(\)/);
  assert.doesNotMatch(screen, /await fetch\(/);
  assert.doesNotMatch(screen, /CHAT_DID_DOCUMENT_URL/);
  assert.doesNotMatch(screen, /chatServiceAdvertised/);

  const reader = read('../src/lib/chatServiceRead.ts');
  assert.match(reader, /fetchIdentityDocument\(CHAT_DID_DOCUMENT_URL, deps\)/);
  assert.match(reader, /chatServiceAdvertised\(document\)/);
  assert.doesNotMatch(reader, /\.message\b/);
  assert.doesNotMatch(reader, /await fetch\(/);
});

test('v0.95.0 records the bounded chat DID read with parity and unchanged metadata', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.97.8');
  assert.equal(appJson.expo.version, '0.97.8');
  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.97\.8<\/string>/);
  }

  const changelog = read('../CHANGELOG.md');
  const section = changelog.slice(changelog.indexOf('## 0.95.0'), changelog.indexOf('## 0.92.0'));
  assert.match(section, /Advanced → Chat DID-document read is now bounded/);
  assert.match(section, /#97\/#99, partial/);
  assert.match(section, /scope count stays 112/);

  const docs = read('../docs/bluesky-compliance.md');
  assert.match(docs, /Advanced → Chat's public DID-document read now shares the same bounded identity reader/);
  const site = read('../site/features.html');
  assert.match(site, /Advanced → Chat's public DID-document read is bounded too/);

  const metadata = read('../oauth-client-metadata.json');
  assert.equal(
    createHash('sha256').update(metadata).digest('hex'),
    '62ed29fa0518cce5ba4fc6290459cde40e4e2b7bf81250216a8c2b48a671eb29',
  );
  assert.equal(JSON.parse(metadata).scope.split(/\s+/).filter(Boolean).length, 112);
});
