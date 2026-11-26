import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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
import { agent } from '../lib/agent';
import { PostCard } from '../components/PostCard';
import { withFeedReply } from '../lib/replyContext.ts';
import { Avatar } from '../components/Avatar';
import { subscribeActorHidden } from '../lib/moderation';
import { useFeeds } from '../lib/feedsContext';
import { ReportListSheet } from '../components/ReportListSheet';
import {
  canLike,
  isLiked,
  nextLikeCount,
  toggleObjectLike,
} from '../lib/objectLikes';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

export function FeedGeneratorScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const p = usePalette();
  const {
    savedFeeds,
    loading: savedFeedsLoading,
    error: savedFeedsError,
    saveFeed,
  } = useFeeds();
  const feed = typeof route.params?.feed === 'string' ? route.params.feed : '';
  const savedFeed = savedFeeds.find((item) => item.value === feed);
  const [generator, setGenerator] = useState<any>(null);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [savingFeed, setSavingFeed] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [likeState, setLikeState] = useState<{
    uri: string | null;
    count: number;
  } | null>(null);
  const [likeBusy, setLikeBusy] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);
  const requestId = useRef(0);
  const moreInFlight = useRef(false);

  const load = useCallback(
    async (fresh: boolean) => {
      if (!feed) {
        setError('This feed has no address.');
        setLoading(false);
        return;
      }
      const id = ++requestId.current;
      if (fresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      setMoreError(null);
      try {
        const [generatorResponse, feedResponse] = await Promise.all([
          agent.app.bsky.feed.getFeedGenerator({ feed }),
          agent.app.bsky.feed.getFeed({ feed, limit: 30 }),
        ]);
        if (id !== requestId.current) return;
        const view = generatorResponse.data.view;
        setGenerator(view);
        setLikeState({ uri: view.viewer?.like || null, count: view.likeCount || 0 });
        setIsOnline(generatorResponse.data.isOnline);
        setIsValid(generatorResponse.data.isValid);
        setPosts(
          (feedResponse.data.feed || [])
            .map(withFeedReply)
            .filter(Boolean)
        );
        setCursor(feedResponse.data.cursor);
      } catch {
        if (id === requestId.current) {
          setError('Could not load this feed. It may be offline or unavailable.');
        }
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [feed]
  );

  useEffect(() => {
    void load(false);
    return () => {
      requestId.current += 1;
    };
  }, [load]);

  useEffect(() => {
    return subscribeActorHidden((did) =>
      setPosts((prev) =>
        prev.filter((post: any) => post.author?.did !== did)
      )
    );
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: generator?.displayName || 'Feed',
      headerRight: generator
        ? () => (
            <Pressable
              onPress={() => setReporting(true)}
              accessibilityRole="button"
              accessibilityLabel="Report this feed"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={({ pressed }) => ({
                minWidth: 44,
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Ionicons name="flag-outline" size={22} color={p.text} />
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, generator, p.text]);

  async function loadMore() {
    if (!feed || !cursor || moreInFlight.current || loading) return;
    const id = requestId.current;
    const nextCursor = cursor;
    moreInFlight.current = true;
    setMoreLoading(true);
    setMoreError(null);
    try {
      const response = await agent.app.bsky.feed.getFeed({
        feed,
        limit: 30,
        cursor: nextCursor,
      });
      if (id !== requestId.current) return;
      setPosts((prev) => {
        const seen = new Set(prev.map((post: any) => post.uri));
        return prev.concat(
          (response.data.feed || [])
            .map((item: any) => item.post)
            .filter((post: any) => post && !seen.has(post.uri))
        );
      });
      setCursor(response.data.cursor);
    } catch {
      if (id === requestId.current) {
        setMoreError('Could not load more from this feed.');
      }
    } finally {
      moreInFlight.current = false;
      if (id === requestId.current) setMoreLoading(false);
    }
  }

  function openThread(uri: string) {
    navigation.navigate('Thread', { uri });
  }

  function openProfile(did: string) {
    navigation.navigate('UserProfile', { actor: did });
  }

  function hidePost(post: any, scope: 'post' | 'author') {
    setPosts((prev) =>
      prev.filter((item) =>
        scope === 'author'
          ? item.author?.did !== post.author.did
          : item.uri !== post.uri
      )
    );
  }

  async function saveThisFeed() {
    if (savingFeed) return;
    setSavingFeed(true);
    setSaveError(null);
    try {
      await saveFeed(feed, false);
    } catch {
      setSaveError('Could not save this feed. Try again.');
    } finally {
      setSavingFeed(false);
    }
  }

  async function toggleLike() {
    if (!likeState || likeBusy) return;
    const target = {
      uri: generator.uri,
      cid: generator.cid,
      likeUri: likeState.uri,
    };
    if (!canLike(target)) return;
    const wasLiked = isLiked(target);
    const optimisticCount = nextLikeCount(
      { ...target, likeCount: likeState.count },
      !wasLiked
    );
    setLikeBusy(true);
    setLikeError(null);
    // Optimistic: flip the count and heart, roll back on failure.
    setLikeState({ uri: wasLiked ? null : 'pending', count: optimisticCount });
    try {
      const result = await toggleObjectLike(target);
      setLikeState({ uri: result.likeUri, count: optimisticCount });
    } catch {
      setLikeState({ uri: likeState.uri, count: likeState.count });
      setLikeError('Could not update this like. Try again.');
    } finally {
      setLikeBusy(false);
    }
  }

  if (loading && !generator) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={p.accent} />
      </View>
    );
  }

  if (!generator) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Ionicons name="albums-outline" size={34} color={p.secondary} />
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>
          Feed unavailable
        </Text>
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 5 }}>
          {error || 'This feed could not be loaded.'}
        </Text>
        <Pressable
          onPress={() => void load(false)}
          accessibilityRole="button"
          accessibilityLabel="Retry loading this feed"
          style={({ pressed }) => ({
            minHeight: 44,
            borderRadius: CARD_RADIUS,
            backgroundColor: p.accent,
            paddingHorizontal: 22,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 16,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: p.onAccent, fontWeight: '700' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const creator = generator.creator || {};
  const Header = (
    <View
      style={[
        styles.card,
        { backgroundColor: p.card, borderColor: p.divider },
        cardShadow,
      ]}
    >
      <View style={styles.identityRow}>
        <Avatar
          avatar={generator.avatar}
          displayName={generator.displayName}
          size={56}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: p.text, fontSize: 19, fontWeight: '700' }} numberOfLines={2}>
            {generator.displayName}
          </Text>
          <Text style={{ color: p.secondary, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
            Feed by @{creator.handle || 'unknown'}
            {generator.likeCount ? ` · ${generator.likeCount} likes` : ''}
          </Text>
        </View>
        <Pressable
          onPress={() =>
            creator.did && navigation.navigate('UserProfile', { actor: creator.did })
          }
          disabled={!creator.did}
          accessibilityRole="button"
          accessibilityLabel={`Open ${creator.handle || 'feed creator'}'s profile`}
          style={({ pressed }) => [
            styles.creatorButton,
            { backgroundColor: p.bg, borderColor: p.divider, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="person-outline" size={18} color={p.text} />
        </Pressable>
      </View>

      {generator.description ? (
        <Text style={{ color: p.text, fontSize: 14, lineHeight: 20, marginTop: 12 }}>
          {generator.description}
        </Text>
      ) : null}

      {likeState && likeState.count > 0 ? (
        <Pressable
          onPress={() =>
            navigation.navigate('EngagementList', { uri: generator.uri, mode: 'likes' })
          }
          accessibilityRole="button"
          accessibilityLabel={`View users who like ${generator.displayName}`}
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Text style={{ color: p.secondary, fontSize: 13, textDecorationLine: 'underline' }}>
            Liked by {likeState.count} {likeState.count === 1 ? 'user' : 'users'}
          </Text>
        </Pressable>
      ) : null}

      <View style={styles.feedActions}>
        <View
          style={[
            styles.savedChip,
            { backgroundColor: p.bg, borderColor: p.divider },
          ]}
        >
          <Ionicons
            name={savedFeed ? 'bookmark' : 'bookmark-outline'}
            size={16}
            color={savedFeed ? p.accent : p.secondary}
          />
          <Text style={{ color: savedFeed ? p.accent : p.secondary, fontSize: 12, fontWeight: '600' }}>
            {savedFeed
              ? savedFeed.pinned
                ? 'Pinned to Home'
                : 'Saved feed'
              : savedFeedsLoading
                ? 'Checking saved feeds…'
                : savedFeedsError
                  ? 'Saved feeds unavailable'
                  : 'Not saved'}
          </Text>
        </View>
        {canLike(generator) ? (
          <Pressable
            onPress={() => void toggleLike()}
            disabled={likeBusy}
            accessibilityRole="button"
            accessibilityLabel={
              likeState?.uri && likeState.uri !== 'pending'
                ? `Unlike ${generator.displayName}`
                : `Like ${generator.displayName}`
            }
            style={({ pressed }) => [
              styles.feedActionButton,
              {
                backgroundColor: p.bg,
                borderColor: likeState?.uri && likeState.uri !== 'pending' ? p.danger : p.divider,
                opacity: pressed || likeBusy ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons
              name={likeState?.uri && likeState.uri !== 'pending' ? 'heart' : 'heart-outline'}
              size={16}
              color={likeState?.uri && likeState.uri !== 'pending' ? p.danger : p.secondary}
            />
            <Text
              style={{
                color: likeState?.uri && likeState.uri !== 'pending' ? p.danger : p.secondary,
                fontSize: 13,
                fontWeight: '700',
                marginLeft: 5,
              }}
            >
              {likeState?.uri && likeState.uri !== 'pending' ? 'Liked' : 'Like'}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => {
            if (savedFeed) navigation.navigate('Feeds');
            else void saveThisFeed();
          }}
          disabled={
            savingFeed ||
            (!savedFeed && (savedFeedsLoading || !!savedFeedsError))
          }
          accessibilityRole="button"
          accessibilityLabel={savedFeed ? 'Manage saved feeds' : 'Save this feed'}
          style={({ pressed }) => [
            styles.feedActionButton,
            {
              backgroundColor: savedFeed ? p.bg : p.accent,
              borderColor: savedFeed ? p.divider : p.accent,
              opacity:
                pressed ||
                savingFeed ||
                (!savedFeed && (savedFeedsLoading || !!savedFeedsError))
                  ? 0.6
                  : 1,
            },
          ]}
        >
          {savingFeed ? (
            <ActivityIndicator size="small" color={p.onAccent} />
          ) : (
            <Text style={{ color: savedFeed ? p.accent : p.onAccent, fontSize: 13, fontWeight: '700' }}>
              {savedFeed ? 'Manage feeds' : 'Save feed'}
            </Text>
          )}
        </Pressable>
      </View>
      {saveError ? (
        <Text style={{ color: p.danger, fontSize: 12, lineHeight: 17, marginTop: 7 }}>
          {saveError}
        </Text>
      ) : null}
      {likeError ? (
        <Text style={{ color: p.danger, fontSize: 12, lineHeight: 17, marginTop: 7 }}>
          {likeError}
        </Text>
      ) : null}

      {generator.contentMode === 'app.bsky.feed.defs#contentModeVideo' ? (
        <Text style={{ color: p.secondary, fontSize: 12, marginTop: 8 }}>
          Video feed
        </Text>
      ) : null}

      {isOnline === false ? (
        <View style={[styles.notice, { backgroundColor: p.bg }]}>
          <Ionicons name="cloud-offline-outline" size={17} color={p.secondary} />
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, flex: 1 }}>
            This feed generator has not been online recently. The posts below are
            the last response Bluesky returned.
          </Text>
        </View>
      ) : null}
      {isValid === false ? (
        <View style={[styles.notice, { backgroundColor: p.bg }]}>
          <Ionicons name="warning-outline" size={17} color={p.danger} />
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, flex: 1 }}>
            The service says this generator does not match its record declaration.
            Treat its ordering and contents with caution.
          </Text>
        </View>
      ) : null}

      {error ? (
        <Pressable
          onPress={() => void load(true)}
          accessibilityRole="button"
          accessibilityLabel="Retry refreshing this feed"
          style={({ pressed }) => [
            styles.notice,
            { backgroundColor: p.bg, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Ionicons name="alert-circle-outline" size={17} color={p.danger} />
          <Text style={{ color: p.danger, fontSize: 12, lineHeight: 17, flex: 1 }}>
            {error} Tap to try again.
          </Text>
        </Pressable>
      ) : null}

      <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 16, marginTop: 10 }}>
        This feed’s order comes from its generator, not Balla. The chronological
        Following feed is unchanged.
      </Text>
    </View>
  );

  return (
    <>
    <FlatList
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 28 }}
      data={posts}
      keyExtractor={(item: any) => item.uri}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          replyParent={item.feedReply?.parent}
          onOpenThread={openThread}
          onOpenProfile={openProfile}
          onPostHidden={hidePost}
          feedbackFeed={{ uri: feed, generator }}
        />
      )}
      ListHeaderComponent={Header}
      ListEmptyComponent={
        <Text style={{ color: p.secondary, textAlign: 'center', marginTop: 36, paddingHorizontal: 24 }}>
          No posts are available from this feed right now.
        </Text>
      }
      ListFooterComponent={
        moreLoading ? (
          <ActivityIndicator color={p.accent} style={{ marginVertical: 18 }} />
        ) : moreError ? (
          <Pressable
            onPress={() => void loadMore()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading more posts from this feed"
            style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: p.accent, fontWeight: '600' }}>{moreError} Try again.</Text>
          </Pressable>
        ) : undefined
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          tintColor={p.accent}
        />
      }
      onEndReached={() => {
        if (cursor && !moreLoading) void loadMore();
      }}
      onEndReachedThreshold={0.6}
    />
    {reporting && generator ? (
      <ReportListSheet feed={generator} onClose={() => setReporting(false)} />
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
    marginBottom: 8,
    padding: 16,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  creatorButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  savedChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feedActionButton: {
    minHeight: 44,
    minWidth: 106,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    minHeight: 44,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
  },
});
