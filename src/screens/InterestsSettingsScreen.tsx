import React, { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAccountPreferences } from '../lib/accountPreferences';
import { normaliseInterests } from '../lib/accountPreferencesModel';
import { describeFailure } from '../lib/reliability';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';

/**
 * Interests are an `app.bsky.actor.defs#interestsPref` value. Balla edits the
 * tag list the AppView and feed generators already read; it does not pretend
 * to control provider-side ranking or recommendations.
 */
export function InterestsSettingsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const { settings, loading, error, saveInterests } = useAccountPreferences();
  const [tags, setTags] = useState<string[]>(settings.interests);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Your interests' });
  }, [navigation]);

  React.useEffect(() => {
    setTags(settings.interests);
  }, [settings.interests]);

  const changed =
    normaliseInterests(tags).join('\u0000') !==
    normaliseInterests(settings.interests).join('\u0000');

  function addTag() {
    const value = normaliseInterests([draft])[0];
    if (!value || tags.includes(value) || tags.length >= 30) return;
    setTags((prev) => [...prev, value]);
    setDraft('');
    setNotice(null);
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((item) => item !== tag));
    setNotice(null);
  }

  async function save() {
    if (saving || !changed) return;
    setSaving(true);
    setSaveError(null);
    setNotice(null);
    const previous = settings.interests;
    try {
      await saveInterests(tags);
      setNotice('Interests saved.');
    } catch (err) {
      setTags(previous);
      setSaveError(describeFailure(err, 'Could not save your interests.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <View
        style={[styles.intro, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}
      >
        <View style={[styles.introIcon, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="bulb-outline" size={22} color={p.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>Your interests</Text>
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
            Topics you care about help Bluesky's app view and feed generators choose what to show you. Balla stores the list on your account.
          </Text>
        </View>
      </View>

      {loading ? (
        <Text style={{ color: p.secondary, fontSize: 13, padding: 16 }}>Loading your interests…</Text>
      ) : null}
      {(error || saveError) ? (
        <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 13, padding: 16 }}>
          {saveError || error}
        </Text>
      ) : null}
      {notice ? (
        <Text style={{ color: p.green, fontSize: 13, padding: 16 }}>{notice}</Text>
      ) : null}

      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}>
        <View style={[styles.addRow, { borderBottomColor: p.divider }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addTag}
            placeholder="Add an interest, e.g. photography"
            placeholderTextColor={p.secondary}
            accessibilityLabel="Add an interest"
            style={[{ color: p.text, flex: 1, fontSize: 15, minHeight: 44 }, webInputReset]}
          />
          <Pressable
            onPress={addTag}
            disabled={!draft.trim() || tags.length >= 30}
            accessibilityRole="button"
            accessibilityLabel="Add interest"
            style={({ pressed }) => ({
              minHeight: 40,
              paddingHorizontal: 14,
              borderRadius: 20,
              backgroundColor: draft.trim() && tags.length < 30 ? p.accent : p.divider,
              opacity: pressed ? 0.8 : 1,
              alignItems: 'center',
              justifyContent: 'center',
            })}
          >
            <Ionicons name="add" size={20} color={draft.trim() && tags.length < 30 ? p.onAccent : p.secondary} />
          </Pressable>
        </View>
        {tags.length === 0 ? (
          <Text style={{ color: p.secondary, fontSize: 13, padding: 16 }}>
            No interests yet. Add a few topics to get started.
          </Text>
        ) : null}
        {tags.map((tag) => (
          <Pressable
            key={tag}
            onPress={() => removeTag(tag)}
            accessibilityRole="button"
            accessibilityLabel={`Remove interest ${tag}`}
            style={({ pressed }) => [styles.tagRow, { borderBottomColor: p.divider, opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={{ color: p.text, fontSize: 14, flex: 1 }}>#{tag}</Text>
            <Ionicons name="close-circle-outline" size={20} color={p.secondary} />
          </Pressable>
        ))}
      </View>

      <View style={{ paddingHorizontal: 16 }}>
        <Pressable
          onPress={() => void save()}
          disabled={!changed || saving}
          accessibilityRole="button"
          accessibilityLabel="Save interests"
          accessibilityState={{ disabled: !changed || saving, busy: saving }}
          style={({ pressed }) => [
            styles.save,
            {
              backgroundColor: changed && !saving ? p.accent : p.divider,
              opacity: pressed && changed && !saving ? 0.8 : 1,
            },
          ]}
        >
          <Text style={{ color: changed && !saving ? p.onAccent : p.secondary, fontWeight: '700', fontSize: 15 }}>
            {saving ? 'Saving…' : changed ? 'Save interests' : 'No changes'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
  },
  introIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginTop: 18,
    marginHorizontal: 16,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  save: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
});
