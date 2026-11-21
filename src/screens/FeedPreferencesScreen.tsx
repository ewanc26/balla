import React, { useLayoutEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useViewPreferences } from '../lib/viewPreferences';
import {
  SettingNote,
  SettingSection,
  SettingSwitch,
} from '../components/SettingControls';
import { usePalette } from '../theme';

/** Editor for the app.bsky.actor.defs#feedViewPref values Balla honours. */
export function FeedPreferencesScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const { feedFilters, loading, error, saveFeedFilters } = useViewPreferences();
  const [busy, setBusy] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Following feed' });
  }, [navigation]);

  async function change(key: keyof typeof feedFilters, value: boolean) {
    if (busy) return;
    setBusy(key);
    try {
      await saveFeedFilters({ [key]: value });
    } catch {
      // The provider rolls back and shows the error; keep the toggle usable.
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      {loading ? <ActivityIndicator style={{ marginVertical: 18 }} color={p.accent} /> : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: p.danger, fontSize: 13, lineHeight: 19, marginHorizontal: 18, marginBottom: 8 }}
        >
          {error}
        </Text>
      ) : null}

      <SettingSection
        title="Hide from Following"
        detail="These filters are saved to your Bluesky preferences and apply only in Following."
      >
        <SettingSwitch
          label="Replies"
          detail="Hide posts that reply to another post."
          value={feedFilters.hideReplies}
          onChange={(value) => void change('hideReplies', value)}
          busy={busy === 'hideReplies'}
        />
        <SettingDivider />
        <SettingSwitch
          label="Reposts"
          detail="Hide posts someone else reposted."
          value={feedFilters.hideReposts}
          onChange={(value) => void change('hideReposts', value)}
          busy={busy === 'hideReposts'}
        />
        <SettingDivider />
        <SettingSwitch
          label="Quote posts"
          detail="Hide posts that quote another post."
          value={feedFilters.hideQuotePosts}
          onChange={(value) => void change('hideQuotePosts', value)}
          busy={busy === 'hideQuotePosts'}
        />
      </SettingSection>

      <SettingNote>
        Hiding something here changes what appears, not the order of what
        remains. Following stays chronological. Saved feeds keep the order their
        generators return.
      </SettingNote>
    </ScrollView>
  );
}

function SettingDivider() {
  const p = usePalette();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: p.divider,
        marginLeft: 14,
      }}
    />
  );
}
