/**
 * Framework-free rules for sharing a post into a DM. The official client's
 * "Send post to..." dialog resolves a conversation (existing, 1:1, or group)
 * and sends the post as an `app.bsky.embed.record` strong ref. Keeping the
 * rules here lets them be tested without a network client or React Native.
 */

/** A post can only be shared when it has a real AT-URI and CID strong ref. */
export function canSharePost(post: any): boolean {
  return !!(
    post &&
    typeof post.uri === 'string' &&
    /^at:\/\/[^\s/]+\/app\.bsky\.feed\.post\/[A-Za-z0-9._~-]+$/.test(post.uri.trim()) &&
    typeof post.cid === 'string' &&
    post.cid.trim().length > 0
  );
}

/** The chat message text shown with a shared post. */
export function shareMessageText(post: any): string {
  const text = typeof post?.record?.text === 'string' ? post.record.text.trim() : '';
  return text.length ? text.slice(0, 300) : 'Shared a post';
}

/** Build the chat message input carrying the post as a record embed. */
export function buildShareMessage(post: any): {
  $type: string;
  text: string;
  embed: { $type: string; record: { uri: string; cid: string } };
} {
  if (!canSharePost(post)) throw new Error('This post has no shareable address.');
  return {
    $type: 'chat.bsky.convo.defs#messageInput',
    text: shareMessageText(post),
    embed: {
      $type: 'app.bsky.embed.record',
      record: { uri: post.uri.trim(), cid: post.cid.trim() },
    },
  };
}

/** Recent convos are shown newest-first, requests excluded. */
export function recentConvos(convos: any[] | undefined): any[] {
  const list = Array.isArray(convos) ? convos : [];
  return list
    .filter((convo) => convo && convo.id && convo.status !== 'request')
    .sort((a, b) => {
      const aTime = Date.parse(a?.lastMessage?.sentAt || a?.indexedAt || '') || 0;
      const bTime = Date.parse(b?.lastMessage?.sentAt || b?.indexedAt || '') || 0;
      return bTime - aTime;
    });
}

/** A short, accessible label for a convo row in the share sheet. */
export function shareTargetLabel(convo: any, viewerDid?: string): string {
  const members = Array.isArray(convo?.members) ? convo.members : [];
  const other = members.find((m: any) => m?.did && m.did !== viewerDid) || members[0];
  const name = String(convo?.kind?.name || '').trim();
  if (name) return name;
  if (other?.displayName) return String(other.displayName);
  if (other?.handle) return `@${other.handle}`;
  return 'Conversation';
}

export function isGroupConvo(convo: any): boolean {
  return String(convo?.kind?.$type || '').includes('#groupConvo') ||
    typeof convo?.kind?.name === 'string';
}
