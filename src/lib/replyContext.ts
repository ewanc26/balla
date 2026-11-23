/**
 * The one-line context above a reply card.
 *
 * A feed page carries the parent post on `feedViewPost.reply.parent`; that is
 * the only honest source for the parent's handle without another request. When
 * only a post view is available, its `record.reply.parent` still proves this is
 * a reply, so the card can say so without inventing an author.
 */

export type ReplyContext = {
  label: string;
  handle: string | null;
  parentUri: string | null;
  self: boolean;
};

export function replyContextFor(
  parent: any,
  postAuthorDid?: string | null
): ReplyContext | null {
  const parentUri =
    parent && typeof parent.uri === 'string' ? parent.uri : null;
  const parentAuthor = parent && parent.author;
  const handle =
    parentAuthor && typeof parentAuthor.handle === 'string'
      ? parentAuthor.handle.trim()
      : '';
  const parentDid =
    parentAuthor && typeof parentAuthor.did === 'string'
      ? parentAuthor.did
      : null;
  const self = !!(parentDid && postAuthorDid && parentDid === postAuthorDid);

  if (!handle && !parentUri) return null;

  if (!handle) {
    return {
      label: 'Replying to an earlier post',
      handle: null,
      parentUri,
      self,
    };
  }

  return {
    label: self ? 'Replying to their earlier post' : `Replying to @${handle}`,
    handle,
    parentUri,
    self,
  };
}

/**
 * Prefer the parent carried by a feed response. Search results and other post
 * views do not carry one, but their record still names a parent URI, so fall
 * back to a truthful generic line rather than hiding the reply state.
 */
export function replyContextForPost(
  post: any,
  parent?: any
): ReplyContext | null {
  const named = replyContextFor(parent, post?.author?.did);
  if (named) return named;
  const parentUri = post?.record?.reply?.parent?.uri;
  if (typeof parentUri !== 'string' || !parentUri) return null;
  return {
    label: 'Replying to an earlier post',
    handle: null,
    parentUri,
    self: false,
  };
}

/**
 * Keep the parent carried by a feed response alongside the post it decorates.
 * The response object is left untouched; screens read the copied field when
 * they render the card.
 */
export function withFeedReply(item: any): any {
  const post = item?.post;
  if (!post) return post;
  const parent = item?.reply?.parent;
  if (!parent) return post;
  return { ...post, feedReply: { parent } };
}
