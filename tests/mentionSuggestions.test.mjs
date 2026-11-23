import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  activeMentionQuery,
  applyMention,
  mentionActors,
} from '../src/lib/mentionSuggestions.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const endOf = (text) => ({ start: text.length, end: text.length });

test('finds the handle under the cursor', () => {
  assert.deepEqual(
    activeMentionQuery('Hello @alice.test', endOf('Hello @alice.test')),
    { query: 'alice.test', start: 6, end: 17 }
  );
});

test('does not treat an email address as a mention', () => {
  assert.equal(
    activeMentionQuery('mail name@example.com', endOf('mail name@example.com')),
    null
  );
});

test('uses the whole token when the cursor is inside it', () => {
  assert.deepEqual(
    activeMentionQuery('Hi @alice.test', { start: 10, end: 10 }),
    { query: 'alice.test', start: 3, end: 14 }
  );
});

test('range selections and non-boundary text do not open suggestions', () => {
  assert.equal(
    activeMentionQuery('Hi @alice.test', { start: 6, end: 9 }),
    null
  );
  assert.equal(
    activeMentionQuery('Hi@alice.test', endOf('Hi@alice.test')),
    null
  );
});

test('keeps punctuation outside the replaced token', () => {
  const text = 'Hi @ali, there';
  const mention = activeMentionQuery(text, { start: 7, end: 7 });
  assert.deepEqual(mention, { query: 'ali', start: 3, end: 7 });

  const next = applyMention(text, mention, '@alice.test');
  assert.equal(next.text, 'Hi @alice.test, there');
  assert.equal(next.cursor, 14);
});

test('a trailing full stop stays outside the token', () => {
  const text = 'Hi @alice.test.';
  const mention = activeMentionQuery(text, endOf(text));
  assert.deepEqual(mention, { query: 'alice.test', start: 3, end: 14 });

  const next = applyMention(text, mention, 'alice.test');
  assert.equal(next.text, 'Hi @alice.test.');
  assert.equal(next.cursor, 14);
});

test('replaces the token and leaves the cursor after the handle', () => {
  const text = 'Hi @alice.test';
  const mention = activeMentionQuery(text, { start: 8, end: 8 });
  const next = applyMention(text, mention, 'bob.test');
  assert.equal(next.text, 'Hi @bob.test ');
  assert.equal(next.cursor, 13);
});

test('a missing handle leaves the text alone', () => {
  const text = 'Hi @al';
  const mention = activeMentionQuery(text, endOf(text));
  assert.deepEqual(applyMention(text, mention, '   '), {
    text,
    cursor: 6,
  });
});

test('filters duplicate and unusable search results', () => {
  const actors = mentionActors([
    { did: 'did:1', handle: '@Alice.Test', displayName: 'Alice' },
    { did: 'did:2', handle: 'alice.test' },
    { did: 'did:3', handle: '   ' },
    { did: 'did:4' },
    { did: 'did:5', handle: 'bob.test' },
  ]);

  assert.deepEqual(
    actors.map(({ did, handle }) => ({ did, handle })),
    [
      { did: 'did:1', handle: 'Alice.Test' },
      { did: 'did:5', handle: 'bob.test' },
    ]
  );
  assert.equal(mentionActors('not an array').length, 0);
  assert.equal(mentionActors([{ handle: 'a' }, { handle: 'b' }], 1).length, 1);
});

test('both composers use the shared picker and people-search scope', () => {
  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  const tokens = metadata.scope.split(/\s+/).filter(Boolean);
  assert.equal(tokens.length, 112);
  assert.equal(
    tokens.filter((token) => token.startsWith('rpc:app.bsky.actor.searchActors'))
      .length,
    1
  );

  const hook = read('../src/lib/useMentionSuggestions.ts');
  assert.match(
    hook,
    /agent\s*\.searchActors\(\{ q: mention\.query\.trim\(\), limit: 6 \}\)/
  );
  assert.match(hook, /mentionActors\(response\?\.data\?\.actors\)/);
  assert.match(hook, /setTimeout\(/);

  const compose = read('../src/screens/ComposeScreen.tsx');
  assert.match(compose, /useMentionSuggestions\(text, selection, !sending\)/);
  assert.match(compose, /<MentionSuggestions/);
  assert.match(compose, /selection=\{selection\}/);
  assert.match(compose, /onSelectionChange=/);

  const thread = read('../src/screens/ThreadScreen.tsx');
  assert.match(
    thread,
    /useMentionSuggestions\(replyText, replySelection, !sending\)/
  );
  assert.match(thread, /<MentionSuggestions/);
  assert.match(thread, /selection=\{replySelection\}/);
  assert.match(thread, /applyMention\(replyText, replyActiveMention, actor\.handle\)/);

  const picker = read('../src/components/MentionSuggestions.tsx');
  assert.match(picker, /accessibilityLabel={`Mention @\$\{handle\}`}/);
  assert.match(picker, /Searching accounts…/);
  assert.match(picker, /No accounts found/);
  assert.match(picker, /Could not search accounts/);
});

test('release copy describes the picker without widening the scope', () => {
  assert.equal(
    JSON.parse(read('../package.json')).version,
    JSON.parse(read('../app.json')).expo.version,
  );

  const changelog = read('../CHANGELOG.md');
  assert.match(changelog, /## 0\.23\.0/);
  assert.match(changelog, /suggests matching accounts/i);
  assert.match(changelog, /thread replies/i);
  assert.match(read('../README.md'), /thread replies/i);
  assert.match(read('../AGENTS.md'), /thread replies/i);

  const site = read('../site/features.html');
  assert.match(site, /issues\/79/);
  assert.match(site, /issues\/81/);
  assert.match(site, /suggests matching accounts/i);
  assert.match(site, /thread replies/i);

  assert.match(
    read('../docs/oauth-scopes.md'),
    /People search and composer\/reply mention suggestions/
  );
  assert.match(read('../docs/bluesky-compliance.md'), /thread replies/i);
  assert.match(read('../docs/social-app-reference.md'), /thread replies/i);
});
