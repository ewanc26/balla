import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';
import { Avatar } from './Avatar';
import { usePreferences } from '../lib/preferences';
import { useRecentActivity } from '../lib/recentActivity';
import type { RecentActivity } from '../lib/recentActivityModel';
import { hiddenByLabel, warnedByLabel } from '../lib/labelVisibility';
import { usePostModeration } from '../lib/moderationContext';

/**
 * A compact, chronological view of what followed accounts replied to or
 * reposted. It uses the Following timeline already loaded by FeedScreen. A
 * row's label and mute state are checked with the same helpers as PostCard.
 */
export function RecentActivityCard({
  onOpenThread,
}: {
  onOpenThread: (uri: string) => void;
}) {
  const p = usePalette();
  const { preferences, setShowRecentActivity } = usePreferences();
  const activities = useRecentActivity();

  if (!preferences.showRecentActivity) return null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: p.card, borderColor: p.divider },
        cardShadow,
      ]}
    >
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          style={{ color: p.text, fontSize: 17, fontWeight: '700', flex: 1 }}
        >
          Recent activity
        </Text>
        <Pressable
          onPress={() => setShowRecentActivity(false)}
          accessibilityRole="button"
          accessibilityLabel="Hide this card"
          accessibilityHint="Removes Recent activity from the right rail"
          style={({ pressed }) => [
            styles.hideButton,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={{ color: p.secondary, fontSize: 12, fontWeight: '600' }}>
            Hide this card
          </Text>
        </Pressable>
      </View>
      <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginBottom: 6 }}>
        Replies and reposts from people you follow. Newest first.
      </Text>

      {activities.length === 0 ? (
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 18, marginTop: 6 }}>
          Nothing yet. New replies and reposts will appear here when the feed
          refreshes.
        </Text>
      ) : (
        activities.map((activity, index) => (
          <ActivityRow
            key={activity.id}
            activity={activity}
            first={index === 0}
            onOpenThread={onOpenThread}
          />
        ))
      )}
    </View>
  );
}

function ActivityRow({
  activity,
  first,
  onOpenThread,
}: {
  activity: RecentActivity;
  first: boolean;
  onOpenThread: (uri: string) => void;
}) {
  const p = usePalette();
  const moderation = usePostModeration(activity.post);
  const listUi = moderation?.ui('contentList');
  const contentUi = moderation?.ui('contentView');
  const profileUi = moderation?.ui('profileView');
  const avatarUi = moderation?.ui('avatar');
  const displayNameUi = moderation?.ui('displayName');

  // The feed hides a post through contentList. Other surfaces hide an account
  // through its identity UI. This compact row has no room for a label warning
  // card, so warned content is named but not repeated here.
  if (
    hiddenByLabel(listUi) ||
    hiddenByLabel(contentUi) ||
    hiddenByLabel(profileUi) ||
    hiddenByLabel(avatarUi) ||
    hiddenByLabel(displayNameUi)
  ) {
    return null;
  }

  const labelled = warnedByLabel(
    contentUi,
    profileUi,
    avatarUi,
    displayNameUi
  );
  const snippet = labelled ? 'A labelled post' : activity.snippet;
  const verb = activity.verb === 'reposted' ? 'reposted' : 'replied';
  const actorName = labelled ? 'Someone you follow' : activity.actorName;

  return (
    <Pressable
      onPress={() => onOpenThread(activity.post.uri)}
      accessibilityRole="button"
      accessibilityLabel={`${actorName} ${verb}: ${snippet}`}
      accessibilityHint="Opens the post in its thread"
      style={({ pressed }) => [
        styles.row,
        {
          borderTopColor: p.divider,
          borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
          backgroundColor: pressed ? p.bg : 'transparent',
        },
      ]}
    >
      <Avatar
        avatar={labelled ? undefined : activity.actorAvatar}
        displayName={actorName}
        size={28}
      />
      <View style={{ marginLeft: 9, flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: p.text, fontSize: 13 }}>
          <Text style={{ fontWeight: '700' }}>{actorName}</Text>
          <Text style={{ color: p.secondary }}> {verb}</Text>
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: p.secondary, fontSize: 12, marginTop: 1 }}
        >
          {snippet}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  hideButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: 7,
  },
});
