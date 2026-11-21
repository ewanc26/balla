import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import { subscribeActorHidden } from '../lib/moderation';
import { PostCard } from '../components/PostCard';
import { PersonRow } from '../components/PersonRow';
import {
  FeedResultCard,
  StarterPackResultCard,
} from '../components/SearchResultCards';
import { SearchFiltersModal } from '../components/SearchFiltersModal';
import {
  addSearchHistory,
  buildPostSearchParams,
  cleanSearchFilters,
  countActiveFilters,
  EMPTY_SEARCH_FILTERS,
  filtersBlockTab,
  parseSearchEntry,
  SEARCH_TABS,
  validateSearchFilters,
  type SearchFilters,
  type SearchTab,
} from '../lib/searchModel';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';
import { MOCK_MODE } from '../lib/mock';

const HISTORY_KEY = 'balla.search.history.v1';

const NOUNS: Record<SearchTab, string> = {
  top: 'posts',
  latest: 'posts',
  people: 'people',
  feeds: 'feeds',
  packs: 'starter packs',
};

type SearchPage = {
  items: any[];
  cursor?: string;
  hitsTotal?: number;
};

async function fetchSearchPage(
  tab: SearchTab,
  query: string,
  filters: SearchFilters,
  cursor?: string
): Promise<SearchPage> {
  if (tab === 'top' || tab === 'latest') {
    const params = buildPostSearchParams(
      query,
      filters,
      agent.did || '',
      tab
    );
    const res = await agent.app.bsky.feed.searchPostsV2({
      ...params,
      limit: 30,
      ...(cursor ? { cursor } : {}),
    });
    return {
      items: res.data.posts || [],
      cursor: res.data.cursor,
      hitsTotal: res.data.hitsTotal,
    };
  }

  if (tab === 'people') {
    const res = await agent.searchActors({
      q: query,
      limit: 30,
      ...(cursor ? { cursor } : {}),
    });
    return { items: res.data.actors || [], cursor: res.data.cursor };
  }

  if (tab === 'feeds') {
    const res = await agent.app.bsky.unspecced.getPopularFeedGenerators({
      query,
      limit: 25,
      ...(cursor ? { cursor } : {}),
    });
    return { items: res.data.feeds || [], cursor: res.data.cursor };
  }

  const res = await agent.app.bsky.graph.searchStarterPacksV2({
    q: query,
    limit: 25,
    ...(cursor ? { cursor } : {}),
  });
  return {
    items: res.data.starterPacks || [],
    cursor: res.data.cursor,
    hitsTotal: res.data.hitsTotal,
  };
}

function itemKey(tab: SearchTab, item: any): string {
  return tab === 'people' ? item.did : item.uri;
}

