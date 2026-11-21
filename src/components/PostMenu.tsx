import React, { useEffect, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { CARD_RADIUS, usePalette, webInputReset } from '../theme';
import { agent } from '../lib/agent';
import {
  blockActor,
  deletePost,
  muteActor,
  notifyActorHidden,
  reportPost,
  REPORT_REASONS,
  unblockActor,
  unmuteActor,
} from '../lib/moderation';
import type { ReportReason } from '../lib/moderation';

type Mode = 'menu' | 'report' | 'confirm-block' | 'confirm-delete';
type HideScope = 'post' | 'author';

interface PostMenuProps {
  post: any;
  visible: boolean;
  onClose: () => void;
  onHidden?: (post: any, scope: HideScope) => void;
  onTranslate?: () => void;
  hasTranslation?: boolean;
  translationVisible?: boolean;
  translationBusy?: boolean;
}

export function PostMenu({
  post,
  visible,
  onClose,
  onHidden,
  onTranslate,
  hasTranslation = false,
  translationVisible = false,
  translationBusy = false,
}: PostMenuProps) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reportSent, setReportSent] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMode('menu');
    setReason(null);
    setDetails('');
    setBusy(false);
    setError(null);
    setNotice(null);
    setReportSent(false);
  }, [visible]);

  if (!visible || !post) return null;

  const author = post.author || {};
  const viewer = author.viewer || {};
  const isOwn = !!author.did && author.did === agent.did;
  const isMuted = !!viewer.muted;
  const blockingUri =
    typeof viewer.blocking === 'string' ? viewer.blocking : undefined;
  const postKey =
    typeof post.uri === 'string' ? post.uri.split('/').pop() : undefined;
  const postUrl =
    postKey && (author.handle || author.did)
      ? `https://bsky.app/profile/${author.handle || author.did}/post/${postKey}`
      : post.uri || '';

  const title =
    mode === 'report'
      ? 'Report post'
      : mode === 'confirm-block'
        ? blockingUri
          ? 'Unblock account'
          : 'Block account'
        : mode === 'confirm-delete'
          ? 'Delete post'
          : 'Post options';

  function close() {
    if (!busy) onClose();
  }

  function openMode(next: Mode) {
    if (busy) return;
    setError(null);
    setNotice(null);
    setMode(next);
  }

  async function handleCopyLink() {
    setError(null);
    setNotice(null);
    try {
      await Clipboard.setStringAsync(postUrl);
      setNotice('Link copied to the clipboard.');
    } catch {
      setError('Could not copy the link. Try again.');
    }
  }

  async function handleCopyText() {
    setError(null);
    setNotice(null);
    const text = post.record && post.record.text;
    if (!text) return;
    try {
      await Clipboard.setStringAsync(text);
      setNotice('Post text copied to the clipboard.');
    } catch {
      setError('Could not copy the post text. Try again.');
    }
  }

  async function handleShare() {
    setError(null);
    setNotice(null);
    const text = post.record && post.record.text ? `${post.record.text}\n\n` : '';
    try {
      if (Platform.OS === 'web') {
        const webNavigator = (globalThis as any).navigator;
        if (webNavigator && typeof webNavigator.share === 'function') {
          await webNavigator.share({
            title: author.displayName || author.handle || 'Bluesky post',
            text,
            url: postUrl,
          });
        } else {
          await Clipboard.setStringAsync(postUrl);
          setNotice('Sharing is not available in this browser. Link copied instead.');
        }
      } else {
        await Share.share({ message: `${text}${postUrl}`, url: postUrl });
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Could not share this post. Try copying the link instead.');
    }
  }

  function handleQuote() {
    if (busy) return;
    onClose();
    navigation.navigate('Compose', { quote: post });
  }

  async function handleMute() {
    if (!author.did || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (isMuted) {
        await unmuteActor(author.did);
        close();
      } else {
        await muteActor(author.did);
        notifyActorHidden(author.did);
        onHidden?.(post, 'author');
        close();
      }
    } catch {
      setError(
        `Could not ${isMuted ? 'unmute' : 'mute'} @${
          author.handle || 'this account'
        }. Try again.`
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleBlock() {
    if (!author.did || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (blockingUri) {
        await unblockActor(blockingUri);
        close();
      } else {
        await blockActor(author.did);
        notifyActorHidden(author.did);
        onHidden?.(post, 'author');
        close();
      }
    } catch {
      setError(
        `Could not ${blockingUri ? 'unblock' : 'block'} @${
          author.handle || 'this account'
        }. Try again.`
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!post.uri || busy) return;
    setBusy(true);
    setError(null);
    try {
      await deletePost(post.uri);
      onHidden?.(post, 'post');
      close();
    } catch {
      setError('Could not delete this post. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleReport() {
    if (!reason || busy) return;
    setBusy(true);
    setError(null);
    try {
      await reportPost(post, reason, details);
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
          Bluesky’s moderation service will review this post. The author will not
          be told who reported it.
        </Text>
        <SheetButton label="Done" onPress={close} />
      </View>
    );
  } else if (mode === 'report') {
    content = (
      <>
        <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20 }}>
          Reports go to Bluesky’s moderation service. The author will not be told.
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
              {
                color: p.text,
                backgroundColor: p.bg,
                borderColor: p.divider,
              },
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
            ? `@${author.handle || 'this account'} will be able to see and interact with your posts again.`
            : `@${author.handle || 'this account'} will not be able to see or interact with your posts. Their posts will be hidden from you.`}
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
  } else if (mode === 'confirm-delete') {
    content = (
      <>
        <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20 }}>
          This removes the post from Bluesky permanently. It cannot be undone.
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
            label="Delete"
            variant="danger"
            onPress={() => void handleDelete()}
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
          icon="link-outline"
          label="Copy link"
          detail="Copy a link to this post."
          onPress={() => void handleCopyLink()}
          disabled={busy}
        />
        {post.record && post.record.text ? (
          <MenuRow
            icon="document-text-outline"
            label="Copy post text"
            detail="Copy the words of this post."
            onPress={() => void handleCopyText()}
            disabled={busy}
          />
        ) : null}
        {post.record && post.record.text && onTranslate ? (
          <MenuRow
            icon="language-outline"
            label={
              translationBusy
                ? 'Translating…'
                : translationVisible
                  ? 'Hide translation'
                  : hasTranslation
                    ? 'Show translation'
                    : 'Translate post'
            }
            detail="Translate into English. Sends the post text to Google."
            onPress={() => {
              onClose();
              onTranslate();
            }}
            disabled={busy || translationBusy}
          />
        ) : null}
        <MenuRow
          icon="share-outline"
          label="Share"
          detail="Send this post elsewhere."
          onPress={() => void handleShare()}
          disabled={busy}
        />
        <MenuRow
          icon="chatbox-ellipses-outline"
          label="Quote post"
          detail="Add your own comment to this post."
          onPress={handleQuote}
          disabled={busy}
        />
        {isOwn ? (
          <MenuRow
            icon="trash-outline"
            label="Delete post"
            detail="Remove this post from Bluesky permanently."
            danger
            onPress={() => openMode('confirm-delete')}
            disabled={busy}
          />
        ) : (
          <>
            <MenuRow
              icon="flag-outline"
              label="Report post"
              detail="Send this post to Bluesky moderation."
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
          accessibilityLabel="Cancel post options"
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
      animationType="fade"
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
              onPress={close}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Close post options"
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
