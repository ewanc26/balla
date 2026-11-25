import React, { useEffect, useRef, useState } from 'react';
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
import { openExternalUrl } from '../lib/openLink';
import { openStreetMapSearchUrl } from '../lib/mapLinks';
import { placeRecordUrl } from '../lib/placeRecordLinks.ts';
import { getPlacesEnabled, getPlacesEndpoint } from '../lib/servicesConfig';
import {
  placesSearchCopy,
  searchPlaces,
  type PlacesSearchState,
} from '../lib/placesSearch';
import {
  placeDetailFields,
  placeResultDetail,
  placesHostLabel,
  type PlaceHit,
} from '../lib/placesModel.ts';
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
  const [enabled, setEnabled] = useState(true);
  // Raw configured value is never rendered; the link builder validates it.
  const [placesEndpoint, setPlacesEndpoint] = useState('');
  const [endpointLabel, setEndpointLabel] = useState<string | null>(null);
  const [endpointChecked, setEndpointChecked] = useState(false);
  const [detailHit, setDetailHit] = useState<PlaceHit | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const containerRef = useRef<any>(null);
  const closeRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  // Escape steps back from the detail view to the results before it closes
  // the picker. The hook keeps the latest handler without refocusing.
  useDialogFocus({
    visible,
    onClose: detailHit ? closeDetails : onClose,
    containerRef,
    initialFocusRef: closeRef,
  });

  useEffect(() => {
    if (!visible) {
      setDetailHit(null);
      setLinkError(null);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const [value, endpoint] = await Promise.all([
          getPlacesEnabled(),
          getPlacesEndpoint(),
        ]);
        if (!active) return;
        setEnabled(value);
        setPlacesEndpoint(value ? endpoint : '');
        // One shared, fail-closed label: never echo the raw persisted value.
        setEndpointLabel(placesHostLabel(endpoint, value));
        setEndpointChecked(true);
        if (!value) {
          setState('off');
          setHits([]);
          setDetailHit(null);
          setLinkError(null);
        }
      } catch {
        if (!active) return;
        setEnabled(false);
        setState('off');
        setHits([]);
        setDetailHit(null);
        setLinkError(null);
        setPlacesEndpoint('');
        setEndpointLabel(placesHostLabel('', false));
        setEndpointChecked(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [visible]);

  async function search() {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setState(null);
    setHits([]);
    setDetailHit(null);
    setLinkError(null);
    try {
      const [allowed, endpoint] = await Promise.all([
        getPlacesEnabled(),
        getPlacesEndpoint(),
      ]);
      setEnabled(allowed);
      setPlacesEndpoint(allowed ? endpoint : '');
      setEndpointLabel(placesHostLabel(endpoint, allowed));
      setEndpointChecked(true);
      if (!allowed) {
        setState('off');
        setHits([]);
        setDetailHit(null);
        setLinkError(null);
        return;
      }
      const result = await searchPlaces(q, endpoint, { enabled: allowed });
      setState(result.state);
      setHits(result.hits);
    } catch {
      // Configuration read failed: fail closed with the fixed failure copy.
      setEnabled(false);
      setPlacesEndpoint('');
      setState('unavailable');
      setDetailHit(null);
      setLinkError(null);
      setEndpointLabel(placesHostLabel('', false));
      setEndpointChecked(true);
    } finally {
      setSearching(false);
    }
  }

  function openDetails(hit: PlaceHit) {
    setDetailHit(hit);
    setLinkError(null);
  }

  function closeDetails() {
    setDetailHit(null);
    setLinkError(null);
  }

  async function openLink(url: string) {
    setLinkError(null);
    try {
      await openExternalUrl(url);
    } catch {
      setLinkError(
        'Could not open your browser. Check your device settings; Balla has not changed the link.',
      );
    }
  }

  const detailFields = detailHit ? placeDetailFields(detailHit) : [];
  const detailRecordUrl = detailHit ? placeRecordUrl(placesEndpoint, detailHit.origin) : null;
  const detailMapUrl = detailHit ? openStreetMapSearchUrl(detailHit.name) : null;

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
          {...dialogAccessibilityProps(detailHit ? 'Place details' : 'Add a place name')}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: p.card, paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <View style={styles.header}>
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>
              {detailHit ? 'Place details' : 'Add a place name'}
            </Text>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={detailHit ? 'Close place details' : 'Close place search'}
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={24} color={p.secondary} />
            </Pressable>
          </View>
          {detailHit ? (
            <>
              <Pressable
                onPress={closeDetails}
                accessibilityRole="button"
                accessibilityLabel="Back to place results"
                style={({ pressed }) => [
                  styles.backButton,
                  {
                    backgroundColor: pressed ? p.bg : 'transparent',
                    borderColor: p.divider,
                  },
                ]}
              >
                <Ionicons name="arrow-back" size={18} color={p.accent} />
                <Text style={{ color: p.accent, fontSize: 14, fontWeight: '600' }}>
                  Back to results
                </Text>
              </Pressable>
              <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
                <Text
                  accessibilityRole="header"
                  style={{ color: p.text, fontSize: 20, fontWeight: '700', marginTop: 8 }}
                >
                  {detailHit.name}
                </Text>
                <Text style={{ color: p.secondary, fontSize: 13, marginTop: 4 }}>
                  {placeResultDetail(detailHit)}
                </Text>
                <Text style={{ color: p.secondary, fontSize: 13, marginTop: 10 }}>
                  These are the fields the provider published for this result. Balla
                  makes no request to open either link, sends no position and writes
                  nothing.
                </Text>
                {detailFields.length ? (
                  <View style={styles.detailList}>
                    {detailFields.map((field) => (
                      <View
                        key={field.label}
                        style={[styles.detailRow, { borderColor: p.divider }]}
                      >
                        <Text style={{ color: p.secondary, fontSize: 12, minWidth: 104 }}>
                          {field.label}
                        </Text>
                        <Text selectable style={{ color: p.text, fontSize: 14, flex: 1 }}>
                          {field.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={{ color: p.secondary, fontSize: 13, marginTop: 10 }}>
                    No further place fields are published for this result.
                  </Text>
                )}
                {linkError ? (
                  <Text
                    accessibilityRole="alert"
                    style={{ color: p.danger, fontSize: 13, marginTop: 10 }}
                  >
                    {linkError}
                  </Text>
                ) : null}
                {detailRecordUrl ? (
                  <Pressable
                    onPress={() => void openLink(detailRecordUrl)}
                    accessibilityRole="button"
                    accessibilityLabel="Open the public gazetteer record"
                    style={({ pressed }) => [
                      styles.detailLink,
                      { borderColor: p.divider, backgroundColor: pressed ? p.bg : 'transparent' },
                    ]}
                  >
                    <Text style={{ color: p.accent, fontSize: 15, fontWeight: '600' }}>
                      Open public gazetteer record
                    </Text>
                    <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}>
                      Opens the result's public record on the configured places host.
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={{ color: p.secondary, fontSize: 13, marginTop: 10 }}>
                    No public gazetteer record is available for this result.
                  </Text>
                )}
                {detailMapUrl ? (
                  <Pressable
                    onPress={() => void openLink(detailMapUrl)}
                    accessibilityRole="button"
                    accessibilityLabel="Search OpenStreetMap for this place by name"
                    style={({ pressed }) => [
                      styles.detailLink,
                      { borderColor: p.divider, backgroundColor: pressed ? p.bg : 'transparent' },
                    ]}
                  >
                    <Text style={{ color: p.accent, fontSize: 15, fontWeight: '600' }}>
                      Search OpenStreetMap by name
                    </Text>
                    <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}>
                      Name search only, not an exact place match. No position is sent.
                    </Text>
                  </Pressable>
                ) : (
                  <Text style={{ color: p.secondary, fontSize: 13, marginTop: 10 }}>
                    No map search is available because this result has no name.
                  </Text>
                )}
                <Pressable
                  onPress={() => onPick(detailHit.name)}
                  accessibilityRole="button"
                  accessibilityLabel="Add this place name as plain text"
                  style={({ pressed }) => [
                    styles.detailAdd,
                    { backgroundColor: pressed ? p.bg : p.accentSoft },
                  ]}
                >
                  <Text style={{ color: p.accent, fontSize: 14, fontWeight: '700' }}>
                    Add {detailHit.name} as plain text
                  </Text>
                </Pressable>
              </ScrollView>
            </>
          ) : (
            <>
              <Text style={{ color: p.secondary, fontSize: 13, marginTop: 4 }}>
                Balla sends only the words you type. No device position, no nearby
                lookup. Choosing a result adds its name as plain text. The map button
                searches OpenStreetMap by name in your browser; it sends no position
                and is not an exact place match. The info button shows the result's
                published fields and a link to its public gazetteer record. Result
                labels come from the provider's published fields, including its
                city-state rule; no popularity is shown. Balla writes
                no check-in record while the place-pin lexicon is a draft.
              </Text>
              {endpointChecked && endpointLabel ? (
                <Text style={{ color: p.secondary, fontSize: 12, marginTop: 6 }}>
                  {`${endpointLabel}. Change it in Advanced → Services.`}
                </Text>
              ) : null}
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
                  disabled={searching || !query.trim() || !enabled}
                  accessibilityRole="button"
                  accessibilityLabel="Search for this place name"
                  style={({ pressed }) => [
                    styles.searchButton,
                    {
                      backgroundColor: p.accent,
                      opacity: pressed || searching || !query.trim() || !enabled ? 0.5 : 1,
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
                {hits.map((hit, index) => (
                  <View
                    key={`${index}:${hit.origin ?? hit.name}`}
                    style={styles.row}
                  >
                    <Pressable
                      onPress={() => onPick(hit.name)}
                      disabled={searching}
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${hit.name} as plain text`}
                      style={({ pressed }) => [
                        styles.rowMain,
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
                          {placeResultDetail(hit)}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => openDetails(hit)}
                      disabled={searching}
                      accessibilityRole="button"
                      accessibilityLabel={`Show details for ${hit.name}`}
                      style={({ pressed }) => [
                        styles.recordButton,
                        { backgroundColor: pressed ? p.bg : 'transparent' },
                      ]}
                    >
                      <Ionicons name="information-circle-outline" size={20} color={p.accent} />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        const url = openStreetMapSearchUrl(hit.name);
                        if (url) void openExternalUrl(url).catch(() => {});
                      }}
                      disabled={searching}
                      accessibilityRole="button"
                      accessibilityLabel={`Search OpenStreetMap for ${hit.name} by name`}
                      style={({ pressed }) => [
                        styles.mapButton,
                        { backgroundColor: pressed ? p.bg : 'transparent' },
                      ]}
                    >
                      <Ionicons name="map-outline" size={20} color={p.accent} />
                    </Pressable>
                  </View>
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
            </>
          )}
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
    minHeight: 56,
    borderRadius: CARD_RADIUS,
    paddingRight: 8,
  },
  rowMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 8,
  },
  mapButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CARD_RADIUS,
  },
  recordButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CARD_RADIUS,
  },
  glyph: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
  },
  detailList: { marginTop: 8 },
  detailRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailLink: {
    minHeight: 56,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
  },
  detailAdd: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CARD_RADIUS,
    marginTop: 12,
  },
  plainButton: {
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
});
