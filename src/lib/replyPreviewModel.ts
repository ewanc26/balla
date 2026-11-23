import { sortReplies, type ThreadSort } from './viewPreferencesModel.ts';

/**
 * The feed preview is deliberately a single direct reply, not a ranked
 * "top comment". The thread preference decides which one; the cache is capped
 * so a long session cannot grow without bound.
 */
export const REPLY_PREVIEW_CACHE_LIMIT = 40;
export const REPLY_PREVIEW_MAX_ACTIVE = 2;

export function isThreadViewPost(node: any): boolean {
  return !!node && String(node?.$type || '').endsWith('threadViewPost');
}

export function directRepliesFromThread(thread: any): any[] {
  if (!isThreadViewPost(thread)) return [];
  return (thread.replies || []).filter(
    (node: any) => isThreadViewPost(node) && !!node?.post?.uri
  );
}

/** Select from the already-loaded direct replies; never pick a nested branch. */
export function firstReplyInOrder(
  replies: any[],
  sort: ThreadSort
): any | null {
  if (!Array.isArray(replies) || replies.length === 0) return null;
  return sortReplies(replies, sort)[0] || null;
}

export function replyPreviewText(post: any): string {
  const text =
    typeof post?.record?.text === 'string'
      ? post.record.text.replace(/\s+/g, ' ').trim()
      : '';
  if (text) return text;

  const embed = String(post?.embed?.$type || '');
  if (embed.includes('images')) return 'A photo reply';
  if (embed.includes('video')) return 'A video reply';
  if (embed.includes('record')) return 'A quoted reply';
  if (embed.includes('external')) return 'A link reply';
  return 'A reply without text';
}

/**
 * Mute and block state lives on the author profile, so the preview can apply
 * those gates before it renders any reply text. Label gates are applied by the
 * preview component with the shared moderation helpers.
 */
export function replyAuthorGated(reply: any): boolean {
  const viewer = reply?.post?.author?.viewer;
  return !!(
    viewer?.muted ||
    viewer?.blocking ||
    viewer?.blockedBy ||
    viewer?.blockingByList
  );
}
