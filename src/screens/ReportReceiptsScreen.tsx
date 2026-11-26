import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePalette } from '../theme';
import { timeAgo } from '../lib/time';
import { reasonLabel } from '../lib/reportModel';
import {
  clearReportReceipts,
  loadReportReceipts,
} from '../lib/reportReceipts';
import type { ReportReceipt } from '../lib/reportModel';

const SUBJECT_LABEL: Record<ReportReceipt['subjectKind'], string> = {
  post: 'Post',
  profile: 'Account',
  'profile-link': 'Profile link',
  list: 'List',
  feed: 'Feed',
  'chat-message': 'Chat message',
  'chat-convo': 'Conversation',
};

/** A local reminder, deliberately not presented as a moderation status. */
export function ReportReceiptsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const [receipts, setReceipts] = useState<ReportReceipt[] | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Your report receipts' });
  }, [navigation]);

  useEffect(() => {
    let active = true;
    loadReportReceipts()
      .then((items) => {
        if (active) setReceipts(items);
      })
      .catch(() => {
        if (active) setReceipts([]);
      });
    return () => {
      active = false;
    };
  }, []);

  async function clear() {
    await clearReportReceipts();
    setReceipts([]);
    setConfirmClear(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={styles.content}
    >
      <View style={[styles.note, { backgroundColor: p.card, borderColor: p.divider }]}>
        <Ionicons name="information-circle-outline" size={18} color={p.accent} />
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, flex: 1 }}>
          These receipts are kept only on this device. They remember what you
          sent and when; they are not an official moderation status, and
          Bluesky’s review is not visible here.
        </Text>
      </View>

      {receipts === null ? (
        <Text style={{ color: p.secondary, fontSize: 14, marginTop: 24 }}>
          Loading receipts…
        </Text>
      ) : receipts.length === 0 ? (
        <Text style={{ color: p.secondary, fontSize: 14, marginTop: 24 }}>
          No reports sent from this device yet.
        </Text>
      ) : (
        receipts.map((receipt) => (
          <View
            key={receipt.id}
            accessibilityRole="text"
            accessibilityLabel={`${SUBJECT_LABEL[receipt.subjectKind]} report, ${reasonLabel(receipt.reasonType)}, receipt ${receipt.id}`}
            style={[styles.receipt, { backgroundColor: p.card, borderColor: p.divider }]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
                {SUBJECT_LABEL[receipt.subjectKind]}: {reasonLabel(receipt.reasonType)}
              </Text>
              <Text
                numberOfLines={2}
                style={{ color: p.secondary, fontSize: 13, marginTop: 2 }}
              >
                {receipt.subjectLabel}
              </Text>
              <Text style={{ color: p.secondary, fontSize: 12, marginTop: 4 }}>
                Receipt #{receipt.id} · {timeAgo(receipt.createdAt)}
              </Text>
              <Text style={{ color: p.secondary, fontSize: 11, marginTop: 2 }}>
                {new Date(receipt.createdAt).toLocaleString()}
              </Text>
            </View>
          </View>
        ))
      )}

      {receipts && receipts.length > 0 ? (
        <View style={{ marginTop: 20 }}>
          {confirmClear ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                onPress={() => setConfirmClear(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel clearing report receipts"
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: p.bg,
                    borderColor: p.divider,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ color: p.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void clear()}
                accessibilityRole="button"
                accessibilityLabel="Clear report receipts from this device"
                style={({ pressed }) => [
                  styles.button,
                  {
                    backgroundColor: p.danger,
                    borderColor: p.danger,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={{ color: p.onDanger, fontWeight: '700' }}>Clear</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setConfirmClear(true)}
              accessibilityRole="button"
              accessibilityLabel="Clear report receipts"
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: p.bg,
                  borderColor: p.divider,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text style={{ color: p.danger, fontWeight: '600' }}>
                Clear receipts on this device
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  receipt: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});
