import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import { describeFailure, readWithRetry } from '../lib/reliability';
import { blockActor, unblockActor, unmuteActor } from '../lib/moderation';
import { Avatar } from '../components/Avatar';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

type Mode = 'blocked' | 'muted';

const COPY: Record<Mode, { title: string; empty: string }> = {
  blocked: {
    title: 'Blocked accounts',
    empty: 'You have not blocked anyone. Use an account’s profile menu to block it.',
  },
  muted: {
    title: 'Muted accounts',
    empty: 'You have not muted anyone. Use an account’s profile menu to mute it.',
  },
};

/**
 * The official client's ModerationBlockedAccounts and ModerationMutedAccounts
 * screens, combined into one surface with a switch. Reads come from the two
 * published graph endpoints; unblock deletes the real app.bsky.graph.block
 * record, unmute calls the graph unmute endpoint. No local state is invented.
 */
export function BlockedAccountsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const [mode, setMode] = useState<Mode>('blocked');
  const [people, setPeople] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyDid, setBusyDid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Blocked and muted accounts' });
  }, [navigation]);

  const fetchPage = useCallback(
    async (nextCursor?: string) => {
      if (mode === 'blocked') {
        const res = await readWithRetry(() =>
          agent.app.bsky.graph.getBlocks({ limit: 50, cursor: nextCursor })
        );
        return { items: res.data.blocks || [], cursor: res.data.cursor };
      }
      const res = await readWithRetry(() =>
        agent.app.bsky.graph.getMutes({ limit: 50, cursor: nextCursor })
      );
      return { items: res.data.mutes || [], cursor: res.data.cursor };
    },
    [mode]
  );

  const loadFirstPage = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    setPeople([]);
    setCursor(undefined);
    setDone(false);
    try {
      const page = await fetchPage(undefined);
      setPeople(page.items);
      setCursor(page.cursor);
      setDone(!page.cursor);
    } catch (err) {
      setError(describeFailure(err, 'Could not load these accounts.'));
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
  }

  async function loadMore() {
    if (inFlight.current || !cursor || done) return;
    inFlight.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursor);
      setPeople((prev) => [...prev, ...page.items]);
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

  // Unblock needs the block record URI, which getBlocks exposes as `uri`.
  // Muting is an actor-level state with no URI, so unmute takes the DID.
  async function remove(person: any) {
    if (busyDid) return;
    setBusyDid(person.did);
    setError(null);
    try {
      if (mode === 'blocked') {
        const uri =
          typeof person.viewer?.blocking === 'string'
            ? person.viewer.blocking
            : typeof person.uri === 'string'
              ? person.uri
              : null;
        if (uri) await unblockActor(uri);
        else await blockActor(person.did).then((created) => unblockActor(created));
      } else {
        await unmuteActor(person.did);
      }
      setPeople((prev) => prev.filter((item) => item.did !== person.did));
    } catch (err) {
      setError(describeFailure(err, `Could not remove @${person.handle}. Try again.`));
    } finally {
      setBusyDid(null);
    }
  }

  function openProfile(did: string) {
    navigation.push('UserProfile', { actor: did });
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          backgroundColor: p.card,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: p.divider,
        }}
      >
        {(['blocked', 'muted'] as Mode[]).map((item) => {
          const active = mode === item;
          return (
            <Pressable
              key={item}
              onPress={() => switchMode(item)}
              accessibilityRole="tab"
              accessibilityLabel={COPY[item].title}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.tab,
                {
                  borderBottomWidth: active ? 2 : 0,
                  borderBottomColor: p.accent,
                  opacity: pressed ? 0.6 : 1,
                },
              ]}
            >
              <Text style={{ color: active ? p.accent : p.secondary, fontWeight: '700', fontSize: 14 }}>
                {COPY[item].title}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 13, padding: 12 }}>
          {error}
        </Text>
      ) : null}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={p.accent} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
          data={people}
          keyExtractor={(item: any) => item.did}
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.6}
          renderItem={({ item }) => (
            <View
              style={[styles.row, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}
            >
              <Pressable
                onPress={() => openProfile(item.did)}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.handle}'s profile`}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 }}
              >
                <Avatar avatar={item.avatar} displayName={item.displayName || item.handle} size={48} />
                <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                  <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                    {item.displayName || item.handle}
                  </Text>
                  <Text style={{ color: p.secondary, fontSize: 13 }} numberOfLines={1}>
                    @{item.handle}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => void remove(item)}
                disabled={busyDid === item.did}
                accessibilityRole="button"
                accessibilityLabel={`${mode === 'blocked' ? 'Unblock' : 'Unmute'} ${item.handle}`}
                style={({ pressed }) => [
                  styles.action,
                  {
                    borderColor: p.divider,
                    opacity: pressed || busyDid === item.did ? 0.6 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={mode === 'blocked' ? 'ban-outline' : 'volume-mute-outline'}
                  size={16}
                  color={p.accent}
                />
                <Text style={{ color: p.accent, fontSize: 13, fontWeight: '600' }}>
                  {mode === 'blocked' ? 'Unblock' : 'Unmute'}
                </Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' }}>
              <Text style={{ color: p.secondary, textAlign: 'center' }}>
                {error || COPY[mode].empty}
              </Text>
              {error ? (
                <Pressable
                  onPress={() => void loadFirstPage()}
                  accessibilityRole="button"
                  accessibilityLabel="Try loading these accounts again"
                  style={{
                    marginTop: 12,
                    minHeight: 44,
                    paddingHorizontal: 20,
                    borderRadius: 8,
                    backgroundColor: p.accentSoft,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: p.accent, fontWeight: '600' }}>Try again</Text>
                </Pressable>
              ) : null}
            </View>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={p.accent} style={{ marginVertical: 18 }} /> : undefined
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
