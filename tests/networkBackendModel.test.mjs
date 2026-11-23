import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKEND_VERB_STATUS,
  NETWORK_BACKEND_COPY,
  NETWORK_BACKEND_ID,
  backendDirectVerbs,
  backendRoutedVerbs,
} from '../src/lib/networkBackendModel.ts';

test('the backend inventory covers every verb group exactly once', () => {
  assert.equal(NETWORK_BACKEND_ID, 'atproto');
  const verbs = BACKEND_VERB_STATUS.map((entry) => entry.verb);
  assert.deepEqual(verbs, [
    'session',
    'timeline',
    'thread',
    'notifications',
    'profile',
    'compose',
    'media',
    'moderation',
    'search',
  ]);
  assert.equal(new Set(verbs).size, verbs.length);
  for (const entry of BACKEND_VERB_STATUS) {
    assert.ok(entry.label.length > 0);
    assert.ok(entry.detail.length > 0);
    assert.ok(['routed', 'direct'].includes(entry.routing));
  }
});

test('the routed and direct lists describe this slice, not a completed migration', () => {
  assert.deepEqual(backendRoutedVerbs(), [
    'timeline',
    'thread',
    'notifications',
    'profile',
    'search',
  ]);
  assert.deepEqual(backendDirectVerbs(), [
    'session',
    'compose',
    'media',
    'moderation',
  ]);
  assert.equal(
    BACKEND_VERB_STATUS.find((entry) => entry.verb === 'session').routing,
    'direct'
  );
  assert.equal(
    BACKEND_VERB_STATUS.find((entry) => entry.verb === 'search').routing,
    'routed'
  );
});

test('backend copy does not claim a second backend or a hidden feature', () => {
  assert.equal(NETWORK_BACKEND_COPY.title, 'Backend');
  assert.equal(NETWORK_BACKEND_COPY.selected, 'AT Protocol');
  assert.match(NETWORK_BACKEND_COPY.selectedDetail, /only registered backend/i);
  assert.match(NETWORK_BACKEND_COPY.note, /mechanical refactor, not a second backend/i);
  assert.match(NETWORK_BACKEND_COPY.note, /behaves exactly as before/i);
  assert.match(NETWORK_BACKEND_COPY.note, /no bridge, identity mapping or provider switch is implied/i);
  assert.match(NETWORK_BACKEND_COPY.scope, /screen call sites this slice did not migrate/i);
  assert.match(NETWORK_BACKEND_COPY.scope, /future adapter would implement the same contract/i);
});
