/**
 * Pure discovery helpers. Every surface here is backed by the already
 * authorised `app.bsky.feed.searchPostsV2` call; none of these modes adds an
 * OAuth scope or injects anything into the chronological Following feed.
 *
 * Hashtag, topic and video pages are deliberately `sort: 'recent'`. Only the
 * opt-in Discover surface uses `sort: 'top'`, and it says so in its own copy.
 */

export type DiscoveryMode = 'hashtag' | 'topic' | 'video' | 'discover';

export const DISCOVERY_PAGE_SIZE = 30;
const MAX_TAG_LENGTH = 100;
const MAX_TOPIC_LENGTH = 200;

export type DiscoveryParams = {
  sort: 'recent' | 'top';
  limit: number;
  excludeReplies: boolean;
  hashtags?: string[];
  query?: string;
  hasVideo?: boolean;
  hasMedia?: boolean;
  cursor?: string;
};

export type DiscoveryCopy = {
  title: string;
  subtitle: string;
  banner: string;
  ranked: boolean;
};

/** A hashtag has no spaces and loses any leading hashes from a search query. */
export function normaliseTag(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^#+/, '').replace(/\s+/g, '').slice(0, MAX_TAG_LENGTH);
}

/** A topic is a plain search term, so interior spaces are kept. */
export function normaliseTopic(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^#+/, '').replace(/\s+/g, ' ').slice(0, MAX_TOPIC_LENGTH);
}

export function isValidTag(tag: string): boolean {
  return (
    tag.trim().length > 0 &&
    tag.length <= MAX_TAG_LENGTH &&
    !/\s/.test(tag)
  );
}

export function isValidTopic(topic: string): boolean {
  return topic.trim().length > 0 && topic.length <= MAX_TOPIC_LENGTH;
}

export function modeFromRouteName(name: unknown): DiscoveryMode | null {
  if (name === 'Hashtag') return 'hashtag';
  if (name === 'Topic') return 'topic';
  if (name === 'VideoFeed') return 'video';
  if (name === 'Discover') return 'discover';
  return null;
}

/**
 * Builds the exact searchPostsV2 params for a page. Returns null when a tag or
 * topic is missing/invalid so the screen can show an honest error instead of
 * sending a broad or empty query to the server.
 */
export function buildDiscoveryParams(
  mode: DiscoveryMode,
  value: unknown,
  cursor?: string
): DiscoveryParams | null {
  const page = {
    limit: DISCOVERY_PAGE_SIZE,
    excludeReplies: true,
    ...(cursor ? { cursor } : {}),
  };
  if (mode === 'hashtag') {
    const tag = normaliseTag(value);
    if (!isValidTag(tag)) return null;
    return { ...page, hashtags: [tag], sort: 'recent' };
  }
  if (mode === 'topic') {
    const topic = normaliseTopic(value);
    if (!isValidTopic(topic)) return null;
    return { ...page, query: topic, sort: 'recent' };
  }
  if (mode === 'video') {
    return { ...page, hasVideo: true, sort: 'recent' };
  }
  if (mode === 'discover') {
    // hasMedia satisfies the API's "query or one filter" rule without faking
    // a search term. This is the only ranked surface in the app.
    return { ...page, hasMedia: true, sort: 'top' };
  }
  return null;
}

export function discoveryCopy(mode: DiscoveryMode, value: unknown): DiscoveryCopy {
  if (mode === 'hashtag') {
    const tag = normaliseTag(value) || 'tag';
    return {
      title: `#${tag}`,
      subtitle: 'Posts tagged with this hashtag · newest first',
      banner:
        'Newest posts first. This page is not ranked and does not change your Following feed.',
      ranked: false,
    };
  }
  if (mode === 'topic') {
    const topic = normaliseTopic(value) || 'topic';
    return {
      title: topic,
      subtitle: 'Search results for this topic · newest first',
      banner:
        'Newest matching posts first. This page is not ranked and does not change your Following feed.',
      ranked: false,
    };
  }
  if (mode === 'video') {
    return {
      title: 'Video',
      subtitle: 'Posts with video · newest first',
      banner:
        'Newest posts with video first. This page is not ranked and does not change your Following feed.',
      ranked: false,
    };
  }
  return {
    title: 'Discover',
    subtitle: 'Suggested by Bluesky, kept out of Following',
    banner:
      'Suggested and ranked by Bluesky’s search, not by who you follow. Nothing here is added to your Following feed. You opened this page yourself.',
    ranked: true,
  };
}

export function discoveryError(mode: DiscoveryMode): string {
  if (mode === 'hashtag') return 'That hashtag is not available. Try another one.';
  if (mode === 'topic') return 'That topic is not available. Try another one.';
  if (mode === 'video') return 'Could not load video posts. Try again.';
  return 'Could not load suggested posts. Try again.';
}

export function emptyDiscoveryCopy(mode: DiscoveryMode): string {
  if (mode === 'hashtag') return 'No posts with this hashtag were found.';
  if (mode === 'topic') return 'No posts for this topic were found.';
  if (mode === 'video') return 'No posts with video were found.';
  return 'No suggested posts were found.';
}
