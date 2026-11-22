/**
 * Post-menu writes beyond reports. Every action here goes through the
 * published AT Protocol APIs; none of them fakes a local-only state.
 */
import { agent } from './agent';
import { postRkey } from './interactionGates';
import { rootPostUri } from './hiddenReplies';
import {
  POSTGATE_COLLECTION,
  detachedEmbeddingRecord,
  isQuoteDetached,
  profilePinUpdate,
  quotedUriFromEmbed,
  uriOwnedBy,
} from './postActionsModel';

export {
  isQuoteDetached,
  quotedUriFromEmbed,
  uriOwnedBy,
} from './postActionsModel';

function signedInDid(): string {
  if (!agent.did) throw new Error('You need to sign in first.');
  return agent.did;
}

/** Pin or unpin a post by writing the strong ref on the profile record. */
export async function setPostPinned(post: any, pin: boolean): Promise<void> {
  const uri = post && post.uri;
  const cid = post && post.cid;
  if (typeof uri !== 'string' || typeof cid !== 'string') {
    throw new Error('This post has no usable address.');
  }
  const did = signedInDid();
  if (uriOwnedBy(uri, did) === false) {
    // Only the author can pin a post to their own profile.
    throw new Error('You can only pin your own posts.');
  }
  await agent.upsertProfile((existing: any) => {
    const next = profilePinUpdate(existing, uri, cid, pin);
    if (!next) throw new Error('This post has no usable address.');
    return next;
  });
}

/** Mute or unmute the root of a thread through the graph service. */
export async function setThreadMuted(post: any, mute: boolean): Promise<void> {
  const root = rootPostUri(post);
  if (!root) throw new Error('This thread has no usable address.');
  if (mute) await agent.app.bsky.graph.muteThread({ root });
  else await agent.app.bsky.graph.unmuteThread({ root });
}

/** Whether the viewed post quotes a post owned by the signed-in account. */
export function canDetachQuote(post: any): boolean {
  const quote = quotedUriFromEmbed(post && post.embed);
  return !!quote && !!agent.did && uriOwnedBy(quote, agent.did);
}

/**
 * Detach or reattach the viewer's quoted post. The postgate belongs to the
 * quoted post (owned by the viewer), and lists the URI of the post embedding
 * it, matching the published `detachedEmbeddingUris` field.
 */
export async function setQuoteDetached(post: any, detach: boolean): Promise<void> {
  const quote = quotedUriFromEmbed(post && post.embed);
  const did = signedInDid();
  if (!quote || !uriOwnedBy(quote, did)) {
    throw new Error('Only the author of the quoted post can change this quote.');
  }
  const embeddingUri = post && post.uri;
  const rkey = postRkey(quote);
  if (typeof embeddingUri !== 'string' || !rkey) {
    throw new Error('This quote has no usable address.');
  }
  let existing: unknown;
  try {
    const res = await agent.com.atproto.repo.getRecord({
      repo: did,
      collection: POSTGATE_COLLECTION,
      rkey,
    });
    existing = res.data.value;
  } catch {
    // A missing postgate means nothing is detached yet.
  }
  const record = detachedEmbeddingRecord(
    existing,
    quote,
    embeddingUri,
    detach,
    new Date().toISOString()
  );
  if (!record) {
    await agent.com.atproto.repo.deleteRecord({
      repo: did,
      collection: POSTGATE_COLLECTION,
      rkey,
    });
    return;
  }
  await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: POSTGATE_COLLECTION,
    rkey,
    record,
    validate: true,
  });
}
