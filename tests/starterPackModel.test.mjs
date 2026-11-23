import test from 'node:test';
import assert from 'node:assert/strict';
import {
  diffStarterPackMembers,
  isBlockedCreator,
  isRecordNotFoundError,
  parseStarterPackListUri,
  parseStarterPackUri,
  starterPackActionError,
  starterPackListItemRecord,
  starterPackListRecord,
  starterPackRecord,
  starterPackShareUrl,
  validateStarterPackDraft,
} from '../src/lib/starterPackModel.ts';

test('starter-pack AT URIs are parsed only for the real collection', () => {
  assert.deepEqual(
    parseStarterPackUri(
      'at://did:plc:abc123/app.bsky.graph.starterpack/3labcdef'
    ),
    { did: 'did:plc:abc123', rkey: '3labcdef' }
  );
  assert.equal(
    parseStarterPackUri('at://did:plc:abc123/app.bsky.graph.list/3labcdef'),
    null
  );
  assert.equal(parseStarterPackUri('https://bsky.app/start/alice.test/3labc'), null);
  assert.equal(parseStarterPackUri('at://did:plc:abc123/app.bsky.graph.starterpack/'), null);
});

test('reference-list URIs are parsed only for the list collection', () => {
  assert.deepEqual(
    parseStarterPackListUri(
      'at://did:plc:abc123/app.bsky.graph.list/3labcdef'
    ),
    { did: 'did:plc:abc123', rkey: '3labcdef' }
  );
  assert.equal(
    parseStarterPackListUri(
      'at://did:plc:abc123/app.bsky.graph.starterpack/3labcdef'
    ),
    null
  );
  assert.equal(parseStarterPackListUri('at://bad'), null);
});

test('share links use the official short path and never invent membership', () => {
  const uri = 'at://did:plc:abc123/app.bsky.graph.starterpack/3labcdef';
  assert.equal(
    starterPackShareUrl(uri, { handle: 'alice.bsky.social', did: 'did:plc:abc123' }),
    'https://bsky.app/start/alice.bsky.social/3labcdef'
  );
  assert.equal(
    starterPackShareUrl(uri, { did: 'did:plc:abc123' }),
    'https://bsky.app/start/did:plc:abc123/3labcdef'
  );
  assert.equal(starterPackShareUrl(uri, {}), null);
  assert.equal(starterPackShareUrl('at://bad', { handle: 'alice' }), null);
});

test('blocked creators are detected from either side of the viewer state', () => {
  assert.equal(isBlockedCreator({ viewer: { blocking: 'at://block' } }), true);
  assert.equal(isBlockedCreator({ viewer: { blockedBy: true } }), true);
  assert.equal(isBlockedCreator({ viewer: {} }), false);
  assert.equal(isBlockedCreator(null), false);
});

test('draft validation uses real visible limits and trims for storage', () => {
  assert.equal(validateStarterPackDraft('Neighbours', 'Tea and walking'), null);
  assert.equal(validateStarterPackDraft('   ', ''), 'Give the starter pack a name.');
  assert.match(validateStarterPackDraft('x'.repeat(65), ''), /at most 64/);
  assert.match(
    validateStarterPackDraft('Name', 'y'.repeat(301)),
    /at most 300/
  );
});

test('record bodies use generated lexicon shapes with an injected timestamp', () => {
  const createdAt = '2026-11-22T12:00:00.000Z';
  const list = starterPackListRecord(' Neighbours ', '  Tea  ', createdAt);
  assert.deepEqual(list, {
    $type: 'app.bsky.graph.list',
    purpose: 'app.bsky.graph.defs#referencelist',
    name: 'Neighbours',
    description: 'Tea',
    createdAt,
  });
  assert.deepEqual(
    starterPackListItemRecord('did:plc:member', list.uri || 'at://list', createdAt),
    {
      $type: 'app.bsky.graph.listitem',
      subject: 'did:plc:member',
      list: 'at://list',
      createdAt,
    }
  );
  assert.deepEqual(
    starterPackRecord({
      name: ' Neighbours ',
      description: '  ',
      list: 'at://did:plc:owner/app.bsky.graph.list/rkey',
      feeds: ['at://did:plc:owner/app.bsky.feed.generator/quiet'],
      createdAt,
    }),
    {
      $type: 'app.bsky.graph.starterpack',
      name: 'Neighbours',
      list: 'at://did:plc:owner/app.bsky.graph.list/rkey',
      feeds: [
        {
          $type: 'app.bsky.graph.starterpack#feedItem',
          uri: 'at://did:plc:owner/app.bsky.feed.generator/quiet',
        },
      ],
      createdAt,
    }
  );
});

test('only the PDS record-not-found error is treated as an already-deleted list', () => {
  assert.equal(
    isRecordNotFoundError({
      status: 400,
      error: 'RecordNotFound',
      message: 'Could not locate record',
    }),
    true
  );
  assert.equal(isRecordNotFoundError({ status: 404, message: 'RecordNotFound' }), true);
  assert.equal(isRecordNotFoundError({ status: 500, message: 'Internal error' }), false);
  assert.equal(isRecordNotFoundError(new Error('offline')), false);
});

test('member diffs and scope errors stay deterministic', () => {
  assert.deepEqual(
    diffStarterPackMembers(['a', 'b', 'c'], ['b', 'c', 'd']),
    { added: ['d'], removed: ['a'] }
  );
  assert.deepEqual(diffStarterPackMembers([], []), { added: [], removed: [] });
  assert.match(
    starterPackActionError(new Error('Bad token scope'), 'Fallback'),
    /Sign out, sign in again/
  );
  assert.equal(starterPackActionError(new Error('offline'), 'Fallback'), 'Fallback');
});
