import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { countGraphemes } from 'unicode-segmenter/grapheme';
import {
  dialogAccessibilityProps,
  dialogAnimation,
  useDialogFocus,
  useReducedMotion,
} from '../lib/accessibility';
import {
  actionLabel,
  appealAction,
  appealReference,
  describeSubject,
  formatModerationDate,
  formatModerationDateTime,
  isSafeHttpUrl,
  scopeLabel,
  subjectLabel,
  subjectWebUrl,
  type ModerationAction,
} from '../lib/moderationInboxModel';
import {
  appealInboxSubject,
  describeAppealError,
} from '../lib/moderationInbox';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';

const MAX_APPEAL = 2000;

export function InboxCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  const p = usePalette();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: p.card, borderColor: p.divider },
        cardShadow,
      ]}
    >
      {title ? (
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

export function InboxError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const p = usePalette();
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.errorCard,
        {
          backgroundColor: p.card,
          borderColor: 'rgba(228, 30, 63, 0.28)',
        },
      ]}
    >
      <Ionicons name="alert-circle-outline" size={22} color={p.danger} />
      <Text
        style={{
          color: p.danger,
          fontSize: 13,
          lineHeight: 19,
          flex: 1,
          marginLeft: 8,
        }}
      >
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try loading the moderation inbox again"
          style={({ pressed }) => [
            styles.retry,
            {
              borderColor: p.divider,
              backgroundColor: p.bg,
              opacity: pressed ? 0.65 : 1,
            },
          ]}
        >
          <Text style={{ color: p.text, fontSize: 13, fontWeight: '600' }}>
            Retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function InboxEmpty({
  icon,
  title,
  detail,
}: {
  icon: any;
  title: string;
  detail: string;
}) {
  const p = usePalette();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={p.secondary} />
      <Text
        style={{
          color: p.text,
          fontSize: 17,
          fontWeight: '700',
          marginTop: 10,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: p.secondary,
          fontSize: 13,
          lineHeight: 19,
          marginTop: 5,
          textAlign: 'center',
        }}
      >
        {detail}
      </Text>
    </View>
  );
}

