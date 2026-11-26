import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { getPathFromState, getStateFromPath } from '@react-navigation/core';
import { SERVICE_HOSTS } from '../src/lib/serviceHosts.ts';
import { webLinking } from '../src/lib/webLinking.ts';

// These drive React Navigation's own parser and serialiser. On the web it reads
// location.pathname and ignores `prefixes`, so only the config can carry /app.
const { config } = webLinking;
const AT = 'at://did:plc:mum/app.bsky.feed.post/3k';

const pathFor = (name, params) =>
  getPathFromState({ index: 1, routes: [{ name: 'Tabs' }, { name, params }] }, config);

const stackFor = (path) => getStateFromPath(path, config)?.routes;
const focused = (path) => {
  let route = stackFor(path)?.at(-1);
  while (route?.state) route = route.state.routes.at(-1);
  return route;
};

test('a shared address under /app opens its own screen', () => {
  assert.equal(focused('/app/settings')?.name, 'Settings');
  assert.equal(focused('/app/search')?.name, 'Search');
  assert.equal(focused('/app/profile')?.name, 'Profile');
  assert.equal(focused('/app/messages/settings')?.name, 'ChatSettings');
  const thread = focused(`/app/post/${encodeURIComponent(AT)}`);
  assert.equal(thread?.name, 'Thread');
  assert.equal(thread.params.uri, AT);
});

test('the bare client address falls through to the default Home tab', () => {
  assert.equal(getStateFromPath('/app', config), undefined);
  assert.equal(getStateFromPath('/app/', config), undefined);
});

test('the address bar never leaves /app', () => {
  for (const name of Object.keys(config.screens)) {
    if (name === 'Tabs') continue;
    assert.ok(pathFor(name).startsWith('/app/'), `${name}: ${pathFor(name)}`);
  }
  for (const name of Object.keys(config.screens.Tabs.screens)) {
    const path = getPathFromState(
      { routes: [{ name: 'Tabs', state: { routes: [{ name }] } }] },
      config,
    );
    assert.match(path, /^\/app(\/|$)/, name);
  }
});

test('a deep-linked screen keeps Home underneath, so it has a way back', () => {
  assert.deepEqual(
    stackFor(`/app/post/${encodeURIComponent(AT)}`).map((route) => route.name),
    ['Tabs', 'Thread'],
  );
});

test('identifiers survive a round trip through the address bar', () => {
  for (const [name, params] of [
    ['Thread', { uri: AT }],
    ['EditPost', { uri: AT }],
    ['UserProfile', { actor: 'did:web:host.example%3A8443' }],
    ['Hashtag', { tag: 'a/b?c#d%' }],
    ['ListEdit', { uri: AT }],
    ['Conversation', { convoId: '3kconvo' }],
  ]) {
    const route = focused(pathFor(name, params));
    assert.equal(route.name, name);
    assert.deepEqual({ ...route.params }, params);
  }
});

test('a screen the app opens without params never reloads with "undefined"', () => {
  const sources = ['../App.tsx', ...readdirSync(new URL('../src/screens/', import.meta.url))
    .map((file) => `../src/screens/${file}`)]
    .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
    .join('\n');
  const bare = new Set(
    [...sources.matchAll(/\bnavigate\('([A-Za-z]+)'\)/g)].map((match) => match[1]),
  );
  assert.ok(bare.has('ListEdit') && bare.has('Compose'), [...bare].join());
  for (const name of bare) {
    const path = pathFor(name);
    assert.doesNotMatch(path, /undefined/, name);
    assert.equal(focused(path).name, name);
  }
});

test('a new list reloads as a new list and keeps its purpose', () => {
  assert.equal(focused(pathFor('ListEdit')).params?.uri, undefined);
  const purpose = 'app.bsky.graph.defs#modlist';
  const route = focused(pathFor('ListEdit', { purpose }));
  assert.equal(route.name, 'ListEdit');
  assert.equal(route.params.uri, undefined);
  assert.equal(route.params.purpose, purpose);
  assert.equal(focused(`/app/list/${encodeURIComponent(AT)}`).name, 'ListDetail');
});

test('a quoted post object is never written to or read from the address', () => {
  const path = pathFor('Compose', { quote: { uri: AT, cid: 'bafy', author: {} } });
  assert.equal(path, '/app/compose');
  assert.equal(focused('/app/compose?quote=%5Bobject%20Object%5D').params?.quote, undefined);
});

test('a crafted link cannot retitle an information page', () => {
  assert.equal(pathFor('Info', { topic: 'privacy', title: 'Privacy policy' }), '/app/info/privacy');
  assert.equal(focused('/app/info/privacy?title=Account%20suspended').params.title, undefined);
});

test('a crafted link cannot put its own label beside a real list or account', () => {
  assert.equal(pathFor('Lists', { actor: 'did:plc:mum', handle: 'mum.test' }), '/app/lists?actor=did%3Aplc%3Amum');
  const lists = focused('/app/lists?actor=did%3Aplc%3Amum&handle=someone.else').params;
  assert.equal(lists.actor, 'did:plc:mum');
  assert.equal(lists.handle, undefined);

  const uri = encodeURIComponent(AT);
  const members = focused(`/app/list/${uri}/members?name=Invented&purpose=app.bsky.graph.defs%23modlist`).params;
  assert.equal(members.name, undefined);
  // A fixed protocol value, not free text: it picks between Balla's own sentences.
  assert.equal(members.purpose, 'app.bsky.graph.defs#modlist');
});

test('a link can only name the moderation service this grant covers', () => {
  const granted = SERVICE_HOSTS.labelerDid;
  for (const [name, extra] of [['ModerationReport', { id: '7' }], ['ModerationNotice', { subject: 'did:plc:mum' }]]) {
    const route = focused(pathFor(name, { moderationService: granted, ...extra }));
    assert.deepEqual({ ...route.params }, { moderationService: granted, ...extra });
    const path = pathFor(name, { moderationService: 'did:web:elsewhere.example', ...extra });
    assert.equal(focused(path).params.moderationService, '', name);
  }
});
