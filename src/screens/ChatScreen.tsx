import React, { useCallback, useEffect, useState } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { agent, getChatAgent } from '../lib/agent';
import { describeFailure, readWithRetry } from '../lib/reliability';
import { timeAgo } from '../lib/time';
import { openExternalUrl } from '../lib/openLink';
import {
  CHAT_SERVICE_DOCS_URL,
  chatServiceCopy,
  chatServiceStateFromError,
  isServiceWideFailure,
  type ChatServiceState,
} from '../lib/chatServiceModel';
import { Avatar } from '../components/Avatar';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';
import {
  CHAT_PAGE_SIZE,
  chatErrorCopy,
  convoSubtitle,
  convoTitle,
  isGroup,
  isJoinRequest,
  messagePreview,
  otherMember,
  unreadLabel,
} from '../lib/chatModel';

type Tab = 'messages' | 'requests';
type Counts = { unreadAcceptedConvos: number; unreadRequestConvos: number };

/**
 * The message inbox. Conversations and requests come from the chat service;
 * the AppView is not involved. Nothing here logs conversation content.
 */
export function ChatScreen() {
  const p = usePalette();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<Tab>('messages');
  const [convos, setConvos] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [convoCursor, setConvoCursor] = useState<string | undefined>();
  const [requestCursor, setRequestCursor] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A host without a chat service must show one honest state, not a broken
  // inbox with dead compose actions and a generic error line.
  const [serviceState, setServiceState] = useState<ChatServiceState | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    const chat = getChatAgent();
    try {
      const [list, requestList, unread] = await Promise.all([
        readWithRetry(() => chat.chat.bsky.convo.listConvos({ limit: CHAT_PAGE_SIZE })),
        readWithRetry(() =>
          chat.chat.bsky.convo.listConvoRequests({ limit: CHAT_PAGE_SIZE })
        ).catch(() => null),
        readWithRetry(() =>
          chat.chat.bsky.convo.getUnreadCounts({ includeGroupChats: true })
        ).catch(() => null),
      ]);
      setConvos(list.data.convos || []);
      setConvoCursor(list.data.cursor);
      setRequests(requestList?.data?.requests || []);
      setRequestCursor(requestList?.data?.cursor);
      if (unread?.data) setCounts(unread.data as Counts);
      // A successful read proves this host serves chat; clear any old notice.
      setServiceState(null);
    } catch (err) {
      const state = chatServiceStateFromError(err);
      if (isServiceWideFailure(state)) setServiceState(state);
      setError(chatErrorCopy(err));
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Returning from a conversation may have marked it read; refresh the counts.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function markAllRead() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const chat = getChatAgent();
      await Promise.all([
        chat.chat.bsky.convo.updateAllRead({ status: 'accepted' }).catch(() => null),
        chat.chat.bsky.convo.updateAllRead({ status: 'request' }).catch(() => null),
      ]);
      await load();
    } catch (err) {
      setError(describeFailure(err, 'Could not mark everything as read. Try again.'));
    }
    setBusy(false);
  }

  async function loadMore() {
    if (loadingMore) return;
    const cursor = tab === 'messages' ? convoCursor : requestCursor;
    if (!cursor) return;
    setLoadingMore(true);
    setError(null);
    const chat = getChatAgent();
    try {
      if (tab === 'messages') {
        const res = await readWithRetry(() =>
          chat.chat.bsky.convo.listConvos({ limit: CHAT_PAGE_SIZE, cursor })
        );
        setConvos((prev) => [...prev, ...(res.data.convos || [])]);
        setConvoCursor(res.data.cursor);
      } else {
        const res = await readWithRetry(() =>
          chat.chat.bsky.convo.listConvoRequests({ limit: CHAT_PAGE_SIZE, cursor })
        );
        setRequests((prev) => [...prev, ...(res.data.requests || [])]);
        setRequestCursor(res.data.cursor);
      }
    } catch (err) {
      setError(describeFailure(err, 'Could not load older conversations.'));
    }
    setLoadingMore(false);
  }

  const data = tab === 'messages' ? convos : requests;
  const requestCount = counts?.unreadRequestConvos ?? 0;
  const acceptedCount = counts?.unreadAcceptedConvos ?? 0;

  function open(item: any) {
    const convoId = item?.id || item?.convoId;
    if (!convoId) return;
    navigation.navigate('Conversation', { convoId });
  }

  // A host that cannot serve chat gets one readable explanation and two real
  // actions. No error screen, no dead compose controls, no silent failure.
  // Every other Balla screen is independent and keeps working.
  if (serviceState && isServiceWideFailure(serviceState)) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <View
          style={{
            backgroundColor: p.card,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: p.divider,
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 14,
          }}
        >
          <Text style={{ color: p.text, fontSize: 20, fontWeight: '700' }}>Messages</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
          <Ionicons name="chatbubble-ellipses-outline" size={38} color={p.secondary} />
          <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>
            Messages aren’t available here
          </Text>
          <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 21 }}>
            {chatServiceCopy(serviceState)}
          </Text>
          <Pressable
            onPress={() => {
              setServiceState(null);
              void load();
            }}
            accessibilityRole="button"
            accessibilityLabel="Check chat again"
            style={({ pressed }) => [
              styles.action,
              { alignSelf: 'flex-start', borderColor: p.divider, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Ionicons name="refresh-outline" size={17} color={p.accent} />
            <Text style={{ color: p.accent, fontWeight: '600', marginLeft: 6 }}>Check again</Text>
          </Pressable>
          <Pressable
            onPress={() => void openExternalUrl(CHAT_SERVICE_DOCS_URL)}
            accessibilityRole="button"
            accessibilityLabel="Read how chat services work"
            style={({ pressed }) => [
              styles.action,
              { alignSelf: 'flex-start', borderColor: p.divider, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Ionicons name="open-outline" size={17} color={p.accent} />
            <Text style={{ color: p.accent, fontWeight: '600', marginLeft: 6 }}>
              How chat services work
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item: any, index) =>
        String(item?.id || item?.convoId || index)
      }
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void load()} tintColor={p.accent} />
      }
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
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
              <Text style={{ color: p.text, fontSize: 20, fontWeight: '700' }}>Messages</Text>
              <Text style={{ color: p.secondary, fontSize: 13, marginTop: 2 }}>
                {counts
                  ? acceptedCount > 0 || requestCount > 0
                    ? `${unreadLabel(acceptedCount + requestCount)} unread conversations`
                    : 'You are up to date.'
                  : 'Private messages on Bluesky.'}
              </Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('ChatSettings')}
              accessibilityRole="button"
              accessibilityLabel="Chat settings"
              style={({ pressed }) => [
                styles.iconButton,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="settings-outline" size={22} color={p.chromeMuted} />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginTop: 10 }}
          >
            <Pressable
              onPress={() => navigation.navigate('CreateGroup')}
              accessibilityRole="button"
              accessibilityLabel="Create a group conversation"
              style={({ pressed }) => [
                styles.action,
                { borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="people-outline" size={17} color={p.accent} />
              <Text style={{ color: p.accent, fontWeight: '600', marginLeft: 6 }}>New group</Text>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('JoinGroup')}
              accessibilityRole="button"
              accessibilityLabel="Join a group with an invite code"
              style={({ pressed }) => [
                styles.action,
                { borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="add-circle-outline" size={17} color={p.accent} />
              <Text style={{ color: p.accent, fontWeight: '600', marginLeft: 6 }}>Join with code</Text>
            </Pressable>
            <Pressable
              onPress={() => void markAllRead()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Mark all conversations and requests as read"
              style={({ pressed }) => [
                styles.action,
                { borderColor: p.divider, opacity: pressed || busy ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="checkmark-done-outline" size={17} color={p.accent} />
              <Text style={{ color: p.accent, fontWeight: '600', marginLeft: 6 }}>Mark all read</Text>
            </Pressable>
          </ScrollView>

          <View style={{ flexDirection: 'row', marginTop: 8 }}>
            <Pressable
              onPress={() => setTab('messages')}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === 'messages' }}
              style={({ pressed }) => [
                styles.tab,
                {
                  borderBottomColor: tab === 'messages' ? p.accent : 'transparent',
                  opacity: pressed ? 0.65 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: tab === 'messages' ? p.accent : p.secondary,
                  fontWeight: '600',
                  fontSize: 14,
                }}
              >
                Inbox
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTab('requests')}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === 'requests' }}
              style={({ pressed }) => [
                styles.tab,
                {
                  borderBottomColor: tab === 'requests' ? p.accent : 'transparent',
                  opacity: pressed ? 0.65 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: tab === 'requests' ? p.accent : p.secondary,
                  fontWeight: '600',
                  fontSize: 14,
                }}
              >
                Requests{requestCount > 0 ? ` (${unreadLabel(requestCount)})` : ''}
              </Text>
            </Pressable>
          </View>

          {error ? (
            <View style={{ paddingTop: 8, gap: 4 }}>
              <Text style={{ color: p.danger, fontSize: 13 }}>{error}</Text>
              <Pressable
                onPress={() => void load()}
                accessibilityRole="button"
                accessibilityLabel="Retry loading messages"
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
      }
      ListFooterComponent={
        loadingMore ? (
          <View style={{ paddingVertical: 16, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={p.accent} />
          </View>
        ) : undefined
      }
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
            {tab === 'requests'
              ? 'No chat requests. Messages from people you do not follow arrive here.'
              : 'No conversations yet. Messages you start or receive appear here.'}
          </Text>
        )
      }
      renderItem={({ item }) => {
        const joinRequest = isJoinRequest(item);
        // A direct row shows the other person. A group has no single other
        // person: ConvoView.members is an unordered subset of "important"
        // members that can start with the viewer, so members[0] would put a
        // random participant's (or the viewer's own) face on the group.
        // Group rows fall back to the group name's initial instead. A join
        // request names the group's owner, who the row is about.
        const member = joinRequest
          ? item?.owner || null
          : isGroup(item)
            ? null
            : otherMember(item, agent.did);
        const title = joinRequest
          ? String(item?.name || '').trim() || 'Group'
          : convoTitle(item, agent.did);
        const subtitle = joinRequest
          ? 'Wants to join this group'
          : convoSubtitle(item, agent.did);
        const preview = joinRequest
          ? `${member?.displayName || member?.handle || 'Someone'} · ${item?.memberCount ?? 0} members`
          : messagePreview(item?.lastMessage);
        const unread = unreadLabel(joinRequest ? 0 : item?.unreadCount || 0);
        return (
          <Pressable
            onPress={() => open(item)}
            accessibilityRole="button"
            accessibilityLabel={`Open conversation with ${title}`}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: p.card,
                borderColor: p.divider,
                opacity: pressed ? 0.7 : 1,
              },
              cardShadow,
            ]}
          >
            <Avatar
              avatar={member?.avatar}
              displayName={title}
              size={48}
            />
            <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
              <Text style={{ color: p.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
              <Text style={{ color: p.secondary, fontSize: 13, marginTop: 3 }} numberOfLines={1}>
                {preview}
              </Text>
              {item?.lastMessage?.sentAt || item?.requestedAt ? (
                <Text style={{ color: p.secondary, fontSize: 11, marginTop: 2 }}>
                  {timeAgo(item?.lastMessage?.sentAt || item?.requestedAt)}
                </Text>
              ) : null}
            </View>
            {item?.muted ? (
              <Ionicons name="notifications-off-outline" size={16} color={p.secondary} />
            ) : null}
            {unread ? (
              <View style={[styles.unread, { backgroundColor: p.accent }]}>
                <Text style={{ color: p.onAccent, fontSize: 11, fontWeight: '700' }}>{unread}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      }}
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
  tab: {
    minHeight: 44,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  unread: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
