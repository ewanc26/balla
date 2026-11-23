import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('server drafts use four exact AppView RPC scopes and no wildcards', () => {
  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  const tokens = metadata.scope.split(/\s+/).filter(Boolean);
  assert.equal(tokens.length, 112);
  const audience = '?aud=did:web:api.eurosky.network#bsky_appview';
  for (const method of ['createDraft', 'deleteDraft', 'getDrafts', 'updateDraft']) {
    assert.ok(tokens.includes(`rpc:app.bsky.draft.${method}${audience}`), method);
  }
  assert.equal(/repo:\*|rpc:\*|blob:\*/.test(metadata.scope), false);
});

test('the draft wrapper calls the published create, update, list and delete helpers', () => {
  const wrapper = read('../src/lib/serverDrafts.ts');
  assert.match(wrapper, /getDrafts\(/);
  assert.match(wrapper, /createDraft\(/);
  assert.match(wrapper, /updateDraft\(/);
  assert.match(wrapper, /deleteDraft\(/);
  assert.match(wrapper, /buildDraftBody\(/);
});

test('the drafts sheet lists, opens and deletes real server drafts', () => {
  const sheet = read('../src/components/ServerDraftsSheet.tsx');
  assert.match(sheet, /listServerDrafts\(/);
  assert.match(sheet, /deleteServerDraft\(/);
  assert.match(sheet, /onLoad\(view\)/);
  assert.match(sheet, /sortDrafts/);
  assert.match(sheet, /accessibilityRole="button"/);
});

test('the composer saves and restores drafts through the sheet', () => {
  const compose = read('../src/screens/ComposeScreen.tsx');
  assert.match(compose, /createServerDraft\(/);
  assert.match(compose, /updateServerDraft\(/);
  assert.match(compose, /draftViewToChoices\(/);
  assert.match(compose, /ServerDraftsSheet/);
  assert.match(compose, /setDraftsOpen\(true\)/);
  assert.match(compose, /activeDraftId/);
  assert.match(compose, /openServerDraft/);
  assert.match(compose, /Save draft/);
});
