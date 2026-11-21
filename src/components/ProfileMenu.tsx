import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  dialogAccessibilityProps,
  dialogAnimation,
  useDialogFocus,
  useReducedMotion,
} from '../lib/accessibility';
import { CARD_RADIUS, usePalette, webInputReset } from '../theme';
import {
  blockActor,
  muteActor,
  notifyActorHidden,
  reportProfile,
  REPORT_REASONS,
  unblockActor,
  unmuteActor,
} from '../lib/moderation';
import type { ReportReason } from '../lib/moderation';

type Mode = 'menu' | 'report' | 'confirm-block';

interface ProfileMenuProps {
  profile: any;
  visible: boolean;
  onClose: () => void;
  onViewerChange: (viewer: Record<string, any>) => void;
  onReload: () => void;
}

export function ProfileMenu({
  profile,
  visible,
  onClose,
  onViewerChange,
  onReload,
}: ProfileMenuProps) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportSent, setReportSent] = useState(false);
  const containerRef = useRef<any>(null);
  const closeButtonRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus({
    visible,
    onClose: close,
    containerRef,
    initialFocusRef: closeButtonRef,
  });

  useEffect(() => {
    if (!visible) return;
    setMode('menu');
    setReason(null);
    setDetails('');
    setBusy(false);
    setError(null);
    setReportSent(false);
  }, [visible]);

  if (!visible || !profile) return null;

  const viewer = profile.viewer || {};
  const isMuted = !!viewer.muted;
  const blockingUri =
    typeof viewer.blocking === 'string' ? viewer.blocking : undefined;
  const handle = profile.handle || 'this account';

  const title =
    mode === 'report'
      ? 'Report account'
      : mode === 'confirm-block'
        ? blockingUri
          ? 'Unblock account'
          : 'Block account'
        : 'Account options';

  function close() {
    if (!busy) onClose();
  }

  function openMode(next: Mode) {
    if (busy) return;
    setError(null);
    setMode(next);
  }

  async function handleMute() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (isMuted) {
        await unmuteActor(profile.did);
        onViewerChange({ muted: false });
        onReload();
      } else {
        await muteActor(profile.did);
        onViewerChange({ muted: true });
        notifyActorHidden(profile.did);
      }
      close();
    } catch {
      setError(`Could not ${isMuted ? 'unmute' : 'mute'} @${handle}. Try again.`);
    } finally {
      setBusy(false);
    }
  }

  async function handleBlock() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (blockingUri) {
        await unblockActor(blockingUri);
        onViewerChange({ blocking: undefined });
        onReload();
      } else {
        const uri = await blockActor(profile.did);
        onViewerChange({ blocking: uri });
        notifyActorHidden(profile.did);
      }
      close();
    } catch {
      setError(
        `Could not ${blockingUri ? 'unblock' : 'block'} @${handle}. Try again.`
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReport() {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      await reportProfile(profile, reason, details);
      setReportSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const permissionIssue = /scope|permission|unauthor|forbidden|auth/i.test(
        message
      );
      setError(
        permissionIssue
          ? 'Your session needs renewing before it can send reports. Sign out, sign in again, and retry.'
          : 'Could not send the report. Check your connection and try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  let content: React.ReactNode;
  if (reportSent) {
    content = (
      <View style={styles.success}>
        <Ionicons name="checkmark-circle" size={44} color={p.green} />
        <Text style={{ color: p.text, fontSize: 19, fontWeight: '700', marginTop: 10 }}>
          Report sent
        </Text>
        <Text
          style={{
            color: p.secondary,
            fontSize: 14,
            lineHeight: 20,
            textAlign: 'center',
            marginTop: 6,
          }}
        >
          Bluesky’s moderation service will review this account. They will not be
          told who reported them.
        </Text>
        <SheetButton label="Done" onPress={close} />
      </View>
    );
  } else if (mode === 'report') {
    content = (
      <>
        <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20 }}>
          Reports go to Bluesky’s moderation service. The account will not be told.
        </Text>
        <ScrollView
          style={{ maxHeight: 330 }}
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
                  styles.reportChoice,
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
                    <View style={[styles.radioDot, { backgroundColor: p.accent }]} />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>
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
              { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
              webInputReset,
            ]}
          />
        </ScrollView>
        {error ? <ErrorNote message={error} /> : null}
        <View style={styles.footerRow}>
          <SheetButton
            label="Back"
            variant="secondary"
            onPress={() => openMode('menu')}
            disabled={busy}
          />
          <SheetButton
            label="Send report"
            onPress={() => void handleReport()}
            disabled={!reason || busy}
            busy={busy}
          />
        </View>
      </>
    );
  } else if (mode === 'confirm-block') {
    content = (
      <>
        <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20 }}>
          {blockingUri
            ? `@${handle} will be able to see and interact with your posts again.`
            : `@${handle} will not be able to see or interact with your posts. Their posts will be hidden from you.`}
        </Text>
        {error ? <ErrorNote message={error} /> : null}
        <View style={styles.footerRow}>
          <SheetButton
            label="Cancel"
            variant="secondary"
            onPress={() => openMode('menu')}
            disabled={busy}
          />
          <SheetButton
            label={blockingUri ? 'Unblock' : 'Block'}
            variant={blockingUri ? 'primary' : 'danger'}
            onPress={() => void handleBlock()}
            disabled={busy}
            busy={busy}
          />
        </View>
      </>
    );
  } else {
    content = (
      <>
        <MenuRow
          icon="flag-outline"
          label="Report account"
          detail="Send this account to Bluesky moderation."
          onPress={() => openMode('report')}
          disabled={busy}
        />
        <MenuRow
          icon={isMuted ? 'volume-high-outline' : 'volume-mute-outline'}
          label={isMuted ? 'Unmute account' : 'Mute account'}
          detail={
            isMuted
              ? 'Show this account in your feeds again.'
              : 'Hide this account without blocking it.'
          }
          onPress={() => void handleMute()}
          disabled={busy}
        />
        <MenuRow
          icon={blockingUri ? 'person-add-outline' : 'ban-outline'}
          label={blockingUri ? 'Unblock account' : 'Block account'}
          detail={
            blockingUri
              ? 'Allow this account to interact with you again.'
              : 'Stop this account from seeing or interacting with you.'
          }
          danger={!blockingUri}
          onPress={() => openMode('confirm-block')}
          disabled={busy}
        />
        {error ? <ErrorNote message={error} /> : null}
        {busy ? <ActivityIndicator color={p.accent} style={{ marginTop: 8 }} /> : null}
        <Pressable
          onPress={close}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Cancel account options"
          style={({ pressed }) => [
            styles.cancel,
            { backgroundColor: pressed ? p.bg : 'transparent', borderColor: p.divider },
          ]}
        >
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
        </Pressable>
      </>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType={dialogAnimation(reducedMotion)}
      onRequestClose={close}
      accessibilityViewIsModal
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable
          onPress={close}
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
            {
              width: Math.min(Math.max(width - 16, 280), 480),
              backgroundColor: p.card,
              paddingBottom: Math.max(insets.bottom, 14),
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>
              {title}
            </Text>
            <Pressable
              ref={closeButtonRef}
              onPress={close}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Close account options"
              accessibilityState={{ disabled: busy }}
              hitSlop={8}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={23} color={p.secondary} />
            </Pressable>
          </View>
          {content}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MenuRow({
  icon,
  label,
  detail,
  danger,
  onPress,
  disabled,
}: {
  icon: any;
  label: string;
  detail: string;
  danger?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? p.bg : 'transparent',
          borderBottomColor: p.divider,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: danger ? 'rgba(228, 30, 63, 0.1)' : p.accentSoft },
        ]}
      >
        <Ionicons name={icon} size={20} color={danger ? p.danger : p.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: danger ? p.danger : p.text, fontSize: 15, fontWeight: '600' }}>
          {label}
        </Text>
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 1 }}>
          {detail}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color={p.secondary} />
    </Pressable>
  );
}

function SheetButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  busy?: boolean;
}) {
  const p = usePalette();
  const background =
    variant === 'primary' ? p.accent : variant === 'danger' ? p.danger : p.bg;
  const foreground = variant === 'secondary' ? p.text : p.onAccent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      style={({ pressed }) => [
        styles.sheetButton,
        {
          backgroundColor: background,
          borderColor: variant === 'secondary' ? p.divider : background,
          opacity: disabled || busy ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}
    >
      {busy ? <ActivityIndicator color={foreground} size="small" /> : null}
      <Text
        style={{
          color: foreground,
          fontSize: 15,
          fontWeight: '700',
          marginLeft: busy ? 7 : 0,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ErrorNote({ message }: { message: string }) {
  const p = usePalette();
  return (
    <Text
      accessibilityRole="alert"
      style={{ color: p.danger, fontSize: 13, lineHeight: 19, marginTop: 10 }}
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheet: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  sheetHeader: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: {
    minHeight: 48,
    marginTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportChoice: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  details: {
    minHeight: 88,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 19,
    textAlignVertical: 'top',
    marginTop: 2,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  sheetButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 10,
  },
  success: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
});
