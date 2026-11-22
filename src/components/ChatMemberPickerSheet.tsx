import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import {
  dialogAccessibilityProps,
  sheetAnimation,
  useDialogFocus,
  useReducedMotion,
} from '../lib/accessibility';
import { describeFailure } from '../lib/reliability';
import { CARD_RADIUS, usePalette, webInputReset } from '../theme';

type Person = { did?: string; handle?: string; displayName?: string; avatar?: string };

/** Search public profiles and choose DIDs; no message content is involved. */
export function ChatMemberPickerSheet({
  title,
  excludeDids = [],
  onClose,
  onAdd,
}: {
  title: string;
  excludeDids?: string[];
  onClose: () => void;
  onAdd: (dids: string[]) => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<any>(null);
  const closeRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus({ visible: true, onClose, containerRef, initialFocusRef: closeRef });

  const excluded = new Set([agent.did, ...excludeDids].filter(Boolean) as string[]);

  async function search() {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setSearched(true);
    setError(null);
    try {
      const res = await agent.searchActors({ q, limit: 30 });
      setResults((res.data.actors || []) as Person[]);
    } catch (err) {
      setResults([]);
      setError(describeFailure(err, 'Could not search for accounts. Try again.'));
    } finally {
      setSearching(false);
    }
  }

  function toggle(did?: string) {
    if (!did || excluded.has(did)) return;
    setSelected((prev) =>
      prev.includes(did) ? prev.filter((item) => item !== did) : [...prev, did]
    );
  }

  function label(person: Person): string {
    return person.displayName || (person.handle ? `@${person.handle}` : person.did || 'Account');
  }

  return (
    <Modal
      transparent
      visible
      animationType={sheetAnimation(reducedMotion)}
      accessibilityViewIsModal
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.backdrop}
        />
        <View
          ref={containerRef}
          {...dialogAccessibilityProps(title)}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: p.card, paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <View style={styles.header}>
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>{title}</Text>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close member picker"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={24} color={p.secondary} />
            </Pressable>
          </View>
          <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19 }}>
            Search by name or handle. Choose people to invite; you are already a member.
          </Text>
          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void search()}
              placeholder="Search accounts"
              placeholderTextColor={p.secondary}
              accessibilityLabel="Search accounts by name or handle"
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
                webInputReset,
              ]}
            />
            <Pressable
              onPress={() => void search()}
              disabled={searching || !query.trim()}
              accessibilityRole="button"
              accessibilityLabel="Search for accounts"
              style={({ pressed }) => [
                styles.searchButton,
                { backgroundColor: p.accent, opacity: pressed || searching || !query.trim() ? 0.5 : 1 },
              ]}
            >
              {searching ? (
                <ActivityIndicator size="small" color={p.onAccent} />
              ) : (
                <Text style={{ color: p.onAccent, fontWeight: '700' }}>Search</Text>
              )}
            </Pressable>
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 13, marginTop: 8 }}>
              {error}
            </Text>
          ) : null}
          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {results.map((person) => {
              const did = String(person.did || '');
              const isExcluded = excluded.has(did);
              const checked = selected.includes(did);
              return (
                <Pressable
                  key={did || person.handle || Math.random()}
                  onPress={() => toggle(did)}
                  disabled={isExcluded}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`${label(person)}${isExcluded ? ', already a member' : ''}`}
                  accessibilityState={{ checked, disabled: isExcluded }}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: pressed ? p.bg : 'transparent', opacity: isExcluded ? 0.6 : 1 },
                  ]}
                >
                  <View style={[styles.check, { borderColor: checked ? p.accent : p.secondary }]}>
                    {checked ? <Ionicons name="checkmark" size={16} color={p.accent} /> : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                      {label(person)}
                    </Text>
                    {person.handle && person.displayName ? (
                      <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={1}>
                        @{person.handle}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            {searched && results.length === 0 && !error ? (
              <Text style={{ color: p.secondary, fontSize: 14, paddingVertical: 16 }}>
                No matching accounts.
              </Text>
            ) : null}
            {!searched ? (
              <Text style={{ color: p.secondary, fontSize: 13, paddingVertical: 16 }}>
                Search results appear here.
              </Text>
            ) : null}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel member selection"
              style={({ pressed }) => [
                styles.button,
                { backgroundColor: p.bg, borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={{ color: p.text, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => onAdd(selected)}
              accessibilityRole="button"
              accessibilityLabel={`Add ${selected.length} selected ${selected.length === 1 ? 'member' : 'members'}`}
              disabled={selected.length === 0}
              accessibilityState={{ disabled: selected.length === 0 }}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: p.accent,
                  borderColor: p.accent,
                  opacity: selected.length === 0 ? 0.45 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={{ color: p.onAccent, fontWeight: '700' }}>
                Add{selected.length ? ` (${selected.length})` : ''}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '90%',
    alignSelf: 'center',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  input: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: CARD_RADIUS, paddingHorizontal: 12, fontSize: 15 },
  searchButton: { minWidth: 88, minHeight: 44, borderRadius: CARD_RADIUS, alignItems: 'center', justifyContent: 'center' },
  results: { maxHeight: 360, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, borderRadius: CARD_RADIUS, paddingHorizontal: 8 },
  check: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', gap: 8, marginTop: 10 },
  button: { flex: 1, minHeight: 44, borderRadius: CARD_RADIUS, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
