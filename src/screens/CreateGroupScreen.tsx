import React, { useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getChatAgent } from '../lib/agent';
import { chatErrorCopy } from '../lib/chatModel';
import { validateGroupName } from '../lib/chatGroupModel';
import { ChatMemberPickerSheet } from '../components/ChatMemberPickerSheet';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';

/** A group is created from a name and resolved member DIDs; no invites by URL here. */
export function CreateGroupScreen() {
  const p = usePalette();
  const navigation = useNavigation<any>();
  const [name, setName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'New group' });
  }, [navigation]);

  async function create() {
    const validation = validateGroupName(name);
    if (validation) {
      setError(validation);
      return;
    }
    if (members.length < 2) {
      setError('Add at least two other people to start a group conversation.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await getChatAgent().chat.bsky.group.createGroup({
        name: name.trim(),
        members,
      });
      navigation.navigate('Conversation', { convoId: res.data.convo.id });
    } catch (err) {
      // Keep the chosen members so a failed create does not lose the work.
      setError(chatErrorCopy(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}>
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>Group name</Text>
        <Text style={{ color: p.secondary, fontSize: 13, marginTop: 6 }}>
          Everyone in the group can see the name. You can change it later from
          conversation settings.
        </Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Group name"
          placeholderTextColor={p.secondary}
          maxLength={64}
          accessibilityLabel="Group name"
          style={[
            styles.input,
            { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
            webInputReset,
          ]}
        />
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: p.card, borderColor: p.divider, marginTop: 12 },
          cardShadow,
        ]}
      >
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>Members</Text>
        <Text style={{ color: p.secondary, fontSize: 13, marginTop: 6 }}>
          {members.length
            ? `${members.length} ${members.length === 1 ? 'person' : 'people'} selected.`
            : 'No one selected yet. A group needs at least two other people.'}
        </Text>
        {members.map((did) => (
          <View key={did} style={styles.memberRow}>
            <Text selectable style={{ color: p.text, fontSize: 13, flex: 1 }}>
              {did}
            </Text>
            <Pressable
              onPress={() => setMembers((prev) => prev.filter((item) => item !== did))}
              accessibilityRole="button"
              accessibilityLabel="Remove selected member"
              style={({ pressed }) => [
                styles.remove,
                { opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="close" size={20} color={p.danger} />
            </Pressable>
          </View>
        ))}
        <Pressable
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel="Choose group members"
          style={({ pressed }) => [
            styles.secondary,
            { borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={{ color: p.accent, fontWeight: '600' }}>
            {members.length ? 'Edit members' : 'Choose people'}
          </Text>
        </Pressable>
      </View>

      {error ? (
        <View style={[styles.error, { borderColor: p.danger }]}>
          <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 14 }}>
            {error}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => void create()}
        disabled={saving}
        accessibilityRole="button"
        accessibilityLabel="Create group"
        style={({ pressed }) => [
          styles.primary,
          { backgroundColor: p.accent, opacity: pressed || saving ? 0.6 : 1 },
        ]}
      >
        {saving ? (
          <ActivityIndicator color={p.onAccent} />
        ) : (
          <Text style={{ color: p.onAccent, fontWeight: '700' }}>Create group</Text>
        )}
      </Pressable>

      {picking ? (
        <ChatMemberPickerSheet
          title="Choose group members"
          excludeDids={members}
          onClose={() => setPicking(false)}
          onAdd={(dids) => {
            setMembers((prev) => [...new Set([...prev, ...dids])]);
            setPicking(false);
          }}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CARD_RADIUS, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: CARD_RADIUS, paddingHorizontal: 12, marginTop: 12, fontSize: 15 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  secondary: { minHeight: 44, borderWidth: 1, borderRadius: CARD_RADIUS, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  error: { borderWidth: 1, borderRadius: CARD_RADIUS, padding: 12, marginTop: 12 },
  primary: { minHeight: 48, borderRadius: CARD_RADIUS, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
});
