import React, { useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAccountPreferences } from '../lib/accountPreferences';
import { describeFailure } from '../lib/reliability';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

/**
 * Mirrors the official client's verification display preference. This only
 * hides locally rendered badges; verified status still comes from Bluesky's
 * verification records and cannot be granted or removed here.
 */
export function VerificationSettingsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const { settings, loading, error, saveVerificationBadges } = useAccountPreferences();
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Verification settings' });
  }, [navigation]);

  const [hide, setHide] = React.useState(false);
  React.useEffect(() => {
    setHide(settings.hideVerificationBadges);
  }, [settings.hideVerificationBadges]);

  async function choose(next: boolean) {
    if (busy || next === hide) return;
    setBusy(true);
    setSaveError(null);
    const previous = hide;
    setHide(next);
    try {
      await saveVerificationBadges(next);
    } catch (err) {
      setHide(previous);
      setSaveError(describeFailure(err, 'Could not save that choice.'));
    } finally {
      setBusy(false);
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
          <Ionicons name="shield-checkmark-outline" size={22} color={p.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>
            Verification badges
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
            Choose whether verified and trusted-verifier badges appear on profiles. Bluesky decides who is verified; this setting only changes what Balla shows you.
          </Text>
        </View>
      </View>

      {loading ? (
        <Text style={{ color: p.secondary, fontSize: 13, padding: 16 }}>
          Loading your preference…
        </Text>
      ) : null}
      {(error || saveError) ? (
        <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 13, padding: 16 }}>
          {saveError || error}
        </Text>
      ) : null}

      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}>
        <ChoiceRow
          label="Show badges"
          detail="Display verification and verifier badges on profiles"
          selected={!hide}
          disabled={busy}
          onPress={() => void choose(false)}
        />
        <ChoiceRow
          label="Hide badges"
          detail="Do not display verification badges anywhere"
          selected={hide}
          disabled={busy}
          onPress={() => void choose(true)}
        />
      </View>
    </ScrollView>
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
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={selected ? p.accent : p.secondary}
      />
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
    marginTop: 18,
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
});
