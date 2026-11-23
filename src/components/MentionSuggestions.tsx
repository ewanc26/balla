import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import type { MentionActor } from '../lib/mentionSuggestions';
import { usePalette } from '../theme';

export type MentionStatus = 'loading' | 'ready' | 'error';

type Props = {
  query: string;
  status: MentionStatus;
  results: MentionActor[];
  onSelect: (actor: MentionActor) => void;
};

export function MentionSuggestions({ query, status, results, onSelect }: Props) {
  const p = usePalette();

  return (
    <View
      style={[
        styles.panel,
        { backgroundColor: p.bg, borderTopColor: p.divider },
      ]}
    >
      <View style={styles.heading}>
        <Text
          accessibilityRole="header"
          style={{ color: p.text, fontSize: 13, fontWeight: '700' }}
        >
          Mention someone
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: p.secondary, fontSize: 12, marginLeft: 8, flexShrink: 1 }}
        >
          @{query}
        </Text>
      </View>

      {status === 'loading' ? (
        <View
          style={styles.statusRow}
          accessible
          accessibilityLabel="Searching for accounts to mention"
        >
          <ActivityIndicator size="small" color={p.accent} />
          <Text style={{ color: p.secondary, fontSize: 12, marginLeft: 8 }}>
            Searching accounts…
          </Text>
        </View>
      ) : null}

      {status === 'error' ? (
        <Text
          accessibilityRole="alert"
          style={{ color: p.secondary, fontSize: 12, lineHeight: 18, paddingVertical: 8 }}
        >
          Could not search accounts. Keep typing to try again.
        </Text>
      ) : null}

      {status === 'ready' && results.length === 0 ? (
        <Text
          style={{ color: p.secondary, fontSize: 12, lineHeight: 18, paddingVertical: 8 }}
        >
          No accounts found for “@{query}”.
        </Text>
      ) : null}

      {status === 'ready'
        ? results.map((actor, index) => {
            const handle = actor.handle || '';
            if (!handle) return null;
            const name =
              typeof actor.displayName === 'string'
                ? actor.displayName.trim()
                : '';
            return (
              <Pressable
                key={actor.did || handle}
                onPress={() => onSelect(actor)}
                accessibilityRole="button"
                accessibilityLabel={`Mention @${handle}`}
                accessibilityHint="Inserts this handle into your post"
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: p.divider,
                  },
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Avatar
                  avatar={actor.avatar}
                  displayName={name || handle}
                  size={34}
                />
                <View style={styles.identity}>
                  <Text
                    numberOfLines={1}
                    style={{ color: p.text, fontSize: 14, fontWeight: '700' }}
                  >
                    {name || `@${handle}`}
                  </Text>
                  {name ? (
                    <Text
                      numberOfLines={1}
                      style={{ color: p.secondary, fontSize: 12, marginTop: 1 }}
                    >
                      @{handle}
                    </Text>
                  ) : null}
                </View>
                <Ionicons
                  name="add-circle-outline"
                  size={20}
                  color={p.accent}
                />
              </Pressable>
            );
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingBottom: 2,
    marginTop: 2,
  },
  heading: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
  },
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 10,
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
});
