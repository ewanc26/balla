import { itemIsSnoozed, type SnoozeMap } from './snoozeModel.ts';

/**
 * The desktop Recent activity card is a view over the Following timeline that
 * is already in memory. It adds no request, no ranking and no like data: every
 * row is a reply or a repost by an account the viewer follows.
 */
export const RECENT_ACTIVITY_LIMIT = 12;
export const RECENT_ACTIVITY_SNIPPET_MAX = 110;

export type RecentActivityVerb = 'replied' | 'reposted';

export type RecentActivity = {
  id: string;
  verb: RecentActivityVerb;
  at: number;
  actorDid: string;
  actorName: string;
  actorHandle?: string;
  actorAvatar?: string;
  post: any;
  snippet: string;
};

type BuildOptions = {
  viewerDid?: string;
  snoozes?: SnoozeMap;
  now?: number;
  limit?: number;
};

function timeValue(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function actorGated(profile: any): boolean {
  const viewer = profile?.viewer;
  return !!(
    viewer?.muted ||
    viewer?.blocking ||
    viewer?.blockedBy ||
    viewer?.blockingByList
  );
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function snippetOf(post: any): string {
  const text = typeof post?.record?.text === 'string' ? oneLine(post.record.text) : '';
  if (text) {
    return text.length > RECENT_ACTIVITY_SNIPPET_MAX
      ? `${text.slice(0, RECENT_ACTIVITY_SNIPPET_MAX - 1).trimEnd()}…`
      : text;
  }

  const embed = String(post?.embed?.$type || '');
  if (embed.includes('images')) return 'A photo post';
  if (embed.includes('video')) return 'A video post';
  if (embed.includes('record')) return 'A quoted post';
  if (embed.includes('external')) return 'A link post';
  return 'A post without text';
}

function actorOf(profile: any) {
  const actorDid = typeof profile?.did === 'string' ? profile.did : '';
  if (!actorDid) return null;
  const handle = typeof profile.handle === 'string' ? profile.handle : undefined;
  const displayName =
    typeof profile.displayName === 'string' && profile.displayName.trim()
      ? profile.displayName.trim()
      : undefined;
  const avatar =
    typeof profile.avatar === 'string' && profile.avatar ? profile.avatar : undefined;
  return {
    actorDid,
    actorName: displayName || handle || 'Someone you follow',
    ...(handle ? { actorHandle: handle } : {}),
    ...(avatar ? { actorAvatar: avatar } : {}),
  };
}

export function buildRecentActivity(
  items: any[],
  options: BuildOptions = {}
): RecentActivity[] {
  const now = options.now ?? Date.now();
  const requestedLimit = options.limit ?? RECENT_ACTIVITY_LIMIT;
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(0, Math.floor(requestedLimit))
    : RECENT_ACTIVITY_LIMIT;
  if (limit === 0) return [];

  const snoozes = options.snoozes || {};
  const seen = new Set<string>();
  const activity: RecentActivity[] = [];

  for (const item of items || []) {
    const post = item?.post;
    if (!post?.uri || !post?.author?.did) continue;

    const reasonType = String(item?.reason?.$type || '');
    // A like is never content for this card. Ignore it even if a malformed
    // response also carries a reply record.
    if (reasonType.endsWith('reasonLike')) continue;

    const repost = reasonType.endsWith('reasonRepost');
    const reply = !!post?.record?.reply;
    if (!repost && !reply) continue;

    const actorProfile = repost ? item.reason?.by : post.author;
    const actor = actorOf(actorProfile);
    if (!actor) continue;

    if (options.viewerDid && actor.actorDid === options.viewerDid) continue;
    if (actorGated(actorProfile) || actorGated(post.author)) continue;
    if (itemIsSnoozed(item, snoozes, now)) continue;

    const verb: RecentActivityVerb = repost ? 'reposted' : 'replied';
    const at = repost
      ? timeValue(item.reason?.indexedAt) || timeValue(post.indexedAt)
      : timeValue(post.indexedAt);
    const id = `${actor.actorDid}:${verb}:${post.uri}`;
    if (seen.has(id)) continue;
    seen.add(id);

    activity.push({
      id,
      verb,
      at,
      ...actor,
      post,
      snippet: snippetOf(post),
    });
  }

  activity.sort((left, right) => right.at - left.at || left.id.localeCompare(right.id));
  return activity.slice(0, limit);
}
