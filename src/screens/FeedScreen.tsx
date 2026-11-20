import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { agent } from '../lib/agent';
import { PostCard } from '../components/PostCard';
import { Avatar } from '../components/Avatar';
import { usePalette } from '../theme';

export function FeedScreen() {
  const p = usePalette();
  const navigation = useNavigation<any>();
  const [posts, setPosts] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);

  const load = useCallback(
    async (fresh: boolean) => {
      if (fresh) {
        setRefreshing(true);
      } else {
        setMoreLoading(true);
      }
      setError(null);
      try {
        const target = fresh ? undefined : cursor;
        const res = await agent.getTimeline({ limit: 25, cursor: target });
        const feed = res.data.feed || [];
        setPosts((prev) => (fresh ? feed : prev.concat(feed)));
        setCursor(res.data.cursor);
      } catch {
        setError('Could not load the timeline. Pull to try again.');
      }
      setRefreshing(false);
      setMoreLoading(false);
      setLoading(false);
    },
    [cursor]
  );

  React.useEffect(() => {
    load(true);
    // The "What's on your mind?" row above the feed shows your own avatar;
    // if the profile call fails it falls back to the Avatar's initial.
    (async () => {
      try {
        const session = (agent as any).session;
        if (session && session.did) {
          const res = await agent.getProfile({ actor: session.did });
          setMe(res.data);
        }
      } catch {
        // ignored; the trigger works without an avatar
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openThread(uri: string) {
    navigation.navigate('Thread', { uri });
  }

  function Header() {
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
        <Text style={{ color: p.text, fontSize: 28, fontWeight: '800' }}>Balla</Text>
        <Text style={{ color: p.secondary, fontSize: 13, marginTop: 2 }}>
          Following, newest first. No algorithm.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Compose')}
          accessibilityRole="button"
          accessibilityLabel="Write a new post"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: p.card,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginTop: 12,
            minHeight: 44,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Avatar
            avatar={me && me.avatar}
            displayName={(me && (me.displayName || me.handle)) || 'You'}
            size={36}
          />
          <Text style={{ color: p.secondary, fontSize: 15, marginLeft: 10 }}>
            What's on your mind?
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <FlashList
        data={posts}
        keyExtractor={(item: any) => item.post.uri}
        renderItem={({ item }) => <PostCard post={item.post} onOpenThread={openThread} />}
        // FlashList v2 measures items itself; estimatedItemSize is gone.
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          loading ? undefined : (
            <Text style={{ color: p.secondary, textAlign: 'center', marginTop: 48, paddingHorizontal: 24 }}>
              Nothing here yet. Follow some folk, or pull to refresh.
            </Text>
          )
        }
        ListFooterComponent={moreLoading ? <ActivityIndicator style={{ margin: 12 }} /> : null}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={p.accent} />
        }
        onEndReached={() => {
          if (!loading && !moreLoading && cursor) load(false);
        }}
        onEndReachedThreshold={0.6}
      />
      {loading && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={p.accent} />
        </View>
      )}
      {error && !loading && (
        <Text style={{ color: p.danger, textAlign: 'center', margin: 12 }}>{error}</Text>
      )}
    </View>
  );
}
