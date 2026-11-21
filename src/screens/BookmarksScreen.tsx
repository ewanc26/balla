import React, { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { agent } from '../lib/agent';
import { describeFailure, readWithRetry } from '../lib/reliability';
import { subscribeActorHidden } from '../lib/moderation';
import { PostCard } from '../components/PostCard';
import { usePalette } from '../theme';

function isPostView(item: any): boolean {
  return !!item && typeof item.uri === 'string' && typeof item.cid === 'string' && !!item.author;
}

export function BookmarksScreen() {
  const p = usePalette();
  const navigation = useNavigation<any>();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursor = useRef<string | undefined>(undefined);
  const requestId = useRef(0);

  const load = useCallback(async (fresh: boolean) => {
    const id = ++requestId.current;
    if (fresh) setRefreshing(true);
    else setMoreLoading(true);
    setError(null);

    try {
      const res = await readWithRetry(() =>
        agent.app.bsky.bookmark.getBookmarks({
          limit: 50,
          cursor: fresh ? undefined : cursor.current,
        })
      );
      if (id !== requestId.current) return;

      const next = (res.data.bookmarks || [])
        .map((bookmark: any) => bookmark.item)
        .filter(isPostView)
        .map((post: any) => ({
          ...post,
          // Everything in this response is, by definition, saved. Do not rely
          // on the hydrated viewer state to say so.
          viewer: { ...(post.viewer || {}), bookmarked: true },
        }));
      setPosts((prev) => {
        if (fresh) return next;
        const seen = new Set(prev.map((post: any) => post.uri));
        return prev.concat(next.filter((post: any) => !seen.has(post.uri)));
      });
      cursor.current = res.data.cursor;
    } catch (err) {
      if (id === requestId.current) {
        setError(describeFailure(err, 'Could not load saved posts.'));
      }
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
        setMoreLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(true);
      return () => {
        requestId.current += 1;
      };
    }, [load])
  );

  React.useEffect(() => {
    return subscribeActorHidden((did) =>
      setPosts((prev) =>
        prev.filter((item: any) => item.author.did !== did)
      )
    );
  }, []);

  function openThread(uri: string) {
    navigation.navigate('Thread', { uri });
  }

  function openProfile(did: string) {
    navigation.navigate('UserProfile', { actor: did });
  }

  function handleBookmarkChange(bookmarked: boolean, post: any) {
    if (!bookmarked) {
      setPosts((prev) => prev.filter((item: any) => item.uri !== post.uri));
    }
  }

  function hidePost(post: any, scope: 'post' | 'author') {
    setPosts((prev) =>
      prev.filter((item: any) =>
        scope === 'author'
          ? item.author.did !== post.author.did
          : item.uri !== post.uri
      )
    );
  }

  function Header() {
    return (
      <View
        style={{
          backgroundColor: p.card,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: p.divider,
          paddingHorizontal: 16,
          paddingVertical: 14,
          marginBottom: 8,
        }}
      >
        <Text style={{ color: p.text, fontSize: 20, fontWeight: '700' }}>Saved</Text>
        <Text style={{ color: p.secondary, fontSize: 13, marginTop: 2 }}>
          Private bookmarks from Bluesky. Only you can see them.
        </Text>
        {error ? (
          <View style={{ marginTop: 8, gap: 6 }}>
            <Text style={{ color: p.danger, fontSize: 13 }}>{error}</Text>
            <Pressable
              onPress={() => load(true)}
              accessibilityRole="button"
              accessibilityLabel="Retry loading saved posts"
              style={({ pressed }) => ({
                minHeight: 44,
                justifyContent: 'center',
                alignSelf: 'flex-start',
                paddingHorizontal: 8,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Text style={{ color: p.accent, fontWeight: '700' }}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <FlashList
      data={posts}
      keyExtractor={(item: any) => item.uri}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          onOpenThread={openThread}
          onOpenProfile={openProfile}
          onBookmarkChange={handleBookmarkChange}
          onPostHidden={hidePost}
        />
      )}
      // FlashList v2 measures items itself; estimatedItemSize is gone.
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingBottom: 24 }}
      ListHeaderComponent={Header}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator size="large" color={p.accent} style={{ marginTop: 40 }} />
        ) : error ? null : (
          <Text
            style={{
              color: p.secondary,
              textAlign: 'center',
              marginTop: 40,
              paddingHorizontal: 24,
            }}
          >
            No saved posts yet. Tap Save on any post.
          </Text>
        )
      }
      ListFooterComponent={moreLoading ? <ActivityIndicator style={{ margin: 12 }} /> : null}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={p.accent} />
      }
      onEndReached={() => {
        if (!loading && !refreshing && !moreLoading && cursor.current) load(false);
      }}
      onEndReachedThreshold={0.6}
    />
  );
}
