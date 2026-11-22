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
import { getChatAgent } from '../lib/agent';
import {
  dialogAccessibilityProps,
  sheetAnimation,
  useDialogFocus,
  useReducedMotion,
} from '../lib/accessibility';
import { describeFailure } from '../lib/reliability';
import {
  REACTION_CHOICES,
  groupReactions,
  messageActionable,
  validateReactionValue,
} from '../lib/chatGroupModel';
import { CARD_RADIUS, usePalette, webInputReset } from '../theme';

/**
 * Visible actions for one message. Nothing here logs or stores message text;
 * only the message id and reaction value travel to the chat service.
 */
export function MessageActionsSheet({
  convoId,
  message,
  viewerDid,
  onClose,
  onReply,
  onReport,
  onMessageUpdated,
}: {
  convoId: string;
  message: any;
  viewerDid: string;
  onClose: () => void;
  onReply: (message: any) => void;
  onReport: (message: any) => void;
  onMessageUpdated: (message: any) => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<any>(null);
  const closeRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus({ visible: true, onClose, containerRef, initialFocusRef: closeRef });

  const actionable = messageActionable(message);
  const mine = !!viewerDid && message?.sender?.did === viewerDid;
  const mineReactions = new Set(
    groupReactions(message, viewerDid).filter((item) => item.mine).map((item) => item.value)
  );

  async function react(value: string) {
    const validation = validateReactionValue(value);
    if (validation || busy) {
      if (validation) setError(validation);
      return;
    }
    const trimmed = value.trim();
    setBusy(`react:${trimmed}`);
    setError(null);
    try {
      const chat = getChatAgent();
      const remove = mineReactions.has(trimmed);
      const res = remove
        ? await chat.chat.bsky.convo.removeReaction({
            convoId,
            messageId: String(message?.id),
            value: trimmed,
          })
        : await chat.chat.bsky.convo.addReaction({
            convoId,
            messageId: String(message?.id),
            value: trimmed,
          });
      onMessageUpdated(res.data.message);
      setCustom('');
    } catch (err) {
      setError(describeFailure(err, 'Could not change that reaction. Try again.'));
    } finally {
      setBusy(null);
    }
  }

  async function deleteForSelf() {
    if (busy) return;
    setBusy('delete');
    setError(null);
    try {
      const res = await getChatAgent().chat.bsky.convo.deleteMessageForSelf({
        convoId: String(message?.convoId || ''),
        messageId: String(message?.id),
      });
      onMessageUpdated(res.data);
      onClose();
    } catch (err) {
      setError(describeFailure(err, 'Could not delete this message for you. Try again.'));
    } finally {
      setBusy(null);
    }
  }

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
          style={styles.backdrop}
        />
        <View
          ref={containerRef}
          {...dialogAccessibilityProps('Message actions')}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: p.card, paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <View style={styles.header}>
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>Message actions</Text>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close message actions"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={24} color={p.secondary} />
            </Pressable>
          </View>

          {!actionable ? (
            <Text style={{ color: p.secondary, fontSize: 14, marginTop: 10 }}>
              This message can no longer be acted on.
            </Text>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.body}>
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '600', marginTop: 4 }}>
                Add a reaction
              </Text>
              <Text style={{ color: p.secondary, fontSize: 13, marginTop: 4 }}>
                Reactions are stored with the message in your Bluesky conversation.
              </Text>
              <View style={styles.reactions}>
                {REACTION_CHOICES.map((value) => {
                  const selected = mineReactions.has(value);
                  return (
                    <Pressable
                      key={value}
                      onPress={() => void react(value)}
                      disabled={!!busy}
                      accessibilityRole="button"
                      accessibilityLabel={`${selected ? 'Remove' : 'Add'} reaction ${value}`}
                      accessibilityState={{ selected, disabled: !!busy }}
                      style={({ pressed }) => [
                        styles.reaction,
                        {
                          borderColor: selected ? p.accent : p.divider,
                          backgroundColor: selected ? p.accentSoft : p.bg,
                          opacity: pressed || busy ? 0.65 : 1,
                        },
                      ]}
                    >
                      <Text style={{ color: p.text, fontSize: 18 }}>{value}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.customRow}>
                <TextInput
                  value={custom}
                  onChangeText={setCustom}
                  placeholder="Custom reaction"
                  placeholderTextColor={p.secondary}
                  maxLength={16}
                  accessibilityLabel="Custom reaction value"
                  style={[
                    styles.customInput,
                    { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
                    webInputReset,
                  ]}
                />
                <Pressable
                  onPress={() => void react(custom)}
                  disabled={!!busy || !custom.trim()}
                  accessibilityRole="button"
                  accessibilityLabel="Add custom reaction"
                  style={({ pressed }) => [
                    styles.customSend,
                    { backgroundColor: p.accent, opacity: pressed || busy || !custom.trim() ? 0.5 : 1 },
                  ]}
                >
                  {busy === `react:${custom.trim()}` ? (
                    <ActivityIndicator size="small" color={p.onAccent} />
                  ) : (
                    <Text style={{ color: p.onAccent, fontWeight: '700' }}>Add</Text>
                  )}
                </Pressable>
              </View>

              <View style={styles.actions}>
                <Pressable
                  onPress={() => {
                    onReply(message);
                    onClose();
                  }}
                  disabled={!!busy}
                  accessibilityRole="button"
                  accessibilityLabel="Reply to this message"
                  style={({ pressed }) => [
                    styles.action,
                    { backgroundColor: p.bg, borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="return-up-back-outline" size={20} color={p.text} />
                  <Text style={{ color: p.text, fontWeight: '600' }}>Reply</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onReport(message);
                    onClose();
                  }}
                  disabled={!!busy}
                  accessibilityRole="button"
                  accessibilityLabel="Report this message"
                  style={({ pressed }) => [
                    styles.action,
                    { backgroundColor: p.bg, borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="flag-outline" size={20} color={p.text} />
                  <Text style={{ color: p.text, fontWeight: '600' }}>Report</Text>
                </Pressable>
              </View>

              {mine ? (
                confirmDelete ? (
                  <View style={styles.confirm}>
                    <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19 }}>
                      Delete this message only for you? Everyone else in the
                      conversation will still see it.
                    </Text>
                    <View style={styles.confirmButtons}>
                      <Pressable
                        onPress={() => setConfirmDelete(false)}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel delete for me"
                        style={({ pressed }) => [
                          styles.confirmButton,
                          { borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
                        ]}
                      >
                        <Text style={{ color: p.text, fontWeight: '600' }}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void deleteForSelf()}
                        disabled={!!busy}
                        accessibilityRole="button"
                        accessibilityLabel="Confirm delete for me"
                        style={({ pressed }) => [
                          styles.confirmButton,
                          { backgroundColor: p.danger, opacity: pressed || busy ? 0.7 : 1 },
                        ]}
                      >
                        {busy === 'delete' ? (
                          <ActivityIndicator size="small" color={p.onAccent} />
                        ) : (
                          <Text style={{ color: p.onAccent, fontWeight: '700' }}>Delete</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setConfirmDelete(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Delete this message for me"
                    style={({ pressed }) => [
                      styles.delete,
                      { borderColor: p.danger, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <Text style={{ color: p.danger, fontWeight: '700' }}>Delete for me</Text>
                  </Pressable>
                )
              ) : null}
              {error ? (
                <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 13, marginTop: 10 }}>
                  {error}
                </Text>
              ) : null}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { maxHeight: 520 },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  reaction: { minWidth: 52, minHeight: 44, borderWidth: 1, borderRadius: CARD_RADIUS, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  customRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  customInput: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: CARD_RADIUS, paddingHorizontal: 12, fontSize: 15 },
  customSend: { minWidth: 64, minHeight: 44, borderRadius: CARD_RADIUS, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  action: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: CARD_RADIUS, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  delete: { minHeight: 44, borderWidth: 1, borderRadius: CARD_RADIUS, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  confirm: { marginTop: 12, gap: 10 },
  confirmButtons: { flexDirection: 'row', gap: 8 },
  confirmButton: { flex: 1, minHeight: 44, borderRadius: CARD_RADIUS, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
