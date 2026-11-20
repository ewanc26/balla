import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { agent, logout } from '../lib/agent';
import { PostCard } from '../components/PostCard';
import { Avatar } from '../components/Avatar';
import { usePalette } from '../theme';

export function ProfileScreen() {
  const p = usePalette();
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const session = (agent as any).session;
        const did = session ? session.did : undefined;
        if (!did) {
          setFailed(true);
          return;
        }
        const prof = await agent.getProfile({ actor: did });
        setProfile(prof.data);
        const feed = await agent.getAuthorFeed({ actor: did, limit: 30 });
        setPosts((feed.data.feed || []).map((i: any) => i.post));
      } catch {
        setFailed(true);
      }
    })();
  }, []);

  if (failed) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: p.secondary }}>Could not load your profile.</Text>
      </View>
    );
  }
  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={p.accent} />
      </View>
    );
  }

  const header = (
    <View style={{ backgroundColor: p.card, marginBottom: 8 }}>
      <View style={{ height: 180, backgroundColor: p.divider }}>
        {profile.banner ? (
          <Image source={{ uri: profile.banner }} style={{ width: '100%', height: 180 }} resizeMode="cover" />
        ) : null}
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <View style={{ flexDirection: 'row', marginTop: -50, alignItems: 'flex-end' }}>
          <View style={{ borderRadius: 60, borderWidth: 3, borderColor: p.card, backgroundColor: p.card }}>
            <Avatar avatar={profile.avatar} displayName={profile.displayName || profile.handle} size={100} />
          </View>
        </View>
        <Text style={{ color: p.text, fontSize: 24, fontWeight: '800', marginTop: 8 }}>
          {profile.displayName || profile.handle}
        </Text>
        <Text style={{ color: p.secondary, fontSize: 15 }}>@{profile.handle}</Text>
        <Text style={{ color: p.secondary, fontSize: 14, marginTop: 8 }}>
          {profile.followersCount || 0} followers · {profile.followingCount || 0} following
        </Text>
        {profile.description ? (
          <Text style={{ color: p.text, fontSize: 14, lineHeight: 20, marginTop: 8 }}>{profile.description}</Text>
        ) : null}
        <Pressable
          onPress={() => logout()}
          style={({ pressed }) => ({
            marginTop: 14,
            backgroundColor: pressed ? p.divider : p.bg,
            borderRadius: 8,
            minHeight: 44,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 16,
            alignSelf: 'flex-start',
          })}
        >
          <Text style={{ color: p.danger, fontWeight: '600', fontSize: 15 }}>Log out</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <FlashList
      data={posts}
      keyExtractor={(item: any) => item.uri}
      renderItem={({ item }) => <PostCard post={item} />}
      estimatedItemSize={420}
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingBottom: 24 }}
      ListHeaderComponent={header}
    />
  );
}
