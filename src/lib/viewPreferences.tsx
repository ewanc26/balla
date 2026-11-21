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
  DEFAULT_FEED_FILTERS,
  HOME_FEED,
  readFeedFilters,
  readThreadSort,
  type FeedViewFilters,
  type ThreadSort,
} from './viewPreferencesModel';

/**
 * The app.bsky.actor preference values Balla both writes and honours. Reads
 * come from the AppView through the one agent; writes use the SDK helpers so
 * unrelated preferences (muted words, labelers, saved feeds) are preserved.
 */
type ViewPreferencesValue = {
  feedFilters: FeedViewFilters;
  threadSort: ThreadSort;
  loading: boolean;
  error: string | null;
  saveFeedFilters: (patch: Partial<FeedViewFilters>) => Promise<void>;
  saveThreadSort: (sort: ThreadSort) => Promise<void>;
  reload: () => Promise<void>;
};

const ViewPreferencesContext = createContext<ViewPreferencesValue>({
  feedFilters: DEFAULT_FEED_FILTERS,
  threadSort: 'oldest',
  loading: false,
  error: null,
  saveFeedFilters: async () => {},
  saveThreadSort: async () => {},
  reload: async () => {},
});

export function ViewPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [feedFilters, setFeedFilters] = useState(DEFAULT_FEED_FILTERS);
  const [threadSort, setThreadSort] = useState<ThreadSort>('oldest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    try {
      const prefs = await agent.getPreferences();
      if (!mounted.current) return;
      setFeedFilters(readFeedFilters(prefs));
      setThreadSort(readThreadSort(prefs));
      setError(null);
    } catch {
      if (mounted.current) setError('Could not load your viewing preferences.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  const saveFeedFilters = useCallback(
    async (patch: Partial<FeedViewFilters>) => {
      const before = feedFilters;
      setFeedFilters({ ...before, ...patch });
      try {
        await agent.setFeedViewPrefs(HOME_FEED, patch);
        await reload();
      } catch (err) {
        setFeedFilters(before);
        setError('Could not save that filter. Your previous choice is kept.');
        throw err;
      }
    },
    [feedFilters, reload]
  );

  const saveThreadSort = useCallback(
    async (sort: ThreadSort) => {
      const before = threadSort;
      setThreadSort(sort);
      try {
        await agent.setThreadViewPrefs({ sort });
        await reload();
      } catch (err) {
        setThreadSort(before);
        setError('Could not save the thread order. Your previous choice is kept.');
        throw err;
      }
    },
    [threadSort, reload]
  );

  const value = useMemo(
    () => ({
      feedFilters,
      threadSort,
      loading,
      error,
      saveFeedFilters,
      saveThreadSort,
      reload,
    }),
    [feedFilters, threadSort, loading, error, saveFeedFilters, saveThreadSort, reload]
  );

  return (
    <ViewPreferencesContext.Provider value={value}>
      {children}
    </ViewPreferencesContext.Provider>
  );
}

export function useViewPreferences(): ViewPreferencesValue {
  return useContext(ViewPreferencesContext);
}
