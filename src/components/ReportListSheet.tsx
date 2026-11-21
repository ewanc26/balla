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
import { Ionicons } from '@expo/vector-icons';
import {
  dialogAccessibilityProps,
  sheetAnimation,
  useDialogFocus,
  useReducedMotion,
} from '../lib/accessibility';
import { describeFailure } from '../lib/reliability';
import { REPORT_REASONS, type ReportReason } from '../lib/reportModel';
import { reportList } from '../lib/moderation';
import { CARD_RADIUS, usePalette, webInputReset } from '../theme';

/**
 * List reports use the same categories as posts and profiles. The sheet is
 * separate from the post/profile menus because lists are reported from their
 * detail screen, but it shares the categories and the submission path.
 */
export function ReportListSheet({
  list,
  onClose,
}: {
  list: any;
  onClose: () => void;
}) {
  const p = usePalette();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<number | null>(null);
  const containerRef = useRef<any>(null);
  const closeRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus({
    visible: true,
    onClose,
    containerRef,
    initialFocusRef: closeRef,
  });

  async function send() {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await reportList(list, reason, details);
      setReceiptId(response.data.id);
    } catch (err) {
      // Never imply a report was sent when the API refused it.
      setError(
        describeFailure(
          err,
          'Could not send the report. Your reason is still here; try again.'
        )
      );
    } finally {
      setBusy(false);
    }
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
          {...dialogAccessibilityProps('Report this list')}
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: p.card }]}
        >
          <View style={styles.header}>
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>
              {receiptId !== null ? 'Report sent' : 'Report this list'}
            </Text>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close list report"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={24} color={p.secondary} />
            </Pressable>
          </View>

          {receiptId !== null ? (
            <View style={styles.success}>
              <Ionicons name="checkmark-circle" size={44} color={p.green} />
              <Text
                style={{
                  color: p.text,
                  fontSize: 16,
                  fontWeight: '700',
                  marginTop: 10,
                }}
              >
                Bluesky’s moderation service will review this list. The creator
                will not be told who reported it.
              </Text>
              <Text
                style={{
                  color: p.secondary,
                  fontSize: 13,
                  lineHeight: 19,
                  marginTop: 8,
                }}
              >
                Saved locally as receipt #{receiptId}. This receipt is only a
                reminder on this device, not an official moderation status.
              </Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Done"
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: p.accent, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={{ color: p.onAccent, fontWeight: '700' }}>Done</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text
                style={{ color: p.secondary, fontSize: 14, lineHeight: 20 }}
              >
                Reports go to Bluesky’s moderation service. The creator will not
                be told.
              </Text>
              <ScrollView
                style={styles.reasons}
                contentContainerStyle={{ paddingVertical: 10, gap: 8 }}
                keyboardShouldPersistTaps="handled"
              >
                {REPORT_REASONS.map((item) => {
                  const selected = reason === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => setReason(item.value)}
                      accessibilityRole="radio"
                      accessibilityLabel={item.label}
                      accessibilityHint={item.detail}
                      accessibilityState={{ checked: selected }}
                      style={({ pressed }) => [
                        styles.choice,
                        {
                          backgroundColor: pressed ? p.bg : 'transparent',
                          borderColor: selected ? p.accent : p.divider,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.radio,
                          { borderColor: selected ? p.accent : p.secondary },
                        ]}
                      >
                        {selected ? (
                          <View
                            style={[styles.radioDot, { backgroundColor: p.accent }]}
                          />
                        ) : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{ color: p.text, fontSize: 15, fontWeight: '600' }}
                        >
                          {item.label}
                        </Text>
                        <Text
                          style={{
                            color: p.secondary,
                            fontSize: 12,
                            lineHeight: 17,
                            marginTop: 1,
                          }}
                        >
                          {item.detail}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
                <TextInput
                  value={details}
                  onChangeText={setDetails}
                  placeholder="Anything else the moderators should know? (optional)"
                  placeholderTextColor={p.secondary}
                  multiline
                  maxLength={1000}
                  accessibilityLabel="Additional report details"
                  style={[
                    styles.details,
                    {
                      color: p.text,
                      backgroundColor: p.bg,
                      borderColor: p.divider,
                    },
                    webInputReset,
                  ]}
                />
              </ScrollView>
              {error ? (
                <Text
                  accessibilityRole="alert"
                  style={{ color: p.danger, fontSize: 13, lineHeight: 19 }}
                >
                  {error}
                </Text>
              ) : null}
              <View style={styles.footer}>
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel list report"
                  disabled={busy}
                  accessibilityState={{ disabled: busy }}
                  style={({ pressed }) => [
                    styles.button,
                    {
                      backgroundColor: p.bg,
                      borderColor: p.divider,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={{ color: p.text, fontWeight: '600' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => void send()}
                  accessibilityRole="button"
                  accessibilityLabel="Send list report"
                  disabled={!reason || busy}
                  accessibilityState={{ disabled: !reason || busy, busy }}
                  style={({ pressed }) => [
                    styles.button,
                    {
                      backgroundColor: p.accent,
                      borderColor: p.accent,
                      opacity: !reason || busy ? 0.45 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={p.onAccent} />
                  ) : (
                    <Text style={{ color: p.onAccent, fontWeight: '700' }}>
                      Send report
                    </Text>
                  )}
                </Pressable>
              </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '92%',
    alignSelf: 'center',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
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
  reasons: { maxHeight: 330 },
  choice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  details: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: 'top',
  },
  footer: { flexDirection: 'row', gap: 8, marginTop: 12 },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    alignSelf: 'center',
    marginTop: 16,
  },
  success: { alignItems: 'center', paddingVertical: 24 },
});
