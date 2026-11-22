import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  dialogAccessibilityProps,
  sheetAnimation,
  useDialogFocus,
  useReducedMotion,
} from '../lib/accessibility';
import { describeFailure } from '../lib/reliability';
import {
  parseActivitySubscription,
  putActivitySubscription,
  toggleActivitySubscription,
} from '../lib/activitySubscriptions';
import { CARD_RADIUS, usePalette } from '../theme';

/**
 * Mirrors the official subscribe-profile dialog: opt in to an account's posts
 * and, optionally, its replies. Replies cannot be selected without posts. The
 * write goes through the AppView's published putActivitySubscription RPC.
 */
export function SubscribeProfileSheet({
  visible,
  did,
  handle,
  current,
  onClose,
  onSaved,
}: {
  visible: boolean;
  did: string;
  handle: string;
  current: unknown;
  onClose: () => void;
  onSaved: (value: { post: boolean; reply: boolean }) => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const containerRef = useRef<any>(null);
  const closeRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  const [state, setState] = useState(() => parseActivitySubscription(current));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setState(parseActivitySubscription(current));
      setError(null);
    }
  }, [visible, current]);

  useDialogFocus({
    visible,
    onClose,
    containerRef,
    initialFocusRef: closeRef,
  });

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await putActivitySubscription(did, state);
      onSaved(state);
      onClose();
    } catch (err) {
      setError(
        describeFailure(
          err,
          'Could not save this preference. Your choices are still here; try again.'
        )
      );
    } finally {
      setBusy(false);
    }
  }

  if (!visible) return null;

  const options = [
    {
      kind: 'post' as const,
      label: 'Posts',
      detail: `Get notified when @${handle} makes a new post.`,
    },
    {
      kind: 'reply' as const,
      label: 'Posts and replies',
      detail: `Also get notified when @${handle} replies to other people.`,
    },
  ];

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
          {...dialogAccessibilityProps('Activity notifications')}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: p.card,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>
              Activity notifications
            </Text>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.close}
            >
              <Ionicons name="close" size={22} color={p.secondary} />
            </Pressable>
          </View>
          <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20, marginBottom: 14 }}>
            Choose what you want to be notified about for this account. These
            preferences are stored on your Bluesky account.
          </Text>
          {options.map((option) => {
            const selected =
              option.kind === 'post'
                ? state.post && !state.reply
                : state.reply;
            return (
              <Pressable
                key={option.kind}
                onPress={() =>
                  setState((prev) =>
                    option.kind === 'post'
                      ? toggleActivitySubscription(prev, 'post', true)
                      : toggleActivitySubscription(prev, 'reply', true)
                  )
                }
                accessibilityRole="radio"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.option,
                  {
                    borderColor: selected ? p.accent : p.divider,
                    backgroundColor: selected ? p.accentSoft : p.bg,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={selected ? p.accent : p.secondary}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
                    {option.label}
                  </Text>
                  <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                    {option.detail}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setState({ post: false, reply: false })}
            accessibilityRole="radio"
            accessibilityLabel="Off"
            accessibilityState={{ selected: !state.post && !state.reply }}
            style={({ pressed }) => [
              styles.option,
              {
                borderColor: !state.post && !state.reply ? p.accent : p.divider,
                backgroundColor: !state.post && !state.reply ? p.accentSoft : p.bg,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons
              name={!state.post && !state.reply ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={!state.post && !state.reply ? p.accent : p.secondary}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>Off</Text>
              <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                Do not notify me about this account.
              </Text>
            </View>
          </Pressable>
          {error ? (
            <Text style={{ color: p.danger, fontSize: 13, marginTop: 10 }}>{error}</Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => [
                styles.button,
                { borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void save()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Save activity notification settings"
              style={({ pressed }) => [
                styles.button,
                styles.primary,
                { backgroundColor: p.accent, opacity: busy || pressed ? 0.7 : 1 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Save</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  close: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  option: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { borderWidth: 0 },
});
