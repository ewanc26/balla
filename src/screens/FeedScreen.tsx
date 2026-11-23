import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { networkBackend } from '../lib/networkBackend';
import { describeFailure, readWithRetry } from '../lib/reliability';
import { subscribeActorHidden } from '../lib/moderation';
import { useFeeds } from '../lib/feedsContext';
import { usePreferences } from '../lib/preferences';
import { useViewPreferences } from '../lib/viewPreferences';
import {
  filterByContentLanguages,
  filterFeedItems,
} from '../lib/viewPreferencesModel';
import { filterSnoozedItems } from '../lib/snoozeModel';
import { useSnoozedAccounts } from '../lib/snooze';
import { buildRecentActivity } from '../lib/recentActivityModel';
import { setRecentActivity } from '../lib/recentActivity';
import { clearReplyPreviewCache } from '../lib/replyPreviewStore';
import { useMemories } from '../lib/useMemories';
import { isMemoriesDismissed, memoriesDateKey } from '../lib/memoriesModel';
import { PostCard } from '../components/PostCard';
import { MemoriesCard } from '../components/MemoriesCard';
import { Avatar } from '../components/Avatar';
import { FeedSwitcherSheet } from '../components/FeedSwitcherSheet';
import {
  feedChoices,
  feedStillAvailable,
  selectedFeed,
} from '../lib/feedSwitcher';
import { useViewer } from '../lib/viewer';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

