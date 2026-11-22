/**
 * Framework-free state rules for liking strong-ref objects (feed generators
 * and labeler services). The official client reuses the generic
 * `app.bsky.feed.like` record for these subjects. Kept separate from the agent
 * wrapper so the rules can be tested without a network client.
 */

export type LikeTarget = {
  uri: string;
  cid: string;
  likeUri?: string | null;
  likeCount?: number;
};

/** A valid strong-ref like subject needs a real AT-URI and CID. */
export function canLike(target: LikeTarget | null | undefined): boolean {
  return !!(
    target &&
    typeof target.uri === 'string' &&
    target.uri.startsWith('at://') &&
    typeof target.cid === 'string' &&
    target.cid.length > 0
  );
}

export function isLiked(target: LikeTarget | null | undefined): boolean {
  return !!target?.likeUri;
}

/** Optimistic count after a toggle: never below zero. */
export function nextLikeCount(target: LikeTarget, liked: boolean): number {
  const current = Math.max(0, Number(target.likeCount || 0));
  return Math.max(0, liked ? current + 1 : current - 1);
}
