import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
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
  muteRepostsActor,
  notifyActorHidden,
  reportProfile,
  REPORT_REASONS,
  unblockActor,
  unmuteActor,
} from '../lib/moderation';
import type { ReportReason } from '../lib/moderation';
import { buildProfileShareUrl, profileShareText } from '../lib/profileShareModel';
import { reportableProfileLinks } from '../lib/reportModel';
import { agent } from '../lib/agent';
import { useViewer } from '../lib/viewer';
import {
  canVerifyProfile,
  issuedVerificationUris,
  issueVerificationAsViewer,
  removeMyVerification,
} from '../lib/verificationActions';
import {
  DEFAULT_DURATION_MINUTES,
  DURATION_MINUTES,
  displayDuration,
  endLiveStatus,
  liveLinkFromStatus,
  loadMyLiveStatus,
  normaliseLiveLink,
  statusIsActive,
  upsertLiveStatus,
} from '../lib/liveStatus';
import {
  endSnooze,
  loadSnoozes,
  snoozeAccount,
} from '../lib/snooze';
import { snoozeRemainingLabel } from '../lib/snoozeModel';

type Mode =
  | 'menu'
  | 'report'
  | 'confirm-block'
  | 'confirm-verify'
  | 'confirm-remove-verification'
  | 'live-form'
  | 'live-confirm-end';

interface ProfileMenuProps {
  profile: any;
  visible: boolean;
  onClose: () => void;
  onViewerChange: (viewer: Record<string, any>) => void;
  onReload: () => void;
  onReportLink?: () => void;
}

