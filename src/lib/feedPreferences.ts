export type SavedFeedItem = {
  id: string;
  type: string;
  value: string;
  pinned: boolean;
};

/**
 * Reads the current saved-feed items without inventing entries. The Agent
 * already migrates the legacy savedFeedsPref shape; this remains defensive
 * because preferences are user-controlled and may come from another client.
 */
export function normaliseSavedFeeds(value: unknown): SavedFeedItem[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, SavedFeedItem>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id !== 'string' ||
      !candidate.id ||
      typeof candidate.type !== 'string' ||
      !candidate.type ||
      typeof candidate.value !== 'string' ||
      !candidate.value ||
      typeof candidate.pinned !== 'boolean'
    ) {
      continue;
    }
    // A later duplicate id replaces the earlier item, matching the Agent's
    // own overwrite semantics.
    byId.delete(candidate.id);
    byId.set(candidate.id, {
      id: candidate.id,
      type: candidate.type,
      value: candidate.value,
      pinned: candidate.pinned,
    });
  }
  return Array.from(byId.values());
}

export function feedItems(items: SavedFeedItem[]): SavedFeedItem[] {
  return items.filter((item) => item.type === 'feed');
}

export function pinnedFeedItems(items: SavedFeedItem[]): SavedFeedItem[] {
  return items.filter((item) => item.type === 'feed' && item.pinned);
}

export function findSavedFeed(
  items: SavedFeedItem[],
  value: string
): SavedFeedItem | undefined {
  return items.find((item) => item.type === 'feed' && item.value === value);
}

export function isFeedSaved(items: SavedFeedItem[], value: string): boolean {
  return !!findSavedFeed(items, value);
}

/**
 * Moves a pinned feed among the pinned feed entries only. Timeline and list
 * preferences supplied by other clients keep their positions, and unpinned
 * entries are never displaced by a Home-tab reorder.
 */
export function movePinnedFeed(
  items: SavedFeedItem[],
  value: string,
  direction: -1 | 1
): SavedFeedItem[] {
  const feedPositions = items
    .map((item, index) =>
      item.type === 'feed' && item.pinned ? index : -1
    )
    .filter((index) => index >= 0);
  const visibleIndex = feedPositions.findIndex(
    (index) => items[index].value === value
  );
  if (visibleIndex < 0) return items;
  const targetVisibleIndex = visibleIndex + direction;
  if (
    targetVisibleIndex < 0 ||
    targetVisibleIndex >= feedPositions.length
  ) {
    return items;
  }

  const next = items.slice();
  const from = feedPositions[visibleIndex];
  const to = feedPositions[targetVisibleIndex];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
