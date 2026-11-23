import React, { useLayoutEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePreferences } from '../lib/preferences';
import { useViewer } from '../lib/viewer';
import { useMemories } from '../lib/useMemories';
import { memoriesDateKey, memoriesSubtitle } from '../lib/memoriesModel';
import { MemoryPostRow } from '../components/MemoryPostRow';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

/** Every matching post for today, newest year first, read from the PDS. */
export function MemoriesScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const { profile } = useViewer();
  const { preferences } = usePreferences();
  const preference = profile?.did ? preferences.memories[profile.did] : undefined;
  const enabled = !!preference?.enabled;
  const dateKey = memoriesDateKey(new Date());
  const memories = useMemories(profile?.did, enabled, dateKey);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Memories' });
  }, [navigation]);

  if (!enabled) {
    return (
      <View style={[styles.centred, { backgroundColor: p.bg }]}>
        <Ionicons name="calendar-outline" size={30} color={p.secondary} />
        <Text style={[styles.emptyTitle, { color: p.text }]}>Memories is off</Text>
        <Text style={[styles.emptyCopy, { color: p.secondary }]}>
          Turn on On this day in Following feed preferences. It is off by
          default, makes no notifications and only reads your own repository.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('FeedPreferences')}
          accessibilityRole="button"
          accessibilityLabel="Open Following feed preferences"
          style={({ pressed }) => [
            styles.settingsButton,
            { borderColor: p.accent, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Text style={{ color: p.accent, fontSize: 14, fontWeight: '700' }}>
            Open feed preferences
          </Text>
        </Pressable>
      </View>
    );
  }

  if (memories === undefined) {
    return (
      <View style={[styles.centred, { backgroundColor: p.bg }]}>
        <ActivityIndicator size="large" color={p.accent} />
      </View>
    );
  }

  if (!memories) {
    return (
      <View style={[styles.centred, { backgroundColor: p.bg }]}>
        <Ionicons name="cloud-offline-outline" size={30} color={p.secondary} />
        <Text style={[styles.emptyTitle, { color: p.text }]}>
          Could not read your memories
        </Text>
        <Text style={[styles.emptyCopy, { color: p.secondary }]}>
          Your feed is unchanged. This only reads the public posts in your own
          repository.
        </Text>
      </View>
    );
  }

  if (memories.items.length === 0) {
    return (
      <View style={[styles.centred, { backgroundColor: p.bg }]}>
        <Ionicons name="calendar-outline" size={30} color={p.secondary} />
        <Text style={[styles.emptyTitle, { color: p.text }]}>
          Nothing from this date
        </Text>
        <Text style={[styles.emptyCopy, { color: p.secondary }]}>
          No posts from this date in earlier years were found in your
          repository.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 10, paddingBottom: 32 }}
    >
      <View
        style={[
          styles.intro,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <View style={[styles.iconBubble, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="calendar-outline" size={21} color={p.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: p.text, fontSize: 19, fontWeight: '700' }}>
            On this day
          </Text>
          <Text
            style={{
              color: p.secondary,
              fontSize: 13,
              lineHeight: 19,
              marginTop: 2,
            }}
          >
            {memoriesSubtitle(memories.dateKey, memories.items)}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.list,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        {memories.items.map((item) => (
          <MemoryPostRow
            key={item.uri}
            item={item}
            lines={6}
            onPress={(uri) => navigation.navigate('Thread', { uri })}
          />
        ))}
      </View>

      {memories.truncated ? (
        <Text style={[styles.note, { color: p.secondary }]}>
          This session checked the newest {memories.scanned} posts in your
          repository. Older posts are outside this walk.
        </Text>
      ) : (
        <Text style={[styles.note, { color: p.secondary }]}>
          Read from the public posts in your repository. No AppView or
          engagement counts are involved.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centred: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
  },
  emptyCopy: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 420,
  },
  settingsButton: {
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 4,
  },
  intro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginHorizontal: 8,
    marginBottom: 8,
    padding: 14,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    marginHorizontal: 8,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  note: {
    fontSize: 12,
    lineHeight: 18,
    marginHorizontal: 18,
    marginTop: 12,
  },
});
