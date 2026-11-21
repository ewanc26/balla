import type { SavedFeedItem } from './feedPreferences';

export type FeedChoice = {
  /** `null` is the chronological Following feed, never a custom feed. */
  value: string | null;
  label: string;
  creator: string | null;
  pinned: boolean;
  following: boolean;
};

/** Uses only generator metadata Bluesky returned; never invents a title. */
export function generatorName(generator: any): string | null {
  const name = generator?.displayName;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

export function generatorCreator(generator: any): string | null {
  const handle = generator?.creator?.handle;
  return typeof handle === 'string' && handle.trim() ? `@${handle.trim()}` : null;
}

/**
 * Following is always first. Pinned feeds keep the order the user set, then
 * unpinned saved feeds appear so they are reachable without pinning first.
 */
export function feedChoices(
  savedFeeds: SavedFeedItem[],
  generators: Record<string, any>
): FeedChoice[] {
  const feeds: FeedChoice[] = savedFeeds.map((feed) => ({
    value: feed.value,
    label: generatorName(generators[feed.value]) || 'Saved feed',
    creator: generatorCreator(generators[feed.value]),
    pinned: feed.pinned,
    following: false,
  }));
  return [
    {
      value: null,
      label: 'Following',
      creator: null,
      pinned: false,
      following: true,
    },
    ...feeds.filter((feed) => feed.pinned),
    ...feeds.filter((feed) => !feed.pinned),
  ];
}

export function selectedFeed(
  value: string | null,
  savedFeeds: SavedFeedItem[],
  generators: Record<string, any>
): FeedChoice {
  const choices = feedChoices(savedFeeds, generators);
  return choices.find((choice) => choice.value === value) || choices[0];
}

/** A saved feed that has been removed can no longer stay selected. */
export function feedStillAvailable(
  value: string | null,
  savedFeeds: SavedFeedItem[]
): boolean {
  return value === null || savedFeeds.some((feed) => feed.value === value);
}
