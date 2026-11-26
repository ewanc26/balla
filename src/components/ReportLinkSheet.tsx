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
import { describeFailure } from '../lib/reliability';
import { reportProfileLink } from '../lib/moderation';
import {
  profileLinkHost,
  profileLinkLabel,
} from '../lib/profileLinks';
import {
  reportableProfileLinks,
  REPORT_REASONS,
  type ReportReason,
} from '../lib/reportModel';
import { CARD_RADIUS, usePalette, webInputReset } from '../theme';

/**
 * A visible picker for link records on someone else's profile. Long-press is
 * not available to every reader, so the profile menu reaches this sheet.
 */
export function ReportLinkSheet({
  links,
  onClose,
}: {
  links: any[];
  onClose: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const reportable = reportableProfileLinks(links);
  const [selected, setSelected] = useState<any>(reportable[0] || null);
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
    if (!reason || !selected || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await reportProfileLink(selected, reason, details);
      setReceiptId(response.data.id);
    } catch (err) {
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

  const title = receiptId !== null ? 'Report sent' : 'Report a link';

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
          {...dialogAccessibilityProps(title)}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: p.card,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>
              {title}
            </Text>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close link report"
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
                Bluesky’s moderation service will review this link. The profile
                owner will not be told who reported it.
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
          ) : !reportable.length ? (
            <Text style={{ color: p.secondary, fontSize: 14, marginTop: 12 }}>
              This profile has no links that can be reported.
            </Text>
          ) : (
            <>
              <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19 }}>
                Pick a link, then choose why it should be reviewed.
              </Text>
              <ScrollView
                style={styles.picker}
                contentContainerStyle={{ gap: 6 }}
                keyboardShouldPersistTaps="handled"
              >
                {reportable.map((link: any) => {
                  const active = selected?.uri === link.uri;
                  return (
                    <Pressable
                      key={link.uri}
                      onPress={() => setSelected(link)}
                      accessibilityRole="radio"
                      accessibilityLabel={`Report ${profileLinkLabel(link)}`}
                      accessibilityHint={profileLinkHost(link.url)}
                      accessibilityState={{ checked: active }}
                      style={({ pressed }) => [
                        styles.linkRow,
                        {
                          borderColor: active ? p.accent : p.divider,
                          backgroundColor: active ? p.accentSoft : p.bg,
                          opacity: pressed ? 0.7 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="link-outline" size={18} color={p.accent} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={{ color: p.text, fontSize: 14, fontWeight: '600' }}
                          numberOfLines={1}
                        >
                          {profileLinkLabel(link)}
                        </Text>
                        <Text
                          style={{ color: p.secondary, fontSize: 11 }}
                          numberOfLines={1}
                        >
                          {profileLinkHost(link.url)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <ScrollView
                style={styles.reasons}
                contentContainerStyle={{ paddingTop: 10, gap: 8 }}
                keyboardShouldPersistTaps="handled"
              >
                {REPORT_REASONS.map((item) => {
                  const active = reason === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => setReason(item.value)}
                      accessibilityRole="radio"
                      accessibilityLabel={item.label}
                      accessibilityHint={item.detail}
                      accessibilityState={{ checked: active }}
                      style={({ pressed }) => [
                        styles.choice,
                        {
                          backgroundColor: pressed ? p.bg : 'transparent',
                          borderColor: active ? p.accent : p.divider,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.radio,
                          { borderColor: active ? p.accent : p.secondary },
                        ]}
                      >
                        {active ? (
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
                  accessibilityLabel="Cancel link report"
                  disabled={busy}
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
                  accessibilityLabel="Send link report"
                  disabled={!reason || !selected || busy}
                  accessibilityState={{ disabled: !reason || !selected || busy, busy }}
                  style={({ pressed }) => [
                    styles.button,
                    {
                      backgroundColor: p.accent,
                      borderColor: p.accent,
                      opacity: !reason || !selected || busy ? 0.45 : pressed ? 0.7 : 1,
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
  picker: { maxHeight: 140, marginTop: 10 },
  linkRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 10,
  },
  reasons: { maxHeight: 280 },
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
    minHeight: 80,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  footer: { flexDirection: 'row', gap: 8, marginTop: 12 },
  button: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  success: { alignItems: 'center', paddingVertical: 18 },
});