export function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'good' | 'warning' | 'danger' | 'pending' | 'muted';
}) {
  const p = usePalette();
  const color =
    tone === 'good'
      ? p.green
      : tone === 'warning'
        ? '#B26A00'
        : tone === 'danger'
          ? p.danger
          : tone === 'pending'
            ? p.accent
            : p.secondary;
  const background =
    tone === 'good'
      ? 'rgba(49, 162, 76, 0.12)'
      : tone === 'warning'
        ? 'rgba(178, 106, 0, 0.12)'
        : tone === 'danger'
          ? 'rgba(228, 30, 63, 0.1)'
          : tone === 'pending'
            ? p.accentSoft
            : p.bg;
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      <Text style={{ color, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function DetailLine({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  const p = usePalette();
  if (!value) return null;
  return (
    <View style={styles.detailLine}>
      <Text style={{ color: p.secondary, fontSize: 12, fontWeight: '600' }}>
        {label}
      </Text>
      <Text
        style={{
          color: p.text,
          fontSize: 13,
          lineHeight: 19,
          marginTop: 2,
        }}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

export function SubjectLink({
  subject,
  record,
  account,
  onOpen,
  perspective = 'report',
}: {
  subject: any;
  record?: any;
  account?: any;
  onOpen?: () => void;
  perspective?: 'report' | 'notice';
}) {
  const p = usePalette();
  const descriptor = describeSubject(subject);
  const label = subjectLabel(subject, perspective);
  const web = subjectWebUrl(subject);
  const recordText =
    record && typeof record.text === 'string' ? record.text.trim() : '';
  const handle =
    account && typeof account.handle === 'string' ? account.handle : '';
  const did =
    descriptor.did ||
    (account && typeof account.did === 'string' ? account.did : '');

  return (
    <View style={[styles.subject, { borderColor: p.divider, backgroundColor: p.bg }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={[styles.subjectIcon, { backgroundColor: p.accentSoft }]}>
          <Ionicons
            name={
              descriptor.kind === 'post'
                ? 'chatbubble-ellipses-outline'
                : descriptor.kind === 'account'
                  ? 'person-outline'
                  : 'document-text-outline'
            }
            size={18}
            color={p.accent}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>
            {label}
          </Text>
          {handle ? (
            <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={1}>
              @{handle}
            </Text>
          ) : did ? (
            <Text style={{ color: p.secondary, fontSize: 11 }} numberOfLines={1}>
              {did}
            </Text>
          ) : null}
        </View>
      </View>

      {recordText ? (
        <Text
          style={{
            color: p.text,
            fontSize: 14,
            lineHeight: 20,
            marginTop: 10,
          }}
          numberOfLines={6}
        >
          {recordText}
        </Text>
      ) : descriptor.kind === 'content' || descriptor.kind === 'status' ? (
        <Text style={{ color: p.secondary, fontSize: 12, marginTop: 8 }}>
          The moderation service did not return a preview for this content.
        </Text>
      ) : null}

      {onOpen ? (
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Open ${label.toLowerCase()}`}
          style={({ pressed }) => [
            styles.openButton,
            {
              borderColor: p.divider,
              backgroundColor: pressed ? p.soft : p.card,
            },
          ]}
        >
          <Text style={{ color: p.accent, fontSize: 13, fontWeight: '700' }}>
            Open {descriptor.kind === 'account' ? 'account' : 'post'}
          </Text>
          <Ionicons name="open-outline" size={15} color={p.accent} />
        </Pressable>
      ) : web ? (
        <Pressable
          onPress={() => void Linking.openURL(web).catch(() => {})}
          accessibilityRole="link"
          accessibilityLabel={`Open ${label.toLowerCase()} on Bluesky`}
          style={({ pressed }) => [
            styles.openButton,
            {
              borderColor: p.divider,
              backgroundColor: pressed ? p.soft : p.card,
            },
          ]}
        >
          <Text style={{ color: p.accent, fontSize: 13, fontWeight: '700' }}>
            Open on Bluesky
          </Text>
          <Ionicons name="open-outline" size={15} color={p.accent} />
        </Pressable>
      ) : (
        <Text style={{ color: p.secondary, fontSize: 11, marginTop: 8 }}>
          This item cannot be opened in Balla.
        </Text>
      )}
    </View>
  );
}

export function ActionHistory({
  actions,
  onOpenPolicy,
}: {
  actions: ModerationAction[];
  onOpenPolicy: (url: string) => void;
}) {
  const p = usePalette();
  if (!actions.length) {
    return (
      <Text style={{ color: p.secondary, fontSize: 13 }}>
        No action history was returned for this subject.
      </Text>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      {actions.map((action, index) => {
        const scope = scopeLabel(action.scope);
        return (
          <View key={action.id} style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ alignItems: 'center', width: 12 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: index === 0 ? p.accent : p.secondary,
                  marginTop: 4,
                }}
              />
              {index < actions.length - 1 ? (
                <View
                  style={{
                    width: 2,
                    flex: 1,
                    minHeight: 24,
                    backgroundColor: p.divider,
                    marginTop: 4,
                  }}
                />
              ) : null}
            </View>
            <View style={{ flex: 1, minWidth: 0, paddingBottom: 2 }}>
              <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }}>
                {actionLabel(action.type)}
              </Text>
              <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}>
                {formatModerationDateTime(action.createdAt)}
                {scope ? ` · ${scope}` : ''}
              </Text>
              {action.reversedAt ? (
                <Text style={{ color: p.green, fontSize: 12, marginTop: 3 }}>
                  Reversed {formatModerationDate(action.reversedAt)}
                </Text>
              ) : null}
              {action.expiresAt ? (
                <Text style={{ color: p.secondary, fontSize: 12, marginTop: 3 }}>
                  Expires {formatModerationDateTime(action.expiresAt)}
                </Text>
              ) : null}
              {action.labels?.length ? (
                <Text style={{ color: p.secondary, fontSize: 12, marginTop: 3 }}>
                  Labels: {action.labels.join(', ')}
                </Text>
              ) : null}
              {action.policies?.length ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {action.policies.map((policy) =>
                    isSafeHttpUrl(policy.link) ? (
                      <Pressable
                        key={policy.key}
                        onPress={() => onOpenPolicy(policy.link)}
                        accessibilityRole="link"
                        accessibilityLabel={`Read policy: ${policy.displayName}`}
                        style={({ pressed }) => [
                          styles.policy,
                          {
                            borderColor: p.divider,
                            backgroundColor: pressed ? p.bg : 'transparent',
                          },
                        ]}
                      >
                        <Text
                          style={{ color: p.accent, fontSize: 12, fontWeight: '600' }}
                        >
                          {policy.displayName}
                        </Text>
                        <Ionicons name="open-outline" size={13} color={p.accent} />
                      </Pressable>
                    ) : (
                      <Text
                        key={policy.key}
                        style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}
                      >
                        {policy.displayName}
                      </Text>
                    )
                  )}
                </View>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function AppealModal({
  visible,
  data,
  actions,
  onClose,
  onSubmitted,
}: {
  visible: boolean;
  data: any;
  actions: ModerationAction[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = countGraphemes(reason);
  const over = count > MAX_APPEAL;
  const containerRef = useRef<any>(null);
  const closeButtonRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus({
    visible,
    onClose,
    containerRef,
    initialFocusRef: closeButtonRef,
  });

  useEffect(() => {
    if (!visible) {
      setReason('');
      setBusy(false);
      setError(null);
    }
  }, [visible]);

  if (!visible) return null;

  async function submit() {
    if (busy || over || !reason.trim() || !data?.src) return;
    setBusy(true);
    setError(null);
    try {
      const action = appealAction(data, actions);
      const ref = appealReference(data, action);
      await appealInboxSubject(data.src, {
        subject: data.subject,
        reason: reason.trim(),
        ...(ref ? { action: ref } : {}),
      });
      setReason('');
      onSubmitted();
      onClose();
    } catch (err) {
      setError(describeAppealError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      transparent
      visible
      animationType={dialogAnimation(reducedMotion)}
      statusBarTranslucent
      onRequestClose={busy ? undefined : onClose}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          onPress={busy ? undefined : onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.backdrop}
        />
        <View
          ref={containerRef}
          {...dialogAccessibilityProps('Appeal this decision')}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: p.card,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>
              Appeal this decision
            </Text>
            <Pressable
              ref={closeButtonRef}
              onPress={onClose}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Close appeal"
              style={({ pressed }) => [
                styles.close,
                {
                  backgroundColor: pressed ? p.bg : 'transparent',
                  opacity: busy ? 0.4 : 1,
                },
              ]}
            >
              <Ionicons name="close" size={23} color={p.secondary} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 6 }}
          >
            <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19 }}>
              Tell the moderators why you believe this decision was a mistake. A
              different moderator will review it.
            </Text>
            <Text
              style={{
                color: p.text,
                fontSize: 14,
                fontWeight: '700',
                marginTop: 12,
                marginBottom: 6,
              }}
            >
              Reason for appeal
            </Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              editable={!busy}
              multiline
              autoFocus
              placeholder="Explain what should be reviewed"
              placeholderTextColor={p.secondary}
              accessibilityLabel="Reason for appeal"
              textAlignVertical="top"
              style={[
                styles.input,
                {
                  color: p.text,
                  backgroundColor: p.bg,
                  borderColor: over ? p.danger : p.divider,
                },
                webInputReset,
              ]}
            />
            <View style={styles.counterRow}>
              <Text
                style={{ color: over ? p.danger : p.secondary, fontSize: 12, flex: 1 }}
              >
                {over
                  ? 'Shorten the appeal before submitting.'
                  : 'This explanation goes to the moderation service.'}
              </Text>
              <Text style={{ color: over ? p.danger : p.secondary, fontSize: 12 }}>
                {count}/{MAX_APPEAL}
              </Text>
            </View>
            {error ? (
              <Text
                accessibilityRole="alert"
                style={{ color: p.danger, fontSize: 13, lineHeight: 19, marginTop: 8 }}
              >
                {error}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={onClose}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Cancel appeal"
                style={({ pressed }) => [
                  styles.sheetButton,
                  {
                    backgroundColor: p.bg,
                    borderColor: p.divider,
                    opacity: busy ? 0.5 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void submit()}
                disabled={busy || over || !reason.trim()}
                accessibilityRole="button"
                accessibilityLabel="Submit appeal"
                accessibilityState={{
                  disabled: busy || over || !reason.trim(),
                  busy,
                }}
                style={({ pressed }) => [
                  styles.sheetButton,
                  {
                    backgroundColor: p.accent,
                    borderColor: p.accent,
                    opacity: busy || over || !reason.trim() ? 0.45 : pressed ? 0.7 : 1,
                  },
                ]}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={p.onAccent} />
                ) : (
                  <Text
                    style={{ color: p.onAccent, fontSize: 15, fontWeight: '700' }}
                  >
                    Submit
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    padding: 14,
    marginHorizontal: 8,
    marginBottom: 10,
    gap: 10,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    padding: 12,
    marginHorizontal: 8,
    marginBottom: 10,
  },
  retry: {
    minHeight: 44,
    minWidth: 72,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginLeft: 8,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 52,
    paddingBottom: 40,
  },
  pill: {
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  detailLine: {
    marginTop: 8,
  },
  subject: {
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    padding: 12,
    marginTop: 10,
  },
  subjectIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openButton: {
    minHeight: 44,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  policy: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
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
    maxWidth: 520,
    maxHeight: '88%',
    alignSelf: 'center',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sheetHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 21,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 6,
  },
  sheetButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
