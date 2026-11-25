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
import {
  dialogAccessibilityProps,
  sheetAnimation,
  useDialogFocus,
  useReducedMotion,
} from '../lib/accessibility';
import { getPlacesEndpoint } from '../lib/servicesConfig';
import {
  placesSearchCopy,
  searchPlaces,
  type PlacesSearchState,
} from '../lib/placesSearch';
import type { PlaceHit } from '../lib/placesModel';
import { CARD_RADIUS, usePalette, webInputReset } from '../theme';

/**
 * Typed place search for the composer (#156, partial). The person presses
 * Search explicitly; only their words go to the configured public provider.
 * Picking a result inserts its name as plain text: no coordinates, no check-in
 * record and no place chip exist yet because the pin lexicon is a draft.
 */
export function PlacePickerSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (name: string) => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<PlaceHit[]>([]);
  const [state, setState] = useState<PlacesSearchState | null>(null);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<any>(null);
  const closeRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus({ visible, onClose, containerRef, initialFocusRef: closeRef });

  async function search() {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setState(null);
    setHits([]);
    try {
      const result = await searchPlaces(q, await getPlacesEndpoint());
      setState(result.state);
      setHits(result.hits);
    } catch {
      // Configuration read failed: fail closed with the fixed failure copy.
      setState('unavailable');
    } finally {
      setSearching(false);
    }
  }

  if (!visible) return null;

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
          {...dialogAccessibilityProps('Add a place name')}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: p.card, paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <View style={styles.header}>
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>
              Add a place name
            </Text>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close place search"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={24} color={p.secondary} />
            </Pressable>
          </View>
          <Text style={{ color: p.secondary, fontSize: 13, marginTop: 4 }}>
            Balla sends only the words you type. No device position, no nearby
            lookup. Choosing a result adds its name as plain text; Balla writes
            no check-in record while the place-pin lexicon is a draft.
          </Text>
          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => void search()}
              placeholder="Search a place by name"
              placeholderTextColor={p.secondary}
              accessibilityLabel="Place name to search"
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
              accessibilityLabel="Search for this place name"
              style={({ pressed }) => [
                styles.searchButton,
                {
                  backgroundColor: p.accent,
                  opacity: pressed || searching || !query.trim() ? 0.5 : 1,
                },
              ]}
            >
              {searching ? (
                <ActivityIndicator size="small" color={p.onAccent} />
              ) : (
                <Text style={{ color: p.onAccent, fontWeight: '700' }}>Search</Text>
              )}
            </Pressable>
          </View>
          {state ? (
            <Text
              accessibilityRole={state === 'ready' ? undefined : 'alert'}
              style={{
                color: state === 'ready' ? p.secondary : p.danger,
                fontSize: 13,
                marginTop: 8,
              }}
            >
              {state === 'ready'
                ? hits.length
                  ? `${hits.length} result${hits.length === 1 ? '' : 's'}. No position was sent.`
                  : 'No matching places. You can still add the name you typed.'
                : placesSearchCopy(state)}
            </Text>
          ) : null}
          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {hits.map((hit) => (
              <Pressable
                key={`${hit.origin ?? hit.name}:${hit.name}`}
                onPress={() => onPick(hit.name)}
                disabled={searching}
                accessibilityRole="button"
                accessibilityLabel={`Add ${hit.name} as plain text`}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? p.bg : 'transparent' },
                ]}
              >
                <View style={[styles.glyph, { backgroundColor: p.accentSoft }]}>
                  <Ionicons
                    name={hit.kind === 'area' ? 'map-outline' : 'location-outline'}
                    size={18}
                    color={p.accent}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={{ color: p.text, fontSize: 15, fontWeight: '600' }}
                    numberOfLines={1}
                  >
                    {hit.name}
                  </Text>
                  <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={1}>
                    {hit.category || hit.subtype || (hit.kind === 'area' ? 'Area' : 'Place')}
                    {hit.country ? ` · ${hit.country}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={() => onPick(query)}
            disabled={!query.trim() || searching}
            accessibilityRole="button"
            accessibilityLabel="Add the typed name as plain text"
            style={({ pressed }) => [
              styles.plainButton,
              {
                borderColor: p.divider,
                backgroundColor: pressed ? p.bg : 'transparent',
                opacity: !query.trim() || searching ? 0.5 : 1,
              },
            ]}
          >
            <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }}>
              Use typed name as plain text
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '88%',
    alignSelf: 'center',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  searchButton: {
    minWidth: 88,
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  results: { maxHeight: 320, marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 8,
  },
  glyph: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  plainButton: {
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
});
