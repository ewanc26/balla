import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';
import { touchTargetStyle } from '../lib/accessibility';

/** Shared, labelled 44pt controls for the preference editors. */

export function SettingSection({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: React.ReactNode;
}) {
  const p = usePalette();
  return (
    <View style={{ marginBottom: 18 }}>
      <Text
        accessibilityRole="header"
        style={{ color: p.text, fontSize: 17, fontWeight: '700', marginHorizontal: 18, marginBottom: 7 }}
      >
        {title}
      </Text>
      {detail ? (
        <Text
          style={{
            color: p.secondary,
            fontSize: 12,
            lineHeight: 17,
            marginHorizontal: 18,
            marginBottom: 9,
          }}
        >
          {detail}
        </Text>
      ) : null}
      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function SettingSwitch({
  label,
  detail,
  value,
  onChange,
  busy = false,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  busy?: boolean;
}) {
  const p = usePalette();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>{label}</Text>
        {detail ? (
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => onChange(!value)}
        disabled={busy}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value, busy }}
        aria-checked={value}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        style={({ pressed }) => [
          styles.switch,
          {
            backgroundColor: value ? p.accent : p.soft,
            opacity: pressed || busy ? 0.6 : 1,
          },
        ]}
      >
        <View
          style={[
            styles.knob,
            { backgroundColor: p.card, alignSelf: value ? 'flex-end' : 'flex-start' },
          ]}
        />
      </Pressable>
    </View>
  );
}

export function SettingLinkRow({
  icon,
  label,
  detail,
  value,
  onPress,
  danger = false,
  external = false,
}: {
  icon: any;
  label: string;
  detail?: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  external?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityHint={detail}
      style={({ pressed }) => [
        styles.linkRow,
        {
          borderBottomColor: p.divider,
          backgroundColor: pressed ? p.bg : 'transparent',
        },
      ]}
    >
      <View style={[styles.iconBubble, { backgroundColor: p.accentSoft }]}>
        <Ionicons name={icon} size={20} color={danger ? p.danger : p.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: danger ? p.danger : p.text, fontSize: 15, fontWeight: '700' }}>
          {label}
        </Text>
        {detail ? (
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
            {detail}
          </Text>
        ) : null}
        {value ? (
          <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name={external ? 'open-outline' : 'chevron-forward'}
        size={17}
        color={p.secondary}
      />
    </Pressable>
  );
}

export function SettingValueRow({ label, value }: { label: string; value: string }) {
  const p = usePalette();
  return (
    <View style={styles.valueRow}>
      <Text style={{ color: p.text, fontSize: 14, fontWeight: '600', minWidth: 128 }}>
        {label}
      </Text>
      <Text
        selectable
        style={{ color: p.secondary, fontSize: 12, lineHeight: 18, flex: 1, minWidth: 0 }}
      >
        {value || 'Not available'}
      </Text>
    </View>
  );
}

export type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  detail?: string;
};

export function SettingChoice<T extends string>({
  label,
  options,
  value,
  onChange,
  busy = false,
}: {
  label: string;
  options: readonly ChoiceOption<T>[];
  value: T;
  onChange: (value: T) => void;
  busy?: boolean;
}) {
  const p = usePalette();
  return (
    <View>
      <View style={styles.choiceHeading}>
        <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>{label}</Text>
      </View>
      {options.map((option, index) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            disabled={busy}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, busy }}
            aria-checked={selected}
            style={({ pressed }) => [
              styles.choiceRow,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider },
              { opacity: pressed || busy ? 0.65 : 1 },
            ]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: selected ? p.accent : p.text, fontSize: 15, fontWeight: '600' }}>
                {option.label}
              </Text>
              {option.detail ? (
                <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
                  {option.detail}
                </Text>
              ) : null}
            </View>
            <View
              style={[
                styles.radio,
                {
                  borderColor: selected ? p.accent : p.divider,
                  backgroundColor: selected ? p.accent : 'transparent',
                },
              ]}
            >
              {selected ? (
                <Ionicons name="checkmark" size={15} color={p.onAccent} />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SettingButton({
  label,
  onPress,
  busy = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: p.accent,
          opacity: pressed || busy || disabled ? 0.6 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={p.onAccent} />
      ) : (
        <Text style={{ color: p.onAccent, fontSize: 15, fontWeight: '700' }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function SettingNote({ children }: { children: React.ReactNode }) {
  const p = usePalette();
  return (
    <View style={styles.note}>
      <Ionicons name="information-circle-outline" size={16} color={p.secondary} />
      <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 17, flex: 1 }}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 8,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    ...touchTargetStyle,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  switch: {
    ...touchTargetStyle,
    borderRadius: 22,
    padding: 3,
    marginLeft: 10,
    justifyContent: 'center',
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  choiceHeading: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  choiceRow: {
    ...touchTargetStyle,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 18,
    marginBottom: 18,
  },
});
