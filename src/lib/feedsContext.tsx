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
  findSavedItem,
  findSavedListItem,
  homeFeedItems,
  listFeedItems,
  movePinnedFeed,
  normaliseSavedFeeds,
  pinnedHomeFeedItems,
  type SavedFeedItem,
} from './feedPreferences';

type FeedDetails = Record<string, any>;

type FeedsContextValue = {
  items: SavedFeedItem[];
  savedFeeds: SavedFeedItem[];
  homeFeeds: SavedFeedItem[];
  pinnedHomeFeeds: SavedFeedItem[];
  generators: FeedDetails;
  lists: FeedDetails;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  detailsError: string | null;
  refresh: () => Promise<void>;
  saveFeed: (value: string, pinned?: boolean) => Promise<void>;
  removeFeed: (value: string) => Promise<void>;
  removeSource: (value: string) => Promise<void>;
  setPinned: (value: string, pinned: boolean) => Promise<void>;
  pinList: (value: string, pinned: boolean) => Promise<void>;
  movePinned: (value: string, direction: -1 | 1) => Promise<void>;
};

const NOOP = async () => {};

const FeedsContext = createContext<FeedsContextValue>({
  items: [],
  savedFeeds: [],
  homeFeeds: [],
  pinnedHomeFeeds: [],
  generators: {},
  lists: {},
  loading: false,
  refreshing: false,
  error: null,
  detailsError: null,
  refresh: NOOP,
  saveFeed: NOOP,
  removeFeed: NOOP,
  removeSource: NOOP,
  setPinned: NOOP,
  pinList: NOOP,
  movePinned: NOOP,
});

export function FeedsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SavedFeedItem[]>([]);
  const [generators, setGenerators] = useState<FeedDetails>({});
  const [lists, setLists] = useState<FeedDetails>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const itemsRef = useRef<SavedFeedItem[]>([]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const loadDetails = useCallback(async (next: SavedFeedItem[]) => {
    const feedUris = feedItems(next).map((item) => item.value);
    const listUris = listFeedItems(next).map((item) => item.value);
    if (feedUris.length === 0 && listUris.length === 0) {
      setGenerators({});
      setLists({});
      setDetailsError(null);
      return;
    }

    const messages: string[] = [];

    if (feedUris.length > 0) {
      try {
        const response = await agent.app.bsky.feed.getFeedGenerators({
          feeds: feedUris,
        });
        const map: FeedDetails = {};
        for (const generator of response.data.feeds || []) {
          if (generator?.uri) map[generator.uri] = generator;
        }
        setGenerators(map);
        const missing = feedUris.filter((uri) => !map[uri]).length;
        if (missing > 0) {
          messages.push(
            `Bluesky returned no details for ${missing} saved ${
              missing === 1 ? 'feed' : 'feeds'
            }.`
          );
        }
      } catch {
        // Keep the preferences the user set. A details outage must not make
        // saved feeds impossible to remove, unpin or reorder.
        setGenerators({});
        messages.push(
          'Saved feeds loaded, but their descriptions could not be fetched.'
        );
      }
    } else {
      setGenerators({});
    }

    if (listUris.length > 0) {
      const results = await Promise.allSettled(
        listUris.map(async (uri) => {
          const response = await agent.app.bsky.graph.getList({
            list: uri,
            limit: 1,
          });
          return { uri, list: response.data.list };
        })
      );
      const map: FeedDetails = {};
      let failed = 0;
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.list) {
          map[result.value.uri] = result.value.list;
        } else {
          failed += 1;
        }
      }
      setLists(map);
      if (failed > 0) {
        messages.push(
          `Bluesky returned no details for ${failed} saved list ${
            failed === 1 ? 'feed' : 'feeds'
          }.`
        );
      }
    } else {
      setLists({});
    }

    setDetailsError(messages.length > 0 ? messages.join(' ') : null);
  }, []);

  const applyServerItems = useCallback(
    (value: unknown) => {
      const next = normaliseSavedFeeds(value);
      itemsRef.current = next;
      setItems(next);
      void loadDetails(next);
    },
    [loadDetails]
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
        await loadDetails(next);
      } catch {
        setError('Could not load your saved feeds.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadDetails]
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

  const removeSource = useCallback(
    (value: string) =>
      enqueue(async () => {
        const existing = findSavedItem(itemsRef.current, value);
        if (!existing) return;
        const next = await agent.removeSavedFeeds([existing.id]);
        applyServerItems(next);
      }),
    [applyServerItems, enqueue]
  );

  const setPinned = useCallback(
    (value: string, pinned: boolean) =>
      enqueue(async () => {
        const existing = findSavedItem(itemsRef.current, value);
        if (!existing || existing.pinned === pinned) return;
        const next = await agent.updateSavedFeeds([
          { ...existing, pinned },
        ]);
        applyServerItems(next);
      }),
    [applyServerItems, enqueue]
  );

  const pinList = useCallback(
    (value: string, pinned: boolean) =>
      enqueue(async () => {
        const existing = findSavedListItem(itemsRef.current, value);
        if (existing) {
          if (existing.pinned === pinned) return;
          const next = await agent.updateSavedFeeds([
            { ...existing, pinned },
          ]);
          applyServerItems(next);
          return;
        }
        if (!pinned) return;
        const next = await agent.addSavedFeeds([
          { type: 'list', value, pinned: true },
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
  const homeFeeds = useMemo(() => homeFeedItems(items), [items]);
  const pinnedHomeFeeds = useMemo(() => pinnedHomeFeedItems(items), [items]);

  const value = useMemo(
    () => ({
      items,
      savedFeeds,
      homeFeeds,
      pinnedHomeFeeds,
      generators,
      lists,
      loading,
      refreshing,
      error,
      detailsError,
      refresh,
      saveFeed,
      removeFeed,
      removeSource,
      setPinned,
      pinList,
      movePinned,
    }),
    [
      items,
      savedFeeds,
      homeFeeds,
      pinnedHomeFeeds,
      generators,
      lists,
      loading,
      refreshing,
      error,
      detailsError,
      refresh,
      saveFeed,
      removeFeed,
      removeSource,
      setPinned,
      pinList,
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
