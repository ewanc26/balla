import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { agent, getChatAgent } from '../lib/agent';
import { describeFailure, readWithRetry } from '../lib/reliability';
import { timeAgo } from '../lib/time';
import { CARD_RADIUS, usePalette } from '../theme';
import {
  CHAT_PAGE_SIZE,
  CHAT_TEXT_LIMIT,
  buildPostEmbed,
  canSendMessage,
  chatErrorCopy,
  convoTitle,
  isGroup,
  isPostUri,
  messageKind,
  sendBlockedCopy,
  senderName,
  systemMessageCopy,
  validateMessageText,
} from '../lib/chatModel';
import {
  buildReplyRef,
  groupReactions,
  messageActionable,
  participantCount,
  replyPreview,
} from '../lib/chatGroupModel';
import { MessageActionsSheet } from '../components/MessageActionsSheet';
import { ChatReportSheet } from '../components/ChatReportSheet';
import { GroupParticipantsSheet } from '../components/GroupParticipantsSheet';

const MESSAGE_PAGE_SIZE = 40;

/** Newest-first API pages are rendered oldest-first, by their real sent time. */
function chronological(messages: any[]): any[] {
  return [...messages].sort((a, b) =>
    String(a?.sentAt || '').localeCompare(String(b?.sentAt || ''))
  );
}

/**
 * One conversation. Reads and writes go to the chat service through its proxy;
 * resolving a shared post's CID uses the already-authorised AppView call.
 * Message text is never logged.
 */
