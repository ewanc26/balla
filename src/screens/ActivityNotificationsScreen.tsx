import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../components/Avatar';
import { SubscribeProfileSheet } from '../components/SubscribeProfileSheet';
import {
  listActivitySubscriptions,
  parseActivitySubscription,
  subscriptionSummary,
} from '../lib/activitySubscriptions';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

/**
 * Lists the accounts whose posts/replies the viewer opted in to. Mirrors the
 * official ActivityNotificationSettings list and reuses the same subscribe
 * sheet as the profile bell, so edits and removals go through one real RPC.
 */
export function ActivityNotificationsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Activity notifications' });
  }, [navigation]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setItems(await listActivitySubscriptions());
    } catch {
      setError('Could not load your activity subscriptions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function onSaved(value: { post: boolean; reply: boolean }) {
    const did = editing?.did;
    setItems((prev) =>
      value.post || value.reply
        ? prev.map((item) =>
            item.did === did
              ? { ...item, viewer: { ...(item.viewer || {}), activitySubscription: value } }
              : item
          )
        : prev.filter((item) => item.did !== did)
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color={p.accent} />
      ) : error ? (
        <View style={{ padding: 20 }}>
          <Text style={{ color: p.danger, fontSize: 14 }}>{error}</Text>
          <Pressable
            onPress={() => void load()}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={{ marginTop: 12, minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ color: p.accent, fontWeight: '700' }}>Try again</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={{ padding: 20 }}>
          <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20 }}>
            You are not subscribed to anyone's activity yet. Use the bell on a
            profile to choose which posts and replies notify you.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.did)}
          renderItem={({ item }) => {
            const sub = parseActivitySubscription(item.viewer?.activitySubscription);
            return (
              <Pressable
                onPress={() => setEditing(item)}
                accessibilityRole="button"
                accessibilityLabel={`Edit activity notifications for @${item.handle}`}
                accessibilityHint={subscriptionSummary(sub)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: p.card, borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
                  cardShadow,
                ]}
              >
                <Avatar
                  avatar={item.avatar}
                  displayName={item.displayName || item.handle}
                  size={44}
                />
                <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
                  <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
                    {item.displayName || item.handle}
                  </Text>
                  <Text style={{ color: p.secondary, fontSize: 13 }} numberOfLines={1}>
                    @{item.handle} · {subscriptionSummary(sub)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={p.secondary} />
              </Pressable>
            );
          }}
        />
      )}
      <SubscribeProfileSheet
        visible={!!editing}
        did={editing?.did || ''}
        handle={editing?.handle || ''}
        current={editing?.viewer?.activitySubscription}
        onClose={() => setEditing(null)}
        onSaved={onSaved}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 12,
    marginTop: 10,
  },
});
