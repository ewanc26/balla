import React, { useLayoutEffect } from 'react';
import { ScrollView } from 'react-native';
import { usePreferences } from '../lib/preferences';
import {
  SettingLinkRow,
  SettingNote,
  SettingSection,
  SettingSwitch,
} from '../components/SettingControls';
import { usePalette } from '../theme';

/**
 * Parity with the official Content and Media settings screen.
 *
 * The linked screens are the real editors Balla already ships (saved feeds,
 * thread view, Following feed, interests, accessibility). The two toggles are
 * device-local choices, exactly as in the official client: there is no
 * app.bsky preference record for them. Trending topics/videos rows are omitted
 * because their visibility comes from a provider-owned config endpoint Balla
 * does not control, so a toggle would be a fake control.
 */
export function ContentAndMediaSettingsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const { preferences, setUseInAppBrowser, setDisableAutoplay } = usePreferences();

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Content and media' });
  }, [navigation]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <SettingSection title="Preferences">
        <SettingLinkRow
          icon="albums-outline"
          label="Manage saved feeds"
          detail="Pin feeds to Home and reorder them"
          onPress={() => navigation.navigate('Feeds')}
        />
        <SettingLinkRow
          icon="chatbox-outline"
          label="Thread preferences"
          detail="Reply order in threads"
          onPress={() => navigation.navigate('ThreadPreferences')}
        />
        <SettingLinkRow
          icon="home-outline"
          label="Following feed preferences"
          detail="Show replies, reposts and quote posts"
          onPress={() => navigation.navigate('FeedPreferences')}
        />
        <SettingLinkRow
          icon="heart-outline"
          label="Your interests"
          detail="Topics used to improve your feeds"
          onPress={() => navigation.navigate('InterestsSettings')}
        />
      </SettingSection>

      <SettingSection title="Media">
        <SettingSwitch
          label="Use in-app browser to open links"
          detail={
            preferences.useInAppBrowser === undefined
              ? 'Ask which browser to use the first time you open a link.'
              : preferences.useInAppBrowser
                ? 'Links open in Balla. Change this any time.'
                : 'Links open in your system browser.'
          }
          value={preferences.useInAppBrowser === true}
          onChange={(value) => setUseInAppBrowser(value)}
        />
        <SettingSwitch
          label="Autoplay videos and GIFs"
          detail="Play media automatically as you scroll."
          value={!preferences.disableAutoplay}
          onChange={(value) => setDisableAutoplay(!value)}
        />
      </SettingSection>

      <SettingSection title="Accessibility">
        <SettingLinkRow
          icon="accessibility-outline"
          label="Accessibility"
          detail="Alt text, alt badges and motion preferences"
          onPress={() => navigation.navigate('AccessibilitySettings')}
        />
      </SettingSection>

      <SettingNote>
        These media choices are stored on this device only, so they never change
        what other people see or sync to your Bluesky account.
      </SettingNote>
    </ScrollView>
  );
}
