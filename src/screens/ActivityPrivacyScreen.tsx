import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { usePalette, CARD_RADIUS } from '../theme';
import {
  ALLOW_OPTIONS,
  loadActivityPrivacy,
  setActivityPrivacy,
  type AllowSubscriptions,
} from '../lib/activityPrivacy';

/** Who may opt in to notifications about your posts and replies. */
export function ActivityPrivacyScreen() {
  const p = usePalette();
  const navigation = useNavigation();
  const [value, setValue] = useState<AllowSubscriptions | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadActivityPrivacy()
      .then((next) => {
        if (active) setValue(next);
      })
      .catch(() => {
        if (active) setValue('followers');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    navigation.setOptions?.({ title: 'Activity privacy' });
  }, [navigation]);

  async function choose(next: AllowSubscriptions) {
    if (busy || next === value) return;
    const previous = value;
    setValue(next);
    setBusy(true);
    setError(null);
    try {
      await setActivityPrivacy(next);
    } catch {
      setValue(previous);
      setError('Could not save this preference. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ backgroundColor: p.bg }} contentContainerStyle={styles.content}>
      <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
        This controls who can opt in to notifications for your new posts and
        replies. It is stored in your account's published notification
        declaration, so it applies to every client.
      </Text>
      {ALLOW_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => void choose(option.value)}
            disabled={busy}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled: busy }}
            style={({ pressed }) => [
              styles.row,
              {
                borderColor: selected ? p.accent : p.divider,
                backgroundColor: selected ? p.accentSoft : p.card,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={selected ? p.accent : p.secondary}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
                {option.label}
              </Text>
              <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 18, marginTop: 3 }}>
                {option.detail}
              </Text>
            </View>
            {busy && selected ? <ActivityIndicator color={p.accent} /> : null}
          </Pressable>
        );
      })}
      {error ? <Text style={{ color: p.danger, fontSize: 13, marginTop: 12 }}>{error}</Text> : null}
      <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 18 }}>
        People subscribed to your activity can be reviewed and removed from the
        official client; Balla does not expose that inbox.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16 },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
});
