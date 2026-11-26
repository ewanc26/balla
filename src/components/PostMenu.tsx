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
import { useNavigation } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { CARD_RADIUS, usePalette, webInputReset } from '../theme';
import { agent } from '../lib/agent';
import { BLUESKY_WEB } from '../lib/serviceHosts.ts';
import {
  dialogAccessibilityProps,
  dialogAnimation,
  useDialogFocus,
  useReducedMotion,
} from '../lib/accessibility';
import { describeFailure } from '../lib/reliability';
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
import { usePreferences } from '../lib/preferences';
import { languageSummary } from '../lib/postOptions';
import {
  isThreadRootAuthor,
  loadHiddenReplyUris,
  setReplyHidden,
} from '../lib/hiddenReplies';
import {
  canDetachQuote,
  isQuoteDetached,
  setPostPinned,
  setQuoteDetached,
  setThreadMuted,
} from '../lib/postActions';
import type { FeedbackKind } from '../lib/feedFeedbackModel';
import { hidePostForMe } from '../lib/hiddenPosts';
import {
  endSnooze,
  loadSnoozes,
  snoozeAccount,
} from '../lib/snooze';
import { snoozeRemainingLabel } from '../lib/snoozeModel';
import { canSharePost } from '../lib/shareViaChatModel';
import { canOfferEdit } from '../lib/postEditModel';
import { ShareViaChatSheet } from './ShareViaChatSheet';

type Mode = 'menu' | 'report' | 'confirm-block' | 'confirm-delete' | 'confirm-hide';
type HideScope = 'post' | 'author';

/** Share-via-chat needs a signed-in viewer and a post with a real strong ref. */
export function canShareViaChat(post: any, did?: string): boolean {
  return !!did && canSharePost(post);
}

interface PostMenuProps {
  post: any;
  visible: boolean;
  onClose: () => void;
  onHidden?: (post: any, scope: HideScope) => void;
  onHiddenReplyChange?: (post: any, hidden: boolean) => void;
  onTranslate?: () => void;
  hasTranslation?: boolean;
  translationVisible?: boolean;
  translationBusy?: boolean;
  onFeedback?: (kind: FeedbackKind) => void;
}

