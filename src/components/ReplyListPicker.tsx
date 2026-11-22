import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import { normaliseListUri } from '../lib/interactionGates';
import { loadLists } from '../lib/lists';
import { CARD_RADIUS, usePalette } from '../theme';

/**
 * A threadgate list rule needs a real list AT-URI. This picker only offers
 * lists the signed-in account owns, read through the published graph lexicon;
 * it never invents a URI from a name or a web URL.
 */
export function ReplyListPicker({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (uri: string | null) => void;
}) {
  const p = usePalette();
  const [lists, setLists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!agent.did) {
      setLoading(false);
      setError('Sign in to choose a list.');
      return () => {
        active = false;
      };
    }
    loadLists(agent.did)
      .then((items) => {
        if (!active) return;
        setLists(items.filter((item) => normaliseListUri(item.uri)));
        setError(null);
      })
      .catch(() => {
        if (active) setError('Could not load your lists. Replies stay open until one is chosen.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const chosen = normaliseListUri(selected);

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }}>
        Choose one of your lists
      </Text>
      <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
        Only people on the chosen list can reply. A list must be saved before replies can be limited to it.
      </Text>
      {loading ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <ActivityIndicator color={p.accent} />
          <Text style={{ color: p.secondary, fontSize: 13 }}>Loading your lists…</Text>
        </View>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 13, marginTop: 8 }}>
          {error}
        </Text>
      ) : null}
      {!loading && !error && lists.length === 0 ? (
        <Text style={{ color: p.secondary, fontSize: 13, marginTop: 8 }}>
          You have no lists yet. Create one from the Lists screen first.
        </Text>
      ) : null}
      {lists.map((list) => {
        const active = chosen === list.uri;
        return (
          <Pressable
            key={list.uri}
            onPress={() => onSelect(active ? null : list.uri)}
            accessibilityRole="radio"
            accessibilityLabel={`Allow replies from ${list.name || 'this list'}`}
            accessibilityState={{ checked: active }}
            style={({ pressed }) => [
              styles.row,
              {
                borderBottomColor: p.divider,
                backgroundColor: active ? p.accentSoft : pressed ? p.bg : 'transparent',
              },
            ]}
          >
            <Ionicons
              name={active ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={active ? p.accent : p.secondary}
            />
            <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
              <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                {list.name || 'Untitled list'}
              </Text>
              <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={2}>
                {list.description || (list.purpose === 'app.bsky.graph.defs#modlist' ? 'Moderation list' : 'List')}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {chosen ? (
        <Pressable
          onPress={() => onSelect(null)}
          accessibilityRole="button"
          accessibilityLabel="Clear the chosen reply list"
          style={({ pressed }) => [
            styles.clear,
            { borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={{ color: p.text, fontSize: 13, fontWeight: '600' }}>
            Clear chosen list
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  clear: {
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
});
