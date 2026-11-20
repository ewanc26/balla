import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
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

// Tapping a notification lands you inside the conversation it came from.
// Replies, mentions and quotes carry their own uri; likes and reposts point
// at the subject post through reasonSubject. Follows have no conversation,
// so their row stays put.
function threadUri(item: any): string | undefined {
  const reason = String(item.reason || '');
  if (reason === 'reply' || reason === 'mention' || reason === 'quote') return item.uri;
  if (reason.startsWith('like') || reason.startsWith('repost')) return item.reasonSubject;
  return undefined;
}

export function NotificationsScreen() {
  const p = usePalette();
  const navigation = useNavigation<any>();
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

  function Header() {
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
        <Text style={{ color: p.text, fontSize: 28, fontWeight: '800' }}>Notifications</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item: any, index: number) => item.uri || String(index)}
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingBottom: 24 }}
      ListHeaderComponent={Header}
      ListEmptyComponent={
        refreshing ? undefined : (
          <Text style={{ color: p.secondary, textAlign: 'center', marginTop: 48 }}>
            Nothing yet.
          </Text>
        )
      }
      renderItem={({ item }) => {
        const author = item.author || {};
        const uri = threadUri(item);
        return (
          <Pressable
            disabled={!uri}
            onPress={() => navigation.navigate('Thread', { uri })}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: p.card,
              paddingHorizontal: 14,
              paddingVertical: 12,
              marginBottom: 4,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Avatar avatar={author.avatar} displayName={author.displayName || author.handle} size={44} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: p.text, fontSize: 15 }}>
                <Text style={{ fontWeight: '600' }}>{author.displayName || author.handle}</Text>{' '}
                <Text style={{ color: p.secondary }}>{reasonText(item.reason || '')}</Text>
              </Text>
              <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}>{timeAgo(item.indexedAt)}</Text>
            </View>
          </Pressable>
        );
      }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={p.accent} />}
    />
  );
}