export function PostMenu({
  post,
  visible,
  onClose,
  onHidden,
  onHiddenReplyChange,
  onTranslate,
  hasTranslation = false,
  translationVisible = false,
  translationBusy = false,
  onFeedback,
}: PostMenuProps) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { preferences } = usePreferences();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<Mode>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reportSent, setReportSent] = useState(false);
  const [replyIsHidden, setReplyIsHidden] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isThreadMuted, setIsThreadMuted] = useState(false);
  const [detached, setDetached] = useState(false);
  const [snoozedUntil, setSnoozedUntil] = useState<number | null>(null);
  const [shareChatOpen, setShareChatOpen] = useState(false);
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
    setReplyIsHidden(false);
    setShareChatOpen(false);
    setIsPinned(!!(post && post.viewer && post.viewer.pinned));
    setIsThreadMuted(!!(post && post.viewer && post.viewer.threadMuted));
    setDetached(isQuoteDetached(post && post.embed));
    const snoozeDid = post && post.author && post.author.did;
    if (snoozeDid) {
      void loadSnoozes().then((records) => {
        setSnoozedUntil(records[snoozeDid]?.until ?? null);
      });
    } else {
      setSnoozedUntil(null);
    }
    if (visible && post && post.record && post.record.reply && isThreadRootAuthor(post)) {
      // Only the root post author can read/write this threadgate, and the
      // record lives in their own repo at the root post's rkey.
      void loadHiddenReplyUris(post)
        .then((uris) => setReplyIsHidden(uris.includes(post.uri)))
        .catch(() => setReplyIsHidden(false));
    }
  }, [visible, post]);

  // The share sheet outlives the menu: choosing "Send via direct message"
  // closes the menu, so keep rendering the sheet even while the menu is hidden.
  if (!visible || !post) {
    return shareChatOpen ? (
      <ShareViaChatSheet
        visible
        post={post}
        onClose={() => setShareChatOpen(false)}
      />
    ) : null;
  }

  const author = post.author || {};
  const viewer = author.viewer || {};
  const isOwn = !!author.did && author.did === agent.did;
  // The menu offers Edit only while the local record is still inside its
  // one-edit window. The screen re-checks the window and the account age.
  const editOffer = isOwn ? canOfferEdit(post.record) : null;
  const isReply = !!(post.record && post.record.reply && post.record.reply.parent);
  const canHideForEveryone = isReply && !isOwn && isThreadRootAuthor(post);
  const isMuted = !!viewer.muted;
  const blockingUri =
    typeof viewer.blocking === 'string' ? viewer.blocking : undefined;
  const postKey =
    typeof post.uri === 'string' ? post.uri.split('/').pop() : undefined;
  const postUrl =
    postKey && (author.handle || author.did)
      ? BLUESKY_WEB.post(author.handle || author.did, postKey)
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
          : mode === 'confirm-hide'
            ? isReply
              ? 'Hide reply for me'
              : 'Hide post for me'
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

  async function handleToggleReplyHidden() {
    if (!canHideForEveryone || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const hide = !replyIsHidden;
    try {
      await setReplyHidden(post, post.uri, hide);
      setReplyIsHidden(hide);
      setNotice(
        hide
          ? 'Reply hidden for everyone. Only you can still see it in this thread.'
          : 'Reply is visible to everyone again.'
      );
      onHiddenReplyChange?.(post, hide);
    } catch (err) {
      setError(
        describeFailure(err, 'Could not change this reply’s visibility. Try again.')
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleTogglePin() {
    if (!isOwn || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const pin = !isPinned;
    try {
      await setPostPinned(post, pin);
      setIsPinned(pin);
      setNotice(pin ? 'Post pinned to your profile.' : 'Post unpinned from your profile.');
    } catch (err) {
      setError(describeFailure(err, 'Could not change the pinned post. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleThreadMute() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const mute = !isThreadMuted;
    try {
      await setThreadMuted(post, mute);
      setIsThreadMuted(mute);
      setNotice(
        mute
          ? 'Thread muted. Its replies will be hidden from your feeds.'
          : 'Thread unmuted. Its replies will appear again.'
      );
    } catch (err) {
      setError(describeFailure(err, 'Could not change this thread’s mute. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleQuoteDetach() {
    if (busy || !canDetachQuote(post)) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const detach = !detached;
    try {
      await setQuoteDetached(post, detach);
      setDetached(detach);
      setNotice(
        detach
          ? 'Your quoted post has been detached.'
          : 'Your quoted post is attached again.'
      );
    } catch (err) {
      setError(describeFailure(err, 'Could not change the quote attachment. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  function handleFeedback(kind: FeedbackKind) {
    if (!onFeedback || busy) return;
    onFeedback(kind);
    setNotice('Feedback sent to the feed operator.');
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
    } catch (err) {
      setError(
        describeFailure(
          err,
          `Could not ${isMuted ? 'unmute' : 'mute'} @${
            author.handle || 'this account'
          }. Try again.`
        )
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSnooze() {
    if (!author.did || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await snoozeAccount(author.did, author.handle);
      const records = await loadSnoozes();
      setSnoozedUntil(records[author.did]?.until ?? Date.now());
      setNotice(
        `Snoozed @${author.handle || 'this account'} for 30 days. Only this device hides them from Home.`
      );
    } catch {
      setError('Could not save the snooze on this device. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleEndSnooze() {
    if (!author.did || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await endSnooze(author.did);
      setSnoozedUntil(null);
      setNotice('Snooze ended. Their posts will appear in Home again.');
    } catch {
      setError('Could not end the snooze on this device. Try again.');
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
    } catch (err) {
      setError(
        describeFailure(
          err,
          `Could not ${blockingUri ? 'unblock' : 'block'} @${
            author.handle || 'this account'
          }. Try again.`
        )
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
    } catch (err) {
      // The post is still there: say so, and leave Delete available to retry.
      setError(describeFailure(err, 'Could not delete this post. It is still there; try again.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleHideForMe() {
    if (!post.uri || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Device-local only: no report, no server write. The moderation context
      // subscribes to this store and filters the post on every surface.
      await hidePostForMe(post.uri);
      onHidden?.(post, 'post');
      close();
    } catch {
      setError('Could not hide this post. Try again.');
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
      // Never imply a report was sent when the API refused it.
      setError(
        describeFailure(err, 'Could not send the report. Your reason is still here; try again.')
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
  } else if (mode === 'confirm-hide') {
    content = (
      <>
        <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20 }}>
          {isReply
            ? 'Hide this reply from your feeds and threads on this device. This cannot be undone here.'
            : 'Hide this post from your feeds and threads on this device. This cannot be undone here.'}
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
            label="Hide"
            variant="danger"
            onPress={() => void handleHideForMe()}
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
            detail={`Translate into ${languageSummary([preferences.primaryLanguage])}. Sends the post text to Google.`}
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
        {canShareViaChat(post, agent.did) ? (
          <MenuRow
            icon="paper-plane-outline"
            label="Send via direct message"
            detail="Share this post in a chat."
            onPress={() => {
              onClose();
              setShareChatOpen(true);
            }}
            disabled={busy}
          />
        ) : null}
        <MenuRow
          icon="chatbox-ellipses-outline"
          label="Quote post"
          detail="Add your own comment to this post."
          onPress={handleQuote}
          disabled={busy}
        />
        {isOwn ? (
          <>
            <MenuRow
              icon={isPinned ? 'pin-outline' : 'bookmark-outline'}
              label={isPinned ? 'Unpin from profile' : 'Pin to profile'}
              detail={
                isPinned
                  ? 'Remove this post from the top of your profile.'
                  : 'Feature this post at the top of your profile.'
              }
              onPress={() => void handleTogglePin()}
              disabled={busy}
            />
            {editOffer && editOffer.ok ? (
              <MenuRow
                icon="create-outline"
                label="Edit post"
                detail="Fix a typo within five minutes of posting. You can edit once; likes, reposts and replies reset."
                onPress={() => {
                  onClose();
                  navigation.navigate('EditPost', { uri: post.uri });
                }}
                disabled={busy}
              />
            ) : null}
            <MenuRow
              icon="options-outline"
              label="Interaction settings"
              detail="Choose who can reply and whether this post can be quoted."
              onPress={() => {
                onClose();
                navigation.navigate('InteractionSettings', { uri: post.uri });
              }}
              disabled={busy}
            />
          </>
        ) : null}
        {canDetachQuote(post) ? (
          <MenuRow
            icon="chatbox-outline"
            label={detached ? 'Reattach quote' : 'Detach quote'}
            detail={
              detached
                ? 'Attach your quoted post to this post again.'
                : 'Remove your quoted post from this post.'
            }
            onPress={() => void handleToggleQuoteDetach()}
            disabled={busy}
          />
        ) : null}
        <MenuRow
          icon={isThreadMuted ? 'volume-high-outline' : 'volume-mute-outline'}
          label={isThreadMuted ? 'Unmute thread' : 'Mute thread'}
          detail={
            isThreadMuted
              ? 'Show replies in this thread in your feeds again.'
              : 'Hide this thread and its replies from your feeds.'
          }
          onPress={() => void handleToggleThreadMute()}
          disabled={busy}
        />
        <MenuRow
          icon="text-outline"
          label="Mute words & tags"
          detail="Open Content filters to manage muted words and hashtags."
          onPress={() => {
            onClose();
            navigation.navigate('ContentFilters', { section: 'muted-words' });
          }}
          disabled={busy}
        />
        {onFeedback ? (
          <>
            <MenuRow
              icon="happy-outline"
              label="Show more like this"
              detail="Tell this feed's operator you want more posts like this."
              onPress={() => handleFeedback('more')}
              disabled={busy}
            />
            <MenuRow
              icon="sad-outline"
              label="Show less like this"
              detail="Tell this feed's operator you want fewer posts like this."
              onPress={() => handleFeedback('less')}
              disabled={busy}
            />
          </>
        ) : null}
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
            <MenuRow
              icon="eye-off-outline"
              label={isReply ? 'Hide reply for me' : 'Hide post for me'}
              detail="Hide this from your feeds and threads on this device only."
              onPress={() => openMode('confirm-hide')}
              disabled={busy}
            />
            {canHideForEveryone ? (
              <MenuRow
                icon={replyIsHidden ? 'eye-outline' : 'eye-off-outline'}
                label={replyIsHidden ? 'Unhide reply for everyone' : 'Hide reply for everyone'}
                detail={
                  replyIsHidden
                    ? 'Show this reply to everyone in your thread again.'
                    : 'Hide this reply from everyone in your thread. Only you will still see it.'
                }
                onPress={() => void handleToggleReplyHidden()}
                disabled={busy}
              />
            ) : null}
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
          style={[styles.backdrop, { backgroundColor: p.overlay }]}
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
              accessibilityLabel="Close post options"
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
          { backgroundColor: danger ? p.dangerSoft : p.accentSoft },
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
  const foreground =
    variant === 'secondary' ? p.text : variant === 'danger' ? p.onDanger : p.onAccent;
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
