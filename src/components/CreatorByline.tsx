/**
 * Single source of truth for Balla's creator byline: "Balla by Ewan Croft",
 * handle `@ewancroft.uk`. Tapping it resolves the handle live through the
 * same identity resolution every profile link uses, then opens the author's
 * profile inside Balla. When resolution fails it falls back to the author's
 * web profile, so nothing is pinned to a DID or a current PDS host.
 *
 * Agent credits, if ever displayed, follow the repo's allowed-agents policy
 * (AGENTS.md): only Claude and Mistral Vibe may be credited as coding agents.
 */
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { openExternalUrl } from '../lib/openLink';
import { resolveHandleToDid } from '../lib/identityResolver';
import { CREATOR } from '../lib/serviceHosts';
import { usePalette } from '../theme';

export function CreatorByline() {
  const p = usePalette();
  const navigation = useNavigation<any>();

  async function onPress() {
    try {
      const did = await resolveHandleToDid(CREATOR.handle);
      if (did) {
        navigation.navigate('UserProfile', { actor: did });
        return;
      }
    } catch {
      // Fall through to the web profile: the byline must never dead-end.
    }
    void openExternalUrl(CREATOR.webProfile).catch(() => {});
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${CREATOR.name}'s profile`}
      accessibilityHint="Opens the author's Bluesky profile in Balla"
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.65 : 1 }]}
    >
      <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
        Balla by {CREATOR.name}
      </Text>
      <Text style={{ color: p.accent, fontSize: 13, fontWeight: '600' }}>
        @{CREATOR.handle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
});
