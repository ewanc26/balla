import React, { useLayoutEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text } from 'react-native';
import { useViewPreferences } from '../lib/viewPreferences';
import {
  SettingChoice,
  SettingNote,
  SettingSection,
} from '../components/SettingControls';
import { usePalette } from '../theme';
import type { ThreadSort } from '../lib/viewPreferencesModel';

const SORTS: readonly { value: ThreadSort; label: string; detail: string }[] = [
  {
    value: 'oldest',
    label: 'Oldest first',
    detail: 'Replies in the order they were posted.',
  },
  {
    value: 'newest',
    label: 'Newest first',
    detail: 'Most recent replies at the top of each branch.',
  },
  {
    value: 'most-likes',
    label: 'Most liked',
    detail: 'Replies with more likes first, then oldest first.',
  },
];

/** Editor for the threadViewPref.sort value Balla can render from AppView data. */
export function ThreadPreferencesScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const { threadSort, loading, error, saveThreadSort } = useViewPreferences();
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Thread order' });
  }, [navigation]);

  async function change(sort: ThreadSort) {
    if (busy || sort === threadSort) return;
    setBusy(true);
    try {
      await saveThreadSort(sort);
    } catch {
      // The provider rolls back and shows the error.
    } finally {
      setBusy(false);
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
        title="Replies"
        detail="Saved to your Bluesky preferences and applied to every branch of a thread."
      >
        <SettingChoice
          label="Order"
          options={SORTS}
          value={threadSort}
          onChange={(sort) => void change(sort)}
          busy={busy}
        />
      </SettingSection>

      <SettingNote>
        Balla always shows replies under the post they answer, so there is no
        tree-view toggle. It does not embed third-party players, so there is no
        external-media preference to change.
      </SettingNote>
    </ScrollView>
  );
}
