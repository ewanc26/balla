/**
 * Framework-free rules for the profile's feed tabs. The official client shows
 * Posts, Replies, Media and Videos tabs (plus a self-only Likes tab), all driven
 * by published `app.bsky.feed.getAuthorFeed` filters and `getActorLikes`. Keeping
 * the rules here means the tab set can be checked without a renderer.
 */

export type ProfileFeedTab = 'posts' | 'replies' | 'media' | 'videos' | 'likes';

export const ALL_PROFILE_TABS: ProfileFeedTab[] = [
  'posts',
  'replies',
  'media',
  'videos',
  'likes',
];

/** The published getAuthorFeed filter for each authored-content tab. */
export const AUTHOR_FEED_FILTERS: Partial<Record<ProfileFeedTab, string>> = {
  posts: 'posts_and_author_threads',
  replies: 'posts_and_replies_only',
  media: 'posts_with_media',
  videos: 'posts_with_video',
};

export type TabVisibility = {
  isSelf: boolean;
  isLabeler: boolean;
  hasSession: boolean;
};

/**
 * Which tabs the official client exposes. Labeler profiles hide Media/Videos;
 * Likes is only shown on your own profile. Replies need a session (Balla only
 * renders profiles in a signed-in app, but the rule is explicit here).
 */
export function visibleProfileTabs({
  isSelf,
  isLabeler,
  hasSession,
}: TabVisibility): ProfileFeedTab[] {
  const tabs: ProfileFeedTab[] = ['posts'];
  if (hasSession) tabs.push('replies');
  if (!isLabeler) {
    tabs.push('media');
    tabs.push('videos');
  }
  if (isSelf) tabs.push('likes');
  return tabs;
}

/** Likes uses a different RPC; every other tab uses getAuthorFeed. */
export function usesActorLikes(tab: ProfileFeedTab): boolean {
  return tab === 'likes';
}

/** Resolve a tab to its author-feed filter, or null for the Likes tab. */
export function filterForTab(tab: ProfileFeedTab): string | null {
  return AUTHOR_FEED_FILTERS[tab] || null;
}

/** Guard against a stale/deep-linked tab that is no longer visible. */
export function normaliseTab(
  value: unknown,
  visible: ProfileFeedTab[]
): ProfileFeedTab {
  return typeof value === 'string' && (visible as string[]).includes(value)
    ? (value as ProfileFeedTab)
    : 'posts';
}

export function tabLabel(tab: ProfileFeedTab): string {
  switch (tab) {
    case 'posts':
      return 'Posts';
    case 'replies':
      return 'Replies';
    case 'media':
      return 'Media';
    case 'videos':
      return 'Videos';
    case 'likes':
      return 'Likes';
  }
}
