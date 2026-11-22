import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { openExternalUrl } from '../lib/openLink';
import { useNavigation } from '@react-navigation/native';
import { agent } from '../lib/agent';
import { describeFailure } from '../lib/reliability';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';
import {
  AUDIENCE_OPTIONS,
  CHAT_AUDIENCE,
  audienceLabel,
} from '../lib/chatModel';

const OFFICIAL_CHAT_SETTINGS = 'https://bsky.app/settings/chat';

/**
 * Chat configuration is mostly provider-owned. This screen reports the real
 * proxy/audience Balla uses and the real "who can message you" value Bluesky
 * reports, then links to the official control instead of faking a write.
 */
export function ChatSettingsScreen() {
  const p = usePalette();
  const navigation = useNavigation<any>();
  const [allowIncoming, setAllowIncoming] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const did = agent.did;
    if (!did) {
      setLoading(false);
      return;
    }
    agent
      .getProfile({ actor: did })
      .then((res) => {
        if (!active) return;
        const value = (res.data as any)?.associated?.chat?.allowIncoming;
        setAllowIncoming(typeof value === 'string' ? value : null);
      })
      .catch((err) => {
        if (active) setError(describeFailure(err, 'Could not read this setting.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: p.bg }} contentContainerStyle={{ padding: 16 }}>
      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}>
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>Chat service</Text>
        <Text style={{ color: p.secondary, fontSize: 14, marginTop: 6 }}>
          Messages are sent to Bluesky's chat service through Balla's chat proxy. Balla does not
          store your messages; they stay with your Bluesky account.
        </Text>
        <Text
          selectable
          style={{ color: p.text, fontSize: 12, marginTop: 10, fontFamily: 'monospace' }}
        >
          {CHAT_AUDIENCE}
        </Text>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider, marginTop: 12 },
          cardShadow,
        ]}
      >
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>Who can message you</Text>
        {loading ? (
          <Text style={{ color: p.secondary, fontSize: 14, marginTop: 6 }}>Loading…</Text>
        ) : error ? (
          <Text style={{ color: p.danger, fontSize: 14, marginTop: 6 }}>{error}</Text>
        ) : (
          <Text style={{ color: p.text, fontSize: 15, marginTop: 8 }}>
            {audienceLabel(allowIncoming || undefined)}
          </Text>
        )}
        <Text style={{ color: p.secondary, fontSize: 13, marginTop: 10 }}>
          This is set by Bluesky, not Balla. Options are{' '}
          {AUDIENCE_OPTIONS.map((option) => option.label).join(', ')}.
        </Text>
        <Pressable
          onPress={() => void openExternalUrl(OFFICIAL_CHAT_SETTINGS)}
          accessibilityRole="link"
          accessibilityLabel="Open Bluesky chat settings"
          style={({ pressed }) => [
            styles.link,
            { borderColor: p.divider, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={{ color: p.accent, fontSize: 14, fontWeight: '600' }}>
            Change in Bluesky settings
          </Text>
          <IoniconsChevron color={p.accent} />
        </Pressable>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider, marginTop: 12 },
          cardShadow,
        ]}
      >
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>
          Notification preferences
        </Text>
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
          Chat and chat-request notifications are separate from post alerts.
          Choose who can notify you and whether push is on for each.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('ChatNotificationSettings')}
          accessibilityRole="button"
          accessibilityLabel="Edit chat notification preferences"
          style={({ pressed }) => [
            styles.link,
            { borderColor: p.divider, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text style={{ color: p.accent, fontSize: 14, fontWeight: '600' }}>
            Edit chat notifications
          </Text>
          <IoniconsChevron color={p.accent} />
        </Pressable>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider, marginTop: 12 },
          cardShadow,
        ]}
      >
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>Sign-in required</Text>
        <Text style={{ color: p.secondary, fontSize: 14, marginTop: 6 }}>
          Chat uses a separate permission from public posts. Accounts that signed in before chat
          was added need to sign in again once to grant it.
        </Text>
      </View>
    </ScrollView>
  );
}

// A tiny inline chevron keeps this screen dependency-light.
function IoniconsChevron({ color }: { color: string }) {
  return <Text style={{ color, fontSize: 16, marginLeft: 6 }}>›</Text>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  link: {
    minHeight: 44,
    marginTop: 12,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
