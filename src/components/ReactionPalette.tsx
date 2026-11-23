import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePalette, useFontScale } from '../theme';
import { REACTION_PALETTE } from '../lib/reactionsModel';
import { touchTargetStyle } from '../lib/accessibilityModel';

export function ReactionPalette({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect?: (emoji: string) => void;
}) {
  const p = usePalette();
  const font = useFontScale();
  if (!visible) return null;
  return (
    <View
      style={[styles.sheet, { backgroundColor: p.card, borderColor: p.divider }]}
      accessibilityLabel="Reaction palette"
    >
      <Text style={{ color: p.text, fontSize: font(14), fontWeight: '700', marginBottom: 8 }}>
        Reactions
      </Text>
      <Text style={{ color: p.secondary, fontSize: font(12), marginBottom: 12 }}>
        Reaction records are public records in your repository, the same as likes.
        AT Protocol has no private data yet.
      </Text>
      <View style={styles.row}>
        {REACTION_PALETTE.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => {
              if (onSelect) onSelect(item.emoji);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${item.label} reaction ${item.emoji}`}
            style={({ pressed }) => [
              styles.button,
              touchTargetStyle,
              { borderColor: p.divider, backgroundColor: pressed ? p.bg : p.card },
            ]}
          >
            <Text style={{ fontSize: font(22) }}>{item.emoji}</Text>
            <Text style={{ color: p.secondary, fontSize: font(11), marginTop: 2 }}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close reaction palette"
        style={({ pressed }) => [
          styles.close,
          touchTargetStyle,
          { borderColor: p.divider, opacity: pressed ? 0.65 : 1 },
        ]}
      >
        <Text style={{ color: p.text, fontSize: font(14), fontWeight: '600' }}>Close</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: {
    minWidth: 44,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  close: {
    marginTop: 12,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ReactionPalette;
