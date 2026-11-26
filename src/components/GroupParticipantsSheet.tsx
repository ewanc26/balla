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
import {
  orderedParticipants,
  participantCount,
  participantLabel,
  participantSubtitle,
} from '../lib/chatGroupModel';
import { CARD_RADIUS, usePalette } from '../theme';

/**
 * The full group roster from getConvoMembers (#193). Names come only from the
 * member view; a display name, handle or DID is shown as supplied. No invite,
 * ranking or presence state is invented, and nothing is written.
 */
export function GroupParticipantsSheet({
  visible,
  members,
  viewerDid,
  onClose,
}: {
  visible: boolean;
  members: any[] | undefined;
  viewerDid: string;
  onClose: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const containerRef = useRef<any>(null);
  const closeRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus({ visible, onClose, containerRef, initialFocusRef: closeRef });

  if (!visible) return null;

  const people = orderedParticipants(members, viewerDid);
  const count = participantCount(members);

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
          {...dialogAccessibilityProps('Group participants')}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: p.card, paddingBottom: Math.max(insets.bottom, 20) },
          ]}
        >
          <View style={styles.header}>
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>
              Participants
            </Text>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close participants"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={24} color={p.secondary} />
            </Pressable>
          </View>
          <Text style={{ color: p.secondary, fontSize: 13, marginTop: 4 }}>
            {count
              ? `${count} member${count === 1 ? '' : 's'} in this group.`
              : 'The member list is not available right now.'}
          </Text>
          <ScrollView style={styles.list}>
            {people.map((member: any) => {
              const label = participantLabel(member, viewerDid);
              const subtitle = participantSubtitle(member);
              return (
                <View
                  key={String(member?.did || label)}
                  style={[styles.row, { borderColor: p.divider }]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={{ color: p.text, fontSize: 15, fontWeight: '600' }}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                    {subtitle ? (
                      <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={1}>
                        {subtitle}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', inset: 0 },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  list: { marginTop: 12 },
  row: {
    minHeight: 52,
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    paddingVertical: 6,
  },
});