export function ProfileMenu({
  profile,
  visible,
  onClose,
  onViewerChange,
  onReload,
  onReportLink,
}: ProfileMenuProps) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile: viewerProfile } = useViewer();
  const [mode, setMode] = useState<Mode>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reportSent, setReportSent] = useState(false);
  const [liveActive, setLiveActive] = useState(false);
  const [liveLink, setLiveLink] = useState('');
  const [liveDuration, setLiveDuration] = useState(DEFAULT_DURATION_MINUTES);
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
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
    setNotice(null);
    setReportSent(false);
    if (agent.did && profile?.did === agent.did) {
      void loadMyLiveStatus()
        .then((stored) => {
          const status = stored?.value;
          const active = statusIsActive(status);
          setLiveActive(active);
          setLiveLink(liveLinkFromStatus(status) || '');
          if (typeof status?.record?.durationMinutes === 'number') {
            setLiveDuration(status.record.durationMinutes);
          }
        })
        .catch(() => setLiveActive(false));
    } else {
      setLiveActive(false);
    }
    const snoozeDid = profile?.did;
    if (snoozeDid) {
      void loadSnoozes().then((records) => {
        setSnoozedUntil(records[snoozeDid]?.until ?? null);
      });
    } else {
      setSnoozedUntil(null);
    }
  }, [visible, profile?.did]);

  if (!visible || !profile) return null;

  const viewer = profile.viewer || {};
  const isMuted = !!viewer.muted;
  const isMutedOnlyReposts = !!viewer.mutedOnlyReposts && !isMuted;
  const reportableLinks = reportableProfileLinks(profile.links);
  const profileUrl = buildProfileShareUrl(profile);
  const blockingUri =
    typeof viewer.blocking === 'string' ? viewer.blocking : undefined;
  const handle = profile.handle || 'this account';
  const viewerDid = viewerProfile?.did || agent.did;
  const isOwn = !!viewerDid && viewerDid === profile.did;
  const canVerify = canVerifyProfile(viewerProfile, profile.did);
  const hasIssued =
    !!viewerDid && issuedVerificationUris(profile, viewerDid).length > 0;

  const title =
    mode === 'report'
      ? 'Report account'
      : mode === 'confirm-block'
        ? blockingUri
          ? 'Unblock account'
          : 'Block account'
        : mode === 'confirm-verify'
          ? 'Verify account'
          : mode === 'confirm-remove-verification'
            ? 'Remove verification'
            : mode === 'live-form'
              ? liveActive
                ? 'Edit live status'
                : 'Go live'
              : mode === 'live-confirm-end'
                ? 'End live status'
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
        onViewerChange({ muted: false, mutedOnlyReposts: false });
        onReload();
      } else {
        await muteActor(profile.did);
        onViewerChange({ muted: true, mutedOnlyReposts: false });
        notifyActorHidden(profile.did);
      }
      close();
    } catch {
      setError(`Could not ${isMuted ? 'unmute' : 'mute'} @${handle}. Try again.`);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleRepostMute() {
    if (busy || isMuted) return;
    setBusy(true);
    setError(null);
    try {
      if (isMutedOnlyReposts) {
        await unmuteActor(profile.did);
        onViewerChange({ muted: false, mutedOnlyReposts: false });
      } else {
        await muteRepostsActor(profile.did);
        onViewerChange({ muted: false, mutedOnlyReposts: true });
      }
      onReload();
      close();
    } catch {
      setError(
        `Could not ${isMutedOnlyReposts ? 'show' : 'hide'} reposts from @${handle}. Try again.`
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyProfileLink() {
    setError(null);
    setNotice(null);
    if (!profileUrl) {
      setError('This profile has no shareable address.');
      return;
    }
    try {
      await Clipboard.setStringAsync(profileUrl);
      setNotice('Profile link copied to the clipboard.');
    } catch {
      setError('Could not copy the profile link. Try again.');
    }
  }

  async function handleShareProfile() {
    setError(null);
    setNotice(null);
    if (!profileUrl) {
      setError('This profile has no shareable address.');
      return;
    }
    const text = profileShareText(profile);
    try {
      if (Platform.OS === 'web') {
        const webNavigator = (globalThis as any).navigator;
        if (webNavigator && typeof webNavigator.share === 'function') {
          await webNavigator.share({ title: text, text, url: profileUrl });
        } else {
          await Clipboard.setStringAsync(profileUrl);
          setNotice('Sharing is not available in this browser. Link copied instead.');
        }
      } else {
        await Share.share({ message: `${text}\n\n${profileUrl}`, url: profileUrl });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Could not share this profile. Try copying the link instead.');
    }
  }

  async function handleSnooze() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await snoozeAccount(profile.did, profile.handle);
      const records = await loadSnoozes();
      setSnoozedUntil(records[profile.did]?.until ?? Date.now());
      setNotice(
        `Snoozed @${handle} for 30 days. Only this device hides them from Home.`
      );
    } catch {
      setError('Could not save the snooze on this device. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleEndSnooze() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await endSnooze(profile.did);
      setSnoozedUntil(null);
      setNotice('Snooze ended. Their posts will appear in Home again.');
    } catch {
      setError('Could not end the snooze on this device. Try again.');
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

  async function handleIssueVerification() {
    if (!canVerify || busy) return;
    setBusy(true);
    setError(null);
    try {
      await issueVerificationAsViewer(viewerProfile, profile);
      onReload();
      close();
    } catch {
      setError(`Could not verify @${handle}. Try again.`);
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveVerification() {
    if (!hasIssued || busy) return;
    setBusy(true);
    setError(null);
    try {
      await removeMyVerification(profile);
      onReload();
      close();
    } catch {
      setError(`Could not remove your verification of @${handle}. Try again.`);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoLive() {
    if (busy) return;
    const link = normaliseLiveLink(liveLink);
    if (liveLink.trim() && !link) {
      setError('Enter a valid http(s) link, or leave it blank.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await upsertLiveStatus(link || undefined, liveDuration);
      setLiveActive(true);
      onReload();
      close();
    } catch {
      setError('Could not update your live status. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleEndLive() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await endLiveStatus();
      setLiveActive(false);
      onReload();
      close();
    } catch {
      setError('Could not end your live status. Try again.');
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
  } else if (mode === 'confirm-verify') {
    content = (
      <>
        <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20 }}>
          Verify @{handle}? This publishes a verification record in your account and
          can be undone at any time.
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
            label="Verify"
            onPress={() => void handleIssueVerification()}
            disabled={busy}
            busy={busy}
          />
        </View>
      </>
    );
  } else if (mode === 'confirm-remove-verification') {
    content = (
      <>
        <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20 }}>
          Remove your verification of @{handle}? This deletes the verification
          record from your account.
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
            label="Remove"
            variant="danger"
            onPress={() => void handleRemoveVerification()}
            disabled={busy}
            busy={busy}
          />
        </View>
      </>
    );
  } else if (mode === 'live-form') {
    content = (
      <>
        <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20 }}>
          Add a temporary live status to your profile. People who open your
          profile will see it until it expires.
        </Text>
        <TextInput
          value={liveLink}
          onChangeText={setLiveLink}
          placeholder="https://twitch.tv/your-stream (optional)"
          placeholderTextColor={p.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          accessibilityLabel="Live link"
          style={[
            styles.input,
            { color: p.text, borderColor: p.divider, backgroundColor: p.bg },
          ]}
        />
        <Text style={{ color: p.secondary, fontSize: 13, fontWeight: '600' }}>
          Duration: {displayDuration(liveDuration)}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {DURATION_MINUTES.map((minutes) => (
            <Pressable
              key={minutes}
              onPress={() => setLiveDuration(minutes)}
              accessibilityRole="button"
              accessibilityLabel={`Duration ${displayDuration(minutes)}`}
              accessibilityState={{ selected: minutes === liveDuration }}
              style={[
                styles.durationChip,
                {
                  borderColor: minutes === liveDuration ? p.accent : p.divider,
                  backgroundColor: minutes === liveDuration ? p.accent : p.bg,
                },
              ]}
            >
              <Text
                style={{
                  color: minutes === liveDuration ? p.onAccent : p.text,
                  fontSize: 13,
                  fontWeight: '600',
                }}
              >
                {displayDuration(minutes)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {error ? <ErrorNote message={error} /> : null}
        <View style={styles.footerRow}>
          <SheetButton
            label="Cancel"
            variant="secondary"
            onPress={() => openMode('menu')}
            disabled={busy}
          />
          <SheetButton
            label={liveActive ? 'Update' : 'Go live'}
            onPress={() => void handleGoLive()}
            disabled={busy}
            busy={busy}
          />
        </View>
      </>
    );
  } else if (mode === 'live-confirm-end') {
    content = (
      <>
        <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20 }}>
          End your live status now? The status record is removed from your
          account.
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
            label="End live"
            variant="danger"
            onPress={() => void handleEndLive()}
            disabled={busy}
            busy={busy}
          />
        </View>
      </>
    );
  } else {
    content = (
      <>
        {isOwn ? (
          <MenuRow
            icon="radio-outline"
            label={liveActive ? 'Edit live status' : 'Go live'}
            detail={
              liveActive
                ? 'Update your current live status.'
                : 'Add a temporary live status to your profile.'
            }
            onPress={() => openMode('live-form')}
            disabled={busy}
          />
        ) : null}
        {isOwn && liveActive ? (
          <MenuRow
            icon="radio-button-off-outline"
            label="End live status"
            detail="Remove your live status now."
            danger
            onPress={() => openMode('live-confirm-end')}
            disabled={busy}
          />
        ) : null}
        {canVerify ? (
          <MenuRow
            icon={hasIssued ? 'checkmark-circle-outline' : 'checkmark-circle-outline'}
            label={hasIssued ? 'Remove verification' : 'Verify account'}
            detail={
              hasIssued
                ? 'Withdraw the verification record you issued to this account.'
                : 'Publish a verification record for this account.'
            }
            onPress={() => openMode(hasIssued ? 'confirm-remove-verification' : 'confirm-verify')}
            disabled={busy}
          />
        ) : null}
        {isOwn ? null : (
          <>
            <MenuRow
              icon="share-outline"
              label="Share via…"
              detail="Send a link to this profile elsewhere."
              onPress={() => void handleShareProfile()}
              disabled={busy}
            />
            <MenuRow
              icon="link-outline"
              label="Copy link to profile"
              detail="Copy this profile’s public address."
              onPress={() => void handleCopyProfileLink()}
              disabled={busy}
            />
            <MenuRow
              icon="flag-outline"
              label="Report account"
              detail="Send this account to Bluesky moderation."
              onPress={() => openMode('report')}
              disabled={busy}
            />
            {reportableLinks.length ? (
              <MenuRow
                icon="alert-circle-outline"
                label="Report a link"
                detail="Choose one of this profile’s links to report."
                onPress={() => {
                  onClose();
                  onReportLink?.();
                }}
                disabled={busy || !onReportLink}
              />
            ) : null}
            {isMuted ? null : (
              <MenuRow
                icon="repeat-outline"
                label={
                  isMutedOnlyReposts
                    ? 'Show reposts in feeds'
                    : 'Hide reposts in feeds'
                }
                detail={
                  isMutedOnlyReposts
                    ? 'Show reposts from this account in your feeds again.'
                    : 'Hide only this account’s reposts from your feeds.'
                }
                onPress={() => void handleToggleRepostMute()}
                disabled={busy}
              />
            )}
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
            {snoozedUntil && snoozedUntil > Date.now() ? (
              <MenuRow
                icon="sunny-outline"
                label="End snooze"
                detail={`Snoozed, ${snoozeRemainingLabel(
                  snoozedUntil,
                  Date.now()
                )}. Hidden from Home on this device only. Tap to show this account again.`}
                onPress={() => void handleEndSnooze()}
                disabled={busy}
              />
            ) : (
              <MenuRow
                icon="moon-outline"
                label="Snooze for 30 days"
                detail="Hide this account from Home on this device. They are not told."
                onPress={() => void handleSnooze()}
                disabled={busy}
              />
            )}
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
          </>
        )}
        {notice ? (
          <Text
            accessibilityRole="alert"
            style={{ color: p.green, fontSize: 13, lineHeight: 19, marginTop: 8 }}
          >
            {notice}
          </Text>
        ) : null}
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
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    fontSize: 14,
    marginTop: 2,
  },
  durationChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    marginRight: 8,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
