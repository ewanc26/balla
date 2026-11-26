import React, { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { editHistory } from '../lib/postEditModel';
import { formatDateTime } from '../lib/time';
import {
  dialogAccessibilityProps,
  dialogAnimation,
  useDialogFocus,
  useReducedMotion,
} from '../lib/accessibility';
import { CARD_RADIUS, usePalette } from '../theme';

/**
 * A visible "· Edited" badge beside the timestamp. It opens the same two-entry
 * history for everyone: the original text and the current text, because the
 * one-edit cap means there are never more than two versions.
 */
export function EditedBadge({ record }: { record: any }) {
  const p = usePalette();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<any>(null);
  const closeButtonRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  const history = editHistory(record);

  useDialogFocus({
    visible: open,
    onClose: () => setOpen(false),
    containerRef,
    initialFocusRef: closeButtonRef,
  });

  if (!history) return null;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Edited post. Open the full edit history."
        accessibilityHint="Shows the original and current versions of this post."
        style={({ pressed }) => [
          styles.badge,
          { backgroundColor: pressed ? p.bg : 'transparent' },
        ]}
      >
        <Text style={{ color: p.secondary, fontSize: 13 }}>· Edited</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType={dialogAnimation(reducedMotion)}
        onRequestClose={() => setOpen(false)}
        accessibilityViewIsModal
      >
        <View style={[styles.overlay, { backgroundColor: p.overlay }]}>
          <Pressable
            onPress={() => setOpen(false)}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={styles.backdrop}
          />
          <View
            ref={containerRef}
            {...dialogAccessibilityProps('Edit history')}
            accessibilityViewIsModal
            style={[
              styles.sheet,
              {
                width: Math.min(Math.max(width - 16, 280), 480),
                backgroundColor: p.card,
                paddingBottom: Math.max(insets.bottom, 14),
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  accessibilityRole="header"
                  style={{ color: p.text, fontSize: 18, fontWeight: '700' }}
                >
                  Edit history
                </Text>
                <Text
                  style={{
                    color: p.secondary,
                    fontSize: 12,
                    lineHeight: 18,
                    marginTop: 3,
                  }}
                >
                  Full history: one edit, so two versions. The post keeps its
                  address.
                </Text>
              </View>
              <Pressable
                ref={closeButtonRef}
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close edit history"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeButton,
                  { backgroundColor: pressed ? p.bg : 'transparent' },
                ]}
              >
                <Ionicons name="close" size={23} color={p.secondary} />
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: 420 }}
              contentContainerStyle={{ paddingBottom: 6 }}
            >
              {history.map((entry) => (
                <View
                  key={entry.label}
                  style={[
                    styles.entry,
                    { borderColor: p.divider, backgroundColor: p.bg },
                  ]}
                >
                  <View style={styles.entryHeading}>
                    <Text
                      style={{
                        color: p.text,
                        fontSize: 13,
                        fontWeight: '700',
                      }}
                    >
                      {entry.label}
                    </Text>
                    <Text style={{ color: p.secondary, fontSize: 12 }}>
                      {entry.at ? formatDateTime(entry.at) : 'Date unavailable'}
                    </Text>
                  </View>
                  <Text
                    selectable
                    style={{
                      color: entry.text === null ? p.secondary : p.text,
                      fontSize: 14,
                      lineHeight: 20,
                      marginTop: 6,
                    }}
                  >
                    {entry.text === null
                      ? 'The original text was not kept by the client that edited this post.'
                      : entry.text || 'No text in this version.'}
                  </Text>
                </View>
              ))}
              <Text
                style={{
                  color: p.secondary,
                  fontSize: 12,
                  lineHeight: 18,
                  marginTop: 4,
                }}
              >
                Balla keeps one edit per post. The edit recreates the record at
                the same AT-URI, so likes, reposts and replies start again at
                zero.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    alignSelf: 'center',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  entry: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    padding: 12,
    marginBottom: 8,
  },
  entryHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
