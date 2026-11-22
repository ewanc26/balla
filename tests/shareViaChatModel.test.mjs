import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildShareMessage,
  canSharePost,
  isGroupConvo,
  recentConvos,
  shareMessageText,
  shareTargetLabel,
} from '../src/lib/shareViaChatModel.ts';

const POST = {
  uri: 'at://did:plc:abc/app.bsky.feed.post/3labc',
  cid: 'bafy-post-cid',
  record: { text: 'A lovely post about the book fair.' },
};

test('a post needs a real AT-URI and CID to be shared into chat', () => {
  assert.equal(canSharePost(POST), true);
  assert.equal(canSharePost({ ...POST, uri: 'https://bsky.app/post/1' }), false);
  assert.equal(canSharePost({ ...POST, cid: '' }), false);
  assert.equal(canSharePost(null), false);
});

test('the share message carries the post as an app.bsky.embed.record strong ref', () => {
  const message = buildShareMessage(POST);
  assert.equal(message.$type, 'chat.bsky.convo.defs#messageInput');
  assert.equal(message.embed.$type, 'app.bsky.embed.record');
  assert.deepEqual(message.embed.record, { uri: POST.uri, cid: POST.cid });
  assert.equal(message.text, 'A lovely post about the book fair.');
  assert.throws(() => buildShareMessage({ uri: 'nope' }), /no shareable address/);
});

test('share text falls back and is bounded', () => {
  assert.equal(shareMessageText({}), 'Shared a post');
  assert.equal(shareMessageText({ record: { text: '  hi  ' } }), 'hi');
  assert.equal(shareMessageText({ record: { text: 'x'.repeat(500) } }).length, 300);
});

test('recent convos drop requests and sort newest first', () => {
  const convos = [
    { id: 'old', lastMessage: { sentAt: '2026-01-01T00:00:00Z' } },
    { id: 'new', lastMessage: { sentAt: '2026-02-01T00:00:00Z' } },
    { id: 'req', status: 'request', lastMessage: { sentAt: '2026-03-01T00:00:00Z' } },
  ];
  assert.deepEqual(recentConvos(convos).map((c) => c.id), ['new', 'old']);
  assert.deepEqual(recentConvos(undefined), []);
});

test('share labels cover groups and direct convos', () => {
  const group = { kind: { $type: 'chat.bsky.convo.defs#groupConvo', name: 'Book club' } };
  assert.equal(isGroupConvo(group), true);
  assert.equal(shareTargetLabel(group), 'Book club');
  const direct = { members: [{ did: 'did:plc:mum', handle: 'mum.bsky.social' }] };
  assert.equal(isGroupConvo(direct), false);
  assert.equal(shareTargetLabel(direct, 'did:plc:me'), '@mum.bsky.social');
});
