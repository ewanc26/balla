/**
 * The one-line context above a reply card.
 *
 * A feed page carries the parent post on `feedViewPost.reply.parent`; that is
 * the only honest source for the parent's handle without another request. When
 * the parent is unavailable the card says so rather than guessing an author.
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
