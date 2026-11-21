import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { agent } from '../lib/agent';
import { Avatar } from './Avatar';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

// One row per account in followers, following, known-follower, like and repost
// lists. Follow state is local so the row can update without refetching a page.
export function PersonRow({
  person,
  detail,
  onOpenProfile,
}: {
  person: any;
  detail?: string;
  onOpenProfile: (did: string) => void;
}) {
  const p = usePalette();
  const [followUri, setFollowUri] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const currentFollow =
    followUri !== undefined ? followUri : person.viewer?.following || null;
  const isSelf = person.did === agent.did;
  const isBlocked = !!(person.viewer?.blocking || person.viewer?.blockedBy);
  const name = person.displayName || person.handle;

  async function toggleFollow() {
    if (busy || isSelf || isBlocked) return;
    const previous = currentFollow;
    setBusy(true);
    // Optimistic state; restored if the PDS rejects the write.
    setFollowUri(previous ? null : 'pending');
    try {
      if (previous) {
        await agent.deleteFollow(previous);
      } else {
        const result = await agent.follow(person.did);
        setFollowUri(result.uri);
      }
    } catch {
      setFollowUri(previous);
    }
    setBusy(false);
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: p.card, borderColor: p.divider },
        cardShadow,
      ]}
    >
      <Pressable
        onPress={() => onOpenProfile(person.did)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${person.handle}'s profile`}
        style={({ pressed }) => [styles.identity, { opacity: pressed ? 0.65 : 1 }]}
      >
        <Avatar avatar={person.avatar} displayName={name} size={52} />
        <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
            {name}
          </Text>
          <Text style={{ color: p.secondary, fontSize: 13 }} numberOfLines={1}>
            @{person.handle}
          </Text>
          {detail ? (
            <Text style={{ color: p.secondary, fontSize: 12, marginTop: 1 }}>{detail}</Text>
          ) : person.description ? (
            <Text
              style={{ color: p.secondary, fontSize: 13, lineHeight: 18, marginTop: 2 }}
              numberOfLines={2}
            >
              {person.description}
            </Text>
          ) : null}
        </View>
      </Pressable>

      {!isSelf ? (
        <Pressable
          onPress={toggleFollow}
          disabled={busy || isBlocked}
          accessibilityRole="button"
          accessibilityLabel={
            isBlocked
              ? `Following unavailable for ${person.handle}`
              : currentFollow
                ? `Unfollow ${person.handle}`
                : `Follow ${person.handle}`
          }
          style={({ pressed }) => ({
            minHeight: 44,
            minWidth: 96,
            paddingHorizontal: 14,
            borderRadius: CARD_RADIUS,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isBlocked ? p.soft : currentFollow ? p.soft : p.accent,
            opacity: pressed || busy ? 0.6 : 1,
            marginLeft: 8,
          })}
        >
          {busy ? (
            <ActivityIndicator color={currentFollow ? p.text : '#FFFFFF'} />
          ) : (
            <Text
              style={{
                color: isBlocked ? p.secondary : currentFollow ? p.text : '#FFFFFF',
                fontWeight: '700',
                fontSize: 14,
              }}
            >
              {isBlocked ? 'Blocked' : currentFollow ? 'Following' : 'Follow'}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginHorizontal: 8,
    marginBottom: 8,
    minHeight: 76,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
    minHeight: 44,
  },
});
