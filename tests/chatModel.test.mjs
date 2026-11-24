import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIENCE_OPTIONS,
  CHAT_AUDIENCE,
  audienceLabel,
  buildPostEmbed,
  canSendMessage,
  chatErrorCopy,
  chatFailureFrom,
  convoSubtitle,
  convoTitle,
  isGroup,
  isJoinRequest,
  isPostUri,
  isRequest,
  messageKind,
  messagePreview,
  sendBlockedCopy,
  senderName,
  systemMessageCopy,
  unreadLabel,
  validateMessageText,
} from '../src/lib/chatModel.ts';

test('chat audience and proxy are documented constants', () => {
  assert.equal(CHAT_AUDIENCE, 'did:web:api.bsky.chat#bsky_chat');
  assert.deepEqual(
    AUDIENCE_OPTIONS.map((option) => option.value).slice(),
    ['all', 'following', 'none']
  );
  assert.equal(audienceLabel('following'), 'People I follow');
  assert.equal(audienceLabel(undefined), 'Not set');
});

test('conversation titles name the other person or the group', () => {
  const direct = {
    members: [
      { did: 'did:plc:me', handle: 'me.test' },
      { did: 'did:plc:mum', handle: 'mum.test', displayName: 'Mum' },
    ],
  };
  assert.equal(convoTitle(direct, 'did:plc:me'), 'Mum');
  assert.equal(convoSubtitle(direct, 'did:plc:me'), 'mum.test');

  const group = {
    members: [{ did: 'did:plc:me', handle: 'me.test' }],
    kind: { $type: 'chat.bsky.convo.defs#groupConvo', name: 'Family', memberCount: 4 },
  };
  assert.equal(isGroup(group), true);
  assert.equal(convoTitle(group, 'did:plc:me'), 'Family');
  assert.equal(convoSubtitle(group, 'did:plc:me'), 'Group · 4 members');
  assert.equal(convoTitle({}, 'did:plc:me'), 'Conversation');
});

test('group message senders resolve to a name from the page profiles', () => {
  // A message view carries only the sender DID. The names come from the
  // relatedProfiles a getMessages page returns, plus the convo member subset.
  const profiles = [
    { did: 'did:plc:me', handle: 'me.test', displayName: 'Me' },
    { did: 'did:plc:mum', handle: 'mum.test', displayName: 'Mum' },
    { did: 'did:plc:ailsa', handle: 'ailsa.test' },
  ];
  assert.equal(senderName({ sender: { did: 'did:plc:mum' } }, profiles, 'did:plc:me'), 'Mum');
  assert.equal(senderName({ sender: { did: 'did:plc:ailsa' } }, profiles, 'did:plc:me'), '@ailsa.test');
  assert.equal(senderName({ sender: { did: 'did:plc:me' } }, profiles, 'did:plc:me'), 'You');
  // An unresolvable sender is left blank, never given an invented name.
  assert.equal(senderName({ sender: { did: 'did:plc:unknown' } }, profiles, 'did:plc:me'), '');
  assert.equal(senderName({ sender: { did: 'did:plc:mum' } }, undefined, 'did:plc:me'), '');
  assert.equal(senderName({}, profiles, 'did:plc:me'), '');
});

test('request, join-request and locked states are named honestly', () => {
  assert.equal(isRequest({ status: 'request' }), true);
  assert.equal(isRequest({ status: 'accepted' }), false);
  assert.equal(
    isJoinRequest({ $type: 'chat.bsky.group.defs#joinRequestConvoView' }),
    true
  );
  const locked = { kind: { lockStatus: 'locked' } };
  assert.equal(canSendMessage(locked), false);
  assert.match(sendBlockedCopy(locked), /locked/);
  assert.equal(canSendMessage({ status: 'request' }), false);
  assert.equal(canSendMessage({ kind: { lockStatus: 'unlocked' } }), true);
});

test('message kinds and previews cover text, deleted and system messages', () => {
  assert.equal(messageKind({ $type: 'chat.bsky.convo.defs#messageView', text: 'Hi' }), 'text');
  assert.equal(messageKind({ $type: 'chat.bsky.convo.defs#deletedMessageView' }), 'deleted');
  assert.equal(messageKind({ $type: 'chat.bsky.convo.defs#systemMessageView' }), 'system');
  assert.equal(messageKind({}), 'unknown');
  assert.equal(messagePreview({ text: '  Hello  ' }), 'Hello');
  assert.equal(messagePreview({ $type: 'chat.bsky.convo.defs#deletedMessageView' }), 'Message deleted');
  assert.equal(
    systemMessageCopy({ $type: 'chat.bsky.convo.defs#systemMessageDataMemberLeave' }),
    'Someone left the group'
  );
  assert.equal(messagePreview(null), 'No messages yet');
});

test('unread counts respect the Bluesky cap', () => {
  assert.equal(unreadLabel(0), '');
  assert.equal(unreadLabel(3), '3');
  assert.equal(unreadLabel(100), '99+');
  assert.equal(unreadLabel(120), '99+');
});

test('message validation is empty-safe and length-limited', () => {
  assert.match(validateMessageText('   '), /Write a message/);
  assert.equal(validateMessageText('Hello'), null);
  assert.match(validateMessageText('x'.repeat(1001)), /1000/);
});

test('post embeds only accept post AT URIs and use the record shape', () => {
  assert.equal(isPostUri('at://did:plc:abc/app.bsky.feed.post/3k'), true);
  assert.equal(isPostUri('https://bsky.app/profile/a/post/3k'), false);
  assert.equal(isPostUri('at://did:plc:abc/app.bsky.graph.list/3k'), false);
  assert.deepEqual(buildPostEmbed(' at://did:plc:abc/app.bsky.feed.post/3k ', 'bafy'), {
    $type: 'app.bsky.embed.record',
    record: { uri: 'at://did:plc:abc/app.bsky.feed.post/3k', cid: 'bafy' },
  });
});

test('chat errors map to honest, content-free copy', () => {
  assert.equal(chatFailureFrom({ error: 'MessagesDisabled' }), 'disabled');
  assert.equal(chatFailureFrom({ error: 'BlockedActor' }), 'blocked');
  assert.equal(chatFailureFrom({ error: 'NotFollowedBySender' }), 'not-followed');
  assert.match(chatErrorCopy({ error: 'MessagesDisabled' }), /turned off/);
  assert.match(chatErrorCopy({ error: 'BlockedSubject' }), /block/);
  assert.match(chatErrorCopy(new Error('offline')), /offline/);
  assert.match(chatErrorCopy({}), /could not be loaded/);
});
