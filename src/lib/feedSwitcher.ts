import type { SavedFeedItem } from './feedPreferences';

export type FeedKind = 'following' | 'feed' | 'list';

export type FeedChoice = {
  /** `null` is the chronological Following feed, never a saved source. */
  value: string | null;
  label: string;
  creator: string | null;
  pinned: boolean;
  following: boolean;
  kind: FeedKind;
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

export function listName(list: any): string | null {
  const name = list?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

export function listCreator(list: any): string | null {
  const handle = list?.creator?.handle;
  return typeof handle === 'string' && handle.trim() ? `@${handle.trim()}` : null;
}

/**
 * Following is always first. Pinned sources keep the order the user set, then
 * unpinned saved sources appear so they are reachable without pinning first.
 */
export function feedChoices(
  savedFeeds: SavedFeedItem[],
  generators: Record<string, any>,
  lists: Record<string, any> = {}
): FeedChoice[] {
  const sources: FeedChoice[] = savedFeeds
    .filter((item) => item.type === 'feed' || item.type === 'list')
    .map((item) => {
      if (item.type === 'list') {
        return {
          value: item.value,
          label: listName(lists[item.value]) || 'List feed',
          creator: listCreator(lists[item.value]),
          pinned: item.pinned,
          following: false,
          kind: 'list',
        };
      }
      return {
        value: item.value,
        label: generatorName(generators[item.value]) || 'Saved feed',
        creator: generatorCreator(generators[item.value]),
        pinned: item.pinned,
        following: false,
        kind: 'feed',
      };
    });
  return [
    {
      value: null,
      label: 'Following',
      creator: null,
      pinned: false,
      following: true,
      kind: 'following',
    },
    ...sources.filter((source) => source.pinned),
    ...sources.filter((source) => !source.pinned),
  ];
}

export function selectedFeed(
  value: string | null,
  savedFeeds: SavedFeedItem[],
  generators: Record<string, any>,
  lists: Record<string, any> = {}
): FeedChoice {
  const choices = feedChoices(savedFeeds, generators, lists);
  return choices.find((choice) => choice.value === value) || choices[0];
}

/** A saved source that has been removed can no longer stay selected. */
export function feedStillAvailable(
  value: string | null,
  savedFeeds: SavedFeedItem[]
): boolean {
  return (
    value === null ||
    savedFeeds.some(
      (feed) =>
        (feed.type === 'feed' || feed.type === 'list') &&
        feed.value === value
    )
  );
}
