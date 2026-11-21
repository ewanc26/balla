import React, { useRef } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  dialogAccessibilityProps,
  sheetAnimation,
  useDialogFocus,
  useReducedMotion,
} from '../lib/accessibility';
import { CARD_RADIUS, usePalette } from '../theme';
import type { FeedChoice } from '../lib/feedSwitcher';

/** A visible, keyboard-reachable feed picker, modelled on Facebook's Feeds
 * submenu: one place to choose All/Following or a saved feed, with a route to
 * managing them. No gesture-only or hidden shortcut is required. */
export function FeedSwitcherSheet({
  visible,
  choices,
  selected,
  onClose,
  onSelect,
  onManage,
}: {
  visible: boolean;
  choices: FeedChoice[];
  selected: string | null;
  onClose: () => void;
  onSelect: (value: string | null) => void;
  onManage: () => void;
}) {
  const p = usePalette();
  const containerRef = useRef<any>(null);
  const closeRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus({
    visible,
    onClose,
    containerRef,
    initialFocusRef: closeRef,
  });

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={sheetAnimation(reducedMotion)}
      accessibilityViewIsModal
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.backdrop}
        />
        <View
          ref={containerRef}
          {...dialogAccessibilityProps('Switch feed')}
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: p.card, borderColor: p.divider }]}
        >
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: p.text, fontSize: 19, fontWeight: '700' }}>
                Switch feed
              </Text>
              <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}>
                Following is always newest first. Custom feeds keep their generator’s order.
              </Text>
            </View>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close feed switcher"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={22} color={p.secondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} accessibilityRole="menu">
            {choices.map((choice) => {
              const active = choice.value === selected;
              return (
                <Pressable
                  key={choice.value || 'following'}
                  onPress={() => onSelect(choice.value)}
                  accessibilityRole="menuitemradio"
                  accessibilityLabel={
                    choice.following
                      ? 'Following, chronological feed'
                      : `${choice.label}${choice.creator ? ` by ${choice.creator}` : ''}${choice.pinned ? ', pinned' : ''}`
                  }
                  accessibilityState={{ checked: active }}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      borderBottomColor: p.divider,
                      backgroundColor: active
                        ? p.accentSoft
                        : pressed
                          ? p.bg
                          : 'transparent',
                    },
                  ]}
                >
                  <Ionicons
                    name={choice.following ? 'time-outline' : 'albums-outline'}
                    size={21}
                    color={active ? p.accent : p.secondary}
                  />
                  <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                    <Text
                      numberOfLines={1}
                      style={{ color: p.text, fontSize: 16, fontWeight: '700' }}
                    >
                      {choice.label}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}
                    >
                      {choice.following
                        ? 'Newest first · no ranking or ads'
                        : `${choice.pinned ? 'Pinned · ' : ''}${choice.creator || 'Custom feed'}`}
                    </Text>
                  </View>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={23} color={p.accent} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={onManage}
            accessibilityRole="button"
            accessibilityLabel="Manage saved feeds"
            style={({ pressed }) => [
              styles.manage,
              { borderTopColor: p.divider, opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Ionicons name="settings-outline" size={19} color={p.accent} />
            <Text style={{ color: p.accent, fontSize: 15, fontWeight: '700', marginLeft: 10 }}>
              Manage saved feeds
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
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
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    maxHeight: '82%',
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  list: {
    maxHeight: 460,
  },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  manage: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
