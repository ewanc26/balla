import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { agent } from './agent';
import {
  feedItems,
  findSavedFeed,
  movePinnedFeed,
  normaliseSavedFeeds,
  pinnedFeedItems,
  type SavedFeedItem,
} from './feedPreferences';

type FeedGenerators = Record<string, any>;

type FeedsContextValue = {
  items: SavedFeedItem[];
  savedFeeds: SavedFeedItem[];
  pinnedFeeds: SavedFeedItem[];
  generators: FeedGenerators;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  detailsError: string | null;
  refresh: () => Promise<void>;
  saveFeed: (value: string, pinned?: boolean) => Promise<void>;
  removeFeed: (value: string) => Promise<void>;
  setPinned: (value: string, pinned: boolean) => Promise<void>;
  movePinned: (value: string, direction: -1 | 1) => Promise<void>;
};

const NOOP = async () => {};

const FeedsContext = createContext<FeedsContextValue>({
  items: [],
  savedFeeds: [],
  pinnedFeeds: [],
  generators: {},
  loading: false,
  refreshing: false,
  error: null,
  detailsError: null,
  refresh: NOOP,
  saveFeed: NOOP,
  removeFeed: NOOP,
  setPinned: NOOP,
  movePinned: NOOP,
});

export function FeedsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SavedFeedItem[]>([]);
  const [generators, setGenerators] = useState<FeedGenerators>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const itemsRef = useRef<SavedFeedItem[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const loadGenerators = useCallback(async (next: SavedFeedItem[]) => {
    const uris = feedItems(next).map((item) => item.value);
    if (uris.length === 0) {
      setGenerators({});
      setDetailsError(null);
      return;
    }
    try {
      const response = await agent.app.bsky.feed.getFeedGenerators({
        feeds: uris,
      });
      const map: FeedGenerators = {};
      for (const generator of response.data.feeds || []) {
        if (generator?.uri) map[generator.uri] = generator;
      }
      setGenerators(map);
      const missing = uris.filter((uri) => !map[uri]).length;
      setDetailsError(
        missing
          ? `Bluesky returned no details for ${missing} saved ${
              missing === 1 ? 'feed' : 'feeds'
            }.`
          : null
      );
    } catch {
      // Keep the preferences and names the user gave us. A details outage must
      // not make saved feeds impossible to remove or unpin.
      setDetailsError(
        'Saved feeds loaded, but their descriptions could not be fetched.'
      );
    }
  }, []);

  const applyServerItems = useCallback(
    (value: unknown) => {
      const next = normaliseSavedFeeds(value);
      itemsRef.current = next;
      setItems(next);
      void loadGenerators(next);
    },
    [loadGenerators]
  );

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const preferences = await agent.getPreferences();
        const next = normaliseSavedFeeds(preferences.savedFeeds || []);
        itemsRef.current = next;
        setItems(next);
        await loadGenerators(next);
      } catch {
        setError('Could not load your saved feeds.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadGenerators]
  );

  useEffect(() => {
    void load('initial');
  }, [load]);

  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const result = queue.current.then(task, task);
    queue.current = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }, []);

  const refresh = useCallback(async () => {
    await load('refresh');
  }, [load]);

  const saveFeed = useCallback(
    (value: string, pinned = false) =>
      enqueue(async () => {
        const existing = findSavedFeed(itemsRef.current, value);
        if (existing) {
          if (!pinned || existing.pinned) return;
          const next = await agent.updateSavedFeeds([
            { ...existing, pinned: true },
          ]);
          applyServerItems(next);
          return;
        }
        const next = await agent.addSavedFeeds([
          { type: 'feed', value, pinned },
        ]);
        applyServerItems(next);
      }),
    [applyServerItems, enqueue]
  );

  const removeFeed = useCallback(
    (value: string) =>
      enqueue(async () => {
        const existing = findSavedFeed(itemsRef.current, value);
        if (!existing) return;
        const next = await agent.removeSavedFeeds([existing.id]);
        applyServerItems(next);
      }),
    [applyServerItems, enqueue]
  );

  const setPinned = useCallback(
    (value: string, pinned: boolean) =>
      enqueue(async () => {
        const existing = findSavedFeed(itemsRef.current, value);
        if (!existing || existing.pinned === pinned) return;
        const next = await agent.updateSavedFeeds([
          { ...existing, pinned },
        ]);
        applyServerItems(next);
      }),
    [applyServerItems, enqueue]
  );

  const movePinned = useCallback(
    (value: string, direction: -1 | 1) =>
      enqueue(async () => {
        const next = movePinnedFeed(itemsRef.current, value, direction);
        if (next === itemsRef.current) return;
        const serverItems = await agent.overwriteSavedFeeds(next);
        applyServerItems(serverItems);
      }),
    [applyServerItems, enqueue]
  );

  const savedFeeds = useMemo(() => feedItems(items), [items]);
  const pinnedFeeds = useMemo(() => pinnedFeedItems(items), [items]);

  const value = useMemo(
    () => ({
      items,
      savedFeeds,
      pinnedFeeds,
      generators,
      loading,
      refreshing,
      error,
      detailsError,
      refresh,
      saveFeed,
      removeFeed,
      setPinned,
      movePinned,
    }),
    [
      items,
      savedFeeds,
      pinnedFeeds,
      generators,
      loading,
      refreshing,
      error,
      detailsError,
      refresh,
      saveFeed,
      removeFeed,
      setPinned,
      movePinned,
    ]
  );

  return (
    <FeedsContext.Provider value={value}>{children}</FeedsContext.Provider>
  );
}

export function useFeeds(): FeedsContextValue {
  return useContext(FeedsContext);
}
