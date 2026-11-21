import React, { useEffect, useLayoutEffect, useState } from 'react';
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
import { countGraphemes } from 'unicode-segmenter/grapheme';
import {
  CREATABLE_LIST_PURPOSES,
  CURATE_LIST,
  LIST_DESCRIPTION_MAX,
  LIST_NAME_MAX,
  listActionError,
  validateListDraft,
} from '../lib/listModel';
import {
  createList,
  loadListRecord,
  updateListRecord,
} from '../lib/lists';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';

export function ListEditScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const p = usePalette();
  const uri = typeof route.params?.uri === 'string' ? route.params.uri : '';
  const requestedPurpose =
    route.params?.purpose === 'app.bsky.graph.defs#modlist'
      ? 'app.bsky.graph.defs#modlist'
      : CURATE_LIST;
  const [purpose, setPurpose] = useState<string>(requestedPurpose);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(!!uri);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: uri ? 'Edit list' : 'New list' });
  }, [navigation, uri]);

  useEffect(() => {
    if (!uri) return;
    let active = true;
    setLoading(true);
    loadListRecord(uri)
      .then((record) => {
        if (!active) return;
        setName(typeof record?.name === 'string' ? record.name : '');
        setDescription(
          typeof record?.description === 'string' ? record.description : ''
        );
        if (typeof record?.purpose === 'string') setPurpose(record.purpose);
        setError(null);
      })
      .catch((cause) => {
        if (active) {
          setError(
            listActionError(
              cause,
              'Could not load this list. It may have been deleted or belong to another account.'
            )
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [uri]);

  const validation = validateListDraft(name, description);
  const nameCount = countGraphemes(name.trim());
  const descriptionCount = countGraphemes(description.trim());
  const canSave = !loading && !saving && !validation;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      if (uri) {
        await updateListRecord(uri, { name, description });
        navigation.goBack();
      } else {
        const created = await createList({ name, description, purpose });
        navigation.replace('ListDetail', { uri: created });
      }
    } catch (cause) {
      setError(
        listActionError(
          cause,
          'Could not save this list. Check your connection and try again.'
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
          {uri ? 'Edit list details' : 'Create a list'}
        </Text>
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
          Lists are public AT Protocol records. Their name and description are
          visible to anyone who can see your profile.
        </Text>

        {error ? (
          <View style={[styles.notice, { backgroundColor: p.bg, borderColor: p.danger }]}>
            <Ionicons name="alert-circle-outline" size={18} color={p.danger} />
            <Text style={{ color: p.danger, fontSize: 13, lineHeight: 19, flex: 1 }}>
              {error}
            </Text>
          </View>
        ) : null}

        {!uri ? (
          <View style={{ marginTop: 18 }}>
            <Text style={[styles.label, { color: p.text }]}>What is this list for?</Text>
            {CREATABLE_LIST_PURPOSES.map((item) => {
              const selected = purpose === item.value;
              return (
                <Pressable
                  key={item.value}
                  onPress={() => setPurpose(item.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={({ pressed }) => [
                    styles.purpose,
                    {
                      backgroundColor: pressed ? p.bg : 'transparent',
                      borderColor: selected ? p.accent : p.divider,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.radio,
                      { borderColor: selected ? p.accent : p.secondary },
                    ]}
                  >
                    {selected ? (
                      <View style={[styles.radioDot, { backgroundColor: p.accent }]} />
                    ) : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
                      {item.label}
                    </Text>
                    <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}>
                      {item.description}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={[styles.fixedPurpose, { backgroundColor: p.bg, borderColor: p.divider }]}>
            <Ionicons name="information-circle-outline" size={17} color={p.secondary} />
            <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, flex: 1 }}>
              A list’s purpose is fixed after creation so its subscribers and feed
              are not silently changed underneath them.
            </Text>
          </View>
        )}

        <Text style={[styles.label, { color: p.text, marginTop: 18 }]}>List name</Text>
        <View
          style={[
            styles.inputShell,
            {
              backgroundColor: p.bg,
              borderColor: validation && !name.trim() ? p.danger : p.divider,
            },
          ]}
        >
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={purpose === CURATE_LIST ? 'e.g. Neighbours' : 'e.g. Spam accounts'}
            placeholderTextColor={p.secondary}
            autoCapitalize="sentences"
            accessibilityLabel="List name"
            style={[styles.nameInput, { color: p.text }, webInputReset]}
          />
        </View>
        <Text
          style={{
            color: nameCount > LIST_NAME_MAX ? p.danger : p.secondary,
            fontSize: 11,
            marginTop: 4,
            textAlign: 'right',
          }}
        >
          {nameCount}/{LIST_NAME_MAX}
        </Text>

        <Text style={[styles.label, { color: p.text, marginTop: 10 }]}>
          Description <Text style={{ color: p.secondary, fontWeight: '400' }}>(optional)</Text>
        </Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="What belongs on this list?"
          placeholderTextColor={p.secondary}
          multiline
          textAlignVertical="top"
          accessibilityLabel="List description"
          style={[
            styles.descriptionInput,
            { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
            webInputReset,
          ]}
        />
        <Text
          style={{
            color: descriptionCount > LIST_DESCRIPTION_MAX ? p.danger : p.secondary,
            fontSize: 11,
            marginTop: 4,
            textAlign: 'right',
          }}
        >
          {descriptionCount}/{LIST_DESCRIPTION_MAX}
        </Text>

        {validation && (name.trim() || description.trim()) ? (
          <Text style={{ color: p.danger, fontSize: 12, lineHeight: 17, marginTop: 4 }}>
            {validation}
          </Text>
        ) : null}

        <Pressable
          onPress={() => void save()}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel={uri ? 'Save list changes' : 'Create list'}
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
              {uri ? 'Save changes' : 'Create list'}
            </Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 8,
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
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  purpose: {
    minHeight: 66,
    borderWidth: 1,
    borderRadius: 10,
    padding: 11,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  fixedPurpose: {
    marginTop: 14,
    padding: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  inputShell: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  nameInput: {
    minHeight: 46,
    fontSize: 15,
  },
  descriptionInput: {
    minHeight: 126,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 21,
  },
  save: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
});
