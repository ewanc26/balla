import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { SettingNote, SettingSection } from '../components/SettingControls';
import { CARD_RADIUS, usePalette } from '../theme';
import { APP_ICON_CHOICES, type AppIconChoice } from '../lib/appIconModel';
import {
  isAppIconSupported,
  readAppIconChoice,
  writeAppIconChoice,
} from '../lib/appIcon';

const DEFAULT_ICON =
  Platform.OS === 'android'
    ? require('../../assets/adaptive-icon.png')
    : require('../../assets/icon.png');
const DARK_ICON =
  Platform.OS === 'android'
    ? require('../../assets/app-icons/android_icon_legacy_dark.png')
    : require('../../assets/app-icons/ios_icon_legacy_dark.png');

const ICON_SOURCES: Record<AppIconChoice, any> = {
  default: DEFAULT_ICON,
  dark: DARK_ICON,
};

/** Device-local Light/Dark icon switcher, with the internal Bluesky+ set omitted. */
export function AppIconSettingsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const supported = isAppIconSupported();
  const [current, setCurrent] = useState<AppIconChoice>(() => readAppIconChoice());
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'App Icon' });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      setCurrent(readAppIconChoice());
    }, []),
  );

  const requestChange = useCallback(
    (next: AppIconChoice) => {
      if (!supported || busy || next === current) return;
      const label = APP_ICON_CHOICES.find((choice) => choice.value === next)?.label ?? next;
      const apply = () => {
        setBusy(true);
        void writeAppIconChoice(next)
          .then(setCurrent)
          .catch(() => {
            Alert.alert(
              'Could not change app icon',
              'This device did not apply the icon change. Please try again.',
            );
          })
          .finally(() => setBusy(false));
      };

      if (Platform.OS === 'android') {
        Alert.alert(
          `Change app icon to "${label}"`,
          'The app will be restarted.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'OK', style: 'default', onPress: apply },
          ],
        );
      } else {
        apply();
      }
    },
    [busy, current, supported],
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <SettingSection title="Default icons">
        {APP_ICON_CHOICES.map((choice) => (
          <AppIconRow
            key={choice.value}
            choice={choice.value}
            label={choice.label}
            detail={choice.detail}
            selected={choice.value === current}
            disabled={!supported || busy}
            onPress={() => requestChange(choice.value)}
            busy={busy}
          />
        ))}
      </SettingSection>

      <SettingNote>
        {supported
          ? 'This choice is stored by your device, not your Bluesky account. Android restarts Balla when the icon changes.'
          : 'App icons can only be changed in the native iOS or Android app.'}
      </SettingNote>
    </ScrollView>
  );
}

function AppIconRow({
  choice,
  label,
  detail,
  selected,
  disabled,
  busy,
  onPress,
}: {
  choice: AppIconChoice;
  label: string;
  detail: string;
  selected: boolean;
  disabled: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={`Set app icon to ${label}`}
      accessibilityState={{ selected, disabled, busy }}
      aria-checked={selected}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed && !disabled ? p.card : 'transparent' },
      ]}
    >
      <View
        style={[
          styles.tile,
          { backgroundColor: choice === 'dark' ? '#0E1420' : p.accent },
        ]}
      >
        <Image source={ICON_SOURCES[choice]} style={styles.image} resizeMode="contain" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: selected ? p.accent : p.text, fontSize: 15, fontWeight: '600' }}>
          {label}
        </Text>
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
          {detail}
        </Text>
      </View>
      {busy && selected ? (
        <ActivityIndicator size="small" color={p.accent} />
      ) : (
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={22}
          color={selected ? p.accent : p.divider}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 72,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  tile: {
    width: 46,
    height: 46,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: 42,
    height: 42,
  },
});
