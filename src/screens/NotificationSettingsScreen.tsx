import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import { Toggle } from '../components/Toggle';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

type Category = {
  key: string;
  title: string;
  detail: string;
  icon: any;
  filterable?: boolean;
  sync?: string[];
};

const FILTERABLE: Category[] = [
  { key: 'like', title: 'Likes', detail: 'When someone likes your post.', icon: 'thumbs-up-outline', filterable: true },
  { key: 'follow', title: 'New followers', detail: 'When someone follows you.', icon: 'person-add-outline', filterable: true },
  { key: 'reply', title: 'Replies', detail: 'When someone replies to your post.', icon: 'chatbubble-outline', filterable: true },
  { key: 'mention', title: 'Mentions', detail: 'When someone mentions you.', icon: 'at-outline', filterable: true },
  { key: 'quote', title: 'Quotes', detail: 'When someone quotes your post.', icon: 'chatbox-ellipses-outline', filterable: true },
  { key: 'repost', title: 'Reposts', detail: 'When someone reposts your post.', icon: 'repeat-outline', filterable: true },
  { key: 'likeViaRepost', title: 'Likes of your reposts', detail: 'When someone likes a post you reposted.', icon: 'heart-outline', filterable: true },
  { key: 'repostViaRepost', title: 'Reposts of your reposts', detail: 'When someone reposts a post you reposted.', icon: 'git-compare-outline', filterable: true },
];

const SIMPLE: Category[] = [
  {
    key: 'starterpackJoined',
    title: 'Everything else',
    detail: 'Starter pack joins, verification changes and other account activity.',
    icon: 'sparkles-outline',
    sync: ['verified', 'unverified'],
  },
  {
    key: 'subscribedPost',
    title: 'Activity from others',
    detail: 'Posts and replies from accounts you choose to follow closely.',
    icon: 'notifications-outline',
  },
];

export function NotificationSettingsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const [prefs, setPrefs] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Notification settings' });
  }, [navigation]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await agent.app.bsky.notification.getPreferences({});
      setPrefs(response.data.preferences);
    } catch {
      setError('Could not load notification preferences.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function update(category: Category, patch: Record<string, any>) {
    if (!prefs || saving) return;
    const previous = prefs;
    const keys = [category.key, ...(category.sync || [])];
    const next = { ...prefs };
    for (const key of keys) {
      next[key] = { ...(prefs[key] || {}), ...patch };
    }
    setPrefs(next);
    setSaving(category.key);
    setError(null);
    try {
      const payload: Record<string, any> = {};
      for (const key of keys) payload[key] = next[key];
      const response = await agent.app.bsky.notification.putPreferencesV2(payload as any);
      if (response.data && response.data.preferences) {
        setPrefs(response.data.preferences);
      }
    } catch {
      setPrefs(previous);
      setError('Could not save that notification preference. Try again.');
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={p.accent} />
      </View>
    );
  }

  if (!prefs) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: p.secondary, textAlign: 'center' }}>
          {error || 'Could not load notification preferences.'}
        </Text>
        <Pressable
          onPress={() => void load()}
          accessibilityRole="button"
          accessibilityLabel="Try loading notification preferences again"
          style={{ marginTop: 12, minHeight: 44, paddingHorizontal: 20, borderRadius: 8, backgroundColor: p.soft, justifyContent: 'center' }}
        >
          <Text style={{ color: p.text, fontWeight: '600' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: p.danger, fontSize: 13, lineHeight: 19, marginHorizontal: 18, marginBottom: 8 }}
        >
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={() => navigation.navigate('ActivityNotifications')}
        accessibilityRole="button"
        accessibilityLabel="Manage activity notifications"
        accessibilityHint="See and edit the accounts whose posts and replies notify you"
        style={({ pressed }) => [
          styles.manageRow,
          {
            backgroundColor: p.card,
            borderColor: p.divider,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <View style={[styles.iconBubble, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="notifications-outline" size={19} color={p.accent} />
        </View>
        <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
            Accounts you follow closely
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 1 }}>
            Manage whose posts and replies notify you.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={p.secondary} />
      </Pressable>

      <View style={[styles.note, { backgroundColor: p.card, borderColor: p.divider }]}>
        <Ionicons name="information-circle-outline" size={18} color={p.secondary} />
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginLeft: 8, flex: 1 }}>
          These preferences are stored on your Bluesky account. Balla does not
          register this device for push yet, so push switches apply to clients
          that do; in-app switches apply to the Notifications screen the next
          time it refreshes.
        </Text>
      </View>

      {[...FILTERABLE, ...SIMPLE].map((category) => {
        const preference = prefs[category.key] || {
          list: true,
          push: false,
          include: 'all',
        };
        const list = 'list' in preference ? !!preference.list : true;
        const push = !!preference.push;
        const include = preference.include || 'all';
        const busy = saving === category.key;
        return (
          <View
            key={category.key}
            style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={[styles.iconBubble, { backgroundColor: p.accentSoft }]}>
                <Ionicons name={category.icon} size={19} color={p.accent} />
              </View>
              <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
                <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
                  {category.title}
                </Text>
                <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 1 }}>
                  {category.detail}
                </Text>
              </View>
              {busy ? <ActivityIndicator size="small" color={p.accent} /> : null}
            </View>

            <View style={{ marginTop: 8 }}>
              <SwitchRow
                label="In-app notifications"
                value={list}
                disabled={!!saving}
                onValueChange={(value) => void update(category, { list: value })}
              />
              <SwitchRow
                label="Push notifications"
                value={push}
                disabled={!!saving}
                onValueChange={(value) => void update(category, { push: value })}
              />
            </View>

            {category.filterable ? (
              <View style={{ marginTop: 4 }}>
                <Text style={{ color: p.secondary, fontSize: 12, fontWeight: '700', marginBottom: 6 }}>
                  Notify me about
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {(
                    [
                      ['all', 'Everyone'],
                      ['follows', 'People I follow'],
                    ] as ['all' | 'follows', string][]
                  ).map(([value, label]) => {
                    const selected = include === value;
                    return (
                      <Pressable
                        key={value}
                        onPress={() => void update(category, { include: value })}
                        disabled={!!saving}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled: !!saving }}
                        accessibilityLabel={`${label} for ${category.title}`}
                        style={({ pressed }) => ({
                          minHeight: 44,
                          paddingHorizontal: 14,
                          borderRadius: 6,
                          borderWidth: 1,
                          borderColor: selected ? p.accent : p.divider,
                          backgroundColor: selected ? p.accentSoft : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: pressed ? 0.65 : 1,
                        })}
                      >
                        <Text
                          style={{
                            color: selected ? p.accent : p.text,
                            fontSize: 13,
                            fontWeight: '600',
                          }}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>
        );
      })}

      <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, paddingHorizontal: 18 }}>
        Device push registration and OS permission prompts are tracked separately
        and are not claimed here. Turning off in-app notifications removes that
        category from the Notifications screen after it is seen again.
      </Text>
    </ScrollView>
  );
}

function SwitchRow({
  label,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
      <Text style={{ color: p.text, fontSize: 14, flex: 1 }}>{label}</Text>
      <Toggle label={label} value={value} onChange={onValueChange} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  manageRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    marginHorizontal: 8,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    marginHorizontal: 8,
    marginBottom: 10,
    padding: 12,
  },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
    marginBottom: 8,
    padding: 14,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
