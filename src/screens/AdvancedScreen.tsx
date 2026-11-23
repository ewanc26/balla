import React, { useLayoutEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

/**
 * The Advanced submenu holds choices about the infrastructure Balla uses.
 * Only working controls are listed here; a link to an unfinished feature
 * would be an inert control and a false claim about what the app can do.
 */
export function AdvancedScreen({ navigation }: { navigation: any }) {
  const p = usePalette();

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Advanced' });
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
          <Ionicons name="options-outline" size={22} color={p.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>
            Infrastructure choices
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
            AT Protocol separates identities, repositories, AppViews and moderation
            services. Balla lists the choices it can actually honour here.
          </Text>
        </View>
      </View>

      <Section title="Moderation">
        <Row
          icon="shield-checkmark-outline"
          label="Labeler services"
          detail="Subscribe to third-party labelers and set per-label rules"
          onPress={() => navigation.navigate('ContentFilters', { section: 'labelers' })}
        />
      </Section>

      <Section title="Media">
        <Row
          icon="image-outline"
          label="Media origin"
          detail="Choose PDS-first image loading and manage the image cache"
          onPress={() => navigation.navigate('MediaOrigin')}
        />
      </Section>

      <Section title="Identity">
        <Row
          icon="finger-print-outline"
          label="Identity"
          detail="DID and handle resolution strategy, cached identities and offline reads"
          onPress={() => navigation.navigate('IdentitySettings')}
        />
      </Section>

      <Section title="Chat">
        <Row
          icon="chatbubble-ellipses-outline"
          label="Chat service"
          detail="Check whether this host can serve direct messages"
          onPress={() => navigation.navigate('ChatService')}
        />
      </Section>

      <View style={styles.footnote}>
        <Ionicons name="information-circle-outline" size={16} color={p.secondary} />
        <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 17, flex: 1 }}>
          Labels are advisory metadata from services you choose. Anyone can run a
          labeler. Your local filters, blocks and report receipts keep working if a
          labeler or the AppView is unavailable.
        </Text>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        style={{
          color: p.secondary,
          fontSize: 13,
          fontWeight: '700',
          paddingHorizontal: 18,
          marginBottom: 6,
        }}
      >
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}>
        {children}
      </View>
    </View>
  );
}

function Row({
  icon,
  label,
  detail,
  onPress,
}: {
  icon: string;
  label: string;
  detail?: string;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? p.bg : 'transparent' },
      ]}
    >
      <Ionicons name={icon as any} size={20} color={p.accent} />
      <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
        <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>{label}</Text>
        {detail ? (
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={16} color={p.secondary} />
    </Pressable>
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
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  footnote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    paddingHorizontal: 18,
    marginTop: 2,
  },
});
