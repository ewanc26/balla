import React, { useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAccountPreferences } from '../lib/accountPreferences';
import { describeGates, gatesEqual, normaliseGates, type InteractionGates } from '../lib/interactionGates';
import { REPLY_OPTIONS, QUOTE_OPTIONS } from '../lib/gateOptions';
import { ReplyListPicker } from '../components/ReplyListPicker';
import { describeFailure } from '../lib/reliability';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

/**
 * The official client's "Post Interaction Settings" defaults. These are
 * `app.bsky.actor.defs#postInteractionSettings` preference values used for new
 * posts; per-post gate records are still edited from the composer.
 */
export function DefaultInteractionSettingsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const { settings, loading, error, saveDefaultGates } = useAccountPreferences();
  const [gates, setGates] = useState<InteractionGates>(settings.defaultGates);
  const [saved, setSaved] = useState<InteractionGates>(settings.defaultGates);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Default interaction settings' });
  }, [navigation]);

  React.useEffect(() => {
    setGates(settings.defaultGates);
    setSaved(settings.defaultGates);
  }, [settings.defaultGates]);

  const changed = !gatesEqual(gates, saved);

  async function save() {
    if (saving || !changed) return;
    setSaving(true);
    setSaveError(null);
    setNotice(null);
    const previous = saved;
    try {
      await saveDefaultGates(gates);
      setSaved(normaliseGates(gates));
      setNotice('Default interaction settings saved.');
    } catch (err) {
      setGates(previous);
      setSaveError(describeFailure(err, 'Could not save these defaults.'));
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
          <Ionicons name="options-outline" size={22} color={p.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>New posts</Text>
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
            These become the starting reply and quote settings for every new post. You can still change them for a single post in the composer.
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={p.accent} />
          <Text style={{ color: p.secondary, fontSize: 13, marginTop: 8 }}>Loading your defaults…</Text>
        </View>
      ) : null}
      {(error || saveError) ? (
        <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 13, padding: 16 }}>
          {saveError || error}
        </Text>
      ) : null}
      {notice ? (
        <Text style={{ color: p.green, fontSize: 13, padding: 16 }}>{notice}</Text>
      ) : null}

      {!loading ? (
        <>
          <Section title="Who can reply">
            {REPLY_OPTIONS.map((option) => (
              <ChoiceRow
                key={option.value}
                label={option.label}
                detail={option.detail}
                selected={gates.reply === option.value}
                disabled={saving}
                onPress={() => {
                  setGates((prev) => ({ ...prev, reply: option.value }));
                  setNotice(null);
                }}
              />
            ))}
            {gates.reply === 'list' ? (
              <View style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                <ReplyListPicker
                  selected={gates.listUri || null}
                  onSelect={(listUri) => {
                    setGates((prev) => ({ ...prev, listUri }));
                    setNotice(null);
                  }}
                />
              </View>
            ) : null}
          </Section>

          <Section title="Quotes">
            {QUOTE_OPTIONS.map((option) => (
              <ChoiceRow
                key={option.value}
                label={option.label}
                detail={option.detail}
                selected={gates.quote === option.value}
                disabled={saving}
                onPress={() => {
                  setGates((prev) => ({ ...prev, quote: option.value }));
                  setNotice(null);
                }}
              />
            ))}
          </Section>

          <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
            <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18 }}>
              Current: {describeGates(saved)}
            </Text>
            <Pressable
              onPress={() => void save()}
              disabled={!changed || saving}
              accessibilityRole="button"
              accessibilityLabel="Save default interaction settings"
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
                {saving ? 'Saving…' : changed ? 'Save settings' : 'No changes'}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={{ color: p.secondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginHorizontal: 16, marginBottom: 6 }}>
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}>
        {children}
      </View>
    </View>
  );
}

function ChoiceRow({
  label,
  detail,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  detail: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={`${label}. ${detail}`}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [styles.choice, { backgroundColor: pressed ? p.bg : 'transparent' }]}
    >
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? p.accent : p.secondary} />
      <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
        <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}>{detail}</Text>
      </View>
    </Pressable>
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
    marginHorizontal: 16,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  choice: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  loading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  save: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
});
