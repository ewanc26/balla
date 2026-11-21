import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import { subscribeActorHidden } from '../lib/moderation';
import { PostCard } from '../components/PostCard';
import { Avatar } from '../components/Avatar';
import { useViewer } from '../lib/viewer';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

export function FeedScreen() {
  const p = usePalette();
  const navigation = useNavigation<any>();
  const { profile: me } = useViewer();
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

  React.useEffect(() => {
    return subscribeActorHidden((did) =>
      setPosts((prev) =>
        prev.filter((item: any) => item.post.author.did !== did)
      )
    );
  }, []);

  function openThread(uri: string) {
    navigation.navigate('Thread', { uri });
  }

  function openProfile(did: string) {
    navigation.navigate('UserProfile', { actor: did });
  }

  function hidePost(post: any, scope: 'post' | 'author') {
    setPosts((prev) =>
      prev.filter((item: any) =>
        scope === 'author'
          ? item.post.author.did !== post.author.did
          : item.post.uri !== post.uri
      )
    );
  }

  function Header() {
    return (
      <View>
        <View
          style={[
            styles.feedTabs,
            { backgroundColor: p.card, borderBottomColor: p.divider },
          ]}
        >
          <View style={[styles.activeTab, { borderBottomColor: p.accent }]}>
            <Text style={{ color: p.accent, fontSize: 15, fontWeight: '700' }}>
              Following
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.composer,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <Pressable
            onPress={() => navigation.navigate('Compose')}
            accessibilityRole="button"
            accessibilityLabel="Write a new post"
            style={({ pressed }) => [styles.composerTop, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Avatar
              avatar={me && me.avatar}
              displayName={(me && (me.displayName || me.handle)) || 'You'}
              size={40}
            />
            <View style={[styles.pill, { backgroundColor: p.bg }]}>
              <Text style={{ color: p.secondary, fontSize: 15 }}>
                What's on your mind?
              </Text>
            </View>
          </Pressable>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.divider }} />
          <Pressable
            onPress={() => navigation.navigate('Compose')}
            accessibilityRole="button"
            accessibilityLabel="Create a text post"
            style={({ pressed }) => [
              styles.composerAction,
              { backgroundColor: pressed ? p.bg : 'transparent' },
            ]}
          >
            <Ionicons name="create-outline" size={20} color={p.accent} />
            <Text style={{ color: p.accent, fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
              Post
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <FlashList
        data={posts}
        keyExtractor={(item: any) => item.post.uri}
        renderItem={({ item }) => (
          <PostCard
            post={item.post}
            onOpenThread={openThread}
            onOpenProfile={openProfile}
            onPostHidden={hidePost}
          />
        )}
        // FlashList v2 measures items itself; estimatedItemSize is gone.
        contentContainerStyle={{ paddingBottom: 24 }}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          loading ? undefined : (
            <Text
              style={{
                color: p.secondary,
                textAlign: 'center',
                marginTop: 48,
                paddingHorizontal: 24,
              }}
            >
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
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="large" color={p.accent} />
        </View>
      )}
      {error && !loading && (
        <Text style={{ color: p.danger, textAlign: 'center', margin: 12 }}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  feedTabs: {
    height: 48,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  activeTab: {
    paddingHorizontal: 18,
    justifyContent: 'center',
    borderBottomWidth: 3,
  },
  composer: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
  },
  composerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  pill: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    marginLeft: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  composerAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    borderRadius: 6,
  },
});
