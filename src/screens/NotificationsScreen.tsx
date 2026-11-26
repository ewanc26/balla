import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { moderateNotification } from '@atproto/api';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import { networkBackend } from '../lib/networkBackend';
import { describeFailure, readWithRetry } from '../lib/reliability';
import { subscribeActorHidden } from '../lib/moderation';
import { useModeration } from '../lib/moderationContext';
import {
  notificationTarget,
  notificationTargetAction,
} from '../lib/notificationModel';
import { timeAgo } from '../lib/time';
import { Avatar } from '../components/Avatar';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

type Filter = 'all' | 'following' | 'replies' | 'follows' | 'alerts';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'following', label: 'People I follow' },
  { value: 'replies', label: 'Replies' },
  { value: 'follows', label: 'Follows' },
  { value: 'alerts', label: 'Post alerts' },
];

function baseReason(reason: string): string {
  if (reason.startsWith('like')) return 'like';
  if (reason.startsWith('repost')) return 'repost';
  if (reason === 'follow' || reason === 'follow_via_proxy') return 'follow';
  return reason;
}

function reasonText(reason: string): string {
  if (reason === 'like' || reason === 'like_via_proxy') return 'liked your post';
  if (reason === 'repost' || reason === 'repost_via_proxy') return 'reposted your post';
  if (reason === 'reply') return 'replied to your post';
  if (reason === 'mention') return 'mentioned you';
  if (reason === 'quote') return 'quoted your post';
  if (reason === 'follow' || reason === 'follow_via_proxy') return 'followed you';
  return reason;
}

// Facebook overlays a small reason icon on the actor's avatar. Balla has the
// same reason vocabulary as Bluesky, so map it directly rather than inventing
// notification categories.
function reasonBadge(reason: string): { icon: any; green?: boolean } {
  if (reason.startsWith('like')) return { icon: 'thumbs-up' };
  if (reason.startsWith('repost')) return { icon: 'repeat', green: true };
  if (reason === 'reply') return { icon: 'chatbubble' };
  if (reason === 'mention') return { icon: 'at' };
  if (reason === 'quote') return { icon: 'chatbox-ellipses' };
  if (reason.startsWith('follow')) return { icon: 'person-add', green: true };
  return { icon: 'notifications' };
}

function matchesFilter(item: any, filter: Filter, following: Set<string>): boolean {
  const reason = String(item.reason || '');
  if (filter === 'following') {
    return (
      following.has(item.author?.did) || !!item.author?.viewer?.following
    );
  }
  if (filter === 'replies') {
    return reason === 'reply' || reason === 'mention' || reason === 'quote';
  }
  if (filter === 'follows') {
    return reason === 'follow' || reason === 'follow_via_proxy';
  }
  if (filter === 'alerts') {
    return reason === 'mention' || reason === 'quote';
  }
  return true;
}

function groupNotifications(items: any[]) {
  const groups: any[] = [];
  const index = new Map<string, number>();

  for (const item of items) {
    const reason = baseReason(String(item.reason || ''));
    const groupable = reason === 'like' || reason === 'repost' || reason === 'follow';
    const key = groupable
      ? `${reason}:${reason === 'follow' ? 'all' : item.reasonSubject || item.uri}`
      : `item:${item.uri}`;
    let group = groups[index.get(key) ?? -1];

    if (!group) {
      group = {
        key,
        reason,
        items: [],
        actors: [],
        indexedAt: item.indexedAt,
        isRead: true,
      };
      index.set(key, groups.length);
      groups.push(group);
    }

    group.items.push(item);
    if (
      item.author &&
      !group.actors.some((actor: any) => actor.did === item.author.did)
    ) {
      group.actors.push(item.author);
    }
    if (item.isRead === false) group.isRead = false;
  }

  return groups;
}

