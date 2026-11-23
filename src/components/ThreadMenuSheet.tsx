import React, { useRef } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
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
import { CARD_RADIUS, usePalette } from '../theme';
import {
  wallToWallName,
  type WallToWallPartner,
} from '../lib/wallToWallModel';

/**
 * The Thread header's menu. Wall-to-wall actions are listed only when the
 * screen finds both the viewer and at least one other author in the visible
 * thread. Nothing here reads or writes the network.
 */
export function ThreadMenuSheet({
  visible,
  partners,
  activeDid,
  onClose,
  onSelect,
  onViewFull,
}: {
  visible: boolean;
  partners: WallToWallPartner[];
  activeDid: string | null;
  onClose: () => void;
  onSelect: (did: string) => void;
  onViewFull: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
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
          {...dialogAccessibilityProps('Thread view')}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: p.card,
              borderColor: p.divider,
              paddingBottom: Math.max(insets.bottom, 8),
            },
          ]}
        >
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: p.text, fontSize: 19, fontWeight: '700' }}>
                Thread view
              </Text>
              <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}>
                Wall-to-wall shows only your posts and one other person’s, in
                thread order. Everyone else is left out by author. It is still a
                public thread.
              </Text>
            </View>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close thread menu"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={22} color={p.secondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} accessibilityRole="menu">
            {partners.map((partner) => {
              const active = partner.did === activeDid;
              const name = wallToWallName(partner);
              return (
                <Pressable
                  key={partner.did}
                  onPress={() => onSelect(partner.did)}
                  accessibilityRole="menuitemradio"
                  accessibilityLabel={`Wall-to-wall with ${name}`}
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
                    name="people-outline"
                    size={21}
                    color={active ? p.accent : p.secondary}
                  />
                  <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                    <Text
                      numberOfLines={1}
                      style={{ color: p.text, fontSize: 16, fontWeight: '700' }}
                    >
                      Wall-to-wall with {name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}
                    >
                      {active
                        ? 'Showing now · View full thread to exit'
                        : 'Only your posts and theirs, in thread order'}
                    </Text>
                  </View>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={23} color={p.accent} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {activeDid ? (
            <Pressable
              onPress={onViewFull}
              accessibilityRole="button"
              accessibilityLabel="View full thread"
              style={({ pressed }) => [
                styles.manage,
                { borderTopColor: p.divider, opacity: pressed ? 0.65 : 1 },
              ]}
            >
              <Ionicons name="arrow-back-outline" size={19} color={p.accent} />
              <Text
                style={{
                  color: p.accent,
                  fontSize: 15,
                  fontWeight: '700',
                  marginLeft: 10,
                }}
              >
                View full thread
              </Text>
            </Pressable>
          ) : null}
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
    maxHeight: 360,
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
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
  },
});
