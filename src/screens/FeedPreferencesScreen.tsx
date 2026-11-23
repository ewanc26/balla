import React, { useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useViewPreferences } from '../lib/viewPreferences';
import { usePreferences } from '../lib/preferences';
import { useViewer } from '../lib/viewer';
import { endSnooze, useSnoozedAccounts } from '../lib/snooze';
import { activeSnoozes, snoozeRemainingLabel } from '../lib/snoozeModel';
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
  const { preferences, setMemoriesEnabled } = usePreferences();
  const { profile } = useViewer();
  const memoriesPreference = profile?.did
    ? preferences.memories[profile.did]
    : undefined;
  const snoozedAccounts = useSnoozedAccounts();
  const snoozedList = activeSnoozes(snoozedAccounts, Date.now());
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

      <SettingSection
        title="Memories"
        detail="Off by default, and stored on this device for this account. This is not a Bluesky preference."
      >
        <SettingSwitch
          label="On this day"
          detail="Show your own posts from this date in past years. Only public records in your repository are read, and only while this is on. No notifications, badges or engagement counts."
          value={!!memoriesPreference?.enabled}
          onChange={(value) => {
            if (profile?.did) setMemoriesEnabled(profile.did, value);
          }}
        />
      </SettingSection>

      <SettingSection
        title="Snoozed accounts"
        detail="Home hides these accounts until each 30-day snooze ends. Snoozes are device-local and do not follow your account to other devices."
      >
        {snoozedList.length === 0 ? (
          <Text
            style={{
              color: p.secondary,
              fontSize: 13,
              lineHeight: 19,
              paddingHorizontal: 14,
              paddingVertical: 14,
            }}
          >
            No snoozed accounts.
          </Text>
        ) : (
          snoozedList.map((item) => (
            <View
              key={item.did}
              style={[styles.snoozeRow, { borderTopColor: p.divider }]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{ color: p.text, fontSize: 15, fontWeight: '600' }}
                >
                  {item.handle ? `@${item.handle}` : item.did}
                </Text>
                <Text style={{ color: p.secondary, fontSize: 12, marginTop: 1 }}>
                  Snoozed, {snoozeRemainingLabel(item.until, Date.now())}
                </Text>
              </View>
              <Pressable
                onPress={() => void endSnooze(item.did)}
                accessibilityRole="button"
                accessibilityLabel={`End snooze for ${
                  item.handle ? `@${item.handle}` : item.did
                }`}
                accessibilityHint="Show this account in Home again now."
                style={({ pressed }) => [
                  styles.endButton,
                  { borderColor: p.accent, opacity: pressed ? 0.65 : 1 },
                ]}
              >
                <Text style={{ color: p.accent, fontSize: 13, fontWeight: '700' }}>
                  End snooze
                </Text>
              </Pressable>
            </View>
          ))
        )}
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

const styles = StyleSheet.create({
  snoozeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  endButton: {
    minHeight: 44,
    minWidth: 120,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
