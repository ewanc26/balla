import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import {
  labelerFailureCopy,
  labelerInputError,
} from '../lib/failureCopyModel.ts';
import {
  dialogAccessibilityProps,
  dialogAnimation,
  useDialogFocus,
  useReducedMotion,
} from '../lib/accessibility';
import { resolveDidDocument } from '../lib/identityResolver';
import {
  checkingLabelerProbe,
  labelerProbeText,
  probeLabeler,
  type LabelerProbe,
} from '../lib/labelerProbe';
import { BSKY_LABELER_DID } from '../lib/moderation';
import { useModeration } from '../lib/moderationContext';
import { Avatar } from '../components/Avatar';
import { SettingSwitch } from '../components/SettingControls';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';

type Visibility = 'ignore' | 'warn' | 'hide';
type WordTarget = 'content' | 'tag';

const DEFAULT_LABELER_NAME = 'Bluesky moderation';

function labelText(definition: any): { name: string; description: string } {
  const locale =
    (definition.locales || []).find((item: any) =>
      String(item.lang || '').toLowerCase().startsWith('en')
    ) || (definition.locales || [])[0];
  return {
    name: locale?.name || definition.identifier || 'Label',
    description:
      locale?.description || `Labels content as “${definition.identifier || 'unknown'}”.`,
  };
}

