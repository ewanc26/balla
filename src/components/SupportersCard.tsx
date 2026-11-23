/**
 * The only place in the app that asks for support (#163). It is static by
 * design: the linked page owns its own routes, so nothing is fetched, cached
 * or tracked here. The creator byline is the same component used everywhere
 * else, and the support URL comes from the one constant beside the service
 * hosts. No feed, thread or notification surface may link this URL.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CARD_RADIUS, usePalette } from '../theme';
import { openExternalUrl } from '../lib/openLink';
import { CREATOR } from '../lib/serviceHosts';
import { CreatorByline } from './CreatorByline';

export function SupportersCard() {
  const p = usePalette();

  return (
    <View
      accessibilityLabel="Support Balla"
      style={[styles.card, { backgroundColor: p.bg, borderColor: p.divider }]}
    >
      <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
        Balla is reader-supported
      </Text>
      <Text
        style={{
          color: p.secondary,
          fontSize: 13,
          lineHeight: 19,
          marginTop: 4,
        }}
      >
        Independent software, supported by readers. One-off or recurring
        support is handled at ewancroft.uk.
      </Text>
      <Pressable
        onPress={() => {
          void openExternalUrl(CREATOR.supportUrl).catch(() => {});
        }}
        accessibilityRole="button"
        accessibilityLabel="Support Balla"
        accessibilityHint="Opens the support page in your browser"
        style={({ pressed }) => [
          styles.button,
          { borderColor: p.accent, opacity: pressed ? 0.65 : 1 },
        ]}
      >
        <Ionicons name="heart-outline" size={18} color={p.accent} />
        <Text
          style={{
            color: p.accent,
            fontSize: 15,
            fontWeight: '700',
            marginLeft: 8,
          }}
        >
          Support Balla
        </Text>
      </Pressable>
      <View style={[styles.rule, { backgroundColor: p.divider }]} />
      <CreatorByline />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    padding: 14,
    marginTop: 18,
  },
  button: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 12,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginTop: 12,
    marginBottom: 6,
  },
});