export function FeedScreen() {
  const p = usePalette();
  const navigation = useNavigation<any>();
  const { profile: me } = useViewer();
  const { homeFeeds, generators, lists } = useFeeds();
  const { preferences, dismissMemories } = usePreferences();
  const { feedFilters } = useViewPreferences();
  const snoozedAccounts = useSnoozedAccounts();
  const [activeFeed, setActiveFeed] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [reqId, setReqId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [previewVisibleUris, setPreviewVisibleUris] = useState<Set<string>>(
    () => new Set()
  );
  const requestId = useRef(0);
  const activeSource = activeFeed
    ? homeFeeds.find((item) => item.value === activeFeed)
    : undefined;
  const activeIsList = activeSource?.type === 'list';
  const memoriesDayKey = memoriesDateKey(new Date());
  const memoriesPreference = me?.did
    ? preferences.memories[me.did]
    : undefined;
  const memoriesEnabled = !!memoriesPreference?.enabled;
  const memories = useMemories(me?.did, memoriesEnabled, memoriesDayKey);
  const showMemories =
    !activeFeed &&
    !!memories?.items.length &&
    !isMemoriesDismissed(memoriesPreference, memoriesDayKey);

  const load = useCallback(
    async (fresh: boolean) => {
      const id = ++requestId.current;
      if (fresh) setRefreshing(true);
      else setMoreLoading(true);
      setError(null);
      try {
        const target = fresh ? undefined : cursor;
        const readPage = activeFeed
          ? activeIsList
            ? () =>
                networkBackend.timeline.getListFeed({
                  list: activeFeed,
                  limit: 25,
                  cursor: target,
                })
            : () =>
                networkBackend.timeline.getFeed({
                  feed: activeFeed,
                  limit: 25,
                  cursor: target,
                })
          : () => networkBackend.timeline.getTimeline({ limit: 25, cursor: target });
        // Both calls are reads, so bounded backoff is safe here. Writes are
        // never replayed by this helper.
        const res = await readWithRetry(readPage);
        if (id !== requestId.current) return;
        const feed = res.data.feed || [];
        setPosts((prev) => (fresh ? feed : prev.concat(feed)));
        setCursor(res.data.cursor);
        setReqId((res.data as any).reqId);
      } catch (err) {
        if (id === requestId.current) {
          setError(
            describeFailure(
              err,
              activeIsList
                ? 'Could not load this list feed. Tap Retry to try again.'
                : activeFeed
                  ? 'Could not load this feed. Tap Retry to try again.'
                  : 'Could not load the timeline. Tap Retry to try again.'
            )
          );
        }
      } finally {
        if (id === requestId.current) {
          setRefreshing(false);
          setMoreLoading(false);
          setLoading(false);
        }
      }
    },
    [activeFeed, activeIsList, cursor]
  );

  useEffect(() => {
    setPosts([]);
    setCursor(undefined);
    setReqId(undefined);
    setError(null);
    setLoading(true);
    setPreviewVisibleUris(new Set());
    void load(true);
    return () => {
      requestId.current += 1;
      clearReplyPreviewCache();
    };
    // The cursor is deliberately not a dependency: loading another page must
    // not reset the timeline. Switching feeds owns the reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFeed, activeIsList]);

  useEffect(() => {
    if (!feedStillAvailable(activeFeed, homeFeeds)) setActiveFeed(null);
  }, [activeFeed, homeFeeds]);

  useEffect(() => {
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

  // The right rail describes the Following timeline only. Custom and list
  // feeds clear it rather than presenting their generator order as "people you
  // follow". This derives from the same in-memory page set as the feed.
  useEffect(() => {
    setRecentActivity(
      activeFeed
        ? []
        : buildRecentActivity(posts, {
            viewerDid: me?.did,
            snoozes: snoozedAccounts,
            now: Date.now(),
          })
    );
  }, [activeFeed, me?.did, posts, snoozedAccounts]);

  useEffect(() => () => setRecentActivity([]), []);

  // Only Following is filtered here. Custom and list feeds keep the order
  // their service returns; filters are the home feedViewPref, not a global rule.
  // FlashList reports the cards that have stayed on screen long enough to be
  // worth one depth-1 read. The callback is stable because changing it on the
  // fly is not supported. Leaving the viewport removes a queued request.
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 20,
    minimumViewTime: 150,
  }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: any[] }) => {
      const next = new Set<string>();
      for (const token of viewableItems) {
        const uri = token?.item?.post?.uri;
        if (typeof uri === 'string') next.add(uri);
      }
      setPreviewVisibleUris((previous) => {
        if (
          previous.size === next.size &&
          [...next].every((uri) => previous.has(uri))
        ) {
          return previous;
        }
        return next;
      });
    }
  ).current;

  const visiblePosts = useMemo(() => {
    // Snoozes apply only here: every other surface (notifications, profiles,
    // threads and chat) still shows the account. Expiry is read on each render,
    // and a feed refresh always produces one. Order is untouched.
    const unsnoozed = filterSnoozedItems(posts, snoozedAccounts, Date.now());
    return activeFeed
      ? unsnoozed
      : filterByContentLanguages(
          filterFeedItems(unsnoozed, feedFilters),
          preferences.contentLanguages
        );
  }, [activeFeed, posts, feedFilters, preferences.contentLanguages, snoozedAccounts]);

  const activeGenerator =
    activeFeed && !activeIsList ? generators[activeFeed] : undefined;
  const choices = feedChoices(homeFeeds, generators, lists);
  const activeChoice = selectedFeed(activeFeed, homeFeeds, generators, lists);

  function Header() {
    return (
      <View>
        <View
          style={[
            styles.switcherBar,
            { backgroundColor: p.card, borderBottomColor: p.divider },
          ]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{
                color: p.secondary,
                fontSize: 11,
                fontWeight: '700',
                textTransform: 'uppercase',
              }}
            >
              {activeChoice.following
                ? 'Chronological feed'
                : activeChoice.kind === 'list'
                  ? 'List feed'
                  : 'Custom feed'}
            </Text>
            <Text
              numberOfLines={1}
              style={{ color: p.text, fontSize: 17, fontWeight: '700', marginTop: 1 }}
            >
              {activeChoice.label}
            </Text>
          </View>
          <Pressable
            onPress={() => setSwitcherOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Switch feed"
            accessibilityHint="Choose Following, a saved feed or a list feed"
            style={({ pressed }) => [
              styles.switchButton,
              {
                backgroundColor: p.accentSoft,
                opacity: pressed ? 0.65 : 1,
              },
            ]}
          >
            <Ionicons name="swap-horizontal-outline" size={19} color={p.accent} />
            <Text style={{ color: p.accent, fontSize: 14, fontWeight: '700', marginLeft: 7 }}>
              Switch
            </Text>
          </Pressable>
        </View>

        {activeFeed ? (
          <View style={[styles.feedNote, { borderColor: p.divider }]}>
            <Ionicons
              name={activeChoice.kind === 'list' ? 'list-outline' : 'git-branch-outline'}
              size={16}
              color={p.secondary}
            />
            <Text
              style={{
                color: p.secondary,
                fontSize: 12,
                lineHeight: 17,
                flex: 1,
              }}
            >
              {activeChoice.kind === 'list'
                ? `List feed${activeChoice.creator ? ` by ${activeChoice.creator}` : ''}. Posts from people on this list, newest first. Following remains chronological and first.`
                : `Custom feed${activeChoice.creator ? ` by ${activeChoice.creator}` : ''}. Its order comes from the generator, not Balla. Following remains chronological and first.`}
            </Text>
          </View>
        ) : null}

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
            style={({ pressed }) => [
              styles.composerTop,
              { opacity: pressed ? 0.7 : 1 },
            ]}
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
          <View
            style={{
              height: StyleSheet.hairlineWidth,
              backgroundColor: p.divider,
            }}
          />
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
            <Text
              style={{
                color: p.accent,
                fontSize: 15,
                fontWeight: '600',
                marginLeft: 8,
              }}
            >
              Post
            </Text>
          </Pressable>
        </View>

        {showMemories && memories ? (
          <MemoriesCard
            memories={memories}
            onOpenThread={openThread}
            onSeeAll={() => navigation.navigate('Memories')}
            onDismiss={() => {
              if (me?.did) dismissMemories(me.did, memories.dateKey);
            }}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <FlashList
        data={visiblePosts}
        extraData={previewVisibleUris}
        keyExtractor={(item: any) => item.post.uri}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <PostCard
            post={item.post}
            replyParent={item.reply?.parent}
            onOpenThread={openThread}
            onOpenProfile={openProfile}
            onPostHidden={hidePost}
            replyPreviewEnabled={previewVisibleUris.has(item.post.uri)}
            feedbackFeed={
              activeIsList
                ? undefined
                : {
                    uri: activeFeed || undefined,
                    generator: activeGenerator,
                    feedContext: item.feedContext,
                    reqId,
                  }
            }
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
              {activeFeed
                ? 'This feed has no posts right now. Pull to refresh, or choose Following.'
                : posts.length > 0
                  ? 'Your feed and language filters hide every post on this page. Change them in Settings.'
                  : 'Nothing here yet. Follow some folk, or pull to refresh.'}
            </Text>
          )
        }
        ListFooterComponent={
          moreLoading ? <ActivityIndicator style={{ margin: 12 }} /> : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={p.accent}
          />
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
        <View
          style={[
            styles.errorPanel,
            { backgroundColor: p.card, borderColor: p.divider },
          ]}
        >
          <Text style={{ color: p.danger, textAlign: 'center' }}>{error}</Text>
          <Pressable
            onPress={() => load(true)}
            accessibilityRole="button"
            accessibilityLabel="Retry loading the feed"
            style={({ pressed }) => [
              styles.errorRetry,
              { borderColor: p.accent, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Text style={{ color: p.accent, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      )}
      <FeedSwitcherSheet
        visible={switcherOpen}
        choices={choices}
        selected={activeFeed}
        onClose={() => setSwitcherOpen(false)}
        onSelect={(value) => {
          setActiveFeed(value);
          setSwitcherOpen(false);
        }}
        onManage={() => {
          setSwitcherOpen(false);
          navigation.navigate('Feeds');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  errorPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    padding: 14,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 10,
    ...cardShadow,
  },
  errorRetry: {
    minHeight: 44,
    minWidth: 120,
    paddingHorizontal: 18,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switcherBar: {
    minHeight: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  switchButton: {
    minHeight: 44,
    minWidth: 110,
    borderRadius: CARD_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginLeft: 10,
  },
  feedNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
