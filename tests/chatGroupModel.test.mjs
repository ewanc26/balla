import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GROUP_NAME_LIMIT,
  JOIN_RULES,
  NOTIFICATION_INCLUDES,
  REACTION_CHOICES,
  buildConvoReportSubject,
  buildMessageReportSubject,
  buildReplyRef,
  canOwnerChangeLock,
  findMember,
  groupReactions,
  isOwner,
  joinLinkEnabled,
  joinLinkStatusLabel,
  joinRequestCount,
  joinRuleLabel,
  lockAction,
  lockStatusLabel,
  memberRole,
  notificationIncludeLabel,
  replyPreview,
  validateGroupName,
  validateJoinCode,
  validateReactionValue,
  viewerIsOwner,
} from '../src/lib/chatGroupModel.ts';

test('group names and join codes are validated without hidden limits', () => {
  assert.match(validateGroupName('   '), /name/);
  assert.equal(validateGroupName('Family'), null);
  assert.match(validateGroupName('x'.repeat(GROUP_NAME_LIMIT + 1)), new RegExp(String(GROUP_NAME_LIMIT)));
  assert.match(validateJoinCode('  '), /join code/);
  assert.equal(validateJoinCode('abc123'), null);
});

test('reaction values accept quick picks and bounded custom text', () => {
  assert.equal(REACTION_CHOICES.length, 6);
  assert.match(validateReactionValue('  '), /reaction/);
  assert.equal(validateReactionValue('👍'), null);
  assert.match(validateReactionValue('x'.repeat(17)), /16/);
});

test('ownership comes from the full member list, not the subset on ConvoView', () => {
  const members = [
    { did: 'did:plc:viewer', handle: 'viewer.test', kind: { $type: 'chat.bsky.actor.defs#groupConvoMember', role: 'standard' } },
    { did: 'did:plc:owner', handle: 'owner.test', kind: { $type: 'chat.bsky.actor.defs#groupConvoMember', role: 'owner' } },
  ];
  assert.equal(memberRole(members[1]), 'owner');
  assert.equal(isOwner(members[1]), true);
  assert.equal(isOwner(members[0]), false);
  assert.equal(memberRole({ did: 'did:plc:x' }), 'standard');
  assert.equal(findMember(members, 'did:plc:owner'), members[1]);
  assert.equal(findMember(members, 'did:plc:missing'), null);
  assert.equal(viewerIsOwner(members, 'did:plc:owner'), true);
  assert.equal(viewerIsOwner(members, 'did:plc:viewer'), false);
  assert.equal(viewerIsOwner(undefined, 'did:plc:owner'), false);
});

test('join rules and link states are named honestly', () => {
  assert.deepEqual(JOIN_RULES.map((rule) => rule.value), ['anyone', 'followedByOwner']);
  assert.equal(joinRuleLabel('anyone'), 'Anyone with the link');
  assert.equal(joinRuleLabel('unknown'), 'Restricted');
  assert.equal(joinLinkEnabled(null), false);
  assert.equal(joinLinkEnabled({ code: 'abc' }), true);
  assert.equal(joinLinkEnabled({ $type: 'chat.bsky.group.defs#disabledJoinLinkView' }), false);
  assert.equal(joinLinkStatusLabel(null), 'No invite link');
  assert.equal(joinLinkStatusLabel({ code: 'abc' }), 'Invite link is active');
});

test('lock controls respect moderation overrides and permanent locks', () => {
  assert.equal(canOwnerChangeLock({ kind: { lockStatus: 'unlocked' } }), true);
  assert.equal(canOwnerChangeLock({ kind: { lockStatus: 'locked' } }), true);
  assert.equal(canOwnerChangeLock({ kind: { lockStatus: 'locked-permanently' } }), false);
  assert.equal(canOwnerChangeLock({ kind: { lockStatusModerationOverride: true } }), false);
  assert.equal(canOwnerChangeLock(null), false);
  assert.equal(lockAction({ kind: { lockStatus: 'locked' } }), 'unlock');
  assert.equal(lockAction({ kind: { lockStatus: 'unlocked' } }), 'lock');
  assert.equal(lockAction({ kind: { lockStatus: 'locked-permanently' } }), null);
  assert.equal(lockStatusLabel({ kind: { lockStatus: 'locked' } }), 'Locked');
  assert.equal(lockStatusLabel({ kind: { lockStatusModerationOverride: true } }), 'Locked by Bluesky moderation');
  assert.equal(lockStatusLabel({ kind: { lockStatus: 'locked-permanently' } }), 'Locked permanently');
});

test('owner-only join request counts are shown as reported', () => {
  assert.equal(joinRequestCount({ kind: { joinRequestCount: 4 } }), 4);
  assert.equal(joinRequestCount({ kind: { unreadJoinRequestCount: 2 } }), 2);
  assert.equal(joinRequestCount({}), 0);
});

test('reactions are grouped by value and mark the viewer reaction', () => {
  const message = {
    reactions: [
      { value: '👍', sender: { did: 'did:plc:me' } },
      { value: '👍', sender: { did: 'did:plc:them' } },
      { value: '❤️', sender: { did: 'did:plc:them' } },
      { value: '', sender: { did: 'did:plc:me' } },
    ],
  };
  const grouped = groupReactions(message, 'did:plc:me');
  assert.equal(grouped.length, 2);
  assert.deepEqual(
    grouped.map((item) => [item.value, item.count, item.mine]),
    [['❤️', 1, false], ['👍', 2, true]]
  );
  assert.deepEqual(groupReactions({}, 'did:plc:me'), []);
});

test('replies use the in-convo message id, not an at-uri', () => {
  assert.deepEqual(buildReplyRef(' m1 '), {
    $type: 'chat.bsky.convo.defs#replyRef',
    messageId: 'm1',
  });
  assert.equal(replyPreview({ text: '  earlier  ' }), 'earlier');
  assert.equal(replyPreview({}), 'Replying to an earlier message');
  assert.equal(replyPreview(null), '');
});

test('chat notification preferences use real include values', () => {
  assert.deepEqual(NOTIFICATION_INCLUDES.map((item) => item.value), ['all', 'follows']);
  assert.equal(notificationIncludeLabel('follows'), 'People I follow');
  assert.equal(notificationIncludeLabel('all'), 'Everyone');
  assert.equal(notificationIncludeLabel('unknown'), 'Not set');
});

test('chat report subjects use the documented open-union chat refs', () => {
  assert.deepEqual(
    buildMessageReportSubject('convo1', { id: 'm2', sender: { did: 'did:plc:them' } }),
    {
      $type: 'chat.bsky.convo.defs#messageRef',
      messageId: 'm2',
      convoId: 'convo1',
      did: 'did:plc:them',
    }
  );
  assert.deepEqual(
    buildConvoReportSubject('convo1', [{ did: 'did:plc:them' }]),
    { $type: 'chat.bsky.convo.defs#convoRef', convoId: 'convo1', did: 'did:plc:them' }
  );
});
