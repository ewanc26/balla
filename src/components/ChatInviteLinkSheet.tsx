import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { openExternalUrl } from '../lib/openLink';
import { BLUESKY_WEB } from '../lib/serviceHosts.ts';
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
import { JOIN_RULES, joinLinkEnabled, joinRuleLabel } from '../lib/chatGroupModel';
import { CARD_RADIUS, usePalette } from '../theme';
import { Toggle } from './Toggle';

/** Owner controls for a group's join link. The code is the shareable part. */
export function ChatInviteLinkSheet({
  convoId,
  link,
  onClose,
  onUpdated,
}: {
  convoId: string;
  link: any;
  onClose: () => void;
  onUpdated: (link: any) => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [rule, setRule] = useState<string>('anyone');
  const [approval, setApproval] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<any>(null);
  const closeRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus({ visible: true, onClose, containerRef, initialFocusRef: closeRef });

  useEffect(() => {
    if (link?.joinRule) setRule(String(link.joinRule));
    if (typeof link?.requireApproval === 'boolean') setApproval(link.requireApproval);
  }, [link]);

  async function run(key: string, call: () => Promise<any>) {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      const res = await call();
      onUpdated(res.data.joinLink);
    } catch (err) {
      setError(describeFailure(err, 'Could not update the invite link. Try again.'));
    } finally {
      setBusy(null);
    }
  }

  const enabled = joinLinkEnabled(link);

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
          {...dialogAccessibilityProps('Invite link')}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: p.card, paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <View style={styles.header}>
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>Invite link</Text>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close invite link"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={24} color={p.secondary} />
            </Pressable>
          </View>
          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19 }}>
              Anyone with the code can open Bluesky's join page. Balla shows the
              real code; it does not create a shortened or tracking link.
            </Text>

            {link?.code ? (
              <View style={[styles.codeCard, { backgroundColor: p.bg, borderColor: p.divider }]}>
                <Text style={{ color: p.secondary, fontSize: 12 }}>Invite code</Text>
                <Text selectable style={{ color: p.text, fontSize: 15, fontFamily: 'monospace' }}>
                  {String(link.code)}
                </Text>
                <Text style={{ color: p.secondary, fontSize: 12, marginTop: 6 }}>
                  Status: {enabled ? 'Active' : 'Disabled'}
                </Text>
                <Pressable
                  onPress={() => void openExternalUrl(BLUESKY_WEB.chatInvite(String(link.code)))}
                  accessibilityRole="link"
                  accessibilityLabel="Open the official join page for this invite"
                  style={({ pressed }) => [
                    styles.open,
                    { borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={{ color: p.accent, fontWeight: '600' }}>Open join page</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={[styles.section, { color: p.text }]}>Who can use the link</Text>
            {JOIN_RULES.map((item) => (
              <Pressable
                key={item.value}
                onPress={() => setRule(item.value)}
                accessibilityRole="radio"
                accessibilityLabel={item.label}
                accessibilityState={{ checked: rule === item.value }}
                style={({ pressed }) => [
                  styles.choice,
                  {
                    borderColor: rule === item.value ? p.accent : p.divider,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ color: rule === item.value ? p.accent : p.text, fontWeight: '600' }}>
                  {item.label}
                </Text>
              </Pressable>
            ))}

            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Text style={{ color: p.text, fontWeight: '600', flex: 1 }}>Require my approval</Text>
              <Toggle
                label="Require owner approval before someone joins"
                value={approval}
                onChange={setApproval}
              />
            </View>

            {error ? (
              <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 13, marginTop: 10 }}>
                {error}
              </Text>
            ) : null}

            <View style={styles.actions}>
              {link ? (
                <Pressable
                  onPress={() =>
                    void run(
                      enabled ? 'disable' : 'enable',
                      () =>
                        enabled
                          ? getChatAgent().chat.bsky.group.disableJoinLink({ convoId })
                          : getChatAgent().chat.bsky.group.enableJoinLink({ convoId })
                    )
                  }
                  disabled={!!busy}
                  accessibilityRole="button"
                  accessibilityLabel={enabled ? 'Disable invite link' : 'Enable invite link'}
                  style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: p.bg, borderColor: p.divider, opacity: pressed || busy ? 0.7 : 1 },
                  ]}
                >
                  <Text style={{ color: p.text, fontWeight: '600' }}>
                    {busy === 'disable' || busy === 'enable'
                      ? 'Working…'
                      : enabled
                        ? 'Disable link'
                        : 'Enable link'}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() =>
                  void run(
                    'save',
                    () =>
                      link
                        ? getChatAgent().chat.bsky.group.editJoinLink({
                            convoId,
                            joinRule: rule,
                            requireApproval: approval,
                          })
                        : getChatAgent().chat.bsky.group.createJoinLink({
                            convoId,
                            joinRule: rule,
                            requireApproval: approval,
                          })
                  )
                }
                disabled={!!busy}
                accessibilityRole="button"
                accessibilityLabel={link ? 'Save invite link rules' : 'Create invite link'}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: p.accent, borderColor: p.accent, opacity: pressed || busy ? 0.5 : 1 },
                ]}
              >
                {busy === 'save' ? (
                  <ActivityIndicator size="small" color={p.onAccent} />
                ) : (
                  <Text style={{ color: p.onAccent, fontWeight: '700' }}>
                    {link ? 'Save rules' : 'Create link'}
                  </Text>
                )}
              </Pressable>
            </View>
            {link ? (
              <Text style={{ color: p.secondary, fontSize: 12, marginTop: 8 }}>
                Current rule: {joinRuleLabel(String(link.joinRule))}.{' '}
                {link.requireApproval ? 'Approval is required.' : 'No approval is required.'}
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
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '90%',
    alignSelf: 'center',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  body: { maxHeight: 520 },
  codeCard: { borderWidth: 1, borderRadius: CARD_RADIUS, padding: 12, marginTop: 12 },
  open: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderRadius: CARD_RADIUS, paddingHorizontal: 12, marginTop: 10 },
  section: { fontSize: 15, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  choice: { minHeight: 44, borderWidth: 1, borderRadius: CARD_RADIUS, paddingHorizontal: 12, justifyContent: 'center', marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  button: { flex: 1, minHeight: 44, borderRadius: CARD_RADIUS, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
