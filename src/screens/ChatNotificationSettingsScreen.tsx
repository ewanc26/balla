import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getChatAgent } from '../lib/agent';
import { chatErrorCopy } from '../lib/chatModel';
import {
  NOTIFICATION_INCLUDES,
  notificationIncludeLabel,
} from '../lib/chatGroupModel';
import { Toggle } from '../components/Toggle';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

type Preference = { include: string; push: boolean };
type Kind = 'chat' | 'chatRequest';

/**
 * Chat notifications are a separate chat-service preference from the public
 * app.bsky notification preferences. Both values are read and written from the
 * service; Balla keeps no copy of them.
 */
export function ChatNotificationSettingsScreen() {
  const p = usePalette();
  const navigation = useNavigation<any>();
  const [preferences, setPreferences] = useState<Record<Kind, Preference> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Chat notifications' });
  }, [navigation]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getChatAgent().chat.bsky.notification.getPreferences();
      const prefs = res.data.preferences;
      setPreferences({
        chat: {
          include: String(prefs.chat?.include || 'all'),
          push: !!prefs.chat?.push,
        },
        chatRequest: {
          include: String(prefs.chatRequest?.include || 'all'),
          push: !!prefs.chatRequest?.push,
        },
      });
    } catch (err) {
      setError(chatErrorCopy(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function update(kind: Kind, patch: Partial<Preference>) {
    setPreferences((prev) =>
      prev ? { ...prev, [kind]: { ...prev[kind], ...patch } } : prev
    );
  }

  async function save(kind: Kind) {
    if (!preferences || saving) return;
    const value = preferences[kind];
    setSaving(kind);
    setError(null);
    try {
      const res = await getChatAgent().chat.bsky.notification.putPreferences({
        [kind]: {
          $type: 'chat.bsky.notification.defs#chatPreference',
          include: value.include,
          push: value.push,
        },
      } as any);
      const prefs = res.data.preferences;
      setPreferences((prev) =>
        prev
          ? {
              ...prev,
              chat: {
                include: String(prefs.chat?.include || prev.chat.include),
                push: !!prefs.chat?.push,
              },
              chatRequest: {
                include: String(prefs.chatRequest?.include || prev.chatRequest.include),
                push: !!prefs.chatRequest?.push,
              },
            }
          : prev
      );
    } catch (err) {
      setError(chatErrorCopy(err));
    }
    setSaving(null);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: 16 }}
    >
      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}>
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>
          Chat notifications
        </Text>
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
          These are Bluesky’s chat notification settings, stored by the chat
          service. They are separate from post and mention notifications.
        </Text>
      </View>

      {error ? (
        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.danger, marginTop: 12 }]}>
          <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 14 }}>
            {error}
          </Text>
          <Pressable
            onPress={() => void load()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading chat notification preferences"
            style={({ pressed }) => [styles.retry, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ color: p.accent, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={{ alignItems: 'center', paddingTop: 32 }}>
          <ActivityIndicator color={p.accent} />
        </View>
      ) : preferences ? (
        <>
          <PreferenceCard
            title="Messages"
            detail="Notifications for conversations you have accepted."
            value={preferences.chat}
            busy={saving === 'chat'}
            palette={p}
            onChange={(patch) => update('chat', patch)}
            onSave={() => void save('chat')}
          />
          <PreferenceCard
            title="Chat requests"
            detail="Notifications for messages from people you do not follow."
            value={preferences.chatRequest}
            busy={saving === 'chatRequest'}
            palette={p}
            onChange={(patch) => update('chatRequest', patch)}
            onSave={() => void save('chatRequest')}
          />
        </>
      ) : null}
    </ScrollView>
  );
}

function PreferenceCard({
  title,
  detail,
  value,
  busy,
  palette,
  onChange,
  onSave,
}: {
  title: string;
  detail: string;
  value: Preference;
  busy: boolean;
  palette: ReturnType<typeof usePalette>;
  onChange: (patch: Partial<Preference>) => void;
  onSave: () => void;
}) {
  const p = palette;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: p.card, borderColor: p.divider, marginTop: 12 },
        cardShadow,
      ]}
    >
      <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>{title}</Text>
      <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
        {detail}
      </Text>
      <Text style={{ color: p.text, fontSize: 14, fontWeight: '600', marginTop: 12 }}>
        Notify me about
      </Text>
      {NOTIFICATION_INCLUDES.map((item) => (
        <Pressable
          key={item.value}
          onPress={() => onChange({ include: item.value })}
          accessibilityRole="radio"
          accessibilityLabel={`${title}: ${item.label}`}
          accessibilityState={{ checked: value.include === item.value }}
          style={({ pressed }) => [
            styles.choice,
            {
              borderColor: value.include === item.value ? p.accent : p.divider,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text
            style={{
              color: value.include === item.value ? p.accent : p.text,
              fontWeight: '600',
            }}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
      <View style={styles.switchRow}>
        <Text style={{ color: p.text, fontSize: 14, flex: 1 }}>
          {notificationIncludeLabel(value.include)} · push notifications{' '}
          {value.push ? 'on' : 'off'}
        </Text>
        <Toggle
          label={`${title} push notifications`}
          value={value.push}
          onChange={(next) => onChange({ push: next })}
        />
      </View>
      <Pressable
        onPress={onSave}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Save ${title.toLowerCase()} notification preferences`}
        style={({ pressed }) => [
          styles.save,
          { backgroundColor: p.accent, opacity: pressed || busy ? 0.6 : 1 },
        ]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={p.onAccent} />
        ) : (
          <Text style={{ color: p.onAccent, fontWeight: '700' }}>Save</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CARD_RADIUS, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  choice: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginTop: 8,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  save: {
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 8 },
});
