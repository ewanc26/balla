import React, { useLayoutEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePreferences } from '../lib/preferences';
import {
  ACCENT_COLOURS,
  DARK_THEMES,
  FACEBOOK_ERAS,
  FONT_SCALES,
  buildPalette,
  eraFor,
  type ColorScheme,
  type DarkThemeId,
  type FontScaleId,
  type Palette,
} from '../lib/themeModel';
import { CARD_RADIUS, cardShadow, usePalette, useResolvedScheme } from '../theme';
import { BrandMark } from '../components/BrandMark';
import {
  SettingChoice,
  SettingSection,
  SettingSwitch,
} from '../components/SettingControls';

export function AppearanceScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const {
    preferences,
    setAccent,
    setEra,
    setColourMode,
    setDarkTheme,
    setFontScale,
    setShowMusicActivity,
  } = usePreferences();
  const scheme: ColorScheme = useResolvedScheme();
  const selectedEra = eraFor(preferences.era);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Appearance' });
  }, [navigation]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <View
        style={[
          styles.intro,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <View style={[styles.introIcon, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="color-palette-outline" size={22} color={p.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>
            {selectedEra.label}
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
            {selectedEra.years} · Appearance is stored on this device only.
          </Text>
        </View>
      </View>

      <SettingSection title="Colour mode">
        <SettingChoice
          label="Appearance"
          options={[
            { value: 'system', label: 'Follow system', detail: 'Use your device setting.' },
            { value: 'light', label: 'Light', detail: 'Always use the light palette.' },
            { value: 'dark', label: 'Dark', detail: 'Always use the dark palette.' },
          ]}
          value={preferences.colourMode}
          onChange={setColourMode}
        />
      </SettingSection>

      {scheme === 'dark' ? (
        <SettingSection title="Dark theme" detail="Dim or Dark">
          <SettingChoice
            label="Dark theme"
            options={DARK_THEMES.map((value) => ({
              value,
              label: value === 'dim' ? 'Dim' : 'Dark',
              detail:
                value === 'dim'
                  ? 'Softer surfaces with the same contrast.'
                  : 'Full dark palette.',
            }))}
            value={preferences.darkTheme}
            onChange={(value: DarkThemeId) => setDarkTheme(value)}
          />
        </SettingSection>
      ) : null}

      <SettingSection title="Text size" detail="Post and composer text">
        <SettingChoice
          label="Reading size"
          options={FONT_SCALES.map((scale) => ({
            value: scale,
            label:
              scale === 'small' ? 'Small' : scale === 'large' ? 'Large' : 'Default',
          }))}
          value={preferences.fontScale}
          onChange={(value: FontScaleId) => setFontScale(value)}
        />
      </SettingSection>

      <SettingSection title="Music activity" detail="On profiles">
        <SettingSwitch
          label="Show recent plays"
          detail="A compact strip from public teal.fm records in a profile’s repository. Nothing is written or stored by Balla."
          value={preferences.showMusicActivity}
          onChange={setShowMusicActivity}
        />
      </SettingSection>

      <Section title="Accent colour" detail="9 solid colours">
        <View
          style={[
            styles.panel,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <View style={styles.accentGrid}>
            {ACCENT_COLOURS.map((colour) => {
              const selected = preferences.accent === colour.id;
              const swatch = buildPalette(scheme, {
                ...preferences,
                accent: colour.id,
              });
              return (
                <Pressable
                  key={colour.id}
                  onPress={() => setAccent(colour.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${colour.label} accent`}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.accentCell,
                    { opacity: pressed ? 0.65 : 1 },
                  ]}
                >
                  <View
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: swatch.accent,
                        borderColor: selected ? p.text : 'transparent',
                      },
                    ]}
                  >
                    {selected ? (
                      <Ionicons name="checkmark" size={21} color={swatch.onAccent} />
                    ) : null}
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: selected ? p.accent : p.secondary,
                      fontSize: 11,
                      fontWeight: selected ? '700' : '600',
                      marginTop: 5,
                    }}
                  >
                    {colour.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Section>

      <Section title="Facebook era" detail="Chrome and canvas">
        {FACEBOOK_ERAS.map((era) => {
          const selected = preferences.era === era.id;
          const preview = buildPalette(scheme, {
            ...preferences,
            era: era.id,
          });
          return (
            <Pressable
              key={era.id}
              onPress={() => setEra(era.id)}
              accessibilityRole="button"
              accessibilityLabel={`${era.label} era, ${era.years}`}
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.eraCard,
                {
                  backgroundColor: p.card,
                  borderColor: selected ? p.accent : p.divider,
                  opacity: pressed ? 0.72 : 1,
                },
                cardShadow,
              ]}
            >
              <EraPreview palette={preview} />
              <View style={styles.eraBody}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
                    {era.label}{' '}
                    <Text style={{ color: p.secondary, fontSize: 12, fontWeight: '600' }}>
                      {era.years}
                    </Text>
                  </Text>
                  <Text
                    style={{
                      color: p.secondary,
                      fontSize: 12,
                      lineHeight: 17,
                      marginTop: 2,
                    }}
                  >
                    {era.description}
                  </Text>
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
              </View>
            </Pressable>
          );
        })}
      </Section>

      <View style={styles.footnote}>
        <Ionicons name="information-circle-outline" size={16} color={p.secondary} />
        <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 17, flex: 1 }}>
          Era styling follows published Facebook design history from 2004, 2006,
          2011 and 2020. These are visual references only, not an affiliation
          with or endorsement by Meta. Colours are Balla’s own accessible
          approximations; no Facebook logos or assets are used. Following always
          stays chronological.
        </Text>
      </View>
    </ScrollView>
  );
}

function Section({
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
      <View style={styles.sectionHeading}>
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700', flex: 1 }}>
          {title}
        </Text>
        {detail ? (
          <Text style={{ color: p.secondary, fontSize: 12 }}>{detail}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function EraPreview({ palette }: { palette: Palette }) {
  const newFacebook = palette.era === 'newfacebook';
  return (
    <View
      style={[
        styles.preview,
        { backgroundColor: palette.bg, borderColor: palette.divider },
      ]}
    >
      <View
        style={[
          styles.previewChrome,
          {
            backgroundColor: palette.chrome,
            borderBottomColor: palette.chromeBorder,
          },
        ]}
      >
        <BrandMark
          size={16}
          background={newFacebook ? palette.accent : palette.chromeText}
          foreground={newFacebook ? palette.onAccent : palette.chrome}
          square={!newFacebook}
        />
        <Text
          style={{
            color: newFacebook ? palette.accent : palette.chromeText,
            fontSize: 10,
            fontWeight: '800',
            marginLeft: 4,
          }}
        >
          balla
        </Text>
        <View style={{ flex: 1 }} />
        <View
          style={[styles.previewDot, { backgroundColor: palette.chromeAction }]}
        />
        <View
          style={[styles.previewDot, { backgroundColor: palette.chromeMuted }]}
        />
      </View>
      <View style={styles.previewCanvas}>
        <View
          style={[
            styles.previewCard,
            { backgroundColor: palette.card, borderColor: palette.divider },
          ]}
        >
          <View
            style={[styles.previewAvatar, { backgroundColor: palette.accent }]}
          />
          <View style={{ flex: 1, gap: 4 }}>
            <View
              style={[styles.previewLine, { backgroundColor: palette.text }]}
            />
            <View
              style={[styles.previewLineShort, { backgroundColor: palette.secondary }]}
            />
          </View>
        </View>
        <View
          style={[
            styles.previewCard,
            { backgroundColor: palette.card, borderColor: palette.divider },
          ]}
        >
          <View
            style={[styles.previewAvatar, { backgroundColor: palette.accentSoft }]}
          />
          <View style={{ flex: 1, gap: 4 }}>
            <View
              style={[styles.previewLine, { backgroundColor: palette.secondary }]}
            />
            <View
              style={[styles.previewLineShort, { backgroundColor: palette.divider }]}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginHorizontal: 8,
    marginBottom: 16,
    padding: 14,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  introIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  panel: {
    marginHorizontal: 8,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
  },
  accentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  accentCell: {
    width: '33.333%',
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eraCard: {
    marginHorizontal: 8,
    marginBottom: 9,
    borderRadius: CARD_RADIUS,
    borderWidth: 2,
    overflow: 'hidden',
  },
  eraBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  radio: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    margin: 9,
    marginBottom: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    overflow: 'hidden',
  },
  previewChrome: {
    height: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 5,
  },
  previewCanvas: {
    padding: 7,
    gap: 5,
  },
  previewCard: {
    height: 29,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  previewAvatar: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
  },
  previewLine: {
    height: 3,
    borderRadius: 2,
    width: '58%',
    opacity: 0.8,
  },
  previewLineShort: {
    height: 3,
    borderRadius: 2,
    width: '78%',
    opacity: 0.55,
  },
  footnote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    paddingHorizontal: 18,
    marginTop: 2,
  },
});
