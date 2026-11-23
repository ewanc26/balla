import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_AUDIENCE,
  CHAT_SERVICE_DID,
  CHAT_SERVICE_TYPE,
  chatServiceAdvertised,
  chatServiceCopy,
  chatServiceFromDidDocument,
  chatServiceStateFromError,
  isServiceWideFailure,
} from '../src/lib/chatServiceModel.ts';

test('chat service constants mirror the documented proxy and granted audience', () => {
  assert.equal(CHAT_SERVICE_DID, 'did:web:api.bsky.chat');
  assert.equal(CHAT_SERVICE_TYPE, 'bsky_chat');
  assert.equal(CHAT_AUDIENCE, 'did:web:api.bsky.chat#bsky_chat');
});

test('failure states come from error codes and status only, never from text', () => {
  const cases = [
    [{ error: 'MessagesDisabled' }, 'disabled'],
    [{ error: 'ChatDisabled' }, 'disabled'],
    [{ status: 404 }, 'not-advertised'],
    [{ status: 405 }, 'not-advertised'],
    [{ error: 'UnknownMethod' }, 'not-advertised'],
    [{ error: 'MethodNotFound' }, 'not-advertised'],
    [{ status: 401 }, 'unauthorised'],
    [{ status: 403 }, 'unauthorised'],
    [{ status: 429 }, 'limited'],
    [{ error: 'RateLimitExceeded' }, 'limited'],
    [{ status: 503 }, 'unreachable'],
    [{ error: 'NetworkError' }, 'unreachable'],
    [{ error: 'FetchError' }, 'unreachable'],
    [{}, 'unknown'],
  ];
  for (const [err, expected] of cases) {
    assert.equal(chatServiceStateFromError(err), expected, JSON.stringify(err));
  }
  // A provider error message that happens to contain chat words is ignored:
  // it might carry private conversation details.
  assert.equal(
    chatServiceStateFromError({ error: 'SomethingElse', message: 'NetworkError for DM text' }),
    'unknown'
  );
});

test('a DID document only advertises chat with a real HTTPS service', () => {
  const document = {
    service: [
      { id: '#other', type: 'Other', serviceEndpoint: 'https://example.test' },
      { id: '#bsky_chat', type: 'BskyChatService', serviceEndpoint: 'https://api.bsky.chat' },
    ],
  };
  assert.equal(chatServiceAdvertised(document), true);
  assert.equal(
    chatServiceFromDidDocument(document).serviceEndpoint,
    'https://api.bsky.chat'
  );
  assert.equal(chatServiceAdvertised({ service: [] }), false);
  assert.equal(chatServiceAdvertised(null), false);
  // A non-HTTPS or malformed endpoint is not a usable service.
  assert.equal(
    chatServiceAdvertised({ service: [{ id: '#bsky_chat', serviceEndpoint: 'not a url' }] }),
    false
  );
});

test('service-wide failures get an explanatory state, transient ones do not', () => {
  for (const state of ['not-advertised', 'unauthorised', 'disabled', 'unreachable']) {
    assert.equal(isServiceWideFailure(state), true, state);
  }
  for (const state of ['checking', 'reachable', 'limited', 'unknown']) {
    assert.equal(isServiceWideFailure(state), false, state);
  }
});

test('chat status copy is honest and never echoes message content', () => {
  assert.match(chatServiceCopy('not-advertised'), /host doesn’t run/);
  assert.match(chatServiceCopy('not-advertised'), /other Balla screens keep working/);
  assert.match(chatServiceCopy('unauthorised'), /Sign in again/);
  for (const state of [
    'checking', 'reachable', 'unreachable', 'not-advertised',
    'unauthorised', 'disabled', 'limited', 'unknown',
  ]) {
    const copy = chatServiceCopy(state);
    assert.ok(copy.length > 0, state);
    assert.doesNotMatch(copy, /undefined|\[object Object\]/, state);
  }
});
