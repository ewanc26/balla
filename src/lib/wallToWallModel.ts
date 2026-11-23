import { sortReplies, type ThreadSort } from './viewPreferencesModel.ts';

/**
 * Wall-to-wall is a pure, client-side lens over one already-loaded thread. It
 * selects the viewer and one other author by DID, preserving the order the
 * Thread screen renders. It never ranks, fetches, or writes.
 */
export type WallToWallRole = 'ancestor' | 'focus' | 'reply';

export type WallToWallItem = {
  uri: string;
  post: any;
  role: WallToWallRole;
  depth: number;
};

export type WallToWallPartner = {
  did: string;
  handle?: string;
  displayName?: string;
  avatar?: string;
  items: WallToWallItem[];
};

export type WallToWallModel = {
  partners: WallToWallPartner[];
  speakerDids: string[];
};

type ThreadLike = {
  ancestors?: any[];
  post?: any;
  replies?: any[];
};

type BuildOptions = {
  viewerDid?: string;
  sort?: ThreadSort;
};

function cleanHandle(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const handle = value.trim().replace(/^@/, '');
  return handle || undefined;
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text || undefined;
}

function collectItems(thread: ThreadLike, sort: ThreadSort): WallToWallItem[] {
  const items: WallToWallItem[] = [];

  for (const ancestor of thread.ancestors || []) {
    if (!ancestor?.post?.uri) continue;
    items.push({ uri: ancestor.post.uri, post: ancestor.post, role: 'ancestor', depth: 0 });
  }

  if (thread.post?.uri) {
    items.push({ uri: thread.post.uri, post: thread.post, role: 'focus', depth: 0 });
  }

  function walk(nodes: any[], depth: number) {
    const visible = (nodes || []).filter((node) => !!node?.post?.uri);
    for (const node of sortReplies(visible, sort)) {
      items.push({ uri: node.post.uri, post: node.post, role: 'reply', depth });
      walk(node.replies, depth + 1);
    }
  }
  walk(thread.replies || [], 0);

  return items;
}

/**
 * `replies` must already have threadgate-hidden branches removed. The model
 * then derives the participant menu from the visible tree. A partner only
 * exists when the viewer also authored at least one visible post.
 */
export function buildWallToWall(
  thread: ThreadLike,
  options: BuildOptions = {}
): WallToWallModel {
  const items = collectItems(thread, options.sort || 'oldest');
  const speakerDids: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const did = item.post?.author?.did;
    if (typeof did !== 'string' || !did || seen.has(did)) continue;
    seen.add(did);
    speakerDids.push(did);
  }

  const viewerDid = options.viewerDid;
  if (!viewerDid || !seen.has(viewerDid)) {
    return { partners: [], speakerDids };
  }

  const partners: WallToWallPartner[] = [];
  for (const item of items) {
    const author = item.post?.author;
    const did = author?.did;
    if (typeof did !== 'string' || !did || did === viewerDid) continue;
    if (partners.some((partner) => partner.did === did)) continue;

    partners.push({
      did,
      ...(cleanHandle(author.handle) ? { handle: cleanHandle(author.handle) } : {}),
      ...(cleanText(author.displayName)
        ? { displayName: cleanText(author.displayName) }
        : {}),
      ...(typeof author.avatar === 'string' && author.avatar
        ? { avatar: author.avatar }
        : {}),
      items: items.filter((candidate) => {
        const candidateDid = candidate.post?.author?.did;
        return candidateDid === viewerDid || candidateDid === did;
      }),
    });
  }

  return { partners, speakerDids };
}

export function wallToWallName(partner: WallToWallPartner): string {
  return partner.handle ? `@${partner.handle}` : partner.displayName || 'this account';
}
