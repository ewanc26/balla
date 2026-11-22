import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { agent, getChatAgent } from '../lib/agent';
import { describeFailure, readWithRetry } from '../lib/reliability';
import { timeAgo } from '../lib/time';
import { Avatar } from '../components/Avatar';
import { chatErrorCopy } from '../lib/chatModel';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

const REQUEST_PAGE_SIZE = 50;

/** Owner-only list of people asking to join a group. */
export function JoinRequestsScreen() {
  const p = usePalette();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const convoId = String(route.params?.convoId || '');
  const [requests, setRequests] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Join requests' });
  }, [navigation]);

  const load = useCallback(async () => {
    if (!convoId) return;
    setRefreshing(true);
    setError(null);
    try {
      const chat = getChatAgent();
      const [list] = await Promise.all([
        readWithRetry(() =>
          chat.chat.bsky.group.listJoinRequests({
            convoId,
            limit: REQUEST_PAGE_SIZE,
          })
        ),
        chat.chat.bsky.group.updateJoinRequestsRead({ convoId }).catch(() => null),
      ]);
      setRequests(list.data.requests || []);
      setCursor(list.data.cursor);
    } catch (err) {
      setError(chatErrorCopy(err));
    }
    setRefreshing(false);
  }, [convoId]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function loadMore() {
    if (loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await readWithRetry(() =>
        getChatAgent().chat.bsky.group.listJoinRequests({
          convoId,
          limit: REQUEST_PAGE_SIZE,
          cursor,
        })
      );
      setRequests((prev) => [...prev, ...(res.data.requests || [])]);
      setCursor(res.data.cursor);
    } catch (err) {
      setError(describeFailure(err, 'Could not load more join requests.'));
    }
    setLoadingMore(false);
  }

  async function decide(request: any, approve: boolean) {
    const did = String(request?.requestedBy?.did || '');
    if (!did || busy) return;
    setBusy(did);
    setError(null);
    try {
      const chat = getChatAgent();
      if (approve) {
        await chat.chat.bsky.group.approveJoinRequest({ convoId, member: did });
      } else {
        await chat.chat.bsky.group.rejectJoinRequest({ convoId, member: did });
      }
      setRequests((prev) => prev.filter((item) => item?.requestedBy?.did !== did));
    } catch (err) {
      setError(chatErrorCopy(err));
    }
    setBusy(null);
  }

  function name(request: any): string {
    const person = request?.requestedBy;
    return (
      person?.displayName ||
      (person?.handle ? `@${person.handle}` : String(person?.did || 'Someone'))
    );
  }

  return (
    <FlatList
      data={requests}
      keyExtractor={(item: any, index) =>
        String(item?.requestedBy?.did || item?.requestedAt || index)
      }
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => void load()} tintColor={p.accent} />
      }
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
          <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19 }}>
            People ask to join when the invite link requires approval. Approving
            adds them to the group; rejecting does not block them.
          </Text>
          {error ? (
            <View style={{ marginTop: 8, gap: 4 }}>
              <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 13 }}>
                {error}
              </Text>
              <Pressable
                onPress={() => void load()}
                accessibilityRole="button"
                accessibilityLabel="Retry loading join requests"
                style={({ pressed }) => ({
                  minHeight: 44,
                  justifyContent: 'center',
                  alignSelf: 'flex-start',
                  opacity: pressed ? 0.7 : 1,
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
            No pending join requests.
          </Text>
        )
      }
      renderItem={({ item }) => {
        const person = item?.requestedBy;
        const did = String(person?.did || '');
        const working = busy === did;
        return (
          <View
            style={[
              styles.row,
              { backgroundColor: p.card, borderColor: p.divider },
              cardShadow,
            ]}
          >
            <Avatar avatar={person?.avatar} displayName={name(item)} size={44} />
            <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
              <Text style={{ color: p.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
                {name(item)}
              </Text>
              {person?.handle ? (
                <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={1}>
                  @{person.handle}
                </Text>
              ) : null}
              {item?.requestedAt ? (
                <Text style={{ color: p.secondary, fontSize: 11, marginTop: 2 }}>
                  {timeAgo(item.requestedAt)}
                </Text>
              ) : null}
            </View>
            <View style={styles.actions}>
              <Pressable
                onPress={() => void decide(item, false)}
                disabled={working}
                accessibilityRole="button"
                accessibilityLabel={`Reject join request from ${name(item)}`}
                style={({ pressed }) => [
                  styles.button,
                  { borderColor: p.divider, opacity: pressed || working ? 0.6 : 1 },
                ]}
              >
                <Text style={{ color: p.text, fontWeight: '600' }}>Reject</Text>
              </Pressable>
              <Pressable
                onPress={() => void decide(item, true)}
                disabled={working}
                accessibilityRole="button"
                accessibilityLabel={`Approve join request from ${name(item)}`}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: p.accent, opacity: pressed || working ? 0.6 : 1 },
                ]}
              >
                <Text style={{ color: p.onAccent, fontWeight: '700' }}>
                  {working ? '…' : 'Approve'}
                </Text>
              </Pressable>
            </View>
          </View>
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
    padding: 10,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  actions: { gap: 6, alignItems: 'stretch' },
  button: {
    minHeight: 44,
    minWidth: 76,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
