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
import { describeFailure } from '../lib/reliability';
import {
  DEFAULT_INTERACTION_GATES,
  describeGates,
  gatesEqual,
  gatesFromRecords,
  postRkey,
  postgateWrite,
  threadgateWrite,
  type InteractionGates,
  type QuoteAccess,
  type ReplyAccess,
} from '../lib/interactionGates';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

const REPLY_OPTIONS: Array<{ value: ReplyAccess; label: string; detail: string }> = [
  { value: 'everyone', label: 'Everyone', detail: 'Anyone on Bluesky can reply' },
  { value: 'mentioned', label: 'Mentioned accounts', detail: 'Only people named in the post' },
  { value: 'following', label: 'People you follow', detail: 'Anyone in your following list' },
  { value: 'followers', label: 'People who follow you', detail: 'Anyone following your account' },
  { value: 'nobody', label: 'Nobody', detail: 'Close replies on this post' },
];

const QUOTE_OPTIONS: Array<{ value: QuoteAccess; label: string; detail: string }> = [
  { value: 'everyone', label: 'Anyone', detail: 'This post can be quoted' },
  { value: 'nobody', label: 'Nobody', detail: 'Disable quotes of this post' },
];

/**
 * Edits the two published gate records for one post. Reads come from the
 * thread view and `com.atproto.repo.getRecord`; writes use put/delete on the
 * same rkey as the post, so no private state is invented.
 */
export function InteractionSettingsScreen({ route, navigation }: { route: any; navigation: any }) {
  const p = usePalette();
  const uri: string = route?.params?.uri || '';
  const rkey = postRkey(uri);
  const [gates, setGates] = useState<InteractionGates>(DEFAULT_INTERACTION_GATES);
  const [saved, setSaved] = useState<InteractionGates>(DEFAULT_INTERACTION_GATES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Interaction settings' });
  }, [navigation]);

  useEffect(() => {
    let active = true;
    if (!rkey) {
      setLoading(false);
      setError('This post has no usable address, so its settings cannot be read.');
      return () => {
        active = false;
      };
    }

    (async () => {
      // Read both gates through the repository. The published lexicons define
      // these as records, so getRecord is the same contract for both and does
      // not depend on whether an AppView happens to include an optional view.
      const read = async (collection: string): Promise<unknown> => {
        try {
          const record = await agent.com.atproto.repo.getRecord({
            repo: agent.did!,
            collection,
            rkey,
          });
          return record.data.value;
        } catch {
          // A missing gate record means the corresponding access is open.
          return undefined;
        }
      };
      const [threadgate, postgate] = await Promise.all([
        read('app.bsky.feed.threadgate'),
        read('app.bsky.feed.postgate'),
      ]);
      if (!active) return;
      const next = gatesFromRecords(threadgate, postgate);
      setGates(next);
      setSaved(next);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [uri, rkey]);

  async function save() {
    if (saving || !rkey || !uri) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const writes = [
        { write: threadgateWrite(uri, gates, new Date().toISOString()) },
        { write: postgateWrite(uri, gates, new Date().toISOString()) },
      ];
      for (const { write } of writes) {
        if (!write) continue;
        await agent.com.atproto.repo.putRecord({
          repo: agent.did!,
          collection: write.collection,
          rkey: write.rkey,
          record: write.record,
          validate: true,
        });
      }
      // A gate removed in the sheet must be removed from the repository too;
      // leaving the old record would silently keep the old restriction.
      for (const collection of [
        'app.bsky.feed.threadgate',
        'app.bsky.feed.postgate',
      ]) {
        const stillWanted = writes.some(
          ({ write }) => write?.collection === collection
        );
        if (stillWanted) continue;
        try {
          await agent.com.atproto.repo.deleteRecord({
            repo: agent.did!,
            collection,
            rkey,
          });
        } catch {
          // No record existed; nothing to remove.
        }
      }
      setSaved(gates);
      setNotice('Interaction settings saved.');
    } catch (err) {
      setError(
        describeFailure(err, 'Could not save these settings. The previous settings are unchanged.')
      );
    } finally {
      setSaving(false);
    }
  }

  const changed = !gatesEqual(gates, saved);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
    >
      <View
        style={[
          styles.intro,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <View style={[styles.introIcon, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="options-outline" size={22} color={p.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>
            This post
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
            Bluesky stores these settings in reply and quote records beside your post. Balla only reads and edits those records.
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={p.accent} />
          <Text style={{ color: p.secondary, fontSize: 13, marginTop: 8 }}>
            Reading the current settings…
          </Text>
        </View>
      ) : null}

      {error ? (
        <View style={[styles.notice, { borderColor: p.danger }]}>
          <Text style={{ color: p.danger, fontSize: 13, lineHeight: 19 }}>{error}</Text>
        </View>
      ) : null}
      {notice ? (
        <View style={[styles.notice, { borderColor: p.green }]}>
          <Text style={{ color: p.green, fontSize: 13, lineHeight: 19 }}>{notice}</Text>
        </View>
      ) : null}

      {!loading && !error ? (
        <>
          <Section title="Who can reply">
            {REPLY_OPTIONS.map((option) => (
              <ChoiceRow
                key={option.value}
                label={option.label}
                detail={option.detail}
                selected={gates.reply === option.value}
                disabled={saving}
                onPress={() => {
                  setGates((prev) => ({ ...prev, reply: option.value }));
                  setNotice(null);
                }}
              />
            ))}
          </Section>

          <Section title="Quotes">
            {QUOTE_OPTIONS.map((option) => (
              <ChoiceRow
                key={option.value}
                label={option.label}
                detail={option.detail}
                selected={gates.quote === option.value}
                disabled={saving}
                onPress={() => {
                  setGates((prev) => ({ ...prev, quote: option.value }));
                  setNotice(null);
                }}
              />
            ))}
          </Section>

          <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
            <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18 }}>
              Current: {describeGates(saved)}
            </Text>
            <Pressable
              onPress={() => void save()}
              disabled={!changed || saving}
              accessibilityRole="button"
              accessibilityLabel="Save interaction settings"
              accessibilityState={{ disabled: !changed || saving, busy: saving }}
              style={({ pressed }) => [
                styles.save,
                {
                  backgroundColor: changed && !saving ? p.accent : p.divider,
                  opacity: pressed && changed && !saving ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: changed && !saving ? p.onAccent : p.secondary,
                  fontWeight: '700',
                  fontSize: 15,
                }}
              >
                {saving ? 'Saving…' : changed ? 'Save settings' : 'No changes'}
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ marginTop: 18 }}>
      <Text
        style={{
          color: p.secondary,
          fontSize: 12,
          fontWeight: '700',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          marginHorizontal: 16,
          marginBottom: 6,
        }}
      >
        {title}
      </Text>
      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function ChoiceRow({
  label,
  detail,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  detail: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={`${label}. ${detail}`}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        styles.choice,
        { backgroundColor: pressed ? p.bg : 'transparent' },
      ]}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={selected ? p.accent : p.secondary}
      />
      <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
        <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>{label}</Text>
        <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }}>{detail}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginHorizontal: 16,
    padding: 14,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
  },
  introIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    marginHorizontal: 16,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  choice: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  notice: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 12,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
  },
  loading: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  save: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
});
