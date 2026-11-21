import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';
import { agent } from '../lib/agent';
import { describeFailure, readWithRetry } from '../lib/reliability';
import { subscribeActorHidden } from '../lib/moderation';
import { PersonRow } from '../components/PersonRow';
import { usePalette } from '../theme';

type Mode = 'followers' | 'following' | 'known';

const COPY: Record<Mode, { title: string; empty: string }> = {
  followers: { title: 'Followers', empty: 'No followers yet.' },
  following: { title: 'Following', empty: 'Not following anyone yet.' },
  known: { title: 'Followed by', empty: 'No followers you know yet.' },
};

// Followers and following are cursor-paginated AppView lists. Known followers
// is the "followed by people you follow" list the official client shows on a
// profile. All three render the same followable row.
export function PeopleListScreen({ route, navigation }: { route: any; navigation: any }) {
  const p = usePalette();
  const actor: string = route.params?.actor;
  const mode: Mode = route.params?.mode || 'followers';
  const [people, setPeople] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);

  const fetchPage = useCallback(
    async (nextCursor?: string) => {
      const input = { actor, limit: 50, cursor: nextCursor };
      if (mode === 'followers') {
        const res = await agent.app.bsky.graph.getFollowers(input);
        return { items: res.data.followers || [], cursor: res.data.cursor };
      }
      if (mode === 'following') {
        const res = await agent.app.bsky.graph.getFollows(input);
        return { items: res.data.follows || [], cursor: res.data.cursor };
      }
      const res = await agent.app.bsky.graph.getKnownFollowers(input);
      return { items: res.data.followers || [], cursor: res.data.cursor };
    },
    [actor, mode]
  );

  const loadFirstPage = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    setPeople([]);
    setCursor(undefined);
    setDone(false);
    try {
      const page = await readWithRetry(() => fetchPage(undefined));
      setPeople(page.items);
      setCursor(page.cursor);
      setDone(!page.cursor);
    } catch (err) {
      setError(describeFailure(err, 'Could not load this list.'));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  useEffect(() => {
    return subscribeActorHidden((did) => {
      setPeople((prev) => prev.filter((person: any) => person.did !== did));
    });
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({ title: COPY[mode].title });
  }, [navigation, mode]);

  async function loadMore() {
    if (inFlight.current || !cursor || done) return;
    inFlight.current = true;
    setLoadingMore(true);
    try {
      const page = await readWithRetry(() => fetchPage(cursor));
      setPeople((prev) => [...prev, ...page.items]);
      setCursor(page.cursor);
      setDone(!page.cursor);
      setError(null);
    } catch (err) {
      setError(describeFailure(err, 'Could not load more. Scroll to try again.'));
    } finally {
      inFlight.current = false;
      setLoadingMore(false);
    }
  }

  function openProfile(did: string) {
    navigation.push('UserProfile', { actor: did });
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={p.accent} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
      data={people}
      keyExtractor={(item: any) => item.did}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      renderItem={({ item }) => <PersonRow person={item} onOpenProfile={openProfile} />}
      ListEmptyComponent={
        <View style={{ paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' }}>
          <Text style={{ color: p.secondary, textAlign: 'center' }}>
            {error || COPY[mode].empty}
          </Text>
          {error ? (
            <Pressable
              onPress={loadFirstPage}
              accessibilityRole="button"
              accessibilityLabel="Try loading this list again"
              style={({ pressed }) => ({
                marginTop: 12,
                minHeight: 44,
                paddingHorizontal: 20,
                borderRadius: 8,
                backgroundColor: p.soft,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={{ color: p.text, fontWeight: '600' }}>Try again</Text>
            </Pressable>
          ) : null}
        </View>
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator color={p.accent} style={{ marginVertical: 18 }} />
        ) : error && people.length > 0 ? (
          <Pressable
            onPress={loadMore}
            accessibilityRole="button"
            accessibilityLabel="Retry loading more people"
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: p.accent, fontWeight: '600' }}>Try again</Text>
          </Pressable>
        ) : undefined
      }
    />
  );
}
