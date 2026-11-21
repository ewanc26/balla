import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CARD_RADIUS, usePalette } from '../theme';
import { useModeration } from '../lib/moderationContext';
import { BSKY_LABELER_DID } from '../lib/moderation';

const LABEL_NAMES: Record<string, string> = {
  '!hide': 'Content blocked',
  '!warn': 'Content warning',
  '!no-unauthenticated': 'Sign-in required',
  porn: 'Adult content',
  sexual: 'Sexually suggestive',
  nudity: 'Nudity',
  'graphic-media': 'Graphic media',
  gore: 'Graphic media',
};

function labelDetails(
  cause: any,
  labelers: Record<string, string>
): { name: string; description?: string; source?: string } {
  const value = String(cause?.label?.val || '');
  const definition =
    cause?.labelDef?.locales?.find((locale: any) =>
      String(locale.lang || '').toLowerCase().startsWith('en')
    ) || cause?.labelDef?.locales?.[0];
  const did = cause?.source?.type === 'labeler' ? cause.source.did : undefined;
  const source = did
    ? labelers[did] || (did === BSKY_LABELER_DID ? 'Bluesky moderation' : 'a subscribed labeler')
    : undefined;
  return {
    name: definition?.name || LABEL_NAMES[value] || 'Content warning',
    description: definition?.description,
    source,
  };
}

export function ContentWarning({
  causes,
  noOverride,
  onReveal,
  compact,
  compactTitle = 'Media hidden',
}: {
  causes: any[];
  noOverride?: boolean;
  onReveal?: () => void;
  compact?: boolean;
  compactTitle?: string;
}) {
  const p = usePalette();
  const { labelers } = useModeration();
  const details = (causes || [])
    .filter((cause) => cause?.type === 'label')
    .map((cause) => labelDetails(cause, labelers));
  const unique = details.filter(
    (item, index) =>
      details.findIndex(
        (other) => other.name === item.name && other.source === item.source
      ) === index
  );
  const sources = Array.from(
    new Set(unique.map((item) => item.source).filter((source): source is string => !!source))
  );
  const title = unique[0]?.name || 'Content warning';
  const description =
    unique[0]?.description ||
    (noOverride
      ? 'This content has been hidden by moderators.'
      : 'This content has been labelled by moderators.');
  const canReveal = !!onReveal && !noOverride;

  if (compact) {
    return (
      <View
        style={[
          styles.compact,
          { backgroundColor: p.accentSoft, borderColor: p.divider },
        ]}
        accessibilityRole="alert"
      >
        <Ionicons name="eye-off-outline" size={20} color={p.accent} />
        <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
          <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>
            {compactTitle}
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}>
            {title}
            {sources.length ? ` · ${sources.join(', ')}` : ''}
          </Text>
        </View>
        {canReveal ? (
          <Pressable
            onPress={onReveal}
            accessibilityRole="button"
            accessibilityLabel="Show labelled media"
            style={({ pressed }) => [
              styles.reveal,
              { borderColor: p.accent, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Text style={{ color: p.accent, fontSize: 13, fontWeight: '700' }}>
              Show
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: p.accentSoft, borderColor: p.divider },
      ]}
      accessibilityRole="alert"
    >
      <View style={styles.heading}>
        <View style={[styles.icon, { backgroundColor: p.card }]}>
          <Ionicons name="eye-off-outline" size={20} color={p.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
            {title}
          </Text>
          <Text
            style={{
              color: p.secondary,
              fontSize: 13,
              lineHeight: 18,
              marginTop: 2,
            }}
          >
            {description}
          </Text>
          {sources.length ? (
            <Text style={{ color: p.secondary, fontSize: 11, marginTop: 4 }}>
              Labeled by {sources.join(', ')}
            </Text>
          ) : null}
        </View>
      </View>
      {unique.length > 1 ? (
        <Text style={{ color: p.secondary, fontSize: 12, marginTop: 8 }}>
          {unique
            .slice(1)
            .map((item) => item.name)
            .join(' · ')}
        </Text>
      ) : null}
      {canReveal ? (
        <Pressable
          onPress={onReveal}
          accessibilityRole="button"
          accessibilityLabel="Show content anyway"
          style={({ pressed }) => [
            styles.revealWide,
            { borderColor: p.accent, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Text style={{ color: p.accent, fontSize: 14, fontWeight: '700' }}>
            Show anyway
          </Text>
        </Pressable>
      ) : (
        <Text style={{ color: p.secondary, fontSize: 12, marginTop: 8 }}>
          This warning cannot be dismissed.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    padding: 12,
    marginTop: 12,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    padding: 10,
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
  },
  reveal: {
    minHeight: 44,
    minWidth: 64,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    paddingHorizontal: 10,
  },
  revealWide: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
});