function actorNames(actors: any[]): string {
  const names = actors
    .map((actor) => actor?.displayName || actor?.handle)
    .filter(Boolean);
  if (names.length === 0) return 'Someone';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} others`;
}

export function NotificationsScreen() {
  const p = usePalette();
  const navigation = useNavigation<any>();
  const { opts } = useModeration();
  const [items, setItems] = useState<any[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const did = agent.did;
    if (!did) {
      setRefreshing(false);
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      const [res, follows] = await Promise.all([
        readWithRetry(() => networkBackend.notifications.listNotifications({ limit: 50 })),
        readWithRetry(() =>
          networkBackend.notifications.getFollows({ actor: did, limit: 100 })
        ).catch(() => null),
      ]);
      setItems(res.data.notifications || []);
      if (follows?.data?.follows) {
        setFollowing(
          new Set(follows.data.follows.map((item: any) => item.did))
        );
      }
    } catch (err) {
      // Keep old items, but say that the refresh failed rather than quietly
      // showing a stale list as if it were current.
      setError(describeFailure(err, 'Could not refresh notifications.'));
    }
    setRefreshing(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return subscribeActorHidden((did) => {
      setItems((prev) => prev.filter((item: any) => item.author?.did !== did));
    });
  }, []);

  async function markAllRead() {
    if (marking) return;
    setMarking(true);
    setError(null);
    try {
      await agent.updateSeenNotifications();
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (err) {
      // Do not pretend they were read if the API refused.
      setError(describeFailure(err, 'Could not mark notifications as read. They are still unread.'));
    }
    setMarking(false);
  }

  const visibleItems = items
    .filter((item) => matchesFilter(item, filter, following))
    .filter((item) => {
      try {
        return !moderateNotification(item, opts).ui('contentList').filter;
      } catch {
        return true;
      }
    });
  const groups = groupNotifications(visibleItems);
  const unread = items.filter((item) => item.isRead === false).length;

  function Header() {
    return (
      <View>
        <View
          style={{
            backgroundColor: p.card,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: p.divider,
            paddingHorizontal: 16,
            paddingTop: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: p.text, fontSize: 20, fontWeight: '700' }}>
                Notifications
              </Text>
              <Text style={{ color: p.secondary, fontSize: 13, marginTop: 2 }}>
                {unread > 0
                  ? `${unread} unread notification${unread === 1 ? '' : 's'}`
                  : 'You are up to date.'}
              </Text>
            </View>
            {unread > 0 ? (
              <Pressable
                onPress={() => void markAllRead()}
                disabled={marking}
                accessibilityRole="button"
                accessibilityLabel="Mark all notifications as read"
                style={({ pressed }) => [
                  styles.markButton,
                  { opacity: pressed || marking ? 0.6 : 1 },
                ]}
              >
                {marking ? (
                  <ActivityIndicator size="small" color={p.accent} />
                ) : (
                  <Text style={{ color: p.accent, fontSize: 13, fontWeight: '600' }}>
                    Mark all read
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>

          {error ? (
            <View style={{ paddingTop: 8, gap: 4 }}>
              <Text style={{ color: p.danger, fontSize: 13 }}>{error}</Text>
              <Pressable
                onPress={() => void load()}
                accessibilityRole="button"
                accessibilityLabel="Retry loading notifications"
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

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 6 }}
          >
            {FILTERS.map((item) => {
              const selected = filter === item.value;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => setFilter(item.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.tab,
                    {
                      borderBottomColor: selected ? p.accent : 'transparent',
                      opacity: pressed ? 0.65 : 1,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selected ? p.accent : p.secondary,
                      fontSize: 14,
                      fontWeight: '600',
                    }}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      data={groups}
      keyExtractor={(item: any) => item.key}
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingBottom: 24 }}
      ListHeaderComponent={Header}
      ListEmptyComponent={
        refreshing ? undefined : (
          <Text
            style={{
              color: p.secondary,
              textAlign: 'center',
              marginTop: 48,
              paddingHorizontal: 24,
            }}
          >
            {filter === 'all'
              ? 'Nothing yet.'
              : 'No notifications in this filter.'}
          </Text>
        )
      }
      renderItem={({ item: group }) => {
        const first = group.items[0];
        const author = group.actors[0] || first.author || {};
        const target = notificationTarget(first, author);
        const badge = reasonBadge(String(group.reason || ''));
        return (
          <Pressable
            disabled={!target}
            onPress={() => {
              if (!target) return;
              if (target.kind === 'profile') {
                navigation.navigate('UserProfile', { actor: target.did });
              } else {
                navigation.navigate('Thread', { uri: target.uri });
              }
            }}
            accessibilityRole={target ? 'button' : undefined}
            accessibilityLabel={
              target
                ? `${actorNames(group.actors)} ${reasonText(group.reason)}.${notificationTargetAction(target)}`
                : undefined
            }
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: p.card,
                borderColor: p.divider,
                opacity: pressed ? 0.65 : 1,
              },
              cardShadow,
            ]}
          >
            <View>
              <Avatar
                avatar={author.avatar}
                displayName={author.displayName || author.handle}
                size={48}
              />
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: badge.green ? p.green : p.accent,
                    borderColor: p.card,
                  },
                ]}
              >
                <Ionicons name={badge.icon} size={11} color={badge.green ? '#FFFFFF' : p.onAccent} />
              </View>
            </View>
            <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
              <Text style={{ color: p.text, fontSize: 15, lineHeight: 20 }}>
                <Text style={{ fontWeight: '700' }}>
                  {actorNames(group.actors)}
                </Text>{' '}
                <Text style={{ color: p.secondary }}>
                  {reasonText(group.reason)}
                </Text>
              </Text>
              <Text style={{ color: p.secondary, fontSize: 12, marginTop: 3 }}>
                {timeAgo(group.indexedAt)}
                {group.items.length > 1
                  ? ` · ${group.items.length} notifications`
                  : ''}
              </Text>
            </View>
            {group.isRead === false ? (
              <View
                accessibilityLabel="Unread"
                style={[styles.unreadDot, { backgroundColor: p.accent }]}
              />
            ) : null}
          </Pressable>
        );
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={load} tintColor={p.accent} />
      }
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginHorizontal: 8,
    marginBottom: 8,
    minHeight: 72,
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markButton: {
    minHeight: 44,
    minWidth: 88,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  tab: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
});
