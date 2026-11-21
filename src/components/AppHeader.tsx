import React from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '../theme';

export type TabName = 'Home' | 'Search' | 'Notifications' | 'Saved' | 'Profile';

export function AppHeader({
  wide,
  onNavigate,
  onOpenSettings,
}: {
  wide: boolean;
  onNavigate: (tab: TabName) => void;
  onOpenSettings: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
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

        {/* The left rail owns tab, profile and settings actions on desktop;
            the bottom tabs own them on mobile. Repeating either set here would
            put the same controls in two places at once. */}
        <View style={styles.right}>
          {!wide ? (
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
