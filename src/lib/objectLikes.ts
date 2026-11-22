/**
 * Like/unlike for any strong-ref object (feed generators and labeler services),
 * not just posts. The official client reuses the generic `app.bsky.feed.like`
 * record for these subjects, so `agent.like(uri, cid)` / `agent.deleteLike` are
 * the real writes.
 */
import { agent } from './agent';
import { canLike, type LikeTarget } from './objectLikesModel';

export { canLike, isLiked, nextLikeCount, type LikeTarget } from './objectLikesModel';

/** Toggle a like and return the new like record URI (or null when unliked). */
export async function toggleObjectLike(
  target: LikeTarget
): Promise<{ liked: boolean; likeUri: string | null }> {
  if (!canLike(target)) throw new Error('This item has no likeable address.');
  if (target.likeUri) {
    await agent.deleteLike(target.likeUri);
    return { liked: false, likeUri: null };
  }
  const res = await agent.like(target.uri, target.cid);
  return { liked: true, likeUri: res.uri };
}
