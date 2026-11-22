import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { countGraphemes } from 'unicode-segmenter/grapheme';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import { useFeeds } from '../lib/feedsContext';
import {
  createStarterPack,
  loadEditableStarterPack,
  loadFollowsForPicker,
  updateStarterPack,
  type EditableStarterPack,
} from '../lib/starterPacks';
import {
  STARTER_PACK_DESCRIPTION_MAX,
  STARTER_PACK_NAME_MAX,
  starterPackActionError,
  validateStarterPackDraft,
} from '../lib/starterPackModel';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';
import { Avatar } from '../components/Avatar';

export function StarterPackEditScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const p = usePalette();
  const { savedFeeds, generators, loading: feedsLoading, error: feedsError } =
    useFeeds();
  const requestedUri =
    typeof route.params?.uri === 'string' ? route.params.uri : 'new';
  const uri = requestedUri === 'new' ? null : requestedUri;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<any[]>([]);
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>([]);
  const [existing, setExisting] = useState<EditableStarterPack | null>(null);
  const [follows, setFollows] = useState<any[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [loading, setLoading] = useState(!!uri);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameFocused, setNameFocused] = useState(false);
  const [descriptionFocused, setDescriptionFocused] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: uri ? 'Edit starter pack' : 'New starter pack' });
  }, [navigation, uri]);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [people, editable] = await Promise.all([
          loadFollowsForPicker(),
          uri ? loadEditableStarterPack(uri) : Promise.resolve(null),
        ]);
        if (!active) return;
        setFollows(people);
        setExisting(editable);
        if (editable) {
          setName(
            typeof editable.record?.name === 'string' ? editable.record.name : ''
          );
          setDescription(
            typeof editable.record?.description === 'string'
              ? editable.record.description
              : ''
          );
          setSelectedMembers(
            editable.members.map((member) => member.profile).filter(Boolean)
          );
          setSelectedFeeds(editable.feeds);
        }
      } catch (cause) {
        if (active) {
          setError(
            starterPackActionError(
              cause,
              uri
                ? 'Could not load this starter pack. It may have been removed or belong to another account.'
                : 'Could not load the people you follow. You can still choose feeds.'
            )
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [uri]);

  const validation = validateStarterPackDraft(name, description);
  const canSave =
    !loading && !saving && !validation && (!uri || existing !== null);
  const selectedDids = useMemo(
    () => new Set(selectedMembers.map((person) => person.did).filter(Boolean)),
    [selectedMembers]
  );
  const visibleFollows = useMemo(() => {
    const term = memberQuery.trim().toLocaleLowerCase();
    return follows.filter((person) => {
      if (!person?.did || selectedDids.has(person.did)) return false;
      if (!term) return true;
      return [person.handle, person.displayName]
        .filter((value) => typeof value === 'string')
        .join('\n')
        .toLocaleLowerCase()
        .includes(term);
    });
  }, [follows, memberQuery, selectedDids]);

  function addMember(person: any) {
    if (!person?.did || selectedDids.has(person.did)) return;
    setSelectedMembers((current) => [...current, person]);
  }

  function removeMember(did: string) {
    setSelectedMembers((current) => current.filter((person) => person.did !== did));
  }

  function toggleFeed(value: string) {
    setSelectedFeeds((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const draft = {
        name,
        description,
        members: Array.from(selectedDids),
        feeds: selectedFeeds,
      };
      const savedUri = existing
        ? await updateStarterPack(existing, draft)
        : await createStarterPack(draft);
      navigation.replace('StarterPack', { uri: savedUri });
    } catch (cause) {
      setError(
        starterPackActionError(
          cause,
          'Could not save this starter pack. Some earlier records may already have changed; review the pack before retrying.'
        )
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 36 }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <Text style={{ color: p.text, fontSize: 22, fontWeight: '700' }}>
          {uri ? 'Edit starter pack details' : 'Create a starter pack'}
        </Text>
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
          Starter packs and their member lists are public AT Protocol records.
          People and feeds you choose are visible to anyone who opens the pack.
        </Text>

        {error ? (
          <View style={[styles.notice, { backgroundColor: p.bg, borderColor: p.danger }]}>
            <Ionicons name="alert-circle-outline" size={18} color={p.danger} />
            <Text style={{ color: p.danger, fontSize: 13, lineHeight: 19, flex: 1 }}>
              {error}
            </Text>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={p.accent} />
            <Text style={{ color: p.secondary, fontSize: 13, marginTop: 8 }}>
              Loading starter pack details…
            </Text>
          </View>
        ) : null}

        <Text style={[styles.label, { color: p.text, marginTop: 18 }]}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          onFocus={() => setNameFocused(true)}
          onBlur={() => setNameFocused(false)}
          placeholder="e.g. Quiet corner"
          placeholderTextColor={p.secondary}
          accessibilityLabel="Starter pack name"
          style={[
            styles.input,
            {
              color: p.text,
              backgroundColor: p.bg,
              borderColor: nameFocused ? p.accent : p.divider,
            },
            webInputReset,
          ]}
        />
        <Text
          style={{
            color: p.secondary,
            fontSize: 11,
            marginTop: 4,
            textAlign: 'right',
          }}
        >
          {countGraphemes(name.trim())}/{STARTER_PACK_NAME_MAX}
        </Text>

        <Text style={[styles.label, { color: p.text, marginTop: 10 }]}>
          Description <Text style={{ color: p.secondary, fontWeight: '400' }}>(optional)</Text>
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          onFocus={() => setDescriptionFocused(true)}
          onBlur={() => setDescriptionFocused(false)}
          placeholder="Who is this pack for?"
          placeholderTextColor={p.secondary}
          multiline
          textAlignVertical="top"
          accessibilityLabel="Starter pack description"
          style={[
            styles.description,
            {
              color: p.text,
              backgroundColor: p.bg,
              borderColor: descriptionFocused ? p.accent : p.divider,
            },
            webInputReset,
          ]}
        />
        <Text
          style={{
            color: p.secondary,
            fontSize: 11,
            marginTop: 4,
            textAlign: 'right',
          }}
        >
          {Array.from(description.trim()).length}/{STARTER_PACK_DESCRIPTION_MAX}
        </Text>

        {validation && (name.trim() || description.trim()) ? (
          <Text style={{ color: p.danger, fontSize: 12, lineHeight: 17, marginTop: 4 }}>
            {validation}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>
          People in this pack
        </Text>
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 }}>
          Choose from the people you follow. Their follow buttons on the pack
          stay explicit.
        </Text>

        {selectedMembers.length ? (
          <View style={{ marginTop: 12 }}>
            {selectedMembers.map((person) => (
              <View
                key={person.did}
                style={[styles.pickRow, { borderBottomColor: p.divider }]}
              >
                <Avatar
                  avatar={person.avatar}
                  displayName={person.displayName || person.handle}
                  size={36}
                />
                <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                  <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                    {person.displayName || person.handle}
                  </Text>
                  <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={1}>
                    @{person.handle || person.did}
                  </Text>
                </View>
                <Pressable
                  onPress={() => removeMember(person.did)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${person.handle || person.did} from this pack`}
                  style={({ pressed }) => [
                    styles.smallButton,
                    { backgroundColor: p.soft, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text style={{ color: p.text, fontWeight: '700', fontSize: 13 }}>
                    Remove
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: p.secondary, fontSize: 13, marginTop: 10 }}>
            No people selected yet.
          </Text>
        )}

        <TextInput
          value={memberQuery}
          onChangeText={setMemberQuery}
          placeholder="Find someone you follow"
          placeholderTextColor={p.secondary}
          accessibilityLabel="Find someone you follow"
          style={[
            styles.input,
            {
              color: p.text,
              backgroundColor: p.bg,
              borderColor: p.divider,
              marginTop: 14,
            },
            webInputReset,
          ]}
        />
        {visibleFollows.length ? (
          visibleFollows.map((person) => (
            <View
              key={person.did}
              style={[styles.pickRow, { borderBottomColor: p.divider }]}
            >
              <Avatar
                avatar={person.avatar}
                displayName={person.displayName || person.handle}
                size={36}
              />
              <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                  {person.displayName || person.handle}
                </Text>
                <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={1}>
                  @{person.handle || person.did}
                </Text>
              </View>
              <Pressable
                onPress={() => addMember(person)}
                accessibilityRole="button"
                accessibilityLabel={`Add ${person.handle || person.did} to this pack`}
                style={({ pressed }) => [
                  styles.smallButton,
                  { backgroundColor: p.accentSoft, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text style={{ color: p.accent, fontWeight: '700', fontSize: 13 }}>
                  Add
                </Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={{ color: p.secondary, fontSize: 13, marginTop: 12 }}>
            {memberQuery
              ? 'No one you follow matches that name or handle.'
              : 'No people you follow are available yet.'}
          </Text>
        )}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>
          Feeds in this pack
        </Text>
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 3 }}>
          Choose from feeds you have saved. Balla does not create feeds here.
        </Text>

        {feedsLoading ? (
          <ActivityIndicator color={p.accent} style={styles.loading} />
        ) : null}
        {feedsError ? (
          <Text style={{ color: p.danger, fontSize: 13, lineHeight: 19, marginTop: 10 }}>
            {feedsError}
          </Text>
        ) : null}
        {!feedsLoading && savedFeeds.length === 0 ? (
          <Text style={{ color: p.secondary, fontSize: 13, marginTop: 10 }}>
            You have no saved feeds yet.
          </Text>
        ) : null}

        {savedFeeds.map((item) => {
          const selected = selectedFeeds.includes(item.value);
          const detail = generators[item.value];
          return (
            <Pressable
              key={item.id}
              onPress={() => toggleFeed(item.value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${
                detail?.displayName || item.value
              } ${selected ? 'from' : 'to'} this pack`}
              style={({ pressed }) => [
                styles.feedRow,
                {
                  borderBottomColor: p.divider,
                  backgroundColor: selected ? p.accentSoft : p.card,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons
                name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={selected ? p.accent : p.secondary}
              />
              <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
                <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                  {detail?.displayName || item.value}
                </Text>
                <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={1}>
                  {detail?.creator?.handle
                    ? `Feed by @${detail.creator.handle}`
                    : item.value}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => void save()}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityLabel={uri ? 'Save starter pack changes' : 'Create starter pack'}
        accessibilityState={{ disabled: !canSave, busy: saving }}
        style={({ pressed }) => [
          styles.save,
          {
            backgroundColor: p.accent,
            opacity: !canSave ? 0.45 : pressed ? 0.7 : 1,
          },
        ]}
      >
        {saving ? (
          <ActivityIndicator color={p.onAccent} />
        ) : (
          <Text style={{ color: p.onAccent, fontSize: 15, fontWeight: '700' }}>
            {uri ? 'Save changes' : 'Create starter pack'}
          </Text>
        )}
      </Pressable>

      {uri ? null : (
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginHorizontal: 16, marginTop: 8 }}>
          Creating a starter pack writes a member list and a starter-pack record
          to your PDS. Sessions authorised before version 0.13.0 need to sign in
          again before this works.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  notice: {
    marginTop: 14,
    padding: 11,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loading: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  description: {
    minHeight: 108,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 21,
  },
  pickRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    gap: 10,
  },
  smallButton: {
    minHeight: 44,
    minWidth: 72,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  feedRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  save: {
    minHeight: 50,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    marginTop: 10,
  },
});
