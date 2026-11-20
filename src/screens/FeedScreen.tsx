import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { agent } from '../lib/agent';
import { PostCard } from '../components/PostCard';
import { usePalette } from '../theme';

export function FeedScreen() {
  const p = usePalette();
  const [posts, setPosts] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listHeader = (
    <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
      <Text style={{ color: p.text, fontSize: 28, fontWeight: '800' }}>Balla</Text>
      <Text style={{ color: p.secondary, fontSize: 13, marginTop: 2 }}>
        Following, newest first. No algorithm.
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <FlashList
        data={posts}
        keyExtractor={(item: any) => item.post.uri}
        renderItem={({ item }) => <PostCard post={item.post} />}
        estimatedItemSize={420}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          loading ? null : (
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
