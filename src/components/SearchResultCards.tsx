import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

function formatCount(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1000000) return `${Math.round(value / 100) / 10}k`;
  return `${Math.round(value / 100000) / 10}M`;
}

function recordString(record: any, key: string): string {
  return record && typeof record[key] === 'string' ? record[key] : '';
}

export function FeedResultCard({
  feed,
  onOpen,
}: {
  feed: any;
  onOpen: () => void;
}) {
  const p = usePalette();
  const creator = feed.creator || {};
  const name = feed.displayName || 'Untitled feed';
  const likes = Number(feed.likeCount || 0);
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name} feed by ${creator.handle || 'unknown creator'}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: p.card, borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
        cardShadow,
      ]}
    >
      <Avatar avatar={feed.avatar} displayName={name} size={52} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
          {name}
        </Text>
        <Text style={{ color: p.secondary, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
          Feed by @{creator.handle || 'unknown'}
          {likes > 0 ? ` · ${formatCount(likes)} likes` : ''}
        </Text>
        {feed.description ? (
          <Text
            style={{ color: p.secondary, fontSize: 13, lineHeight: 18, marginTop: 3 }}
            numberOfLines={2}
          >
            {feed.description}
          </Text>
        ) : null}
      </View>
      <View style={[styles.openPill, { backgroundColor: p.accentSoft }]}>
        <Text style={{ color: p.accent, fontSize: 13, fontWeight: '700' }}>Open feed</Text>
      </View>
    </Pressable>
  );
}

export function StarterPackResultCard({
  pack,
  onOpen,
}: {
  pack: any;
  onOpen: () => void;
}) {
  const p = usePalette();
  const creator = pack.creator || {};
  const record = pack.record || {};
  const name = recordString(record, 'name') || 'Starter pack';
  const description = recordString(record, 'description');
  const members =
    pack.list?.listItemCount ??
    pack.listItemCount ??
    (Array.isArray(pack.listItemsSample) ? pack.listItemsSample.length : 0);
  const sample = (pack.listItemsSample || [])
    .map((item: any) => item?.subject)
    .filter(Boolean)
    .slice(0, 3);

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name} starter pack by ${creator.handle || 'unknown creator'}`}
      style={({ pressed }) => [
        styles.packCard,
        { backgroundColor: p.card, borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
        cardShadow,
      ]}
    >
      <View style={styles.packTop}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}>
          {sample.length > 0 ? (
            <View style={{ flexDirection: 'row', marginRight: 10 }}>
              {sample.map((person: any, index: number) => (
                <View
                  key={person.did || index}
                  style={{
                    marginLeft: index === 0 ? 0 : -10,
                    borderRadius: 22,
                    borderWidth: 2,
                    borderColor: p.card,
                  }}
                >
                  <Avatar
                    avatar={person.avatar}
                    displayName={person.displayName || person.handle}
                    size={38}
                  />
                </View>
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.packIcon,
                { backgroundColor: p.accentSoft, marginRight: 10 },
              ]}
            >
              <Ionicons name="people" size={23} color={p.accent} />
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
              {name}
            </Text>
            <Text style={{ color: p.secondary, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
              By @{creator.handle || 'unknown'}
              {members > 0 ? ` · ${formatCount(Number(members))} people` : ''}
            </Text>
          </View>
        </View>
        <View style={[styles.openPill, { backgroundColor: p.accentSoft }]}>
          <Text style={{ color: p.accent, fontSize: 13, fontWeight: '700' }}>Open pack</Text>
        </View>
      </View>
      {description ? (
        <Text
          style={{ color: p.secondary, fontSize: 13, lineHeight: 18, marginTop: 8 }}
          numberOfLines={2}
        >
          {description}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 84,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  packCard: {
    minHeight: 82,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  packTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  packIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openPill: {
    minHeight: 32,
    borderRadius: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
