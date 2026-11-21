import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '../theme';
import { HEADER_SEARCH_MIN_WIDTH } from '../lib/layout';
import { BrandMark } from './BrandMark';

export type TabName = 'Home' | 'Search' | 'Notifications' | 'Saved' | 'Profile';

export function AppHeader({
  wide,
  onNavigate,
  onOpenSettings,
  onOpenLists,
  onOpenFeeds,
}: {
  wide: boolean;
  onNavigate: (tab: TabName) => void;
  onOpenSettings: () => void;
  onOpenLists: () => void;
  onOpenFeeds: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const showSearch = wide && width >= HEADER_SEARCH_MIN_WIDTH;
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
            <BrandMark
              size={36}
              background={markBackground}
              foreground={markForeground}
              square={retroChrome}
            />
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

        {/* Tabs stay in exactly one place: the rail on desktop, the bottom bar
            on mobile. These are direct actions to destinations the bottom bar
            cannot show, so they are not a second copy of tab navigation. */}
        <View style={styles.right}>
          {!wide ? (
            <>
              <Pressable
                onPress={onOpenFeeds}
                accessibilityRole="button"
                accessibilityLabel="Manage feeds"
                style={({ pressed }) => [
                  styles.iconButton,
                  { backgroundColor: pressed ? pressedBackground : 'transparent' },
                ]}
              >
                <Ionicons name="albums-outline" size={22} color={p.chromeMuted} />
              </Pressable>
              <Pressable
                onPress={onOpenLists}
                accessibilityRole="button"
                accessibilityLabel="Lists"
                style={({ pressed }) => [
                  styles.iconButton,
                  { backgroundColor: pressed ? pressedBackground : 'transparent' },
                ]}
              >
                <Ionicons name="list-outline" size={22} color={p.chromeMuted} />
              </Pressable>
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
            </>
          ) : null}
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
});
