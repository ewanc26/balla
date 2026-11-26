import React, { useRef } from 'react';
import {
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
import { CARD_RADIUS, usePalette } from '../theme';
import type { VerificationSummary } from '../lib/profileModel';

/**
 * The badge is a button: tapping it explains where the status comes from and
 * who issued the verifications, using only fields on the profile record. No
 * gesture-only detail, and every row stays a reachable 44pt control.
 */
export function VerificationSheet({
  visible,
  handle,
  summary,
  onClose,
}: {
  visible: boolean;
  handle: string;
  summary: VerificationSummary;
  onClose: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const containerRef = useRef<any>(null);
  const closeRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus({
    visible,
    onClose,
    containerRef,
    initialFocusRef: closeRef,
  });

  if (!visible) return null;

  const title = summary.verified
    ? 'Verified account'
    : summary.verifier
      ? 'Trusted verifier'
      : 'Verification';

  return (
    <Modal
      visible={visible}
      transparent
      animationType={sheetAnimation(reducedMotion)}
      accessibilityViewIsModal
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.backdrop, { backgroundColor: p.overlay }]}
        />
        <View
          ref={containerRef}
          {...dialogAccessibilityProps(title)}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: p.card,
              borderColor: p.divider,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: p.text, fontSize: 19, fontWeight: '700' }}>
                {title}
              </Text>
              <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}>
                @{handle}
              </Text>
            </View>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close verification details"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={22} color={p.secondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.body}>
            <View
              style={[
                styles.note,
                { backgroundColor: p.bg, borderColor: p.divider },
              ]}
            >
              <Ionicons name="information-circle-outline" size={18} color={p.accent} />
              <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, flex: 1 }}>
                Bluesky decides verification from records issued by trusted
                verifiers. Balla shows the badges and the verifiers it reports;
                it does not issue or change them.
              </Text>
            </View>

            {summary.verified ? (
              <View style={styles.stateRow}>
                <Ionicons name="checkmark-circle" size={20} color={p.accent} />
                <Text
                  style={{
                    color: p.text,
                    fontSize: 15,
                    fontWeight: '600',
                    marginLeft: 10,
                    flex: 1,
                  }}
                  numberOfLines={2}
                >
                  Verified by{' '}
                  {summary.verifiers.length > 0
                    ? summary.verifiers.map((item) => item.name).join(', ')
                    : 'a trusted verifier'}
                </Text>
              </View>
            ) : null}
            {summary.verifier ? (
              <View style={styles.stateRow}>
                <Ionicons name="shield-checkmark-outline" size={20} color={p.accent} />
                <Text style={{ color: p.text, fontSize: 15, fontWeight: '600', marginLeft: 10 }}>
                  Trusted verifier
                </Text>
              </View>
            ) : null}

            {summary.verifiers.length > 0 ? (
              <View style={[styles.list, { borderTopColor: p.divider }]}>
                <Text style={[styles.listHeading, { color: p.secondary }]}>
                  Verification records
                </Text>
                {summary.verifiers.map((item) => (
                  <View key={item.uri || item.did} style={[styles.row, { borderBottomColor: p.divider }]}>
                    <Ionicons name="checkmark-circle-outline" size={20} color={p.green} />
                    <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                      <Text
                        style={{ color: p.text, fontSize: 15, fontWeight: '600' }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}>
                        {item.handle || item.did}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '82%',
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  body: {
    paddingHorizontal: 18,
  },
  note: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    marginTop: 8,
  },
  list: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 8,
  },
  listHeading: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
