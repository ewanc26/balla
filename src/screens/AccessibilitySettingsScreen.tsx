import React, { useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { usePreferences } from '../lib/preferences';
import {
  SettingNote,
  SettingSection,
  SettingSwitch,
} from '../components/SettingControls';
import { usePalette } from '../theme';

/** Accessibility choices that change what Balla draws, not what it claims. */
export function AccessibilitySettingsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const { preferences, setRequireAltText, setLargerAltBadges } = usePreferences();

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Accessibility' });
  }, [navigation]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={styles.content}
    >
      <SettingSection title="Descriptions">
        <SettingSwitch
          label="Require alt text before posting"
          detail="Blocks an image, video or GIF post until you describe it."
          value={preferences.requireAltText}
          onChange={setRequireAltText}
        />
        <View style={[styles.divider, { backgroundColor: p.divider }]} />
        <SettingSwitch
          label="Larger description badges"
          detail="Makes the ALT badge on described images and video easier to see."
          value={preferences.largerAltBadges}
          onChange={setLargerAltBadges}
        />
      </SettingSection>

      <SettingNote>
        Touch targets are at least 44pt, focus is visible on the web, and motion
        follows your device's reduced-motion setting. These are always on, so
        there is no toggle to break them. Balla does not emit haptic feedback,
        so a haptics preference would do nothing.
      </SettingNote>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 32 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 14 },
});
