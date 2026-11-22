import React, { useCallback, useEffect, useState } from 'react';
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
  isPostUri,
  messageKind,
  sendBlockedCopy,
  systemMessageCopy,
  validateMessageText,
} from '../lib/chatModel';

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
  const [messages, setMessages] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [draft, setDraft] = useState('');
  const [postUri, setPostUri] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const chat = getChatAgent();
    try {
      const [convoRes, messageRes] = await Promise.all([
        readWithRetry(() => chat.chat.bsky.convo.getConvo({ convoId })),
        readWithRetry(() =>
          chat.chat.bsky.convo.getMessages({ convoId, limit: MESSAGE_PAGE_SIZE })
        ),
      ]);
      setConvo(convoRes.data.convo);
      setMessages(chronological(messageRes.data.messages || []));
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
        },
      });
      setMessages((prev) => chronological([...prev, sent.data]));
      setDraft('');
      setPostUri('');
      setShowAttach(false);
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

  const viewerDid = agent.did;
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
          return (
            <View style={[styles.bubbleRow, mine ? styles.mine : styles.theirs]}>
              <View
                style={[
                  styles.bubble,
                  { backgroundColor: mine ? p.accent : p.card, borderColor: p.divider },
                ]}
              >
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
                <Text
                  style={{
                    color: mine ? p.onAccent : p.secondary,
                    fontSize: 11,
                    marginTop: 4,
                    opacity: 0.8,
                  }}
                >
                  {timeAgo(item?.sentAt)}
                </Text>
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
});
