import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePalette, useFontScale } from '../theme';
import { emojiName, type ReactionSummary } from '../lib/reactionsModel';

export function ReactionChips({
  reactions,
  style,
}: {
  reactions: ReactionSummary[];
  style?: any;
}) {
  const p = usePalette();
  const font = useFontScale();
  if (!reactions || reactions.length === 0) return null;
  return (
    <View style={[styles.row, style]}>
      {reactions.map((reaction) => (
        <View
          key={reaction.value}
          style={[styles.chip, { borderColor: p.divider, backgroundColor: p.bg }]}
          accessibilityRole="text"
          accessibilityLabel={`${emojiName(reaction.value)} reaction, ${reaction.count} ${
            reaction.count === 1 ? 'reaction' : 'reactions'
          }${reaction.mine ? ', including yours' : ''}`}
        >
          <Text style={{ color: p.text, fontSize: font(13) }}>
            {reaction.value} {reaction.count}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
});

export default ReactionChips;
