/**
 * Framework-free rules for group chat, reactions and chat notifications. No
 * React Native or agent imports, so these can be tested under Node. Message
 * text and reaction values are never logged; the helpers only shape data that
 * is shown inside a signed-in conversation.
 */

export const GROUP_NAME_LIMIT = 64;
export const REACTION_VALUE_LIMIT = 16;
export const JOIN_CODE_LIMIT = 200;

/** Fixed quick picks; any short string is still accepted from the text field. */
export const REACTION_CHOICES = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

export const JOIN_RULES = [
  { value: 'anyone', label: 'Anyone with the link' },
  { value: 'followedByOwner', label: 'People the owner follows' },
] as const;

export const NOTIFICATION_INCLUDES = [
  { value: 'all', label: 'Everyone' },
  { value: 'follows', label: 'People I follow' },
] as const;

function typeOf(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const typed = value as { $type?: unknown; type?: unknown };
  return String(typed.$type || typed.type || '');
}

export function validateGroupName(name: string): string | null {
  const value = (name || '').trim();
  if (!value) return 'Give the group a name.';
  if ([...value].length > GROUP_NAME_LIMIT) {
    return `Group names must be ${GROUP_NAME_LIMIT} characters or fewer.`;
  }
  return null;
}

export function validateJoinCode(code: string): string | null {
  const value = (code || '').trim();
  if (!value) return 'Enter the join code from the invitation.';
  if (value.length > JOIN_CODE_LIMIT) return 'That join code is too long.';
  return null;
}

export function validateReactionValue(value: string): string | null {
  const trimmed = (value || '').trim();
  if (!trimmed) return 'Choose or type a reaction.';
  if ([...trimmed].length > REACTION_VALUE_LIMIT) {
    return `Reactions must be ${REACTION_VALUE_LIMIT} characters or fewer.`;
  }
  return null;
}

export function memberRole(member: any): string {
  const kind = member?.kind;
  if (typeOf(kind).includes('#groupConvoMember')) {
    return typeof kind?.role === 'string' ? kind.role : 'standard';
  }
  return 'standard';
}

export function isOwner(member: any): boolean {
  return memberRole(member) === 'owner';
}

export function findMember(members: any[] | undefined, did: string): any {
  if (!Array.isArray(members) || !did) return null;
  return members.find((member: any) => member?.did === did) || null;
}

/** The full member list from getConvoMembers decides ownership; ConvoView.members is only a subset. */
export function viewerIsOwner(members: any[] | undefined, viewerDid: string): boolean {
  return isOwner(findMember(members, viewerDid));
}

export function joinRuleLabel(value: string): string {
  return JOIN_RULES.find((rule) => rule.value === value)?.label || 'Restricted';
}

export function joinLinkEnabled(link: any): boolean {
  if (!link) return false;
  if (typeOf(link).includes('#disabledJoinLink')) return false;
  return link?.enabledStatus !== 'disabled';
}

export function joinLinkStatusLabel(link: any): string {
  if (!link) return 'No invite link';
  return joinLinkEnabled(link) ? 'Invite link is active' : 'Invite link is disabled';
}

/** Join-link previews are a union of valid, disabled and invalid views. */
export function joinPreviewState(preview: any): 'valid' | 'disabled' | 'invalid' {
  const kind = typeOf(preview);
  if (kind.includes('#disabledJoinLinkPreview')) return 'disabled';
  if (kind.includes('#invalidJoinLinkPreview')) return 'invalid';
  return 'valid';
}

export function joinPreviewCopy(preview: any): string {
  switch (joinPreviewState(preview)) {
    case 'disabled':
      return 'This invite link has been disabled by the group owner.';
    case 'invalid':
      return 'This invite code is not valid. Check it and try again.';
    default:
      return '';
  }
}

export function joinPreviewTitle(preview: any): string {
  if (joinPreviewState(preview) !== 'valid') return '';
  return String(preview?.name || '').trim() || 'Group conversation';
}

