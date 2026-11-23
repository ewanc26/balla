import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useViewPreferences } from '../lib/viewPreferences';
import {
  firstReplyInOrder,
  replyAuthorGated,
  replyPreviewText,
} from '../lib/replyPreviewModel';
import { useReplyPreview } from '../lib/replyPreviewStore';
import { usePostModeration } from '../lib/moderationContext';
import { hiddenByLabel, warnedByLabel } from '../lib/labelVisibility';
import { usePalette } from '../theme';
import { Avatar } from './Avatar';

/**
 * A first direct reply under a feed card's actions. It is mounted by PostCard
 * only for the Home feed, only while FlashList reports the card viewable. The
 * reply count elsewhere on the card always remains the post view's total.
 */
export function ReplyPreview({
  post,
  enabled,
  onOpenThread,
  onOpenProfile,
}: {
  post: any;
  enabled: boolean;
  onOpenThread?: (uri: string) => void;
  onOpenProfile?: (did: string) => void;
}) {
  const p = usePalette();
  const { threadSort } = useViewPreferences();
  const entry = useReplyPreview(
    post?.uri,
    enabled && !!onOpenThread && (post?.replyCount || 0) > 0
  );
  const reply = entry?.status === 'ready'
    ? firstReplyInOrder(entry.replies, threadSort)
    : null;
  const moderation = usePostModeration(reply?.post);

  if (
    !enabled ||
    !onOpenThread ||
    !reply ||
    !reply.post?.uri ||
    replyAuthorGated(reply) ||
    !moderation
  ) {
    return null;
  }

  const listUi = moderation.ui('contentList');
  const contentUi = moderation.ui('contentView');
  const mediaUi = moderation.ui('contentMedia');
  const profileUi = moderation.ui('profileView');
  const avatarUi = moderation.ui('avatar');
  const displayNameUi = moderation.ui('displayName');

  // A compact preview has no room for a label warning card. If the reply or
  // its identity is hidden or warned, the card keeps the count-only row.
  if (
    hiddenByLabel(listUi) ||
    hiddenByLabel(contentUi) ||
    hiddenByLabel(mediaUi) ||
    hiddenByLabel(profileUi) ||
    hiddenByLabel(avatarUi) ||
    hiddenByLabel(displayNameUi) ||
    warnedByLabel(contentUi, mediaUi, profileUi, avatarUi, displayNameUi)
  ) {
    return null;
  }

  const author = reply.post.author || {};
  const name = author.displayName || author.handle || 'Someone';
  const handle = author.handle ? `@${author.handle}` : '';
  const identity = (
    <>
      <Avatar avatar={author.avatar} displayName={name} size={26} />
      <View style={{ flex: 1, minWidth: 0, marginLeft: 8 }}>
        <Text
          numberOfLines={1}
          style={{ color: p.text, fontSize: 13, fontWeight: '700' }}
        >
          {name}
        </Text>
        {handle ? (
          <Text numberOfLines={1} style={{ color: p.secondary, fontSize: 11 }}>
            {handle}
          </Text>
        ) : null}
      </View>
    </>
  );

  return (
    <View style={[styles.preview, { borderTopColor: p.divider }]}>
      <View style={styles.header}>
        {onOpenProfile && author.did ? (
          <Pressable
            onPress={() => onOpenProfile(author.did)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${name}'s profile`}
            style={({ pressed }) => [
              styles.author,
              { opacity: pressed ? 0.65 : 1 },
            ]}
          >
            {identity}
          </Pressable>
        ) : (
          <View style={styles.author}>{identity}</View>
        )}
        <Pressable
          onPress={() => onOpenThread(post.uri)}
          accessibilityRole="button"
          accessibilityLabel={`View all replies to ${name}`}
          accessibilityHint="Opens this post's conversation"
          style={({ pressed }) => [
            styles.allReplies,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={{ color: p.accent, fontSize: 12, fontWeight: '700' }}>
            View all replies
          </Text>
        </Pressable>
      </View>
      <Text
        numberOfLines={2}
        style={{
          color: p.text,
          fontSize: 13,
          lineHeight: 18,
          marginTop: 2,
          marginBottom: 6,
        }}
      >
        {replyPreviewText(reply.post)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 2,
    paddingTop: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  author: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  allReplies: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 8,
  },
});
