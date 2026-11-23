import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { memorySnippet, type MemoryItem } from '../lib/memoriesModel';
import { usePalette } from '../theme';

/** One compact, read-only memory. Opening it always goes through Thread. */
export function MemoryPostRow({
  item,
  onPress,
  lines = 2,
}: {
  item: MemoryItem;
  onPress: (uri: string) => void;
  lines?: number;
}) {
  const p = usePalette();
  const snippet = memorySnippet(item.record);

  return (
    <Pressable
      onPress={() => onPress(item.uri)}
      accessibilityRole="button"
      accessibilityLabel={`Open your post from ${item.year}: ${snippet}`}
      accessibilityHint="Opens this post in Thread."
      style={({ pressed }) => [
        styles.row,
        {
          borderTopColor: p.divider,
          backgroundColor: pressed ? p.bg : 'transparent',
        },
      ]}
    >
      <View style={[styles.year, { backgroundColor: p.accentSoft }]}>
        <Text style={{ color: p.accent, fontSize: 11, fontWeight: '800' }}>
          {item.year}
        </Text>
      </View>
      <Text
        numberOfLines={lines}
        style={{ color: p.text, fontSize: 14, lineHeight: 20, flex: 1, minWidth: 0 }}
      >
        {snippet}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={p.secondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  year: {
    minWidth: 42,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
});
