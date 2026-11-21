import React, { useLayoutEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePreferences } from '../lib/preferences';
import {
  LANGUAGE_OPTIONS,
  MAX_POST_LANGUAGES,
  languageSummary,
} from '../lib/postOptions';
import {
  SettingChoice,
  SettingNote,
  SettingSection,
} from '../components/SettingControls';
import { CARD_RADIUS, usePalette } from '../theme';

/** Local language choices. No invented server preference or UI translation. */
export function LanguageSettingsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const {
    preferences,
    setPrimaryLanguage,
    setContentLanguages,
  } = usePreferences();

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Languages' });
  }, [navigation]);

  const content = preferences.contentLanguages;
  const atCap = content.length >= MAX_POST_LANGUAGES;

  function toggleContent(code: string) {
    if (content.includes(code)) {
      setContentLanguages(content.filter((item) => item !== code));
    } else if (!atCap) {
      setContentLanguages([...content, code]);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={styles.content}
    >
      <SettingSection
        title="Primary language"
        detail="Used as the first language on new posts and as the target for Translate post."
      >
        <SettingChoice
          label="New posts and translation"
          options={LANGUAGE_OPTIONS.map((option) => ({
            value: option.code,
            label: option.label,
          }))}
          value={preferences.primaryLanguage}
          onChange={setPrimaryLanguage}
        />
      </SettingSection>

      <SettingSection
        title="Content languages"
        detail={`${content.length ? languageSummary(content) : 'All languages'}. Choose up to ${MAX_POST_LANGUAGES}.`}
      >
        {LANGUAGE_OPTIONS.map((option, index) => {
          const selected = content.includes(option.code);
          const disabled = !selected && atCap;
          return (
            <Pressable
              key={option.code}
              onPress={() => toggleContent(option.code)}
              disabled={disabled}
              accessibilityRole="checkbox"
              accessibilityLabel={option.label}
              accessibilityState={{ checked: selected, disabled }}
              aria-checked={selected}
              style={({ pressed }) => [
                styles.languageRow,
                index > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: p.divider,
                },
                { opacity: pressed || disabled ? 0.55 : 1 },
              ]}
            >
              <Text style={{ color: selected ? p.accent : p.text, fontSize: 15, flex: 1 }}>
                {option.label}
              </Text>
              <View
                style={[
                  styles.checkbox,
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
      </SettingSection>

      <SettingNote>
        Balla's interface is in English; these settings do not translate it.
        Content languages hide tagged posts in Following when none of their
        tags match. Untagged posts stay, and en also matches en-GB.
      </SettingNote>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 32 },
  languageRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: CARD_RADIUS,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
});
