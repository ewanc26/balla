import React, { useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getChatAgent } from '../lib/agent';
import { chatErrorCopy } from '../lib/chatModel';
import {
  joinPreviewCopy,
  joinPreviewTitle,
  joinRequestCount,
  validateJoinCode,
} from '../lib/chatGroupModel';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';

/**
 * Joining happens through a real invite code. The preview comes from the chat
 * service before any request is sent, so a disabled or invalid link is shown
 * as such rather than turning into an unexplained failure.
 */
export function JoinGroupScreen() {
  const p = usePalette();
  const navigation = useNavigation<any>();
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'joined'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Join a group' });
  }, [navigation]);

  async function lookUp() {
    const validation = validateJoinCode(code);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const res = await getChatAgent().chat.bsky.group.getJoinLinkPreviews({
        codes: [code.trim()],
      });
      setPreview((res.data.joinLinkPreviews || [])[0] || null);
    } catch (err) {
      setError(chatErrorCopy(err));
    }
    setBusy(false);
  }

  async function join() {
    if (busy || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const res = await getChatAgent().chat.bsky.group.requestJoin({ code: code.trim() });
      if (res.data.status === 'joined' && res.data.convo?.id) {
        setStatus('joined');
        navigation.navigate('Conversation', { convoId: res.data.convo.id });
      } else {
        setStatus('pending');
      }
    } catch (err) {
      setError(chatErrorCopy(err));
    }
    setBusy(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}>
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>Invite code</Text>
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
          Ask the group owner for their invite code. Balla shows the real group
          name and member count before you ask to join.
        </Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          onSubmitEditing={() => void lookUp()}
          placeholder="Paste invite code"
          placeholderTextColor={p.secondary}
          accessibilityLabel="Group invite code"
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            styles.input,
            { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
            webInputReset,
          ]}
        />
        <Pressable
          onPress={() => void lookUp()}
          disabled={busy || !code.trim()}
          accessibilityRole="button"
          accessibilityLabel="Look up this invite code"
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: p.accent, opacity: pressed || busy || !code.trim() ? 0.5 : 1 },
          ]}
        >
          {busy && !preview ? (
            <ActivityIndicator size="small" color={p.onAccent} />
          ) : (
            <Text style={{ color: p.onAccent, fontWeight: '700' }}>Check invite</Text>
          )}
        </Pressable>
      </View>

      {error ? (
        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.danger, marginTop: 12 }]}>
          <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 14 }}>
            {error}
          </Text>
        </View>
      ) : null}

      {preview ? (
        <View
          style={[
            styles.card,
            { backgroundColor: p.card, borderColor: p.divider, marginTop: 12 },
            cardShadow,
          ]}
        >
          <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>
            {joinPreviewTitle(preview) || 'Unavailable invite'}
          </Text>
          {joinPreviewCopy(preview) ? (
            <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20, marginTop: 8 }}>
              {joinPreviewCopy(preview)}
            </Text>
          ) : (
            <>
              <Text style={{ color: p.secondary, fontSize: 14, marginTop: 8 }}>
                {preview.memberCount ?? 0}
                {typeof preview.memberLimit === 'number'
                  ? ` of ${preview.memberLimit}`
                  : ''}{' '}
                members · owned by @{String(preview.owner?.handle || 'unknown')}
              </Text>
              {status === 'pending' ? (
                <Text style={{ color: p.text, fontSize: 14, marginTop: 12 }}>
                  Request sent. The owner has{' '}
                  {joinRequestCount({ kind: preview })} pending request(s) to review.
                  You will see the group if it is approved.
                </Text>
              ) : (
                <Pressable
                  onPress={() => void join()}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Ask to join this group"
                  style={({ pressed }) => [
                    styles.primary,
                    { backgroundColor: p.accent, opacity: pressed || busy ? 0.6 : 1 },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color={p.onAccent} />
                  ) : (
                    <Text style={{ color: p.onAccent, fontWeight: '700' }}>
                      Ask to join
                    </Text>
                  )}
                </Pressable>
              )}
            </>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CARD_RADIUS, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    fontSize: 15,
    marginTop: 12,
  },
  primary: {
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
});
