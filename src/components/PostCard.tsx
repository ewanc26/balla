import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import { timeAgo } from '../lib/time';
import { usePalette } from '../theme';
import { Avatar } from './Avatar';

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1000000) return Math.round(n / 100) / 10 + 'k';
  return Math.round(n / 100000) / 10 + 'M';
}

interface PostCardProps {
  post: any;
  onOpenThread?: (uri: string) => void;
  highlight?: boolean;
}

export function PostCard({ post, onOpenThread, highlight }: PostCardProps) {
  const p = usePalette();
  const author = post && post.author ? post.author : {};
  const record = post && post.record ? post.record : {};
  const [liked, setLiked] = useState(!!(post && post.viewer && post.viewer.like));
  const [likes, setLikes] = useState(post ? post.likeCount || 0 : 0);
  const [reposted, setReposted] = useState(!!(post && post.viewer && post.viewer.repost));
  const [reposts, setReposts] = useState(post ? post.repostCount || 0 : 0);
  const replies = post ? post.replyCount || 0 : 0;
  const imgs = extractImages(post);

  async function toggleLike() {
    try {
      if (liked) {
        setLiked(false);
        setLikes((n: number) => Math.max(0, n - 1));
        await agent.deleteLike(post.viewer.like);
      } else {
        setLiked(true);
        setLikes((n: number) => n + 1);
        const res = await agent.like(post.uri, post.cid);
        post.viewer = Object.assign({}, post.viewer || {}, { like: res.uri });
      }
    } catch {
      // Leave the UI as-is; a tap on a flaky connection should not wedge the card.
    }
  }

  async function toggleRepost() {
    try {
      if (reposted) {
        setReposted(false);
        setReposts((n: number) => Math.max(0, n - 1));
        await agent.deleteRepost(post.viewer.repost);
      } else {
        setReposted(true);
        setReposts((n: number) => n + 1);
        const res = await agent.repost(post.uri, post.cid);
        post.viewer = Object.assign({}, post.viewer || {}, { repost: res.uri });
      }
    } catch {
      // ignored, as above
    }
  }

  function openThread() {
    if (onOpenThread && post && post.uri) onOpenThread(post.uri);
  }

  return (
    <View style={[styles.card, highlight && { borderColor: p.accent, borderWidth: 2 }]}>
      <View style={styles.header}>
        <Avatar avatar={author.avatar} displayName={author.displayName || author.handle} size={40} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
            {author.displayName || author.handle}
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12 }}>
            {timeAgo(post.indexedAt)} · @{author.handle}
          </Text>
        </View>
      </View>
      {!!record.text && (
        <Text style={{ color: p.text, fontSize: 15, lineHeight: 21, marginTop: 10 }}>
          {record.text}
        </Text>
      )}
      {imgs.length > 0 && <Images images={imgs} />}
      <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.divider, marginVertical: 10 }} />
      <View style={styles.actions}>
        <ActionButton
          icon={liked ? 'heart' : 'heart-outline'}
          color={liked ? p.accent : p.secondary}
          label={formatCount(likes)}
          onPress={toggleLike}
        />
        <ActionButton
          icon={reposted ? 'repeat' : 'repeat-outline'}
          color={reposted ? p.green : p.secondary}
          label={formatCount(reposts)}
          onPress={toggleRepost}
        />
        <ActionButton
          icon="chatbubble-outline"
          color={p.secondary}
          label={formatCount(replies)}
          onPress={openThread}
        />
      </View>
    </View>
  );
}

function extractImages(post: any): any[] {
  const embed = post && post.embed;
  if (!embed) return [];
  const type = String(embed.$type || '');
  if (type.endsWith('app.bsky.feed.images#view')) return embed.images || [];
  if (type.endsWith('app.bsky.embed.recordWithMedia#view')) {
    const media = embed.media;
    if (media && String(media.$type || '').endsWith('app.bsky.embed.images#view')) {
      return media.images || [];
    }
  }
  return [];
}

function Images({ images }: { images: any[] }) {
  const p = usePalette();
  const uris = images.slice(0, 4).map((i: any) => i.thumb || i.fullsize);
  if (uris.length === 1) {
    return (
      <Image
        source={{ uri: uris[0] }}
        style={{ width: '100%', height: 280, borderRadius: 10, marginTop: 10, backgroundColor: p.divider }}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 10, borderRadius: 10, overflow: 'hidden' }}>
      {uris.map((u: string) => (
        <Image
          key={u}
          source={{ uri: u }}
          style={{ width: '49.5%', aspectRatio: 1, backgroundColor: p.divider }}
          resizeMode="cover"
        />
      ))}
    </View>
  );
}

function ActionButton({ icon, color, label, onPress }: { icon: any; color: string; label: string; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      style={({ pressed }) => [styles.action, { backgroundColor: p.bg, opacity: pressed ? 0.6 : 1 }]}
    >
      <Ionicons name={icon} size={18} color={color} />
      <Text style={{ color, marginLeft: 6, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-around' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 88,
    borderRadius: 8,
  },
});
