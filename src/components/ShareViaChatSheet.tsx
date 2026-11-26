import React, { useEffect, useRef, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { agent, getChatAgent } from '../lib/agent';
import {
  dialogAccessibilityProps,
  sheetAnimation,
  useDialogFocus,
  useReducedMotion,
} from '../lib/accessibility';
import { describeFailure } from '../lib/reliability';
import {
  chatErrorCopy,
  convoSubtitle,
  convoTitle,
} from '../lib/chatModel';
import {
  buildShareMessage,
  canSharePost,
  isGroupConvo,
  recentConvos,
  shareTargetLabel,
} from '../lib/shareViaChatModel';
import { CARD_RADIUS, usePalette, webInputReset } from '../theme';

type Person = { did?: string; handle?: string; displayName?: string; avatar?: string };

/**
 * Mirrors the official "Send post to..." dialog: pick a recent conversation or
 * a person, then send the post as an `app.bsky.embed.record` strong ref. A new
 * 1:1 chat is resolved through getConvoForMembers; no message text is logged.
 */
export function ShareViaChatSheet({
  visible,
  post,
  onClose,
}: {
  visible: boolean;
  post: any;
  onClose: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [convos, setConvos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<any>(null);
  const closeRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus({ visible, onClose, containerRef, initialFocusRef: closeRef });

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setQuery('');
    setResults([]);
    setSearched(false);
    setError(null);
    setLoading(true);
    getChatAgent()
      .chat.bsky.convo.listConvos({ limit: 30 })
      .then((res: any) => {
        if (active) setConvos(recentConvos(res.data.convos || []));
      })
      .catch(() => {
        if (active) setConvos([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible]);

  async function search() {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setSearched(true);
    setError(null);
    try {
      const res = await agent.searchActors({ q, limit: 30 });
      setResults(
        (res.data.actors || []).filter(
          (actor: any) => actor.did && actor.did !== agent.did
        ) as Person[]
      );
    } catch (err) {
      setResults([]);
      setError(describeFailure(err, 'Could not search for accounts. Try again.'));
    } finally {
      setSearching(false);
    }
  }

  async function sendTo(convoId: string) {
    if (sending) return;
    if (!canSharePost(post)) {
      setError('This post cannot be shared into a chat.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await getChatAgent().chat.bsky.convo.sendMessage({
        convoId,
        message: buildShareMessage(post) as any,
      });
      onClose();
      navigation.navigate('Conversation', { convoId });
    } catch (err) {
      setError(chatErrorCopy(err));
      setSending(false);
    }
  }

  async function startAndSend(did: string) {
    if (sending) return;
    if (!canSharePost(post)) {
      setError('This post cannot be shared into a chat.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await getChatAgent().chat.bsky.convo.getConvoForMembers({
        members: [did],
      });
      await getChatAgent().chat.bsky.convo.sendMessage({
        convoId: res.data.convo.id,
        message: buildShareMessage(post) as any,
      });
      onClose();
      navigation.navigate('Conversation', { convoId: res.data.convo.id });
    } catch (err) {
      setError(chatErrorCopy(err));
      setSending(false);
    }
  }

  if (!visible) return null;

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
          {...dialogAccessibilityProps('Send post to')}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: p.card, paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <View style={styles.header}>
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>Send post to…</Text>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close share dialog"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={24} color={p.secondary} />
            </Pressable>
          </View>

          {error ? (
            <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 13, marginTop: 6 }}>
              {error}
            </Text>
          ) : null}

          <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
            {loading ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={p.accent} />
            ) : null}
            {!loading && convos.length ? (
              <Text style={[styles.section, { color: p.secondary }]}>RECENT CHATS</Text>
            ) : null}
            {convos.map((convo) => (
              <Pressable
                key={convo.id}
                onPress={() => void sendTo(convo.id)}
                disabled={sending}
                accessibilityRole="button"
                accessibilityLabel={`Send post to ${shareTargetLabel(convo, agent.did)}`}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: pressed ? p.bg : 'transparent', opacity: sending ? 0.6 : 1 },
                ]}
              >
                <View style={[styles.avatar, { backgroundColor: p.accentSoft }]}>
                  <Ionicons
                    name={isGroupConvo(convo) ? 'people-outline' : 'person-outline'}
                    size={20}
                    color={p.accent}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                    {convoTitle(convo, agent.did) || shareTargetLabel(convo, agent.did)}
                  </Text>
                  <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={1}>
                    {convoSubtitle(convo, agent.did)}
                  </Text>
                </View>
                {sending ? <ActivityIndicator size="small" color={p.accent} /> : null}
              </Pressable>
            ))}
            <Text style={[styles.section, { color: p.secondary, marginTop: 12 }]}>NEW CHAT</Text>
            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={() => void search()}
                placeholder="Search accounts"
                placeholderTextColor={p.secondary}
                accessibilityLabel="Search accounts by name or handle"
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.input,
                  { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
                  webInputReset,
                ]}
              />
              <Pressable
                onPress={() => void search()}
                disabled={searching || !query.trim()}
                accessibilityRole="button"
                accessibilityLabel="Search for accounts"
                style={({ pressed }) => [
                  styles.searchButton,
                  {
                    backgroundColor: p.accent,
                    opacity: pressed || searching || !query.trim() ? 0.5 : 1,
                  },
                ]}
              >
                {searching ? (
                  <ActivityIndicator size="small" color={p.onAccent} />
                ) : (
                  <Text style={{ color: p.onAccent, fontWeight: '700' }}>Search</Text>
                )}
              </Pressable>
            </View>
            {results.map((person) => {
              const did = String(person.did || '');
              return (
                <Pressable
                  key={did}
                  onPress={() => void startAndSend(did)}
                  disabled={sending}
                  accessibilityRole="button"
                  accessibilityLabel={`Send post to ${person.displayName || (person.handle ? `@${person.handle}` : did)}`}
                  style={({ pressed }) => [
                    styles.row,
                    { backgroundColor: pressed ? p.bg : 'transparent', opacity: sending ? 0.6 : 1 },
                  ]}
                >
                  <View style={[styles.avatar, { backgroundColor: p.accentSoft }]}>
                    <Ionicons name="person-add-outline" size={20} color={p.accent} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                      {person.displayName || (person.handle ? `@${person.handle}` : did)}
                    </Text>
                    {person.handle && person.displayName ? (
                      <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={1}>
                        @{person.handle}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
            {searched && results.length === 0 && !error ? (
              <Text style={{ color: p.secondary, fontSize: 14, paddingVertical: 16 }}>
                No matching accounts.
              </Text>
            ) : null}
          </ScrollView>
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
    maxHeight: '88%',
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
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 10, marginBottom: 2 },
  results: { maxHeight: 460, marginTop: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 8,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  input: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  searchButton: {
    minWidth: 88,
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
