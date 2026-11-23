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
import { describeFailure, readWithRetry } from '../lib/reliability';
import { PostCard } from '../components/PostCard';
import { Avatar } from '../components/Avatar';
import { ReportListSheet } from '../components/ReportListSheet';
import { subscribeActorHidden } from '../lib/moderation';
import {
  listMemberCount,
  listPurposeMeta,
  listViewerState,
} from '../lib/listModel';
import {
  deleteList,
  loadListFeedPage,
  loadListPage,
  removeListMember,
  setListBlocked,
  setListSubscribed,
} from '../lib/lists';
import { useFeeds } from '../lib/feedsContext';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

type Tab = 'posts' | 'people';

function errorCopy(cause: unknown, fallback: string): string {
  return describeFailure(cause, fallback);
}

export function ListDetailScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const p = usePalette();
  const { homeFeeds, pinList } = useFeeds();
  const uri = typeof route.params?.uri === 'string' ? route.params.uri : '';
  const [list, setList] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>('posts');
  const [memberCursor, setMemberCursor] = useState<string | undefined>();
  const [feedCursor, setFeedCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [moreLoading, setMoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [reporting, setReporting] = useState(false);
  const moreInFlight = useRef(false);

  const load = useCallback(
    async (fresh: boolean) => {
      if (!uri) {
        setError('This list has no address.');
        setLoading(false);
        return;
      }
      if (fresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      setFeedError(null);
      try {
        const page = await readWithRetry(() => loadListPage(uri));
        setList(page.list);
        setMembers(page.items || []);
        setMemberCursor(page.cursor);
        setTab((current) =>
          listPurposeMeta(page.list?.purpose).shortLabel === 'Curation'
            ? current
            : 'people'
        );

        if (listPurposeMeta(page.list?.purpose).shortLabel === 'Curation') {
          try {
            const feed = await readWithRetry(() => loadListFeedPage(uri));
            setPosts(
              (feed.feed || [])
                .map((item: any) => item.post)
                .filter(Boolean)
            );
            setFeedCursor(feed.cursor);
            setFeedError(null);
          } catch (cause) {
            setPosts([]);
            setFeedCursor(undefined);
            setFeedError(
              errorCopy(
                cause,
                'Could not load this list’s feed. Pull to refresh and try again.'
              )
            );
          }
        } else {
          setPosts([]);
          setFeedCursor(undefined);
        }
      } catch (cause) {
        setError(
          errorCopy(
            cause,
            'Could not load this list. It may have been deleted or made private.'
          )
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [uri]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    return navigation.addListener('focus', () => {
      void load(true);
    });
  }, [navigation, load]);

  useEffect(() => {
    return subscribeActorHidden((did) => {
      setPosts((prev) => prev.filter((post: any) => post.author?.did !== did));
      setMembers((prev) =>
        prev.filter((item: any) => item.subject?.did !== did)
      );
    });
  }, []);

  const purpose = listPurposeMeta(list?.purpose);
  const viewer = listViewerState(list);
  const isCurate = purpose.shortLabel === 'Curation';
  const pinnedToHome =
    !!list &&
    homeFeeds.some(
      (item) => item.type === 'list' && item.value === list.uri && item.pinned
    );
  const isOwner = !!list?.creator?.did && list.creator.did === agent.did;
  const hiddenForMe = viewer.hidden && !isOwner;

  useLayoutEffect(() => {
    navigation.setOptions({ title: hiddenForMe ? 'Hidden list' : list?.name || 'List' });
  }, [navigation, hiddenForMe, list?.name]);
  const memberCount = listMemberCount(list, members.length);
  const contentHidden = hiddenForMe;

  async function toggleSubscribe() {
    if (!list || busy) return;
    const next = !viewer.subscribed;
    setBusy('subscribe');
    setActionError(null);
    try {
      await setListSubscribed(list.uri, next);
      setList((prev: any) =>
        prev
          ? {
              ...prev,
              viewer: { ...(prev.viewer || {}), muted: next },
            }
          : prev
      );
    } catch (cause) {
      setActionError(
        errorCopy(
          cause,
          `Could not ${next ? 'subscribe to' : 'unsubscribe from'} this list. Try again.`
        )
      );
    } finally {
      setBusy(null);
    }
  }

  async function toggleBlock() {
    if (!list || busy) return;
    const next = !viewer.blocked;
    setConfirmBlock(false);
    setBusy('block');
    setActionError(null);
    try {
      const blockedUri = await setListBlocked(
        list.uri,
        next,
        viewer.blockedUri
      );
      setList((prev: any) =>
        prev
          ? {
              ...prev,
              viewer: {
                ...(prev.viewer || {}),
                blocked: next ? blockedUri : undefined,
              },
            }
          : prev
      );
    } catch (cause) {
      setActionError(
        errorCopy(
          cause,
          `Could not ${next ? 'block' : 'unblock'} this list. Try again.`
        )
      );
    } finally {
      setBusy(null);
    }
  }

  async function togglePin() {
    if (!list || busy) return;
    setBusy('pin');
    setActionError(null);
    try {
      await pinList(list.uri, !pinnedToHome);
    } catch (cause) {
      setActionError(
        errorCopy(
          cause,
          'Could not change this list’s Home shortcut. Try again.'
        )
      );
    } finally {
      setBusy(null);
    }
  }

  async function deleteThisList() {
    if (!list || busy) return;
    setBusy('delete');
    setActionError(null);
    try {
      await deleteList(list.uri);
      navigation.goBack();
    } catch (cause) {
      setActionError(
        errorCopy(
          cause,
          'Could not delete this list. Check your connection and try again.'
        )
      );
      setBusy(null);
    }
  }

  async function removeMember(item: any) {
    if (!list || busy) return;
    setBusy(item.uri);
    setActionError(null);
    try {
      await removeListMember(item.uri);
      setMembers((prev) => prev.filter((entry) => entry.uri !== item.uri));
      setList((prev: any) =>
        prev
          ? {
              ...prev,
              listItemCount: Math.max(0, (prev.listItemCount || 1) - 1),
            }
          : prev
      );
    } catch (cause) {
      setActionError(
        errorCopy(
          cause,
          'Could not remove this person from the list. Try again.'
        )
      );
    } finally {
      setBusy(null);
    }
  }

  async function loadMore() {
    if (!list || !uri || moreInFlight.current || moreLoading) return;
    const nextCursor = tab === 'posts' ? feedCursor : memberCursor;
    if (!nextCursor) return;
    moreInFlight.current = true;
    setMoreLoading(true);
    try {
      if (tab === 'posts') {
        const feed = await readWithRetry(() => loadListFeedPage(uri, nextCursor));
        setPosts((prev) => {
          const seen = new Set(prev.map((post: any) => post.uri));
          return prev.concat(
            (feed.feed || [])
              .map((item: any) => item.post)
              .filter((post: any) => post && !seen.has(post.uri))
          );
        });
        setFeedCursor(feed.cursor);
      } else {
        const page = await readWithRetry(() => loadListPage(uri, nextCursor));
        setMembers((prev) => {
          const seen = new Set(prev.map((item: any) => item.uri));
          return prev.concat(
            (page.items || []).filter((item: any) => !seen.has(item.uri))
          );
        });
        setMemberCursor(page.cursor);
      }
    } catch (cause) {
      setActionError(
        errorCopy(
          cause,
          tab === 'posts'
            ? 'Could not load more posts from this list.'
            : 'Could not load more list members.'
        )
      );
    } finally {
      moreInFlight.current = false;
      setMoreLoading(false);
    }
  }

  function openProfile(did: string) {
    navigation.navigate('UserProfile', { actor: did });
  }

  function hidePost(post: any, scope: 'post' | 'author') {
    setPosts((prev) =>
      prev.filter((item: any) =>
        scope === 'author'
          ? item.author?.did !== post.author?.did
          : item.uri !== post.uri
      )
    );
  }

  if (loading && !list) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={p.accent} />
      </View>
    );
  }

  if (!list) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Ionicons name="list-outline" size={35} color={p.secondary} />
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>
          List unavailable
        </Text>
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 5 }}>
          {error || 'This list could not be loaded.'}
        </Text>
        <Pressable
          onPress={() => void load(false)}
          accessibilityRole="button"
          accessibilityLabel="Retry loading this list"
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

  const Header = (
    <View>
      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <View style={styles.topRow}>
          <Pressable
            onPress={() => list.creator?.did && openProfile(list.creator.did)}
            disabled={!list.creator?.did}
            accessibilityRole="button"
            accessibilityLabel={`Open ${list.creator?.handle || 'creator'}’s profile`}
            style={({ pressed }) => [
              styles.creator,
              { opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Avatar
              avatar={list.creator?.avatar}
              displayName={list.creator?.displayName || list.creator?.handle}
              size={42}
            />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: p.text, fontSize: 13, fontWeight: '700' }} numberOfLines={1}>
                {list.creator?.displayName || list.creator?.handle || 'Unknown creator'}
              </Text>
              <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={1}>
                @{list.creator?.handle || 'unknown'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={p.secondary} />
          </Pressable>
          <View
            style={[
              styles.purposeBadge,
              {
                backgroundColor:
                  hiddenForMe || purpose.shortLabel === 'Moderation'
                    ? p.soft
                    : p.accentSoft,
              },
            ]}
          >
            <Text
              style={{
                color:
                  hiddenForMe || purpose.shortLabel === 'Moderation'
                    ? p.secondary
                    : p.accent,
                fontSize: 10,
                fontWeight: '700',
              }}
            >
              {hiddenForMe ? 'Hidden' : purpose.shortLabel}
            </Text>
          </View>
        </View>

        <Text style={{ color: p.text, fontSize: 25, fontWeight: '800', marginTop: 14 }}>
          {hiddenForMe ? 'Hidden list' : list.name}
        </Text>
        {hiddenForMe ? null : (
          <Text style={{ color: p.secondary, fontSize: 13, marginTop: 3 }}>
            {memberCount} {memberCount === 1 ? 'person' : 'people'}
            {purpose.shortLabel === 'Curation'
              ? ' · list feed'
              : ' · mute or block list'}
          </Text>
        )}

        {!hiddenForMe && list.description ? (
          <Text style={{ color: p.text, fontSize: 14, lineHeight: 21, marginTop: 10 }}>
            {list.description}
          </Text>
        ) : null}

        {viewer.hidden ? (
          <View style={[styles.banner, { backgroundColor: p.bg, borderColor: p.divider }]}>
            <Ionicons name="eye-off-outline" size={18} color={p.secondary} />
            <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, flex: 1 }}>
              {hiddenForMe
                ? 'You hid this list in your Bluesky list settings. Balla does not render its feed or member list.'
                : 'You hid this list in your Bluesky list settings. As its owner, you can still see its contents.'}
            </Text>
          </View>
        ) : null}

        {viewer.blocked ? (
          <View style={[styles.banner, { backgroundColor: p.bg, borderColor: p.divider }]}>
            <Ionicons name="ban-outline" size={18} color={p.danger} />
            <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, flex: 1 }}>
              You blocked this list. Its accounts are blocked from interacting with
              you. Unblock it below to undo that.
            </Text>
          </View>
        ) : null}

        {feedError ? (
          <View style={[styles.banner, { backgroundColor: p.bg, borderColor: p.danger }]}>
            <Ionicons name="alert-circle-outline" size={18} color={p.danger} />
            <Text style={{ color: p.danger, fontSize: 12, lineHeight: 18, flex: 1 }}>
              {feedError}
            </Text>
          </View>
        ) : null}

        {actionError ? (
          <View style={[styles.banner, { backgroundColor: p.bg, borderColor: p.danger }]}>
            <Ionicons name="alert-circle-outline" size={18} color={p.danger} />
            <Text style={{ color: p.danger, fontSize: 12, lineHeight: 18, flex: 1 }}>
              {actionError}
            </Text>
          </View>
        ) : null}

        {hiddenForMe ? null : (
        <View style={styles.actions}>
          {isCurate ? (
            <Action
              icon={pinnedToHome ? 'pin' : 'pin-outline'}
              label={pinnedToHome ? 'Pinned to Home' : 'Pin to Home'}
              active={pinnedToHome}
              busy={busy === 'pin'}
              disabled={!!busy}
              onPress={() => void togglePin()}
            />
          ) : null}
          {isOwner ? (
            <>
              <Action
                icon="create-outline"
                label="Edit"
                onPress={() => navigation.navigate('ListEdit', { uri: list.uri })}
              />
              <Action
                icon="people-outline"
                label="Manage people"
                onPress={() =>
                  navigation.navigate('ListMembers', {
                    uri: list.uri,
                    name: list.name,
                    purpose: list.purpose,
                  })
                }
              />
              <Action
                icon="trash-outline"
                label="Delete"
                danger
                disabled={!!busy}
                onPress={() => setConfirmDelete(true)}
              />
            </>
          ) : (
            <>
              <Action
                icon={viewer.subscribed ? 'checkmark-circle' : 'notifications-outline'}
                label={viewer.subscribed ? 'Subscribed' : 'Subscribe'}
                active={viewer.subscribed}
                busy={busy === 'subscribe'}
                disabled={!!busy}
                onPress={() => void toggleSubscribe()}
              />
              <Action
                icon={viewer.blocked ? 'person-add-outline' : 'ban-outline'}
                label={viewer.blocked ? 'Unblock list' : 'Block list'}
                danger={!viewer.blocked}
                busy={busy === 'block'}
                disabled={!!busy}
                onPress={() => {
                  if (viewer.blocked) void toggleBlock();
                  else setConfirmBlock(true);
                }}
              />
              <Action
                icon="flag-outline"
                label="Report"
                disabled={!!busy}
                onPress={() => setReporting(true)}
              />
            </>
          )}
        </View>
        )}
        {isCurate && !hiddenForMe ? (
          <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 16, marginTop: 8 }}>
            Pinning puts this list feed near the top of Switch feed on Home.
            Following stays chronological and unchanged.
          </Text>
        ) : null}

        {confirmBlock ? (
          <View style={[styles.deleteBox, { backgroundColor: p.bg, borderColor: p.danger }]}>
            <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>
              Block this list?
            </Text>
            <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 3 }}>
              This is public and blocks the accounts on this list. Balla will write
              a list-block record to your PDS. You can undo it from this screen.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pressable
                onPress={() => setConfirmBlock(false)}
                disabled={busy === 'block'}
                accessibilityRole="button"
                accessibilityLabel="Cancel blocking list"
                accessibilityState={{ disabled: busy === 'block' }}
                style={({ pressed }) => [
                  styles.confirmButton,
                  { backgroundColor: p.card, borderColor: p.divider, opacity: pressed ? 0.65 : 1 },
                ]}
              >
                <Text style={{ color: p.text, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void toggleBlock()}
                disabled={busy === 'block'}
                accessibilityRole="button"
                accessibilityLabel="Block every account on this list"
                accessibilityState={{ disabled: busy === 'block', busy: busy === 'block' }}
                style={({ pressed }) => [
                  styles.confirmButton,
                  { backgroundColor: p.danger, borderColor: p.danger, opacity: pressed ? 0.65 : 1 },
                ]}
              >
                {busy === 'block' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Block list</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}

        {!isOwner && !hiddenForMe ? (
          <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 16, marginTop: 8 }}>
            Subscribing applies this list’s mute moderation. Blocking a list is
            public and blocks every account currently on it.
          </Text>
        ) : null}

        {confirmDelete ? (
          <View style={[styles.deleteBox, { backgroundColor: p.bg, borderColor: p.danger }]}>
            <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>
              Delete “{list.name}”?
            </Text>
            <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 3 }}>
              Balla will delete the list and its membership records from your PDS.
              This cannot be undone.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pressable
                onPress={() => setConfirmDelete(false)}
                disabled={busy === 'delete'}
                accessibilityRole="button"
                accessibilityLabel="Cancel deleting list"
                accessibilityState={{ disabled: busy === 'delete' }}
                style={({ pressed }) => [
                  styles.confirmButton,
                  { backgroundColor: p.card, borderColor: p.divider, opacity: pressed ? 0.65 : 1 },
                ]}
              >
                <Text style={{ color: p.text, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void deleteThisList()}
                disabled={busy === 'delete'}
                accessibilityRole="button"
                accessibilityLabel="Delete list"
                accessibilityState={{ disabled: busy === 'delete', busy: busy === 'delete' }}
                style={({ pressed }) => [
                  styles.confirmButton,
                  { backgroundColor: p.danger, borderColor: p.danger, opacity: pressed ? 0.65 : 1 },
                ]}
              >
                {busy === 'delete' ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Delete</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {hiddenForMe ? null : (
      <View
        style={[
          styles.tabs,
          { backgroundColor: p.card, borderColor: p.divider },
        ]}
      >
        {isCurate ? (
          <TabButton
            label="Posts"
            count={contentHidden ? undefined : posts.length}
            selected={tab === 'posts'}
            onPress={() => setTab('posts')}
          />
        ) : null}
        <TabButton
          label="People"
          count={contentHidden ? undefined : memberCount}
          selected={tab === 'people'}
          onPress={() => setTab('people')}
        />
        {isOwner && tab === 'people' ? (
          <Pressable
            onPress={() =>
              navigation.navigate('ListMembers', {
                uri: list.uri,
                name: list.name,
                purpose: list.purpose,
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Add or remove people on this list"
            style={({ pressed }) => [
              styles.addPeople,
              { backgroundColor: p.accentSoft, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Ionicons name="person-add-outline" size={15} color={p.accent} />
            <Text style={{ color: p.accent, fontSize: 12, fontWeight: '700' }}>Add</Text>
          </Pressable>
        ) : null}
      </View>
      )}
    </View>
  );

  const data = contentHidden
    ? []
    : tab === 'posts'
      ? posts
      : members;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
    <FlatList
      key={tab}
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 28 }}
      data={data}
      keyExtractor={(item: any) => item.uri}
      renderItem={({ item }) =>
        tab === 'posts' ? (
          <PostCard
            post={item}
            onOpenThread={(postUri) => navigation.navigate('Thread', { uri: postUri })}
            onOpenProfile={openProfile}
            onPostHidden={hidePost}
          />
        ) : (
          <MemberRow
            item={item}
            canRemove={isOwner}
            busy={busy === item.uri}
            onOpenProfile={openProfile}
            onRemove={() => void removeMember(item)}
          />
        )
      }
      ListHeaderComponent={Header}
      ListEmptyComponent={
        <View style={{ paddingHorizontal: 24, paddingVertical: 30 }}>
          <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
            {contentHidden
              ? 'This list’s contents are hidden by a moderation label.'
              : tab === 'posts'
                ? 'No posts from this list are available yet.'
                : memberCount === 0
                  ? 'No one is on this list yet.'
                  : 'No more members are available to show.'}
          </Text>
        </View>
      }
      ListFooterComponent={
        moreLoading ? (
          <ActivityIndicator color={p.accent} style={{ marginVertical: 18 }} />
        ) : (tab === 'posts' ? feedCursor : memberCursor) && !contentHidden ? (
          <Pressable
            onPress={() => void loadMore()}
            accessibilityRole="button"
            accessibilityLabel={`Load more ${tab === 'posts' ? 'list posts' : 'list members'}`}
            style={({ pressed }) => [
              styles.more,
              { backgroundColor: p.card, borderColor: p.divider, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Text style={{ color: p.accent, fontSize: 13, fontWeight: '700' }}>
              Load more
            </Text>
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
        if (!moreLoading && (tab === 'posts' ? feedCursor : memberCursor)) {
          void loadMore();
        }
      }}
      onEndReachedThreshold={0.6}
    />
    {reporting && list ? (
      <ReportListSheet list={list} onClose={() => setReporting(false)} />
    ) : null}
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
  danger,
  active,
  busy,
  disabled,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  danger?: boolean;
  active?: boolean;
  busy?: boolean;
  disabled?: boolean;
}) {
  const p = usePalette();
  const colour = danger ? p.danger : active ? p.accent : p.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!busy }}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: active ? p.accentSoft : p.bg,
          borderColor: danger ? p.danger : active ? p.accent : p.divider,
          opacity: disabled ? 0.5 : pressed ? 0.65 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colour} />
      ) : (
        <Ionicons name={icon} size={17} color={colour} />
      )}
      <Text style={{ color: colour, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function TabButton({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count?: number;
  selected: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.tab,
        {
          borderBottomColor: selected ? p.accent : 'transparent',
          opacity: pressed ? 0.65 : 1,
        },
      ]}
    >
      <Text style={{ color: selected ? p.accent : p.secondary, fontSize: 14, fontWeight: '700' }}>
        {label}
        {typeof count === 'number' ? ` · ${count}` : ''}
      </Text>
    </Pressable>
  );
}

function MemberRow({
  item,
  canRemove,
  busy,
  onOpenProfile,
  onRemove,
}: {
  item: any;
  canRemove: boolean;
  busy: boolean;
  onOpenProfile: (did: string) => void;
  onRemove: () => void;
}) {
  const p = usePalette();
  const person = item.subject || {};
  const name = person.displayName || person.handle || 'Account';
  return (
    <View
      style={[
        styles.member,
        { backgroundColor: p.card, borderColor: p.divider },
        cardShadow,
      ]}
    >
      <Pressable
        onPress={() => person.did && onOpenProfile(person.did)}
        accessible={!!person.did}
        accessibilityRole="button"
        accessibilityLabel={`Open ${person.handle || 'member'}'s profile`}
        style={({ pressed }) => [
          styles.memberIdentity,
          { opacity: pressed ? 0.65 : 1 },
        ]}
      >
        <Avatar avatar={person.avatar} displayName={name} size={46} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
            {name}
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={1}>
            @{person.handle || 'unknown'}
          </Text>
          {item.subjectOptedOut ? (
            <Text style={{ color: p.secondary, fontSize: 11, marginTop: 1 }}>
              Opted out of appearing in reference lists
            </Text>
          ) : null}
        </View>
      </Pressable>
      {canRemove ? (
        <Pressable
          onPress={onRemove}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${person.handle || 'this account'} from the list`}
          style={({ pressed }) => [
            styles.removeButton,
            { backgroundColor: p.bg, borderColor: p.divider, opacity: pressed || busy ? 0.6 : 1 },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={p.danger} />
          ) : (
            <Text style={{ color: p.danger, fontSize: 12, fontWeight: '700' }}>Remove</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
    marginBottom: 8,
    padding: 15,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  creator: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  purposeBadge: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  banner: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  action: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  deleteBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 11,
    marginTop: 12,
  },
  confirmButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    marginHorizontal: 8,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tab: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 3,
  },
  addPeople: {
    minHeight: 44,
    marginLeft: 'auto',
    borderRadius: 22,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  member: {
    minHeight: 68,
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  memberIdentity: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  removeButton: {
    minHeight: 38,
    minWidth: 70,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  more: {
    minHeight: 46,
    marginHorizontal: 8,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
