import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { agent } from '../lib/agent';
import { timeAgo } from '../lib/time';
import { Avatar } from '../components/Avatar';
import { usePalette } from '../theme';

function reasonText(reason: string): string {
  if (reason === 'like' || reason === 'like_via_proxy') return 'liked your post';
  if (reason === 'repost' || reason === 'repost_via_proxy') return 'reposted your post';
  if (reason === 'reply') return 'replied to your post';
  if (reason === 'mention') return 'mentioned you';
  if (reason === 'quote') return 'quoted your post';
  if (reason === 'follow') return 'followed you';
  return reason;
}

export function NotificationsScreen() {
  const p = usePalette();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      const res = await agent.listNotifications({ limit: 50 });
      setItems(res.data.notifications || []);
    } catch {
      // keep old items; next pull can retry
    }
    setRefreshing(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <FlatList
      data={items}
      keyExtractor={(item: any, index: number) => item.uri || String(index)}
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingBottom: 24 }}
      ListHeaderComponent={
        <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
          <Text style={{ color: p.text, fontSize: 28, fontWeight: '800' }}>Notifications</Text>
        </View>
      }
      ListEmptyComponent={
        refreshing ? null : (
          <Text style={{ color: p.secondary, textAlign: 'center', marginTop: 48 }}>
            Nothing yet.
          </Text>
        )
      }
      renderItem={({ item }) => {
        const author = item.author || {};
        return (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: p.card,
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginBottom: 4,
            }}
          >
            <Avatar avatar={author.avatar} displayName={author.displayName || author.handle} size={44} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: p.text, fontSize: 15 }}>
                <Text style={{ fontWeight: '600' }}>{author.displayName || author.handle}</Text>{' '}
                <Text style={{ color: p.secondary }}>{reasonText(item.reason || '')}</Text>
              </Text>
              <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}>{timeAgo(item.indexedAt)}</Text>
            </View>
          </View>
        );
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={p.accent} />}
    />
  );
}
