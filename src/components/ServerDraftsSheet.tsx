import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import { describeFailure } from '../lib/reliability';
import {
  deleteServerDraft,
  listServerDrafts,
  type ServerDraft,
} from '../lib/serverDrafts';
import {
  draftViewSummary,
  sortDrafts,
} from '../lib/serverDraftsModel.ts';
import { CARD_RADIUS, usePalette } from '../theme';

/**
 * The account's server-side draft stash, backed by the AppView's published
 * `app.bsky.draft.*` RPCs (the same ones the official client uses). Loading a
 * draft restores text and choices; media is never invented — a draft's photos
 * and videos have to be picked again, exactly as in the official client.
 */
export function ServerDraftsSheet({
  visible,
  activeId,
  onClose,
  onLoad,
}: {
  visible: boolean;
  activeId?: string | null;
  onClose: () => void;
  onLoad: (view: ServerDraft) => void;
}) {
  const p = usePalette();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const containerRef = useRef<any>(null);
  const closeRef = useRef<any>(null);
  const [drafts, setDrafts] = useState<ServerDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useDialogFocus({ visible, onClose, containerRef, initialFocusRef: closeRef });

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const list = await listServerDrafts();
      setDrafts(sortDrafts(list));
    } catch (err) {
      setError(describeFailure(err, 'Could not load drafts. Try again.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!visible) return;
    void refresh();
  }, [visible]);

  async function remove(view: ServerDraft) {
    setBusyId(view.id);
    setError(null);
    try {
      await deleteServerDraft(view.id);
      setDrafts((current) => current.filter((item) => item.id !== view.id));
    } catch (err) {
      setError(describeFailure(err, 'Could not delete the draft. Try again.'));
    } finally {
      setBusyId(null);
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
          style={[styles.backdrop, { backgroundColor: p.overlay }]}
        />
        <View
          ref={containerRef}
          {...dialogAccessibilityProps('Drafts')}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: p.card, paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <View style={styles.header}>
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>
              Drafts
            </Text>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close drafts"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={24} color={p.secondary} />
            </Pressable>
          </View>

          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17 }}>
            Saved to your Bluesky account. Photos and videos need adding again.
          </Text>

          {error ? (
            <Text
              accessibilityRole="alert"
              style={{ color: p.danger, fontSize: 13, marginTop: 6 }}
            >
              {error}
            </Text>
          ) : null}

          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {loading ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={p.accent} />
            ) : null}
            {!loading && drafts.length === 0 && !error ? (
              <Text style={{ color: p.secondary, fontSize: 14, paddingVertical: 20 }}>
                No saved drafts yet. Use “Save draft” in the composer to create one.
              </Text>
            ) : null}
            {drafts.map((view) => {
              const summary = draftViewSummary(view);
              if (!summary) return null;
              const isActive = !!activeId && activeId === view.id;
              const details = [
                summary.languages.length ? summary.languages.join(', ') : null,
                summary.hasQuote ? 'quote' : null,
                summary.hasExternal ? 'link' : null,
                summary.labels.length ? `${summary.labels.length} warning${summary.labels.length === 1 ? '' : 's'}` : null,
              ].filter(Boolean);
              return (
                <View
                  key={view.id}
                  style={[
                    styles.row,
                    { borderBottomColor: p.divider, backgroundColor: isActive ? p.accentSoft : 'transparent' },
                  ]}
                >
                  <Pressable
                    onPress={() => {
                      onLoad(view);
                      onClose();
                    }}
                    disabled={!!busyId}
                    accessibilityRole="button"
                    accessibilityLabel={`Open draft: ${summary.text || 'Empty draft'}`}
                    style={({ pressed }) => [
                      styles.rowMain,
                      { opacity: busyId ? 0.6 : pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }} numberOfLines={2}>
                      {summary.text || 'Empty draft'}
                    </Text>
                    <Text style={{ color: p.secondary, fontSize: 12, marginTop: 3 }} numberOfLines={1}>
                      {details.length ? details.join(' · ') : 'Draft'}
                    </Text>
                  </Pressable>
                  {busyId === view.id ? (
                    <ActivityIndicator size="small" color={p.accent} />
                  ) : (
                    <Pressable
                      onPress={() => void remove(view)}
                      disabled={!!busyId}
                      accessibilityRole="button"
                      accessibilityLabel="Delete draft"
                      style={({ pressed }) => [
                        styles.delete,
                        { backgroundColor: pressed ? p.bg : 'transparent' },
                      ]}
                    >
                      <Ionicons name="trash-outline" size={20} color={p.danger} />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>
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
  results: { maxHeight: 460, marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 64,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowMain: { flex: 1, minWidth: 0, paddingVertical: 10 },
  delete: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
