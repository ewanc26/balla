import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { networkBackend } from '../lib/networkBackend';
import { describeFailure, readWithRetry } from '../lib/reliability';
import { subscribeActorHidden } from '../lib/moderation';
import { PostCard } from '../components/PostCard';
import { MOCK_MODE } from '../lib/mock';
import { touchTargetStyle } from '../lib/accessibility';
import {
  buildDiscoveryParams,
  discoveryCopy,
  discoveryError,
  emptyDiscoveryCopy,
  modeFromRouteName,
  type DiscoveryMode,
} from '../lib/discoveryModel';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

/**
 * One screen backs four explicit destinations: Hashtag, Topic, VideoFeed and
 * the opt-in Discover surface. Only Discover is ranked; the other three are
 * newest-first. None of them is inserted into Following.
 */
export function DiscoveryScreen({ route, navigation }: { route?: any; navigation: any }) {
  const p = usePalette();
  const mode: DiscoveryMode = modeFromRouteName(route?.name) ?? 'discover';
  const rawValue = mode === 'hashtag' ? route?.params?.tag : route?.params?.topic;
  const copy = discoveryCopy(mode, rawValue);
  const params = buildDiscoveryParams(mode, rawValue);

  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const requestId = useRef(0);
  const moreInFlight = useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: copy.title });
  }, [navigation, copy.title]);

  async function loadPage(nextCursor?: string, refresh = false) {
    if (!params) {
      setError(discoveryError(mode));
      setLoading(false);
      setLoaded(true);
      return;
    }
    const id = ++requestId.current;
    if (refresh) setRefreshing(true);
    else if (!nextCursor) {
      setLoading(true);
      setLoaded(false);
      setItems([]);
      setCursor(undefined);
    } else setMoreLoading(true);
    setError(null);

    try {
      const res = await readWithRetry(() =>
        networkBackend.search.searchPosts({
          ...params,
          ...(nextCursor ? { cursor: nextCursor } : {}),
        })
      );
      if (id !== requestId.current) return;
      const posts = res.data.posts || [];
      setItems((prev) => {
        if (!nextCursor) return posts;
        const seen = new Set(prev.map((post: any) => post.uri));
        return [...prev, ...posts.filter((post: any) => !seen.has(post.uri))];
      });
      setCursor(res.data.cursor);
      setLoaded(true);
    } catch (cause) {
      if (id !== requestId.current) return;
      setError(describeFailure(cause, discoveryError(mode)));
      setLoaded(true);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
        setMoreLoading(false);
      }
    }
  }

  // The params object is rebuilt on every render, so key the loader by the
  // stable inputs instead of placing it in a dependency array.
  const paramsKey = JSON.stringify(params);
  useLayoutEffect(() => {
    void loadPage(undefined, false);
    return () => {
      requestId.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, rawValue, paramsKey]);

  useLayoutEffect(() => {
    return subscribeActorHidden((did) => {
      setItems((prev) =>
        prev.filter((post: any) => post.author?.did !== did)
      );
    });
  }, []);

  function openThread(uri: string) {
    navigation.navigate('Thread', { uri });
  }

  function openProfile(did: string) {
    navigation.navigate('UserProfile', { actor: did });
  }

  function hidePost(post: any, scope: 'post' | 'author') {
    setItems((prev) =>
      prev.filter((item: any) =>
        scope === 'author'
          ? item.author?.did !== post.author.did
          : item.uri !== post.uri
      )
    );
  }

  function loadMore() {
    if (!cursor || loading || refreshing || moreLoading || moreInFlight.current) return;
    moreInFlight.current = true;
    void loadPage(cursor).finally(() => {
      moreInFlight.current = false;
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <View
        style={[
          styles.banner,
          {
            backgroundColor: copy.ranked ? p.accentSoft : p.card,
            borderBottomColor: p.divider,
          },
          cardShadow,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons
            name={copy.ranked ? 'sparkles-outline' : 'time-outline'}
            size={18}
            color={p.accent}
          />
          <Text style={{ color: p.text, fontSize: 17, fontWeight: '700', marginLeft: 8, flex: 1 }}>
            {copy.title}
          </Text>
          <Text
            accessibilityRole="text"
            style={{
              color: p.accent,
              fontSize: 11,
              fontWeight: '700',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: p.accent,
              borderRadius: CARD_RADIUS,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            {copy.ranked ? 'SUGGESTED · RANKED' : 'NEWEST FIRST'}
          </Text>
        </View>
        <Text style={{ color: p.secondary, fontSize: 12, marginTop: 4 }}>
          {copy.subtitle}
        </Text>
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
          {copy.banner}
        </Text>
        {MOCK_MODE ? (
          <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 16, marginTop: 6 }}>
            Preview: these are sample posts, not live results.
          </Text>
        ) : null}
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={p.accent} />
          <Text style={{ color: p.secondary, fontSize: 13, marginTop: 10 }}>
            Loading posts…
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item: any) => item.uri}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 28 }}
          renderItem={({ item }: { item: any }) => (
            <PostCard
              post={item}
              onOpenThread={openThread}
              onOpenProfile={openProfile}
              onPostHidden={hidePost}
            />
          )}
          ListEmptyComponent={
            loaded && !error ? (
              <View style={styles.centered}>
                <Text style={{ color: p.secondary, fontSize: 13 }}>
                  {emptyDiscoveryCopy(mode)}
                </Text>
              </View>
            ) : undefined
          }
          ListFooterComponent={
            moreLoading ? (
              <ActivityIndicator color={p.accent} style={{ marginVertical: 18 }} />
            ) : error && items.length > 0 ? (
              <Pressable
                onPress={() => void loadPage(undefined, true)}
                accessibilityRole="button"
                accessibilityLabel={`Retry loading ${copy.title}`}
                style={({ pressed }) => [
                  touchTargetStyle,
                  { alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={{ color: p.accent, fontWeight: '600' }}>
                  Could not load posts. Try again.
                </Text>
              </Pressable>
            ) : undefined
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadPage(undefined, true)}
              tintColor={p.accent}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
});