// Content-filter controls backed by the same app.bsky.actor preferences the
// official client writes. Every write reloads the moderation context so the
// feed rendering changes without a restart.
export function ContentFiltersScreen({
  navigation,
  route,
}: {
  navigation: any;
  route?: any;
}) {
  const p = usePalette();
  const { reload } = useModeration();
  const scrollRef = useRef<any>(null);
  const mutedWordsRef = useRef<any>(null);
  const labelersRef = useRef<any>(null);
  const [prefs, setPrefs] = useState<any>(null);
  const [labelDefs, setLabelDefs] = useState<Record<string, any[]>>({});
  const [services, setServices] = useState<Record<string, any>>({});
  const [servicesAvailable, setServicesAvailable] = useState(false);
  const [labelerProbes, setLabelerProbes] = useState<Record<string, LabelerProbe>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAdult, setConfirmAdult] = useState(false);
  const [addLabelerOpen, setAddLabelerOpen] = useState(false);
  const [labelerInput, setLabelerInput] = useState('');
  const [addLabelerBusy, setAddLabelerBusy] = useState(false);
  const [word, setWord] = useState('');
  const [wordTarget, setWordTarget] = useState<WordTarget>('content');
  const adultDialogRef = useRef<any>(null);
  const adultCancelRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  useDialogFocus({
    visible: confirmAdult,
    onClose: () => setConfirmAdult(false),
    containerRef: adultDialogRef,
    initialFocusRef: adultCancelRef,
  });

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Content filters' });
  }, [navigation]);

  const probeLabelers = useCallback((dids: string[]) => {
    const checking: Record<string, LabelerProbe> = {};
    for (const did of dids) checking[did] = checkingLabelerProbe();
    setLabelerProbes(checking);
    void Promise.all(
      dids.map(async (did) => {
        const result = await probeLabeler(did, { resolveDocument: resolveDidDocument });
        setLabelerProbes((current) => ({ ...current, [did]: result }));
      })
    );
  }, []);

  const load = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const next = await agent.getPreferences();
      setPrefs(next);
      const definitions = await agent.getLabelDefinitions(next).catch(() => ({}));
      setLabelDefs(definitions);

      const dids = next.moderationPrefs.labelers.map((labeler: any) => labeler.did);
      probeLabelers(dids);
      try {
        const response = await agent.getLabelers({ dids, detailed: true });
        const byDid: Record<string, any> = {};
        for (const item of response.data.views || []) {
          const view: any = item;
          const did = view.creator?.did;
          if (did) byDid[did] = view;
        }
        setServices(byDid);
        setServicesAvailable(true);
      } catch {
        // Names and reachability are cosmetic. The underlying prefs still
        // load and save, so local filters keep working when a service is down.
        setServices({});
        setServicesAvailable(false);
      }
    } catch {
      setError('Could not load your moderation preferences.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [probeLabelers]);

  useEffect(() => {
    void load(true);
  }, [load]);

  // A menu shortcut can ask for the muted-words section directly. Measure it
  // after prefs render, rather than guessing a scroll offset that changes with
  // each labeler and enabled toggle.
  useEffect(() => {
    if (route?.params?.section !== 'muted-words' || loading || !prefs) return;
    const timer = setTimeout(() => {
      mutedWordsRef.current?.measureLayout?.(
        scrollRef.current,
        (_x: number, y: number) => {
          scrollRef.current?.scrollTo({
            y: Math.max(0, y - 8),
            animated: !reducedMotion,
          });
        }
      );
    }, 50);
    return () => clearTimeout(timer);
  }, [route?.params?.section, loading, prefs, reducedMotion]);

  // The Advanced menu can open the labeler section directly. Measured the same
  // way, so the scroll target stays correct as services load.
  useEffect(() => {
    if (route?.params?.section !== 'labelers' || loading || !prefs) return;
    const timer = setTimeout(() => {
      labelersRef.current?.measureLayout?.(
        scrollRef.current,
        (_x: number, y: number) => {
          scrollRef.current?.scrollTo({
            y: Math.max(0, y - 8),
            animated: !reducedMotion,
          });
        }
      );
    }, 50);
    return () => clearTimeout(timer);
  }, [route?.params?.section, loading, prefs, reducedMotion]);

  function labelerName(did: string): string {
    if (did === BSKY_LABELER_DID) return DEFAULT_LABELER_NAME;
    const view = services[did];
    return (
      view?.creator?.displayName ||
      view?.creator?.handle ||
      `${did.slice(0, 16)}…`
    );
  }

  async function save(key: string, action: () => Promise<void>, failure: string) {
    if (saving) return;
    setSaving(key);
    setError(null);
    try {
      await action();
      await load(false);
      reload();
    } catch {
      setError(failure);
    } finally {
      setSaving(null);
    }
  }

  function requestAdult(enabled: boolean) {
    if (enabled) {
      setConfirmAdult(true);
      return;
    }
    void save(
      'adult',
      () => agent.setAdultContentEnabled(false),
      'Could not save the adult-content setting.'
    );
  }

  function confirmAdultEnabled() {
    setConfirmAdult(false);
    void save(
      'adult',
      () => agent.setAdultContentEnabled(true),
      'Could not save the adult-content setting.'
    );
  }

  async function submitLabeler() {
    const raw = labelerInput.trim().replace(/^@/, '');
    if (!raw || addLabelerBusy) return;
    setAddLabelerBusy(true);
    setError(null);
    try {
      // The AppView profile lookup resolves a handle using the scope Balla
      // already has; there is no separate identity RPC grant.
      const did = raw.startsWith('did:')
        ? raw
        : (await agent.getProfile({ actor: raw })).data.did;
      if (did === BSKY_LABELER_DID) {
        throw labelerInputError('default_subscribed');
      }
      if (prefs.moderationPrefs.labelers.some((labeler: any) => labeler.did === did)) {
        throw labelerInputError('already_subscribed');
      }
      // A third party need not be indexed by this AppView. Accept a DID when
      // either the AppView lists it or its own DID document advertises a
      // labeler that answers a public query.
      const [listed, directCheck] = await Promise.all([
        agent.getLabelers({ dids: [did], detailed: true }).catch(() => null),
        probeLabeler(did, { resolveDocument: resolveDidDocument }),
      ]);
      if (!(listed?.data.views || []).length && directCheck.state !== 'ok') {
        throw labelerInputError('unreachable');
      }
      setLabelerProbes((current) => ({ ...current, [did]: directCheck }));
      await agent.addLabeler(did);
      setLabelerInput('');
      setAddLabelerOpen(false);
      await load(false);
      reload();
    } catch (err) {
      setError(labelerFailureCopy(err));
    } finally {
      setAddLabelerBusy(false);
    }
  }

  async function submitWord() {
    const value = word.trim();
    if (!value) return;
    const duplicate = (prefs.moderationPrefs.mutedWords || []).some(
      (item: any) =>
        item.value.toLowerCase() === value.toLowerCase() &&
        (item.targets || []).includes(wordTarget)
    );
    if (duplicate) {
      setError('That word or hashtag is already muted for this target.');
      return;
    }
    await save(
      'word:add',
      () =>
        agent.addMutedWord({
          value,
          targets: [wordTarget] as any,
          actorTarget: 'all',
        }),
      'Could not add that muted word. Try again.'
    );
    setWord('');
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
          {error || 'Could not load your moderation preferences.'}
        </Text>
        <Pressable
          onPress={() => void load(true)}
          accessibilityRole="button"
          accessibilityLabel="Try loading moderation preferences again"
          style={{ marginTop: 12, minHeight: 44, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 8, backgroundColor: p.soft }}
        >
          <Text style={{ color: p.text, fontWeight: '600' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const moderation = prefs.moderationPrefs;
  const adultEnabled = !!moderation.adultContentEnabled;
  const labelers = moderation.labelers || [];
  const mutedWords = moderation.mutedWords || [];

  function currentLabelPref(labelerDid: string, identifier: string, fallback: Visibility): Visibility {
    if (labelerDid === BSKY_LABELER_DID) {
      return (moderation.labels[identifier] || fallback) as Visibility;
    }
    const labeler = labelers.find((item: any) => item.did === labelerDid);
    return (labeler?.labels?.[identifier] || fallback) as Visibility;
  }

  return (
    <ScrollView
      ref={scrollRef}
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

      <Section title="Adult content">
        <SettingSwitch
          label="Show adult content"
          detail="Adult labels stay hidden until this is on. Balla asks you to confirm you are over 18 first."
          value={adultEnabled}
          busy={saving === 'adult'}
          onChange={requestAdult}
        />
      </Section>

      <Section title="Subscribed labelers" sectionRef={labelersRef}>
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, paddingHorizontal: 12, paddingBottom: 8 }}>
          Labels are advisory metadata from services you choose. Anyone can run a
          labeler. The public endpoint check reads the DID document and queries
          the advertised service; it does not report queue lag or a service's
          mute state. Your local filters keep working if a service is unavailable.
        </Text>
        {labelers.map((labeler: any) => {
          const isDefault = labeler.did === BSKY_LABELER_DID;
          const view = services[labeler.did];
          const listedByAppView = servicesAvailable && (isDefault || Boolean(view));
          const probe = labelerProbes[labeler.did];
          const probeFailed = probe?.state === 'unavailable' || probe?.state === 'invalid';
          return (
            <View key={labeler.did} style={[styles.labelerRow, { borderBottomColor: p.divider }]}>
              <Avatar
                avatar={isDefault ? undefined : view?.creator?.avatar}
                displayName={labelerName(labeler.did)}
                size={40}
              />
              <View style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
                <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                  {labelerName(labeler.did)}
                </Text>
                <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={1}>
                  {isDefault
                    ? 'Always on · independent of your other labelers'
                    : view?.creator?.handle
                      ? `@${view.creator.handle}`
                      : labeler.did}
                </Text>
                <Text
                  style={{
                    color: p.secondary,
                    fontSize: 11,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                >
                  {listedByAppView
                    ? 'Subscribed · listed by the AppView'
                    : 'Subscribed · not listed by the AppView, local rules still apply'}
                </Text>
                <Text
                  accessibilityRole={probeFailed ? 'alert' : undefined}
                  style={{
                    color: probeFailed ? p.danger : p.secondary,
                    fontSize: 11,
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  {labelerProbeText(probe)}
                </Text>
              </View>
              {isDefault ? (
                <View style={[styles.badge, { backgroundColor: p.accentSoft }]}>
                  <Text style={{ color: p.accent, fontSize: 11, fontWeight: '700' }}>Default</Text>
                </View>
              ) : (
                <Pressable
                  onPress={() =>
                    void save(
                      `labeler:${labeler.did}`,
                      () => agent.removeLabeler(labeler.did),
                      'Could not remove that labeler.'
                    )
                  }
                  disabled={!!saving}
                  accessibilityRole="button"
                  accessibilityLabel={`Unsubscribe from ${labelerName(labeler.did)}`}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    minWidth: 84,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 6,
                    backgroundColor: pressed ? p.soft : 'transparent',
                    opacity: saving ? 0.55 : 1,
                  })}
                >
                  {saving === `labeler:${labeler.did}` ? (
                    <ActivityIndicator size="small" color={p.secondary} />
                  ) : (
                    <Text style={{ color: p.danger, fontSize: 13, fontWeight: '600' }}>Remove</Text>
                  )}
                </Pressable>
              )}
            </View>
          );
        })}

        <Pressable
          onPress={() => probeLabelers(labelers.map((labeler: any) => labeler.did))}
          disabled={labelers.some(
            (labeler: any) => labelerProbes[labeler.did]?.state === 'checking'
          )}
          accessibilityRole="button"
          accessibilityLabel="Check labeler endpoints again"
          style={({ pressed }) => [
            styles.addRow,
            { backgroundColor: pressed ? p.bg : 'transparent' },
          ]}
        >
          <Ionicons name="refresh-outline" size={20} color={p.accent} />
          <Text style={{ color: p.accent, fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
            Check labeler endpoints again
          </Text>
        </Pressable>

        {addLabelerOpen ? (
          <View style={{ padding: 12 }}>
            <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginBottom: 8 }}>
              Enter a labeler’s handle or DID. Balla checks the AppView listing and the
              DID’s public label endpoint before subscribing.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={labelerInput}
                onChangeText={setLabelerInput}
                placeholder="labeler.bsky.social"
                placeholderTextColor={p.secondary}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Labeler handle or DID"
                style={[
                  styles.input,
                  { color: p.text, borderColor: p.divider, backgroundColor: p.bg, flex: 1 },
                  webInputReset,
                ]}
              />
              <Pressable
                onPress={() => void submitLabeler()}
                disabled={addLabelerBusy || !labelerInput.trim()}
                accessibilityRole="button"
                accessibilityLabel="Subscribe to labeler"
                style={({ pressed }) => ({
                  minHeight: 44,
                  paddingHorizontal: 16,
                  borderRadius: 6,
                  backgroundColor: p.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: addLabelerBusy || !labelerInput.trim() || pressed ? 0.55 : 1,
                })}
              >
                {addLabelerBusy ? (
                  <ActivityIndicator size="small" color={p.onAccent} />
                ) : (
                  <Text style={{ color: p.onAccent, fontWeight: '700' }}>Add</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setAddLabelerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Add a labeler"
            style={({ pressed }) => [styles.addRow, { backgroundColor: pressed ? p.bg : 'transparent' }]}
          >
            <Ionicons name="add-circle-outline" size={20} color={p.accent} />
            <Text style={{ color: p.accent, fontSize: 15, fontWeight: '600', marginLeft: 8 }}>
              Add a labeler
            </Text>
          </Pressable>
        )}
      </Section>

      <Section title="Label filters">
        {labelers.map((labeler: any) => {
          const definitions = (labelDefs[labeler.did] || []).filter(
            (definition: any) => definition.configurable
          );
          if (!definitions.length) return null;
          return (
            <View key={labeler.did} style={{ paddingHorizontal: 12, paddingBottom: 4 }}>
              <Text style={{ color: p.secondary, fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 2 }}>
                {labelerName(labeler.did)}
              </Text>
              {definitions.map((definition: any) => {
                const copy = labelText(definition);
                const adultOnly = (definition.flags || []).includes('adult');
                const disabled = adultOnly && !adultEnabled;
                const canWarn = !(
                  definition.blurs === 'none' && definition.severity === 'none'
                );
                const current = currentLabelPref(
                  labeler.did,
                  definition.identifier,
                  definition.defaultSetting || 'warn'
                );
                const key = `label:${labeler.did}:${definition.identifier}`;
                return (
                  <View
                    key={definition.identifier}
                    style={[styles.labelRow, { borderTopColor: p.divider }]}
                  >
                    <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }}>
                      {copy.name}
                    </Text>
                    <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 1 }}>
                      {disabled ? 'Adult content is off. Enable it above to change this label.' : copy.description}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {(
                        [
                          ['ignore', 'Show'],
                          ['warn', 'Warn'],
                          ['hide', 'Hide'],
                        ] as [Visibility, string][]
                      ).map(([value, label]) => {
                        if (value === 'warn' && !canWarn) return null;
                        const selected = current === value;
                        return (
                          <Pressable
                            key={value}
                            onPress={() =>
                              void save(
                                key,
                                () =>
                                  agent.setContentLabelPref(
                                    definition.identifier,
                                    value as any,
                                    labeler.did === BSKY_LABELER_DID ? undefined : labeler.did
                                  ),
                                'Could not save that label preference.'
                              )
                            }
                            disabled={disabled || !!saving}
                            accessibilityRole="button"
                            accessibilityLabel={`${label} ${copy.name}`}
                            accessibilityState={{ selected, disabled: disabled || !!saving }}
                            style={({ pressed }) => ({
                              minHeight: 44,
                              minWidth: 64,
                              paddingHorizontal: 12,
                              borderRadius: 6,
                              borderWidth: 1,
                              borderColor: selected ? p.accent : p.divider,
                              backgroundColor: selected ? p.accent : 'transparent',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: disabled ? 0.4 : pressed ? 0.65 : 1,
                            })}
                          >
                            {saving === key ? (
                              <ActivityIndicator size="small" color={selected ? p.onAccent : p.accent} />
                            ) : (
                              <Text
                                style={{
                                  color: selected ? p.onAccent : p.text,
                                  fontSize: 13,
                                  fontWeight: '600',
                                }}
                              >
                                {label}
                              </Text>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}
        {labelers.every(
          (labeler: any) => !(labelDefs[labeler.did] || []).some((definition: any) => definition.configurable)
        ) ? (
          <Text style={{ color: p.secondary, fontSize: 13, padding: 14 }}>
            No configurable labels are available from your subscribed labelers.
          </Text>
        ) : null}
      </Section>

      <View ref={mutedWordsRef}>
        <Section title="Muted words and hashtags">
          {mutedWords.length ? (
          mutedWords.map((item: any) => (
            <View
              key={`${item.value}:${(item.targets || []).join(',')}`}
              style={[styles.wordRow, { borderBottomColor: p.divider }]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: p.text, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                  {item.value}
                </Text>
                <Text style={{ color: p.secondary, fontSize: 12, marginTop: 1 }}>
                  {(item.targets || []).includes('tag') ? 'Hashtag' : 'Word'}
                  {(item.targets || []).includes('content') && (item.targets || []).includes('tag')
                    ? ' · both'
                    : ''}
                </Text>
              </View>
              <Pressable
                onPress={() =>
                  void save(
                    `word:${item.value}`,
                    () => agent.removeMutedWord(item),
                    'Could not remove that muted word.'
                  )
                }
                disabled={!!saving}
                accessibilityRole="button"
                accessibilityLabel={`Remove mute for ${item.value}`}
                style={({ pressed }) => ({
                  minHeight: 44,
                  minWidth: 64,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  backgroundColor: pressed ? p.soft : 'transparent',
                })}
              >
                <Ionicons name="trash-outline" size={18} color={p.danger} />
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={{ color: p.secondary, fontSize: 13, paddingHorizontal: 14, paddingTop: 12 }}>
            No muted words yet.
          </Text>
        )}
        <View style={{ padding: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            {(['content', 'tag'] as WordTarget[]).map((target) => {
              const selected = wordTarget === target;
              return (
                <Pressable
                  key={target}
                  onPress={() => setWordTarget(target)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
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
                  <Text style={{ color: selected ? p.accent : p.text, fontSize: 13, fontWeight: '600' }}>
                    {target === 'content' ? 'Words' : 'Hashtags'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={word}
              onChangeText={setWord}
              onSubmitEditing={() => void submitWord()}
              placeholder={wordTarget === 'content' ? 'Add a word to mute' : 'Add a hashtag to mute'}
              placeholderTextColor={p.secondary}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Muted word or hashtag"
              style={[
                styles.input,
                { color: p.text, borderColor: p.divider, backgroundColor: p.bg, flex: 1 },
                webInputReset,
              ]}
            />
            <Pressable
              onPress={() => void submitWord()}
              disabled={!word.trim() || !!saving}
              accessibilityRole="button"
              accessibilityLabel="Add muted word"
              style={({ pressed }) => ({
                minHeight: 44,
                paddingHorizontal: 16,
                borderRadius: 6,
                backgroundColor: p.accent,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !word.trim() || saving || pressed ? 0.55 : 1,
              })}
            >
              <Text style={{ color: p.onAccent, fontWeight: '700' }}>Add</Text>
            </Pressable>
          </View>
        </View>
        </Section>
      </View>

      <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, paddingHorizontal: 18 }}>
        These preferences are stored on your Bluesky account. Balla applies them before
        rendering posts, profiles and notifications.
      </Text>

      <Modal
        visible={confirmAdult}
        transparent
        animationType={dialogAnimation(reducedMotion)}
        accessibilityViewIsModal
        onRequestClose={() => setConfirmAdult(false)}
      >
        <View style={styles.overlay}>
          <Pressable
            onPress={() => setConfirmAdult(false)}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[styles.backdrop, { backgroundColor: p.overlay }]}
          />
          <View
            ref={adultDialogRef}
            {...dialogAccessibilityProps('Show adult content?')}
            accessibilityViewIsModal
            style={[styles.dialog, { backgroundColor: p.card }]}
          >
            <Text style={{ color: p.text, fontSize: 19, fontWeight: '700' }}>Show adult content?</Text>
            <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20, marginTop: 8 }}>
              You must be at least 18. This changes your Bluesky account preference, so
              other clients you use will respect it too. You can turn it off again here.
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Pressable
                ref={adultCancelRef}
                onPress={() => setConfirmAdult(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel enabling adult content"
                style={({ pressed }) => [styles.dialogButton, { borderColor: p.divider, backgroundColor: p.bg, opacity: pressed ? 0.65 : 1 }]}
              >
                <Text style={{ color: p.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmAdultEnabled}
                accessibilityRole="button"
                accessibilityLabel="I am over 18, enable adult content"
                style={({ pressed }) => [styles.dialogButton, { borderColor: p.accent, backgroundColor: p.accent, opacity: pressed ? 0.65 : 1 }]}
              >
                <Text style={{ color: p.onAccent, fontWeight: '700' }}>I’m over 18</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Section({
  title,
  children,
  sectionRef,
}: {
  title: string;
  children: React.ReactNode;
  sectionRef?: any;
}) {
  const p = usePalette();
  return (
    <View ref={sectionRef} style={{ marginBottom: 14 }}>
      <Text style={{ color: p.secondary, fontSize: 13, fontWeight: '700', paddingHorizontal: 18, marginBottom: 6 }}>
        {title}
      </Text>
      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  labelerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  addRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  input: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  labelRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    padding: 18,
  },
  dialogButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