export function ConversationScreen() {
  const p = usePalette();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const convoId = String(route.params?.convoId || '');
  const [convo, setConvo] = useState<any>(null);
  // The complete roster comes from getConvoMembers. ConvoView.members is only
  // an "important members" subset, so it cannot satisfy "all participants".
  const [members, setMembers] = useState<any[]>([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  // Profiles for the people who authored or reacted to the loaded messages.
  // getMessages returns these as relatedProfiles; without them a group
  // message's sender DID cannot be turned into a name.
  const [relatedProfiles, setRelatedProfiles] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [draft, setDraft] = useState('');
  const [postUri, setPostUri] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [actionsMessage, setActionsMessage] = useState<any>(null);
  const [reportMessage, setReportMessage] = useState<any>(null);
  const [reportingConvo, setReportingConvo] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          {isGroup(convo) ? (
            <Pressable
              onPress={() => setShowParticipants(true)}
              accessibilityRole="button"
              accessibilityLabel={`Group participants, ${participantCount(members, convo)} members`}
              style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <Ionicons name="people-outline" size={22} color={p.chromeAction} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => navigation.navigate('ConversationSettings', { convoId })}
            accessibilityRole="button"
            accessibilityLabel="Conversation settings"
            style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={p.chromeAction} />
          </Pressable>
        </View>
      ),
    });
  }, [navigation, convoId, convo, members, p.chromeAction]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const chat = getChatAgent();
    try {
      const [convoRes, messageRes, memberRes] = await Promise.all([
        readWithRetry(() => chat.chat.bsky.convo.getConvo({ convoId })),
        readWithRetry(() =>
          chat.chat.bsky.convo.getMessages({ convoId, limit: MESSAGE_PAGE_SIZE })
        ),
        // A failed roster read must not break reading or sending messages.
        // Fall back to the subset on ConvoView and say so in the sheet.
        chat.chat.bsky.convo.getConvoMembers({ convoId, limit: 100 }).catch(() => null),
      ]);
      setConvo(convoRes.data.convo);
      setMembers(memberRes?.data?.members || convoRes.data.convo?.members || []);
      setMessages(chronological(messageRes.data.messages || []));
      setRelatedProfiles(messageRes.data.relatedProfiles || []);
      setCursor(messageRes.data.cursor);
      navigation.setOptions({ title: convoTitle(convoRes.data.convo, agent.did) });
      // Opening a conversation marks it read up to the latest message.
      const latest = (messageRes.data.messages || [])[0] as any;
      if (latest?.id) {
        await chat.chat.bsky.convo
          .updateRead({ convoId, messageId: latest.id })
          .catch(() => {});
      }
    } catch (err) {
      setError(chatErrorCopy(err));
    }
    setLoading(false);
  }, [convoId, navigation]);

  useEffect(() => {
    void load();
  }, [load]);

  async function loadMore() {
    if (loadingMore || !cursor) return;
    setLoadingMore(true);
    try {
      const res = await readWithRetry(() =>
        getChatAgent().chat.bsky.convo.getMessages({
          convoId,
          limit: MESSAGE_PAGE_SIZE,
          cursor,
        })
      );
      setMessages((prev) => chronological([...(res.data.messages || []), ...prev]));
      setRelatedProfiles((prev) => {
        const seen = new Set(prev.map((profile: any) => profile?.did));
        const fresh = (res.data.relatedProfiles || []).filter(
          (profile: any) => profile?.did && !seen.has(profile.did)
        );
        return fresh.length ? [...prev, ...fresh] : prev;
      });
      setCursor(res.data.cursor);
    } catch (err) {
      setError(describeFailure(err, 'Could not load older messages.'));
    }
    setLoadingMore(false);
  }

  async function send() {
    if (sending) return;
    const validation = validateMessageText(draft);
    if (validation) {
      setError(validation);
      return;
    }
    const trimmedUri = postUri.trim();
    if (showAttach && trimmedUri && !isPostUri(trimmedUri)) {
      setError('Enter an at:// link to a post, for example at://…/app.bsky.feed.post/…');
      return;
    }
    setSending(true);
    setError(null);
    try {
      let embed: ReturnType<typeof buildPostEmbed> | undefined;
      if (showAttach && trimmedUri) {
        const resolved = await agent.getPostThread({ uri: trimmedUri, depth: 0 });
        const cid = (resolved.data.thread as any)?.post?.cid;
        if (!cid) throw new Error('That post is no longer available.');
        embed = buildPostEmbed(trimmedUri, cid);
      }
      const sent = await getChatAgent().chat.bsky.convo.sendMessage({
        convoId,
        message: {
          $type: 'chat.bsky.convo.defs#messageInput',
          text: draft.trim(),
          ...(embed ? { embed } : {}),
          ...(replyTo?.id ? { replyTo: buildReplyRef(replyTo.id) } : {}),
        } as any,
      });
      setMessages((prev) => chronological([...prev, sent.data]));
      setDraft('');
      setPostUri('');
      setShowAttach(false);
      setReplyTo(null);
      await getChatAgent().chat.bsky.convo
        .updateRead({ convoId, messageId: sent.data.id })
        .catch(() => {});
    } catch (err) {
      // Keep the draft on failure so nothing the person wrote is eaten.
      setError(chatErrorCopy(err));
    }
    setSending(false);
  }

  async function acceptRequest() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await getChatAgent().chat.bsky.convo.acceptConvo({ convoId });
      await load();
    } catch (err) {
      setError(chatErrorCopy(err));
    }
    setBusy(false);
  }

  async function toggleMute() {
    if (busy || !convo) return;
    setBusy(true);
    setError(null);
    const muted = !!convo.muted;
    try {
      const chat = getChatAgent();
      const res = muted
        ? await chat.chat.bsky.convo.unmuteConvo({ convoId })
        : await chat.chat.bsky.convo.muteConvo({ convoId });
      setConvo(res.data.convo);
    } catch (err) {
      setError(chatErrorCopy(err));
    }
    setBusy(false);
  }

  async function leave() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await getChatAgent().chat.bsky.convo.leaveConvo({ convoId });
      navigation.goBack();
    } catch (err) {
      setError(chatErrorCopy(err));
      setBusy(false);
    }
  }

  const viewerDid = agent.did || '';
  // Sender DIDs resolve against the convo's member subset and every profile
  // the loaded message pages referred to.
  const senderProfiles = [...(convo?.members || []), ...relatedProfiles];
  const group = isGroup(convo);
  const blocked = !canSendMessage(convo);
  const blockedCopy = sendBlockedCopy(convo);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: p.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={messages}
        keyExtractor={(item: any) => String(item?.id || item?.rev || Math.random())}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View>
            {convo && !canSendMessage(convo) ? (
              <View
                style={{
                  backgroundColor: p.card,
                  borderColor: p.divider,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderRadius: CARD_RADIUS,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <Text style={{ color: p.text, fontSize: 14 }}>{blockedCopy}</Text>
                {convo?.status === 'request' ? (
                  <Pressable
                    onPress={() => void acceptRequest()}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Accept chat request"
                    style={({ pressed }) => [
                      styles.control,
                      { backgroundColor: p.accent, opacity: pressed || busy ? 0.6 : 1 },
                    ]}
                  >
                    <Text style={{ color: p.onAccent, fontWeight: '700' }}>
                      {busy ? 'Working…' : 'Accept request'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {error ? (
              <View style={{ marginBottom: 12, gap: 4 }}>
                <Text style={{ color: p.danger, fontSize: 13 }}>{error}</Text>
                <Pressable
                  onPress={() => void load()}
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading the conversation"
                  style={({ pressed }) => ({
                    minHeight: 44,
                    justifyContent: 'center',
                    alignSelf: 'flex-start',
                    paddingHorizontal: 8,
                    opacity: pressed ? 0.65 : 1,
                  })}
                >
                  <Text style={{ color: p.accent, fontWeight: '700' }}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
            {cursor ? (
              <Pressable
                onPress={() => void loadMore()}
                disabled={loadingMore}
                accessibilityRole="button"
                accessibilityLabel="Load older messages"
                style={({ pressed }) => [
                  styles.olderButton,
                  { borderColor: p.divider, opacity: pressed || loadingMore ? 0.6 : 1 },
                ]}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={p.accent} />
                ) : (
                  <Text style={{ color: p.accent, fontSize: 14, fontWeight: '600' }}>
                    Load older messages
                  </Text>
                )}
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ alignItems: 'center', paddingTop: 40 }}>
              <ActivityIndicator color={p.accent} />
            </View>
          ) : (
            <Text style={{ color: p.secondary, textAlign: 'center', marginTop: 40 }}>
              No messages yet.
            </Text>
          )
        }
        renderItem={({ item }) => {
          const kind = messageKind(item);
          if (kind === 'system') {
            return (
              <View style={styles.systemRow}>
                <Text style={{ color: p.secondary, fontSize: 12, textAlign: 'center' }}>
                  {systemMessageCopy(item?.data)} · {timeAgo(item?.sentAt)}
                </Text>
              </View>
            );
          }
          if (kind === 'deleted') {
            return (
              <View style={styles.systemRow}>
                <Text style={{ color: p.secondary, fontSize: 12 }}>Message deleted</Text>
              </View>
            );
          }
          const mine = !!viewerDid && item?.sender?.did === viewerDid;
          const reactions = groupReactions(item, viewerDid);
          const replyText = replyPreview(item?.replyTo);
          // In a group, a bubble without a name could be anyone. The sender
          // is named from the profiles the message pages returned; a direct
          // conversation needs no label, as the header already names them.
          const sender = group && !mine ? senderName(item, senderProfiles, viewerDid) : '';
          return (
            <View style={[styles.bubbleRow, mine ? styles.mine : styles.theirs]}>
              <View
                style={[
                  styles.bubble,
                  { backgroundColor: mine ? p.accent : p.card, borderColor: p.divider },
                ]}
              >
                {sender ? (
                  <Text
                    style={{ color: p.secondary, fontSize: 11, fontWeight: '700', marginBottom: 2 }}
                  >
                    {sender}
                  </Text>
                ) : null}
                {replyText ? (
                  <Text
                    style={{
                      color: mine ? p.onAccent : p.secondary,
                      fontSize: 11,
                      fontStyle: 'italic',
                      opacity: 0.85,
                    }}
                  >
                    ↳ {replyText}
                  </Text>
                ) : null}
                <Text style={{ color: mine ? p.onAccent : p.text, fontSize: 15 }}>
                  {String(item?.text || '')}
                </Text>
                {item?.embed?.$type === 'app.bsky.embed.record#view' ||
                item?.embed?.$type === 'app.bsky.embed.record' ? (
                  <Pressable
                    onPress={() => {
                      const uri = item?.embed?.record?.uri;
                      if (uri) navigation.navigate('Thread', { uri });
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Open the shared post"
                    style={{ minHeight: 44, justifyContent: 'center', marginTop: 4 }}
                  >
                    <Text
                      style={{
                        color: mine ? p.onAccent : p.accent,
                        fontSize: 13,
                        fontWeight: '600',
                      }}
                    >
                      View shared post
                    </Text>
                  </Pressable>
                ) : null}
                {reactions.length > 0 ? (
                  <View style={styles.reactions}>
                    {reactions.map((reaction) => (
                      <Pressable
                        key={reaction.value}
                        onPress={() =>
                          setActionsMessage(messageActionable(item) ? item : null)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`${reaction.value}, ${reaction.count} ${reaction.count === 1 ? 'reaction' : 'reactions'}${reaction.mine ? ', including yours' : ''}. Open message actions`}
                        style={({ pressed }) => [
                          styles.reaction,
                          {
                            borderColor: reaction.mine ? p.accent : p.divider,
                            backgroundColor: reaction.mine ? p.accentSoft : p.bg,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text style={{ color: p.text, fontSize: 12 }}>
                          {reaction.value} {reaction.count}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View style={styles.bubbleFooter}>
                  <Text
                    style={{
                      color: mine ? p.onAccent : p.secondary,
                      fontSize: 11,
                      opacity: 0.8,
                    }}
                  >
                    {timeAgo(item?.sentAt)}
                  </Text>
                  {messageActionable(item) ? (
                    <Pressable
                      onPress={() => setActionsMessage(item)}
                      accessibilityRole="button"
                      accessibilityLabel="Message actions: reply, react, report or delete"
                      style={({ pressed }) => [
                        styles.messageAction,
                        { opacity: pressed ? 0.5 : 0.8 },
                      ]}
                    >
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={16}
                        color={mine ? p.onAccent : p.secondary}
                      />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>
          );
        }}
      />

      <View
        style={[
          styles.composer,
          { backgroundColor: p.card, borderTopColor: p.divider },
        ]}
      >
        {replyTo ? (
          <View style={[styles.replyBanner, { borderColor: p.divider }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: p.secondary, fontSize: 11, fontWeight: '700' }}>
                Replying to{' '}
                {replyTo?.sender?.did === viewerDid
                  ? 'your message'
                  : senderName(replyTo, senderProfiles, viewerDid) || 'a message'}
              </Text>
              <Text numberOfLines={1} style={{ color: p.text, fontSize: 13 }}>
                {replyPreview(replyTo)}
              </Text>
            </View>
            <Pressable
              onPress={() => setReplyTo(null)}
              accessibilityRole="button"
              accessibilityLabel="Cancel reply"
              style={({ pressed }) => [
                styles.replyCancel,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="close" size={20} color={p.secondary} />
            </Pressable>
          </View>
        ) : null}
        {showAttach ? (
          <TextInput
            value={postUri}
            onChangeText={setPostUri}
            placeholder="at://…/app.bsky.feed.post/…"
            placeholderTextColor={p.secondary}
            accessibilityLabel="at:// link to the post to attach"
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.input,
              { color: p.text, borderColor: p.divider, marginBottom: 6 },
            ]}
          />
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
          <Pressable
            onPress={() => setShowAttach((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={showAttach ? 'Remove post attachment' : 'Attach a post'}
            style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Ionicons name="link-outline" size={22} color={p.secondary} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={blocked ? blockedCopy : 'Write a message'}
            placeholderTextColor={p.secondary}
            accessibilityLabel="Message text"
            editable={!blocked}
            multiline
            maxLength={CHAT_TEXT_LIMIT}
            style={[
              styles.input,
              { color: p.text, borderColor: p.divider, maxHeight: 120 },
            ]}
          />
          <Pressable
            onPress={() => void send()}
            disabled={sending || blocked}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={({ pressed }) => [
              styles.send,
              {
                backgroundColor: p.accent,
                opacity: pressed || sending || blocked ? 0.5 : 1,
              },
            ]}
          >
            {sending ? (
              <ActivityIndicator size="small" color={p.onAccent} />
            ) : (
              <Ionicons name="send" size={18} color={p.onAccent} />
            )}
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Pressable
            onPress={() => void toggleMute()}
            disabled={busy || !convo}
            accessibilityRole="button"
            accessibilityLabel={convo?.muted ? 'Unmute this conversation' : 'Mute this conversation'}
            style={({ pressed }) => [styles.secondary, { opacity: pressed || busy ? 0.6 : 1 }]}
          >
            <Text style={{ color: p.accent, fontSize: 13 }}>
              {convo?.muted ? 'Unmute' : 'Mute'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setReportingConvo(true)}
            disabled={!convo}
            accessibilityRole="button"
            accessibilityLabel="Report this conversation"
            style={({ pressed }) => [styles.secondary, { opacity: pressed || !convo ? 0.6 : 1 }]}
          >
            <Text style={{ color: p.danger, fontSize: 13 }}>Report conversation</Text>
          </Pressable>
          <Pressable
            onPress={() => void leave()}
            disabled={busy || !convo}
            accessibilityRole="button"
            accessibilityLabel="Leave this conversation"
            style={({ pressed }) => [styles.secondary, { opacity: pressed || busy ? 0.6 : 1 }]}
          >
            <Text style={{ color: p.danger, fontSize: 13 }}>Leave conversation</Text>
          </Pressable>
        </ScrollView>
      </View>

      <GroupParticipantsSheet
        visible={showParticipants}
        members={members}
        viewerDid={viewerDid}
        onClose={() => setShowParticipants(false)}
      />
      {actionsMessage ? (
        <MessageActionsSheet
          convoId={convoId}
          message={actionsMessage}
          viewerDid={viewerDid}
          onClose={() => setActionsMessage(null)}
          onReply={(message) => setReplyTo(message)}
          onReport={(message) => setReportMessage(message)}
          onMessageUpdated={(message) => {
            setMessages((prev) =>
              prev.map((item) => (item?.id === message?.id ? message : item))
            );
          }}
        />
      ) : null}
      {reportMessage ? (
        <ChatReportSheet
          target={{ kind: 'message', convoId, message: reportMessage, members: convo?.members }}
          onClose={() => {
            setReportMessage(null);
            void load();
          }}
        />
      ) : null}
      {reportingConvo ? (
        <ChatReportSheet
          target={{ kind: 'convo', convoId, members: convo?.members }}
          onClose={() => {
            setReportingConvo(false);
            void load();
          }}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubbleRow: { flexDirection: 'row', marginVertical: 4 },
  mine: { justifyContent: 'flex-end' },
  theirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '82%',
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  systemRow: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 24 },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  control: {
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  secondary: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  olderButton: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  reaction: {
    minHeight: 28,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  messageAction: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginHorizontal: -10, marginVertical: -8 },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  replyCancel: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
