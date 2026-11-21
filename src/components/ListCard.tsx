import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';
import {
  listMemberCount,
  listPurposeMeta,
  listViewerState,
} from '../lib/listModel';

export function ListCard({
  list,
  onPress,
  showCreator = true,
}: {
  list: any;
  onPress: () => void;
  showCreator?: boolean;
}) {
  const p = usePalette();
  const purpose = listPurposeMeta(list?.purpose);
  const viewer = listViewerState(list);
  const count = listMemberCount(list);
  const creator = list?.creator || {};

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${list?.name || 'list'}${creator.handle ? ` by @${creator.handle}` : ''}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: p.card, borderColor: p.divider, opacity: pressed ? 0.68 : 1 },
        cardShadow,
      ]}
    >
      <Avatar avatar={list?.avatar} displayName={list?.name || 'List'} size={48} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.titleRow}>
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
            {list?.name || 'Untitled list'}
          </Text>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: purpose.shortLabel === 'Moderation' ? p.soft : p.accentSoft,
              },
            ]}
          >
            <Text
              style={{
                color: purpose.shortLabel === 'Moderation' ? p.secondary : p.accent,
                fontSize: 10,
                fontWeight: '700',
              }}
            >
              {purpose.shortLabel}
            </Text>
          </View>
        </View>

        <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
          {showCreator && creator.handle ? `@${creator.handle} · ` : ''}
          {count} {count === 1 ? 'person' : 'people'}
        </Text>

        {list?.description ? (
          <Text
            style={{ color: p.secondary, fontSize: 13, lineHeight: 18, marginTop: 3 }}
            numberOfLines={2}
          >
            {list.description}
          </Text>
        ) : null}

        {viewer.hidden || viewer.blocked || viewer.subscribed ? (
          <View style={styles.statusRow}>
            {viewer.hidden ? <Status icon="eye-off-outline" text="Hidden by label" /> : null}
            {viewer.subscribed ? <Status icon="checkmark-circle-outline" text="Subscribed" /> : null}
            {viewer.blocked ? <Status icon="ban-outline" text="Blocked" /> : null}
          </View>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={p.secondary} />
    </Pressable>
  );
}

function Status({ icon, text }: { icon: any; text: string }) {
  const p = usePalette();
  return (
    <View style={styles.status}>
      <Ionicons name={icon} size={12} color={p.secondary} />
      <Text style={{ color: p.secondary, fontSize: 10, fontWeight: '600' }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 82,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginHorizontal: 8,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 5,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
});