/**
 * Group lock states: a moderation override or a permanent lock cannot be
 * changed by the owner, so the settings screen must not offer a toggle.
 */
export function canOwnerChangeLock(convo: any): boolean {
  if (!convo) return false;
  if (convo?.kind?.lockStatusModerationOverride) return false;
  const status = convo?.kind?.lockStatus;
  return status !== 'locked-permanently';
}

export function lockStatusLabel(convo: any): string {
  const status = convo?.kind?.lockStatus;
  if (convo?.kind?.lockStatusModerationOverride) {
    return 'Locked by Bluesky moderation';
  }
  if (status === 'locked-permanently') return 'Locked permanently';
  if (status === 'locked') return 'Locked';
  return 'Unlocked';
}

export function lockAction(convo: any): 'lock' | 'unlock' | null {
  if (!canOwnerChangeLock(convo)) return null;
  return convo?.kind?.lockStatus === 'locked' ? 'unlock' : 'lock';
}

/** Owner-only pending request counts are capped by the service; show them as given. */
export function joinRequestCount(convo: any): number {
  if (typeof convo?.kind?.joinRequestCount === 'number') return convo.kind.joinRequestCount;
  if (typeof convo?.kind?.unreadJoinRequestCount === 'number') {
    return convo.kind.unreadJoinRequestCount;
  }
  return 0;
}

export type ReactionSummary = { value: string; count: number; mine: boolean };

/** Count reaction values and mark those the viewer added, without exposing raw sender data. */
export function groupReactions(message: any, viewerDid: string): ReactionSummary[] {
  if (!Array.isArray(message?.reactions)) return [];
  const summaries = new Map<string, ReactionSummary>();
  for (const reaction of message.reactions) {
    const value = String(reaction?.value || '').trim();
    if (!value) continue;
    const existing = summaries.get(value);
    if (existing) {
      existing.count += 1;
      if (reaction?.sender?.did === viewerDid) existing.mine = true;
    } else {
      summaries.set(value, {
        value,
        count: 1,
        mine: reaction?.sender?.did === viewerDid,
      });
    }
  }
  return [...summaries.values()].sort((a, b) =>
    a.value.localeCompare(b.value)
  );
}

export function buildReplyRef(messageId: string): {
  $type: string;
  messageId: string;
} {
  return {
    $type: 'chat.bsky.convo.defs#replyRef',
    messageId: (messageId || '').trim(),
  };
}

export function replyPreview(replyTo: any): string {
  if (!replyTo) return '';
  const text = String(replyTo?.text || '').trim();
  return text ? text : 'Replying to an earlier message';
}

export function notificationIncludeLabel(value: string): string {
  return NOTIFICATION_INCLUDES.find((item) => item.value === value)?.label || 'Not set';
}

/**
 * Chat report subjects use the open end of com.atproto.moderation.createReport's
 * union. The generated TypeScript names only repoRef and strongRef, but the
 * official client sends these chat refs as the protocol defines them.
 */
export function buildMessageReportSubject(convoId: string, message: any): any {
  return {
    $type: 'chat.bsky.convo.defs#messageRef',
    messageId: String(message?.id || ''),
    convoId: (convoId || '').trim(),
    did: String(message?.sender?.did || ''),
  };
}

export function buildConvoReportSubject(convoId: string, members: any[] | undefined): any {
  const list = Array.isArray(members) ? members : [];
  // Group conversation reports target the owner; direct reports target the
  // other member. ConvoView.members is only a subset, so callers pass the full
  // member list from getConvoMembers when they have it.
  const other = list.find((member) => isOwner(member)) || list[0];
  return {
    $type: 'chat.bsky.convo.defs#convoRef',
    convoId: (convoId || '').trim(),
    did: String(other?.did || ''),
  };
}

/** A message action is only available when it names a real message id. */
export function messageActionable(message: any): boolean {
  return typeof message?.id === 'string' && message.id.length > 0;
}

export function joinLinkLabel(code: string): string {
  const value = (code || '').trim();
  if (!value) return '';
  return value;
}