function appendUnique(
  existing: any[],
  incoming: any[],
  tab: SearchTab
): any[] {
  const seen = new Set(existing.map((item) => itemKey(tab, item)));
  const next = [...existing];
  for (const item of incoming) {
    const key = itemKey(tab, item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }
  return next;
}

function searchError(tab: SearchTab, cause: unknown): string {
  const status = Number(
    (cause as any)?.status || (cause as any)?.statusCode || 0
  );
  if (status === 429) {
    return 'Bluesky is rate-limiting search. Wait a moment and try again.';
  }
  if (status === 400) {
    return 'Bluesky rejected this query. Adjust the words or filters and try again.';
  }
  if (status >= 500) {
    return 'Bluesky’s search service is unavailable. Try again shortly.';
  }
  if (cause instanceof TypeError) {
    return 'Could not reach Bluesky. Check your connection and try again.';
  }
  return `Could not search ${NOUNS[tab]}. Try again.`;
}

function noResultsCopy(tab: SearchTab, query: string): string {
  return `No ${NOUNS[tab]} found for “${query}”.`;
}

export function SearchScreen({ route }: { route?: any }) {
  const p = usePalette();
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState<{
    query: string;
    filters: SearchFilters;
  } | null>(null);
  const [tab, setTab] = useState<SearchTab>('top');
  const [filters, setFilters] = useState<SearchFilters>({
    ...EMPTY_SEARCH_FILTERS,
  });
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [hitsTotal, setHitsTotal] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const requestId = useRef(0);
  const moreInFlight = useRef(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(HISTORY_KEY)
      .then((stored) => {
        if (!active || !stored) return;
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setHistory(
              parsed.filter((item): item is string => typeof item === 'string')
            );
          }
        } catch {
          // A corrupt history file must not block search.
        }
      })
      .catch(() => {
        // Search history is optional.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      requestId.current += 1;
    };
  }, []);

  useEffect(() => {
    return subscribeActorHidden((did) => {
      setItems((prev) =>
        prev.filter((item) => {
          const owner = item.did || item.author?.did || item.creator?.did;
          return owner !== did;
        })
      );
    });
  }, []);

  const routeRequest = route?.params?.searchRequest;

  useEffect(() => {
    if (!routeRequest || typeof routeRequest.q !== 'string') return;
    const term = routeRequest.q.trim();
    if (!term) return;
    const nextFilters = cleanSearchFilters(routeRequest.filters);
    setQuery(term);
    setFilters(nextFilters);
    void performSearch('top', term, nextFilters, { remember: true });
    // The nonce distinguishes repeated searches for the same term.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeRequest?.nonce]);

  useEffect(() => {
    if (!MOCK_MODE) return;
    setQuery('tea');
    void performSearch('top', 'tea', EMPTY_SEARCH_FILTERS, { remember: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function remember(nextQuery: string, nextFilters: SearchFilters) {
    setHistory((prev) => {
      const next = addSearchHistory(prev, nextQuery, nextFilters);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => {
        // Keep the in-memory history even if the device cannot persist it.
      });
      return next;
    });
  }

  async function performSearch(
    requestedTab: SearchTab,
    rawQuery: string,
    rawFilters: SearchFilters,
    options: { remember?: boolean; refresh?: boolean } = {}
  ) {
    const term = rawQuery.trim();
    if (!term) return;

    const nextFilters = cleanSearchFilters(rawFilters);
    const validation = validateSearchFilters(nextFilters);
    if (validation) {
      setError(validation);
      return;
    }

    const safeTab = filtersBlockTab(nextFilters, requestedTab)
      ? 'top'
      : requestedTab;
    const id = ++requestId.current;
    setQuery(term);
    setSubmitted({ query: term, filters: nextFilters });
    setFilters(nextFilters);
    setTab(safeTab);
    setError(null);
    setHitsTotal(undefined);
    if (options.refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setLoaded(false);
      setItems([]);
      setCursor(undefined);
    }
    if (options.remember !== false) {
      remember(term, nextFilters);
    }

    try {
      const page = await fetchSearchPage(safeTab, term, nextFilters);
      if (id !== requestId.current) return;
      setItems(page.items);
      setCursor(page.cursor);
      setHitsTotal(page.hitsTotal);
      setLoaded(true);
    } catch (cause) {
      if (id !== requestId.current) return;
      setError(searchError(safeTab, cause));
      setLoaded(true);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }

  async function loadMore() {
    if (
      !submitted ||
      !cursor ||
      loading ||
      refreshing ||
      moreInFlight.current
    ) {
      return;
    }
    const id = requestId.current;
    const activeTab = tab;
    const activeCursor = cursor;
    moreInFlight.current = true;
    setMoreLoading(true);
    setError(null);
    try {
      const page = await fetchSearchPage(
        activeTab,
        submitted.query,
        submitted.filters,
        activeCursor
      );
      if (id !== requestId.current) return;
      setItems((prev) => appendUnique(prev, page.items, activeTab));
      setCursor(page.cursor);
      if (typeof page.hitsTotal === 'number') setHitsTotal(page.hitsTotal);
    } catch (cause) {
      if (id === requestId.current) setError(searchError(activeTab, cause));
    } finally {
      moreInFlight.current = false;
      if (id === requestId.current) setMoreLoading(false);
    }
  }

  function chooseTab(nextTab: SearchTab) {
    if (nextTab === tab) return;
    setTab(nextTab);
    setError(null);
    if (!submitted) return;

    if (filtersBlockTab(submitted.filters, nextTab)) {
      requestId.current += 1;
      setItems([]);
      setCursor(undefined);
      setHitsTotal(undefined);
      setLoading(false);
      setRefreshing(false);
      setLoaded(true);
      return;
    }

    void performSearch(nextTab, submitted.query, submitted.filters, {
      remember: false,
    });
  }

  function applyFilters(nextFilters: SearchFilters) {
    setFilterSheetOpen(false);
    setFilters(nextFilters);
    const term = query.trim();
    if (!term) return;
    const nextTab = filtersBlockTab(nextFilters, tab) ? 'top' : tab;
    void performSearch(nextTab, term, nextFilters, { remember: true });
  }

  function openHistoryEntry(stored: string) {
    const entry = parseSearchEntry(stored);
    setQuery(entry.q);
    setFilters(entry.filters);
    if (entry.q) {
      void performSearch('top', entry.q, entry.filters, { remember: true });
    }
  }

  function removeHistoryEntry(stored: string) {
    setHistory((prev) => {
      const next = prev.filter((item) => item !== stored);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  function clearHistory() {
    setHistory([]);
    AsyncStorage.removeItem(HISTORY_KEY).catch(() => {});
  }

  function openThread(uri: string) {
    navigation.navigate('Thread', { uri });
  }

  function openProfile(did: string) {
    navigation.navigate('UserProfile', { actor: did });
  }

  function hidePost(post: any, scope: 'post' | 'author') {
    setItems((prev) =>
      prev.filter((item) =>
        scope === 'author'
          ? item.author?.did !== post.author.did
          : item.uri !== post.uri
      )
    );
  }

  function renderResult({ item }: { item: any }) {
    if (tab === 'top' || tab === 'latest') {
      return (
        <PostCard
          post={item}
          onOpenThread={openThread}
          onOpenProfile={openProfile}
          onPostHidden={hidePost}
        />
      );
    }
    if (tab === 'people') {
      return <PersonRow person={item} onOpenProfile={openProfile} />;
    }
    if (tab === 'feeds') {
      return (
        <FeedResultCard
          feed={item}
          onOpen={() =>
            navigation.navigate('FeedGenerator', { feed: item.uri })
          }
        />
      );
    }
    return (
      <StarterPackResultCard
        pack={item}
        onOpen={() => navigation.navigate('StarterPack', { uri: item.uri })}
      />
    );
  }

  const filtersActive = countActiveFilters(filters);
  const submittedFilters = submitted
    ? countActiveFilters(submitted.filters)
    : 0;
  const filtersBlocked = submitted
    ? filtersBlockTab(submitted.filters, tab)
    : false;
  const canSearch = query.trim().length > 0 && !loading;

  const empty = (
    <SearchEmpty
      blocked={filtersBlocked}
      error={error}
      loaded={loaded}
      tab={tab}
      query={submitted?.query || ''}
      onRetry={
        submitted
          ? () =>
              void performSearch(tab, submitted.query, submitted.filters, {
                remember: false,
              })
          : undefined
      }
      onClearFilters={() => applyFilters({ ...EMPTY_SEARCH_FILTERS })}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <View
        style={[
          styles.header,
          { backgroundColor: p.card, borderBottomColor: p.divider },
        ]}
      >
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 }}>
          <Text style={{ color: p.text, fontSize: 20, fontWeight: '700' }}>
            Search
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}>
            Posts, people, feeds and starter packs
          </Text>
          <View
            style={[
              styles.searchBox,
              { backgroundColor: p.bg, borderColor: p.divider },
            ]}
          >
            <Ionicons name="search" size={18} color={p.secondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void performSearch(tab, query, filters)}
              placeholder="Search Bluesky"
              placeholderTextColor={p.secondary}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search Bluesky"
              style={[styles.input, { color: p.text }, webInputReset]}
            />
            <Pressable
              onPress={() => void performSearch(tab, query, filters)}
              disabled={!canSearch}
              accessibilityRole="button"
              accessibilityLabel="Search Bluesky"
              accessibilityState={{ disabled: !canSearch, busy: loading }}
              style={({ pressed }) => [
                styles.searchButton,
                { opacity: !canSearch ? 0.45 : pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={{ color: p.accent, fontSize: 14, fontWeight: '700' }}>
                Search
              </Text>
            </Pressable>
          </View>

          <View style={styles.filterRow}>
            <Pressable
              onPress={() => setFilterSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={
                filtersActive
                  ? `Advanced search filters, ${filtersActive} active`
                  : 'Advanced search filters'
              }
              style={({ pressed }) => [
                styles.filterButton,
                {
                  backgroundColor: filtersActive ? p.accentSoft : p.bg,
                  borderColor: filtersActive ? p.accent : p.divider,
                  opacity: pressed ? 0.65 : 1,
                },
              ]}
            >
              <Ionicons
                name="options-outline"
                size={17}
                color={filtersActive ? p.accent : p.text}
              />
              <Text
                style={{
                  color: filtersActive ? p.accent : p.text,
                  fontSize: 13,
                  fontWeight: '600',
                  marginLeft: 6,
                }}
              >
                Filters{filtersActive ? ` · ${filtersActive}` : ''}
              </Text>
            </Pressable>
            {filtersActive > 0 ? (
              <Pressable
                onPress={() => applyFilters({ ...EMPTY_SEARCH_FILTERS })}
                accessibilityRole="button"
                accessibilityLabel="Clear search filters"
                style={({ pressed }) => [
                  styles.clearFilters,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={{ color: p.accent, fontSize: 13, fontWeight: '600' }}>
                  Clear filters
                </Text>
              </Pressable>
            ) : null}
            {submittedFilters > 0 ? (
              <Text
                style={{ color: p.secondary, fontSize: 12, marginLeft: 'auto' }}
              >
                Posts only
              </Text>
            ) : null}
          </View>
        </View>

        {submitted ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tabs}
            >
              {SEARCH_TABS.map((item) => (
                <Tab
                  key={item.id}
                  label={item.label}
                  selected={tab === item.id}
                  onPress={() => chooseTab(item.id)}
                />
              ))}
            </ScrollView>
            <View
              style={[
                styles.summary,
                { borderTopColor: p.divider },
              ]}
            >
              <Text
                style={{ color: p.secondary, fontSize: 12, flex: 1 }}
                numberOfLines={1}
              >
                Results for “{submitted.query}”
              </Text>
              {typeof hitsTotal === 'number' ? (
                <Text style={{ color: p.secondary, fontSize: 12 }}>
                  {hitsTotal} matching posts
                </Text>
              ) : null}
            </View>
          </>
        ) : null}
      </View>

      {!submitted ? (
        <RecentSearches
          history={history}
          onSearch={openHistoryEntry}
          onRemove={removeHistoryEntry}
          onClear={clearHistory}
        />
      ) : loading && items.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={p.accent} />
          <Text style={{ color: p.secondary, fontSize: 13, marginTop: 10 }}>
            Searching…
          </Text>
        </View>
      ) : (
        <FlatList
          key={tab}
          data={filtersBlocked ? [] : items}
          keyExtractor={(item: any) => itemKey(tab, item)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: 28,
            flexGrow: items.length === 0 ? 1 : 0,
          }}
          renderItem={renderResult}
          ListEmptyComponent={empty}
          ListFooterComponent={
            moreLoading ? (
              <ActivityIndicator color={p.accent} style={{ marginVertical: 18 }} />
            ) : error && items.length > 0 ? (
              <Pressable
                onPress={() => void loadMore()}
                accessibilityRole="button"
                accessibilityLabel="Retry loading more search results"
                style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: p.accent, fontWeight: '600' }}>
                  Could not load more. Try again.
                </Text>
              </Pressable>
            ) : undefined
          }
          refreshControl={
            filtersBlocked ? undefined : (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() =>
                  submitted
                    ? void performSearch(
                        tab,
                        submitted.query,
                        submitted.filters,
                        { remember: false, refresh: true }
                      )
                    : undefined
                }
                tintColor={p.accent}
              />
            )
          }
          onEndReached={() => {
            if (!loading && !refreshing && !moreLoading && cursor) {
              void loadMore();
            }
          }}
          onEndReachedThreshold={0.6}
        />
      )}

      <SearchFiltersModal
        visible={filterSheetOpen}
        initialFilters={filters}
        onClose={() => setFilterSheetOpen(false)}
        onApply={applyFilters}
      />
    </View>
  );
}

function Tab({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={`${label} search results`}
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        minHeight: 48,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 3,
        borderBottomColor: selected ? p.accent : 'transparent',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? p.accent : p.secondary,
          fontSize: 15,
          fontWeight: selected ? '700' : '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SearchEmpty({
  blocked,
  error,
  loaded,
  tab,
  query,
  onRetry,
  onClearFilters,
}: {
  blocked: boolean;
  error: string | null;
  loaded: boolean;
  tab: SearchTab;
  query: string;
  onRetry?: () => void;
  onClearFilters: () => void;
}) {
  const p = usePalette();

  if (blocked) {
    return (
      <View style={styles.empty}>
        <Ionicons name="options-outline" size={28} color={p.secondary} />
        <Text style={[styles.emptyTitle, { color: p.text }]}>
          These filters only apply to posts
        </Text>
        <Text style={[styles.emptyBody, { color: p.secondary }]}>
          People, feeds and starter packs cannot be narrowed by post filters.
          Clear the filters to search this tab.
        </Text>
        <Pressable
          onPress={onClearFilters}
          accessibilityRole="button"
          accessibilityLabel="Clear search filters"
          style={({ pressed }) => [
            styles.emptyButton,
            { backgroundColor: p.accent, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Clear filters</Text>
        </Pressable>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.empty}>
        <Ionicons name="alert-circle-outline" size={30} color={p.danger} />
        <Text style={[styles.emptyTitle, { color: p.text }]}>
          Search could not finish
        </Text>
        <Text style={[styles.emptyBody, { color: p.secondary }]}>{error}</Text>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Retry search"
            style={({ pressed }) => [
              styles.emptyButton,
              { backgroundColor: p.soft, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Text style={{ color: p.text, fontWeight: '700' }}>Try again</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (!loaded) return null;

  return (
    <View style={styles.empty}>
      <Ionicons name="search-outline" size={30} color={p.secondary} />
      <Text style={[styles.emptyTitle, { color: p.text }]}>
        {noResultsCopy(tab, query)}
      </Text>
      <Text style={[styles.emptyBody, { color: p.secondary }]}>
        Try different words, another tab, or fewer filters.
      </Text>
    </View>
  );
}

function RecentSearches({
  history,
  onSearch,
  onRemove,
  onClear,
}: {
  history: string[];
  onSearch: (entry: string) => void;
  onRemove: (entry: string) => void;
  onClear: () => void;
}) {
  const p = usePalette();
  const [confirmClear, setConfirmClear] = useState(false);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
    >
      <View style={styles.historyHeader}>
        <Text style={{ color: p.text, fontSize: 16, fontWeight: '700', flex: 1 }}>
          Recent searches
        </Text>
        {history.length > 0 ? (
          <Pressable
            onPress={() => setConfirmClear(true)}
            accessibilityRole="button"
            accessibilityLabel="Clear all recent searches"
            style={({ pressed }) => [
              styles.historyClear,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text style={{ color: p.accent, fontSize: 13, fontWeight: '600' }}>
              Clear all
            </Text>
          </Pressable>
        ) : null}
      </View>

      {confirmClear ? (
        <View
          style={[
            styles.confirmCard,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
            Clear all recent searches?
          </Text>
          <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 18, marginTop: 4 }}>
            This removes the local search list from this device. It does not
            change anything on Bluesky.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Pressable
              onPress={() => setConfirmClear(false)}
              accessibilityRole="button"
              accessibilityLabel="Cancel clearing recent searches"
              style={({ pressed }) => [
                styles.confirmButton,
                { backgroundColor: p.bg, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={{ color: p.text, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onClear();
                setConfirmClear(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Confirm clear all recent searches"
              style={({ pressed }) => [
                styles.confirmButton,
                { backgroundColor: p.danger, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Clear</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {history.length === 0 ? (
        <View
          style={[
            styles.tipCard,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <View style={[styles.tipIcon, { backgroundColor: p.accentSoft }]}>
            <Ionicons name="compass-outline" size={24} color={p.accent} />
          </View>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>
            Find your people and your reading
          </Text>
          <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 5 }}>
            Search posts, accounts, custom feeds and starter packs. Top and
            Latest use Bluesky’s search order; Following is never changed.
          </Text>
          <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 8 }}>
            Use <Text style={{ fontWeight: '700' }}>Filters</Text> for authors,
            mentions, links, tags, languages, dates, replies, media and
            following-only posts. Recent searches stay on this device.
          </Text>
        </View>
      ) : (
        history.map((stored, index) => {
          const entry = parseSearchEntry(stored);
          const count = countActiveFilters(entry.filters);
          return (
            <View
              key={`${stored}-${index}`}
              style={[
                styles.historyRow,
                { backgroundColor: p.card, borderColor: p.divider },
              ]}
            >
              <Pressable
                onPress={() => onSearch(stored)}
                accessibilityRole="button"
                accessibilityLabel={`Search again for ${entry.q}${count ? ` with ${count} filters` : ''}`}
                style={({ pressed }) => [
                  styles.historyMain,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="time-outline" size={19} color={p.secondary} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{ color: p.text, fontSize: 15, fontWeight: '600' }}
                    numberOfLines={1}
                  >
                    {entry.q}
                  </Text>
                  {count > 0 ? (
                    <Text style={{ color: p.secondary, fontSize: 12, marginTop: 1 }}>
                      {count} {count === 1 ? 'filter' : 'filters'}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <Pressable
                onPress={() => onRemove(stored)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${entry.q} from recent searches`}
                style={({ pressed }) => [
                  styles.historyRemove,
                  { opacity: pressed ? 0.55 : 1 },
                ]}
              >
                <Ionicons name="close" size={19} color={p.secondary} />
              </Pressable>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBox: {
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    marginTop: 10,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    paddingHorizontal: 8,
    paddingVertical: 0,
  },
  searchButton: {
    minWidth: 66,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 48,
  },
  filterButton: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  clearFilters: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  tabs: {
    paddingHorizontal: 4,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 30,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingVertical: 36,
    minHeight: 260,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 5,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  emptyButton: {
    minHeight: 44,
    minWidth: 120,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 14,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    minHeight: 44,
    marginBottom: 4,
  },
  historyClear: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
    overflow: 'hidden',
  },
  historyMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    paddingLeft: 14,
    paddingRight: 4,
  },
  historyRemove: {
    width: 48,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipCard: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginTop: 4,
  },
  tipIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  confirmCard: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 8,
  },
  confirmButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
