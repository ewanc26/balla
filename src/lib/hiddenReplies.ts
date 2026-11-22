/**
 * Hidden replies live in the root post's `app.bsky.feed.threadgate` record, in
 * the published `hiddenReplies` field. Hiding is never a local-only flag: we
 * read the existing record (so reply rules and other hidden replies survive),
 * write the updated record through the repository, and delete it when nothing
 * is left to express.
 */
import { agent } from './agent';
import {
  hiddenReplyWrite,
  hiddenRepliesFromRecord,
  postRkey,
} from './interactionGates';

const THREADGATE = 'app.bsky.feed.threadgate';

/** The threadgate for a reply belongs to the root post of the conversation. */
export function rootPostUri(post: any): string | null {
  const root = post && post.record && post.record.reply && post.record.reply.root;
  const candidate =
    root && typeof root.uri === 'string' && root.uri ? root.uri : post && post.uri;
  return typeof candidate === 'string' && postRkey(candidate) ? candidate : null;
}

export function isThreadRootAuthor(post: any): boolean {
  const root = rootPostUri(post);
  if (!root || !agent.did) return false;
  // at://did:plc:.../app.bsky.feed.post/<rkey> — the host is the author DID.
  return root.startsWith(`at://${agent.did}/`);
}

async function readRecord(rootUri: string): Promise<unknown> {
  const rkey = postRkey(rootUri);
  if (!rkey) return undefined;
  try {
    const res = await agent.com.atproto.repo.getRecord({
      repo: agent.did!,
      collection: THREADGATE,
      rkey,
    });
    return res.data.value;
  } catch {
    // A missing threadgate means nothing is hidden yet.
    return undefined;
  }
}

export async function loadHiddenReplyUris(post: any): Promise<string[]> {
  const root = rootPostUri(post);
  if (!root) return [];
  return hiddenRepliesFromRecord(await readRecord(root));
}

/** Hide or unhide one reply. Returns the resulting list of hidden reply URIs. */
export async function setReplyHidden(
  post: any,
  replyUri: string,
  hide: boolean
): Promise<string[]> {
  const root = rootPostUri(post);
  const rkey = root ? postRkey(root) : null;
  if (!root || !rkey) throw new Error('This reply has no usable thread address.');
  const existing = await readRecord(root);
  const write = hiddenReplyWrite(
    root,
    existing,
    replyUri,
    hide ? 'hide' : 'show',
    new Date().toISOString()
  );
  if (!write) {
    // No rules and no hidden replies left: remove the record entirely so an
    // empty gate cannot silently restrict replies.
    await agent.com.atproto.repo.deleteRecord({
      repo: agent.did!,
      collection: THREADGATE,
      rkey,
    });
    return [];
  }
  await agent.com.atproto.repo.putRecord({
    repo: agent.did!,
    collection: write.collection,
    rkey: write.rkey,
    record: write.record,
    validate: true,
  });
  return hiddenRepliesFromRecord(write.record);
}
