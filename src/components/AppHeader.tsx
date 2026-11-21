import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '../theme';
import { Avatar } from './Avatar';
import { useViewer } from '../lib/viewer';

export type TabName = 'Home' | 'Search' | 'Notifications' | 'Saved' | 'Profile';

const NAV_ITEMS: { name: TabName; icon: any; activeIcon: any; label: string }[] = [
  { name: 'Home', icon: 'home-outline', activeIcon: 'home', label: 'Home' },
  { name: 'Search', icon: 'search-outline', activeIcon: 'search', label: 'Search' },
  {
    name: 'Notifications',
    icon: 'notifications-outline',
    activeIcon: 'notifications',
    label: 'Notifications',
  },
  { name: 'Saved', icon: 'bookmark-outline', activeIcon: 'bookmark', label: 'Saved' },
  { name: 'Profile', icon: 'person-outline', activeIcon: 'person', label: 'Profile' },
];

export function AppHeader({
  wide,
  activeTab,
  onNavigate,
  onOpenSettings,
}: {
  wide: boolean;
  activeTab: TabName;
  onNavigate: (tab: TabName) => void;
  onOpenSettings: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile } = useViewer();
  const showSearch = wide && width >= 1200;
  const retroChrome = p.era !== 'newfacebook';
  const pressedBackground = retroChrome ? p.chromePressed : p.bg;
  const searchBackground = retroChrome ? p.chromeField : p.bg;
  const brandColour = retroChrome ? p.chromeText : p.accent;
  const markBackground = retroChrome ? p.chromeText : p.accent;
  const markForeground = retroChrome ? p.chrome : p.onAccent;

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: p.chrome,
          borderBottomColor: p.chromeBorder,
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={styles.inner}>
        <View style={styles.left}>
          <Pressable
            onPress={() => onNavigate('Home')}
            accessibilityRole="button"
            accessibilityLabel="Balla home"
            style={({ pressed }) => [styles.brand, { opacity: pressed ? 0.7 : 1 }]}
          >
            <View
              style={[
                styles.mark,
                {
                  backgroundColor: markBackground,
                  borderRadius: retroChrome ? 2 : 18,
                },
              ]}
            >
              <Text style={[styles.markLetter, { color: markForeground }]}>b</Text>
            </View>
            <Text style={[styles.wordmark, { color: brandColour }]}>balla</Text>
          </Pressable>

          {showSearch ? (
            <Pressable
              onPress={() => onNavigate('Search')}
              accessibilityRole="button"
              accessibilityLabel="Search Bluesky"
              style={({ pressed }) => [
                styles.search,
                { backgroundColor: searchBackground, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Ionicons name="search" size={17} color={p.chromeMuted} />
              <Text style={{ color: p.chromeMuted, fontSize: 15, marginLeft: 8 }}>
                Search Bluesky
              </Text>
            </Pressable>
          ) : null}
        </View>

        {wide ? (
          <View style={styles.centerNav}>
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
                    styles.navItem,
                    active && { borderBottomColor: p.chromeAction },
                    { opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Ionicons
                    name={active ? item.activeIcon : item.icon}
                    size={24}
                    color={active ? p.chromeAction : p.chromeMuted}
                  />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.right}>
          {!wide ? (
            <>
              <Pressable
                onPress={() => onNavigate('Search')}
                accessibilityRole="button"
                accessibilityLabel="Search"
                style={({ pressed }) => [
                  styles.iconButton,
                  { backgroundColor: pressed ? pressedBackground : 'transparent' },
                ]}
              >
                <Ionicons name="search" size={22} color={p.chromeMuted} />
              </Pressable>
              <Pressable
                onPress={() => onNavigate('Notifications')}
                accessibilityRole="button"
                accessibilityLabel="Notifications"
                style={({ pressed }) => [
                  styles.iconButton,
                  { backgroundColor: pressed ? pressedBackground : 'transparent' },
                ]}
              >
                <Ionicons name="notifications-outline" size={22} color={p.chromeMuted} />
              </Pressable>
            </>
          ) : null}
          <Pressable
            onPress={onOpenSettings}
            accessibilityRole="button"
            accessibilityLabel="Settings and privacy"
            style={({ pressed }) => [
              styles.iconButton,
              { backgroundColor: pressed ? pressedBackground : 'transparent' },
            ]}
          >
            <Ionicons name="settings-outline" size={22} color={p.chromeMuted} />
          </Pressable>
          <Pressable
            onPress={() => onNavigate('Profile')}
            accessibilityRole="button"
            accessibilityLabel="Your profile"
            style={({ pressed }) => [styles.avatarButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Avatar
              avatar={profile && profile.avatar}
              displayName={(profile && (profile.displayName || profile.handle)) || 'You'}
              size={34}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  inner: {
    width: '100%',
    maxWidth: 1600,
    alignSelf: 'center',
    height: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  mark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markLetter: {
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 32,
    marginTop: -2,
  },
  wordmark: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -1,
    marginLeft: 8,
  },
  search: {
    minHeight: 44,
    width: 240,
    borderRadius: 20,
    marginLeft: 16,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  centerNav: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: 56,
  },
  navItem: {
    width: 88,
    height: 56,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
});
