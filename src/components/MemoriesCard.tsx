import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  MEMORIES_HOME_LIMIT,
  memoriesSubtitle,
  type MemoriesDay,
} from '../lib/memoriesModel';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';
import { MemoryPostRow } from './MemoryPostRow';

/** The one Home card. Nothing here fetches, ranks or counts engagement. */
export function MemoriesCard({
  memories,
  onOpenThread,
  onSeeAll,
  onDismiss,
}: {
  memories: MemoriesDay;
  onOpenThread: (uri: string) => void;
  onSeeAll: () => void;
  onDismiss: () => void;
}) {
  const p = usePalette();
  if (memories.items.length === 0) return null;
  const preview = memories.items.slice(0, MEMORIES_HOME_LIMIT);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: p.card, borderColor: p.divider },
        cardShadow,
      ]}
    >
      <View style={styles.heading}>
        <View style={[styles.iconBubble, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="calendar-outline" size={19} color={p.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
            On this day
          </Text>
          <Text
            style={{
              color: p.secondary,
              fontSize: 12,
              lineHeight: 17,
              marginTop: 1,
            }}
          >
            {memoriesSubtitle(memories.dateKey, memories.items)}
          </Text>
        </View>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss today's memories"
          accessibilityHint="Hides this card for the rest of this day on this device."
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={({ pressed }) => [
            styles.dismiss,
            { backgroundColor: pressed ? p.bg : 'transparent' },
          ]}
        >
          <Ionicons name="close" size={21} color={p.secondary} />
        </Pressable>
      </View>

      {preview.map((item) => (
        <MemoryPostRow
          key={item.uri}
          item={item}
          onPress={onOpenThread}
          lines={2}
        />
      ))}

      <Pressable
        onPress={onSeeAll}
        accessibilityRole="button"
        accessibilityLabel="See all memories from this date"
        style={({ pressed }) => [
          styles.seeAll,
          {
            borderTopColor: p.divider,
            backgroundColor: pressed ? p.bg : 'transparent',
          },
        ]}
      >
        <Text style={{ color: p.accent, fontSize: 13, fontWeight: '700' }}>
          See all
        </Text>
        <Ionicons name="arrow-forward" size={16} color={p.accent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  heading: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 13,
    paddingRight: 4,
    paddingVertical: 8,
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismiss: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  seeAll: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
});
