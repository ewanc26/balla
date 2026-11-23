import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CURATE_LIST,
  MOD_LIST,
  filterLists,
  listActionError,
  listMemberCount,
  listPurposeMeta,
  listViewerState,
  mergeUniqueLists,
  validateListDraft,
} from '../src/lib/listModel.ts';

test('list drafts require a name and enforce the protocol limits', () => {
  assert.equal(validateListDraft('', ''), 'Give the list a name.');
  assert.equal(validateListDraft('   ', ''), 'Give the list a name.');
  assert.equal(validateListDraft('Neighbours', ''), null);
  assert.equal(validateListDraft('a'.repeat(64), ''), null);
  assert.match(validateListDraft('a'.repeat(65), ''), /64 characters/);
  assert.match(
    validateListDraft('Neighbours', 'a'.repeat(301)),
    /300 characters/
  );
});

test('curation and moderation lists are labelled honestly', () => {
  assert.equal(listPurposeMeta(CURATE_LIST).shortLabel, 'Curation');
  assert.equal(listPurposeMeta(MOD_LIST).shortLabel, 'Moderation');
  assert.equal(listPurposeMeta('unknown').shortLabel, 'List');
});

test('viewer state covers subscribed, blocked and hidden lists', () => {
  assert.deepEqual(listViewerState({}), {
    subscribed: false,
    blocked: false,
    hidden: false,
    blockedUri: undefined,
  });
  const state = listViewerState({
    viewer: { muted: true, blocked: 'at://did:plc:test/app.bsky.graph.listblock/1' },
    labels: [{ val: '!hide' }],
  });
  assert.equal(state.subscribed, true);
  assert.equal(state.blocked, true);
  assert.equal(state.hidden, true);
  assert.match(state.blockedUri, /listblock/);
});

test('list counts never invent a negative member count', () => {
  assert.equal(listMemberCount({ listItemCount: 4 }), 4);
  assert.equal(listMemberCount({ listItemCount: -1 }, 3), 3);
  assert.equal(listMemberCount({}, 2), 2);
});

test('list groups de-duplicate by AT URI without reordering', () => {
  const a = { uri: 'at://a', name: 'A' };
  const b = { uri: 'at://b', name: 'B' };
  const merged = mergeUniqueLists([[a, b], [b, { uri: 'at://c' }]]);
  assert.deepEqual(merged.map((item) => item.uri), ['at://a', 'at://b', 'at://c']);
});

test('local list search matches names, descriptions and creators', () => {
  const lists = [
    { name: 'Neighbours', description: 'Local people', creator: { handle: 'ewan.test' } },
    { name: 'Quiet feeds', description: 'Long reads', creator: { handle: 'ailsa.test' } },
  ];
  assert.equal(filterLists(lists, 'neigh').length, 1);
  assert.equal(filterLists(lists, 'LONG').length, 1);
  assert.equal(filterLists(lists, 'ailsa').length, 1);
  assert.equal(filterLists(lists, '').length, 2);
});

test('missing list permissions point to renewing the OAuth session', () => {
  assert.match(
    listActionError(new Error('insufficient scope'), 'Try again.'),
    /Sign out, sign in again/
  );
  assert.equal(listActionError(new Error('offline'), 'Try again.'), 'Try again.');
});

test('the list feature adds exact OAuth scopes and no wildcards', () => {
  const metadata = JSON.parse(
    readFileSync(new URL('../oauth-client-metadata.json', import.meta.url), 'utf8')
  );
  const tokens = metadata.scope.split(/\s+/).filter(Boolean);
  const required = [
    'repo:app.bsky.graph.list?action=create&action=update&action=delete',
    'repo:app.bsky.graph.listitem?action=create&action=delete',
    'repo:app.bsky.graph.listblock?action=create&action=delete',
    'rpc:app.bsky.graph.getLists?aud=did:web:api.eurosky.network#bsky_appview',
    'rpc:app.bsky.graph.getList?aud=did:web:api.eurosky.network#bsky_appview',
    'rpc:app.bsky.graph.getListMutes?aud=did:web:api.eurosky.network#bsky_appview',
    'rpc:app.bsky.graph.getListBlocks?aud=did:web:api.eurosky.network#bsky_appview',
    'rpc:app.bsky.feed.getListFeed?aud=did:web:api.eurosky.network#bsky_appview',
    'rpc:app.bsky.graph.muteActorList?aud=did:web:api.eurosky.network#bsky_appview',
    'rpc:app.bsky.graph.unmuteActorList?aud=did:web:api.eurosky.network#bsky_appview',
  ];
  assert.equal(tokens.length, 112);
  for (const scope of required) assert.ok(tokens.includes(scope), scope);
  assert.equal(/repo:\*|rpc:\*|blob:\*/.test(metadata.scope), false);
});
