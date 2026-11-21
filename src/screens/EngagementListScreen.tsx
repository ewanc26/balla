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
import { timeAgo } from '../lib/time';
import { PersonRow } from '../components/PersonRow';
import { PostCard } from '../components/PostCard';
import { usePalette } from '../theme';

type Mode = 'likes' | 'reposts' | 'quotes';

const COPY: Record<Mode, { title: string; empty: string }> = {
  likes: { title: 'Likes', empty: 'No likes yet.' },
  reposts: { title: 'Reposts', empty: 'No reposts yet.' },
  quotes: { title: 'Quotes', empty: 'No quotes yet.' },
};

// Per-post engagement lists: who liked, who reposted, and the quote posts.
// Likes/reposts are cursor-paginated actor lists; quotes are full post cards.
export function EngagementListScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const p = usePalette();
  const uri: string = route.params?.uri;
  const mode: Mode = route.params?.mode || 'likes';
  const [items, setItems] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);

  const fetchPage = useCallback(
    async (nextCursor?: string) => {
      if (mode === 'likes') {
        const res = await agent.app.bsky.feed.getLikes({ uri, limit: 50, cursor: nextCursor });
        const likes = (res.data.likes || []).map((like: any) => ({
          ...like.actor,
          likedAt: like.createdAt,
        }));
        return { items: likes, cursor: res.data.cursor };
      }
      if (mode === 'reposts') {
        const res = await agent.app.bsky.feed.getRepostedBy({
          uri,
          limit: 50,
          cursor: nextCursor,
        });
        return { items: res.data.repostedBy || [], cursor: res.data.cursor };
      }
      const res = await agent.app.bsky.feed.getQuotes({
        uri,
        limit: 30,
        cursor: nextCursor,
      });
      return { items: res.data.posts || [], cursor: res.data.cursor };
    },
    [mode, uri]
  );

  const loadFirstPage = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    setItems([]);
    setCursor(undefined);
    setDone(false);
    try {
      const page = await readWithRetry(() => fetchPage(undefined));
      setItems(page.items);
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
      setItems((prev) =>
        prev.filter((item: any) =>
          mode === 'quotes' ? item.author?.did !== did : item.did !== did
        )
      );
    });
  }, [mode]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: COPY[mode].title });
  }, [navigation, mode]);

  async function loadMore() {
    if (inFlight.current || !cursor || done) return;
    inFlight.current = true;
    setLoadingMore(true);
    try {
      const page = await readWithRetry(() => fetchPage(cursor));
      setItems((prev) => [...prev, ...page.items]);
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

  function openThread(postUri: string) {
    navigation.push('Thread', { uri: postUri });
  }

  function hidePost(post: any, scope: 'post' | 'author') {
    setItems((prev) =>
      prev.filter((item: any) =>
        scope === 'author' ? item.author?.did !== post.author.did : item.uri !== post.uri
      )
    );
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
      data={items}
      keyExtractor={(item: any) => (mode === 'quotes' ? item.uri : item.did)}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      renderItem={({ item }) =>
        mode === 'quotes' ? (
          <PostCard
            post={item}
            onOpenThread={openThread}
            onOpenProfile={openProfile}
            onPostHidden={hidePost}
          />
        ) : (
          <PersonRow
            person={item}
            detail={mode === 'likes' && item.likedAt ? `Liked ${timeAgo(item.likedAt)}` : undefined}
            onOpenProfile={openProfile}
          />
        )
      }
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
        ) : error && items.length > 0 ? (
          <Pressable
            onPress={loadMore}
            accessibilityRole="button"
            accessibilityLabel="Retry loading more"
            style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: p.accent, fontWeight: '600' }}>Try again</Text>
          </Pressable>
        ) : undefined
      }
    />
  );
}
