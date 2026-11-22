/**
 * Framework-free rules for chat. Kept free of React Native imports so the
 * honest fallbacks can be tested under Node.
 *
 * Message content is private. Nothing in this module (or the screens that use
 * it) logs message text, previews or conversation content. Previews returned
 * here are shown only inside the signed-in conversation list.
 */

export const CHAT_PAGE_SIZE = 30;
export const CHAT_TEXT_LIMIT = 1000;

export const CHAT_SERVICE_DID = 'did:web:api.bsky.chat';
export const CHAT_SERVICE_TYPE = 'bsky_chat';
/** The OAuth audience for chat RPCs must carry the service's fragment. */
export const CHAT_AUDIENCE = `${CHAT_SERVICE_DID}#${CHAT_SERVICE_TYPE}`;

export const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Everyone' },
  { value: 'following', label: 'People I follow' },
  { value: 'none', label: 'No one' },
] as const;

export function audienceLabel(value?: string): string {
  return AUDIENCE_OPTIONS.find((option) => option.value === value)?.label || 'Not set';
}

function typeOf(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const typed = value as { $type?: unknown; type?: unknown };
  return String(typed.$type || typed.type || '');
}

export function isGroup(convo: any): boolean {
  if (typeOf(convo?.kind).includes('#groupConvo')) return true;
  // A group kind carries a display name; a direct convo does not.
  return typeof convo?.kind?.name === 'string';
}

export function isRequest(convo: any): boolean {
  return convo?.status === 'request';
}

export function isJoinRequest(item: any): boolean {
  return typeOf(item).includes('#joinRequestConvoView');
}

export function otherMember(convo: any, viewerDid?: string): any {
  const members = Array.isArray(convo?.members) ? convo.members : [];
  return (
    members.find((member: any) => member?.did && member.did !== viewerDid) ||
    members[0] ||
    null
  );
}

export function convoTitle(convo: any, viewerDid?: string): string {
  if (isGroup(convo)) {
    const name = String(convo?.kind?.name || '').trim();
    return name || 'Group conversation';
  }
  const member = otherMember(convo, viewerDid);
  const name = String(member?.displayName || '').trim();
  if (name) return name;
  const handle = String(member?.handle || '').trim();
  return handle || 'Conversation';
}

export function convoSubtitle(convo: any, viewerDid?: string): string {
  if (isGroup(convo)) {
    const count = convo?.kind?.memberCount;
    return typeof count === 'number' ? `Group · ${count} members` : 'Group conversation';
  }
  return String(otherMember(convo, viewerDid)?.handle || '');
}

export function messageKind(message: any): 'text' | 'deleted' | 'system' | 'unknown' {
  const kind = typeOf(message);
  if (kind.includes('#deletedMessageView')) return 'deleted';
  if (kind.includes('#systemMessageView')) return 'system';
  if (kind.includes('#messageView')) return 'text';
  if (typeof message?.text === 'string') return 'text';
  return 'unknown';
}

export function systemMessageCopy(data: unknown): string {
  const kind = typeOf(data);
  if (kind.includes('AddMember')) return 'A member was added to the group';
  if (kind.includes('RemoveMember')) return 'A member was removed from the group';
  if (kind.includes('MemberJoin')) return 'Someone joined the group';
  if (kind.includes('MemberLeave')) return 'Someone left the group';
  if (kind.includes('LockConvoPermanently')) return 'This group was locked permanently';
  if (kind.includes('UnlockConvo')) return 'This group was unlocked';
  if (kind.includes('LockConvo')) return 'This group is locked';
  if (kind.includes('EditGroup')) return 'The group details were changed';
  if (kind.includes('JoinLink')) return 'The group join link was changed';
  return 'A group update';
}

/** A short preview for the conversation list. Never sent to a log. */
export function messagePreview(message: any): string {
  if (!message) return 'No messages yet';
  const kind = messageKind(message);
  if (kind === 'deleted') return 'Message deleted';
  if (kind === 'system') return systemMessageCopy(message.data);
  if (kind === 'text') {
    return String(message.text || '').trim() || 'Message';
  }
  return 'Message';
}

/** Bluesky caps unread counts at 100, where 100 means "more than 99". */
export function unreadLabel(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '';
  return count >= 100 ? '99+' : String(count);
}

export function validateMessageText(text: string): string | null {
  const value = (text || '').trim();
  if (!value) return 'Write a message before sending.';
  if ([...value].length > CHAT_TEXT_LIMIT) {
    return `Messages must be ${CHAT_TEXT_LIMIT} characters or fewer.`;
  }
  return null;
}

/** Only an at:// app.bsky.feed.post URI can become a post embed. */
export function isPostUri(uri: string): boolean {
  return /^at:\/\/[^\s/]+\/app\.bsky\.feed\.post\/[A-Za-z0-9._~-]+$/.test(
    (uri || '').trim()
  );
}

/** The public app.bsky.embed.record shape carried by a chat message input. */
export function buildPostEmbed(uri: string, cid: string): {
  $type: string;
  record: { uri: string; cid: string };
} {
  return {
    $type: 'app.bsky.embed.record',
    record: { uri: (uri || '').trim(), cid: (cid || '').trim() },
  };
}

export function chatFailureFrom(err: unknown): string {
  const raw =
    (err as any)?.error ??
    (err as any)?.message ??
    (err as any)?.name ??
    err;
  const code = String(raw || '').toLowerCase();
  if (code.includes('messagesdisabled') || code.includes('chatdisabled')) return 'disabled';
  if (code.includes('blockedactor') || code.includes('blockedsubject') || code.includes('blocked')) {
    return 'blocked';
  }
  if (code.includes('notfollowedbysender')) return 'not-followed';
  if (code.includes('accountsuspended') || code.includes('suspended')) return 'suspended';
  if (
    code.includes('recipientnotfound') ||
    code.includes('invalidconvo') ||
    code.includes('notfound')
  ) {
    return 'not-found';
  }
  if (code.includes('convolocked') || code.includes('locked')) return 'locked';
  if (code.includes('ratelimit') || code === '429') return 'rate-limited';
  if (code.includes('offline') || code.includes('network') || code.includes('fetch')) {
    return 'offline';
  }
  return 'unknown';
}

/** Plain-language, honest error copy. Never includes message content. */
export function chatErrorCopy(err: unknown): string {
  switch (chatFailureFrom(err)) {
    case 'disabled':
      return 'Chat is turned off for this account. Turn it on in Bluesky settings to use messages.';
    case 'blocked':
      return 'You cannot message this person because of a block between your accounts.';
    case 'not-followed':
      return 'This person needs to follow you before you can message them.';
    case 'suspended':
      return 'This account is suspended and cannot be messaged.';
    case 'not-found':
      return 'That conversation or profile is no longer available.';
    case 'locked':
      return 'This conversation is locked. New messages cannot be sent.';
    case 'rate-limited':
      return 'Bluesky is limiting requests just now. Try again in a moment.';
    case 'offline':
      return 'You appear to be offline. Check your connection and try again.';
    default:
      return 'Messages could not be loaded. Please try again.';
  }
}

export function sendBlockedCopy(convo: any): string {
  if (!convo) return 'This conversation is not available.';
  if (isRequest(convo)) return 'Accept this request before replying.';
  const lock = convo?.kind?.lockStatus;
  if (
    lock === 'locked' ||
    lock === 'locked-permanently' ||
    convo?.kind?.lockStatusModerationOverride
  ) {
    return 'This conversation is locked. New messages cannot be sent.';
  }
  return '';
}

export function canSendMessage(convo: any): boolean {
  return sendBlockedCopy(convo) === '';
}
