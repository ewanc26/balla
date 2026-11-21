import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';
import { Avatar } from './Avatar';
import { useViewer } from '../lib/viewer';
import type { TabName } from './AppHeader';

const NAV_ITEMS: { name: TabName; icon: any; label: string }[] = [
  { name: 'Home', icon: 'home-outline', label: 'Home' },
  { name: 'Search', icon: 'search-outline', label: 'Search' },
  { name: 'Notifications', icon: 'notifications-outline', label: 'Notifications' },
  { name: 'Saved', icon: 'bookmark-outline', label: 'Saved' },
  { name: 'Profile', icon: 'person-outline', label: 'Profile' },
];

export function LeftRail({
  activeTab,
  onNavigate,
  onOpenSettings,
}: {
  activeTab: TabName;
  onNavigate: (tab: TabName) => void;
  onOpenSettings: () => void;
}) {
  const p = usePalette();
  const { profile } = useViewer();

  return (
    <View style={[styles.left, { borderRightColor: p.divider }]}>
      <Pressable
        onPress={() => onNavigate('Profile')}
        accessibilityRole="button"
        accessibilityLabel="Open your profile"
        style={({ pressed }) => [
          styles.profileRow,
          { backgroundColor: pressed ? p.bg : 'transparent' },
        ]}
      >
        <Avatar
          avatar={profile && profile.avatar}
          displayName={(profile && (profile.displayName || profile.handle)) || 'You'}
          size={40}
        />
        <View style={{ marginLeft: 10, flex: 1, minWidth: 0 }}>
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
            {(profile && (profile.displayName || profile.handle)) || 'Your profile'}
          </Text>
          <Text style={{ color: p.secondary, fontSize: 13 }} numberOfLines={1}>
            {profile && profile.handle ? `@${profile.handle}` : 'AT Protocol account'}
          </Text>
        </View>
      </Pressable>

      <View style={[styles.rule, { backgroundColor: p.divider }]} />

      {NAV_ITEMS.map((item) => {
        const active = activeTab === item.name;
        return (
          <Pressable
            key={item.name}
            onPress={() => onNavigate(item.name)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.navRow,
              { backgroundColor: pressed ? p.bg : 'transparent' },
            ]}
          >
            <View
              style={[
                styles.iconBubble,
                { backgroundColor: active ? p.accentSoft : p.soft },
              ]}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={active ? p.accent : p.text}
              />
            </View>
            <Text
              style={{
                color: active ? p.accent : p.text,
                fontSize: 15,
                fontWeight: '600',
                marginLeft: 12,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}

      <View style={[styles.rule, { backgroundColor: p.divider }]} />
      <Pressable
        onPress={onOpenSettings}
        accessibilityRole="button"
        accessibilityLabel="Settings and privacy"
        style={({ pressed }) => [
          styles.navRow,
          { backgroundColor: pressed ? p.bg : 'transparent' },
        ]}
      >
        <View style={[styles.iconBubble, { backgroundColor: p.soft }]}>
          <Ionicons name="settings-outline" size={20} color={p.text} />
        </View>
        <Text
          style={{
            color: p.text,
            fontSize: 15,
            fontWeight: '600',
            marginLeft: 12,
          }}
        >
          Settings & privacy
        </Text>
      </Pressable>

      <View style={{ flex: 1 }} />

      <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, paddingHorizontal: 8 }}>
        Newest first. No ranking, no ads.
      </Text>
      <Text
        style={{
          color: p.secondary,
          fontSize: 11,
          lineHeight: 16,
          paddingHorizontal: 8,
          marginTop: 6,
        }}
      >
        Independent AT Protocol software.
      </Text>
    </View>
  );
}

export function RightRail({ onNavigate }: { onNavigate: (tab: TabName) => void }) {
  const p = usePalette();

  return (
    <View style={[styles.right, { borderLeftColor: p.divider }]}>
      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700', marginBottom: 12 }}>
          Your feed
        </Text>
        <RailFact icon="time-outline" text="Newest first, always" />
        <RailFact icon="shield-checkmark-outline" text="No ranking or ads" />
        <RailFact icon="people-outline" text="Only people you follow" />
      </View>

      <Pressable
        onPress={() => onNavigate('Saved')}
        accessibilityRole="button"
        accessibilityLabel="Open saved posts"
        style={({ pressed }) => [
          styles.card,
          styles.savedCard,
          { backgroundColor: p.card, borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
          cardShadow,
        ]}
      >
        <View style={[styles.savedIcon, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="bookmark-outline" size={20} color={p.accent} />
        </View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>Saved</Text>
          <Text style={{ color: p.secondary, fontSize: 13, marginTop: 1 }}>
            Private Bluesky bookmarks
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={p.secondary} />
      </Pressable>

      <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, paddingHorizontal: 8 }}>
        Balla is independent software, not affiliated with Bluesky or Meta.
      </Text>
    </View>
  );
}

function RailFact({ icon, text }: { icon: any; text: string }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 36 }}>
      <Ionicons name={icon} size={18} color={p.accent} />
      <Text style={{ color: p.secondary, fontSize: 14, marginLeft: 10 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  left: {
    width: 260,
    alignSelf: 'stretch',
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: CARD_RADIUS,
    minHeight: 56,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 8,
    borderRadius: CARD_RADIUS,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    width: 300,
    alignSelf: 'stretch',
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 16,
  },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 12,
  },
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
  },
  savedIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
