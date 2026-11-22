import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { agent, getChatAgent } from '../lib/agent';
import { chatErrorCopy, convoTitle } from '../lib/chatModel';
import {
  canOwnerChangeLock,
  isOwner,
  joinLinkStatusLabel,
  joinRequestCount,
  lockAction,
  lockStatusLabel,
  validateGroupName,
  viewerIsOwner,
} from '../lib/chatGroupModel';
import { ChatMemberPickerSheet } from '../components/ChatMemberPickerSheet';
import { ChatInviteLinkSheet } from '../components/ChatInviteLinkSheet';
import { ChatReportSheet } from '../components/ChatReportSheet';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';

/**
 * Per-conversation settings. Ownership comes from the full member list, never
 * from ConvoView.members alone, and moderation-locked convos hide lock controls.
 */
export function ConversationSettingsScreen() {
  const p = usePalette();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const convoId = String(route.params?.convoId || '');
  const [convo, setConvo] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [picking, setPicking] = useState(false);
  const [invite, setInvite] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Conversation settings' });
  }, [navigation]);

  const load = useCallback(async () => {
    if (!convoId) return;
    setLoading(true);
    setError(null);
    try {
      const chat = getChatAgent();
      const [convoRes, memberRes] = await Promise.all([
        chat.chat.bsky.convo.getConvo({ convoId }),
        chat.chat.bsky.convo.getConvoMembers({ convoId, limit: 100 }).catch(() => null),
      ]);
      const next = convoRes.data.convo;
      setConvo(next);
      setName(String((next?.kind as any)?.name || convoTitle(next, agent.did) || ''));
      setMembers(memberRes?.data?.members || next?.members || []);
    } catch (err) {
      setError(chatErrorCopy(err));
    }
    setLoading(false);
  }, [convoId]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  async function run(key: string, call: () => Promise<any>, done?: () => void) {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      const res = await call();
      if (res?.data?.convo) setConvo(res.data.convo);
      if (res?.data?.joinLink) {
        setConvo((prev: any) =>
          prev
            ? {
                ...prev,
                kind: { ...(prev.kind || {}), joinLink: res.data.joinLink },
              }
            : prev
        );
      }
      done?.();
      await load();
    } catch (err) {
      setError(chatErrorCopy(err));
    }
    setBusy(null);
  }

  const kind = convo?.kind;
  const isGroup = !!kind && String(kind.$type || '').includes('#groupConvo');
  const owner = viewerIsOwner(members, agent.did || '');
  const requests = joinRequestCount(convo);
  const lockToggle = lockAction(convo);

  async function saveName() {
    const validation = validateGroupName(name);
    if (validation) {
      setError(validation);
      return;
    }
    await run('name', () =>
      getChatAgent().chat.bsky.group.editGroup({ convoId, name: name.trim() })
    );
    setEditingName(false);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ padding: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      {loading ? (
        <View style={{ alignItems: 'center', paddingTop: 32 }}>
          <ActivityIndicator color={p.accent} />
        </View>
      ) : error ? (
        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.danger }, cardShadow]}>
          <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 14 }}>
            {error}
          </Text>
          <Pressable
            onPress={() => void load()}
            accessibilityRole="button"
            accessibilityLabel="Retry loading conversation settings"
            style={({ pressed }) => [styles.retry, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={{ color: p.accent, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </View>
      ) : convo ? (
        <>
          <View style={[styles.card, { backgroundColor: p.card, borderColor: p.divider }, cardShadow]}>
            <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>
              {isGroup ? 'Group details' : 'Conversation'}
            </Text>
            {isGroup && owner ? (
              editingName ? (
                <>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    maxLength={64}
                    accessibilityLabel="Group name"
                    style={[
                      styles.input,
                      { color: p.text, backgroundColor: p.bg, borderColor: p.divider },
                      webInputReset,
                    ]}
                  />
                  <View style={styles.row}>
                    <Pressable
                      onPress={() => setEditingName(false)}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel editing group name"
                      style={({ pressed }) => [
                        styles.button,
                        { backgroundColor: p.bg, borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <Text style={{ color: p.text, fontWeight: '600' }}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void saveName()}
                      disabled={!!busy}
                      accessibilityRole="button"
                      accessibilityLabel="Save group name"
                      style={({ pressed }) => [
                        styles.button,
                        { backgroundColor: p.accent, borderColor: p.accent, opacity: pressed || busy ? 0.6 : 1 },
                      ]}
                    >
                      <Text style={{ color: p.onAccent, fontWeight: '700' }}>Save</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable
                  onPress={() => setEditingName(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Edit group name"
                  style={({ pressed }) => [
                    styles.action,
                    { borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={{ color: p.text, fontSize: 15, flex: 1 }}>
                    Name: {name || 'Unnamed group'}
                  </Text>
                  <Ionicons name="pencil-outline" size={18} color={p.secondary} />
                </Pressable>
              )
            ) : (
              <Text style={{ color: p.text, fontSize: 15, marginTop: 8 }}>
                {name || 'Conversation'}
              </Text>
            )}
            {isGroup ? (
              <Text style={{ color: p.secondary, fontSize: 13, marginTop: 8 }}>
                {kind.memberCount ?? members.length}
                {typeof kind.memberLimit === 'number' ? ` of ${kind.memberLimit}` : ''} members ·{' '}
                {owner ? 'You are an owner' : 'You are a member'}
              </Text>
            ) : null}
          </View>

          {isGroup && owner ? (
            <>
              <View
                style={[
                  styles.card,
                  { backgroundColor: p.card, borderColor: p.divider, marginTop: 12 },
                  cardShadow,
                ]}
              >
                <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>Members</Text>
                {members.map((member: any) => (
                  <View key={String(member?.did || Math.random())} style={styles.memberRow}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                        {member?.displayName || (member?.handle ? `@${member.handle}` : member?.did)}
                      </Text>
                      {isOwner(member) ? (
                        <Text style={{ color: p.secondary, fontSize: 12 }}>Owner</Text>
                      ) : null}
                    </View>
                    {member?.did !== agent.did ? (
                      <Pressable
                        onPress={() =>
                          void run('remove', () =>
                            getChatAgent().chat.bsky.group.removeMembers({
                              convoId,
                              members: [String(member.did)],
                            })
                          )
                        }
                        disabled={!!busy}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${member?.displayName || member?.handle || 'member'} from the group`}
                        style={({ pressed }) => [
                          styles.small,
                          { borderColor: p.danger, opacity: pressed || busy ? 0.6 : 1 },
                        ]}
                      >
                        <Text style={{ color: p.danger, fontWeight: '600' }}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
                <Pressable
                  onPress={() => setPicking(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Add members to this group"
                  style={({ pressed }) => [
                    styles.action,
                    { borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="person-add-outline" size={18} color={p.accent} />
                  <Text style={{ color: p.accent, fontWeight: '700', marginLeft: 8 }}>
                    Add members
                  </Text>
                </Pressable>
              </View>

              <View
                style={[
                  styles.card,
                  { backgroundColor: p.card, borderColor: p.divider, marginTop: 12 },
                  cardShadow,
                ]}
              >
                <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>Invite link</Text>
                <Text style={{ color: p.secondary, fontSize: 13, marginTop: 6 }}>
                  {joinLinkStatusLabel(kind?.joinLink)}
                </Text>
                <Pressable
                  onPress={() => setInvite(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Manage invite link"
                  style={({ pressed }) => [
                    styles.action,
                    { borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="link-outline" size={18} color={p.accent} />
                  <Text style={{ color: p.accent, fontWeight: '700', marginLeft: 8 }}>
                    Create or edit invite link
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate('JoinRequests', { convoId })}
                  accessibilityRole="button"
                  accessibilityLabel={`Review join requests (${requests})`}
                  style={({ pressed }) => [
                    styles.action,
                    { borderColor: p.divider, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Ionicons name="people-outline" size={18} color={p.accent} />
                  <Text style={{ color: p.accent, fontWeight: '700', marginLeft: 8 }}>
                    Join requests{requests > 0 ? ` (${requests})` : ''}
                  </Text>
                </Pressable>
              </View>

              {canOwnerChangeLock(convo) ? (
                <View
                  style={[
                    styles.card,
                    { backgroundColor: p.card, borderColor: p.divider, marginTop: 12 },
                    cardShadow,
                  ]}
                >
                  <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>Group access</Text>
                  <Text style={{ color: p.secondary, fontSize: 13, marginTop: 6 }}>
                    Status: {lockStatusLabel(convo)}. Locking stops new messages
                    while leaving the conversation in place.
                  </Text>
                  {lockToggle ? (
                    <Pressable
                      onPress={() =>
                        void run(lockToggle, () =>
                          lockToggle === 'lock'
                            ? getChatAgent().chat.bsky.convo.lockConvo({ convoId })
                            : getChatAgent().chat.bsky.convo.unlockConvo({ convoId })
                        )
                      }
                      disabled={!!busy}
                      accessibilityRole="button"
                      accessibilityLabel={lockToggle === 'lock' ? 'Lock this group' : 'Unlock this group'}
                      style={({ pressed }) => [
                        styles.primary,
                        { backgroundColor: p.accent, opacity: pressed || busy ? 0.6 : 1 },
                      ]}
                    >
                      {busy === lockToggle ? (
                        <ActivityIndicator size="small" color={p.onAccent} />
                      ) : (
                        <Text style={{ color: p.onAccent, fontWeight: '700' }}>
                          {lockToggle === 'lock' ? 'Lock group' : 'Unlock group'}
                        </Text>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <View
                  style={[
                    styles.card,
                    { backgroundColor: p.card, borderColor: p.divider, marginTop: 12 },
                    cardShadow,
                  ]}
                >
                  <Text style={{ color: p.text, fontSize: 15 }}>{lockStatusLabel(convo)}</Text>
                  <Text style={{ color: p.secondary, fontSize: 13, marginTop: 4 }}>
                    This lock is controlled by Bluesky moderation, so it cannot
                    be changed here.
                  </Text>
                </View>
              )}
            </>
          ) : null}

          <View
            style={[
              styles.card,
              { backgroundColor: p.card, borderColor: p.divider, marginTop: 12 },
              cardShadow,
            ]}
          >
            <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>Report</Text>
            <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
              Reports go to Bluesky’s moderation service. Balla sends ids only,
              never conversation content.
            </Text>
            <Pressable
              onPress={() => setReporting(true)}
              accessibilityRole="button"
              accessibilityLabel="Report this conversation"
              style={({ pressed }) => [
                styles.action,
                { borderColor: p.danger, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="flag-outline" size={18} color={p.danger} />
              <Text style={{ color: p.danger, fontWeight: '700', marginLeft: 8 }}>
                Report conversation
              </Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {picking ? (
        <ChatMemberPickerSheet
          title="Add group members"
          excludeDids={members.map((member: any) => String(member?.did || '')).filter(Boolean)}
          onClose={() => setPicking(false)}
          onAdd={(dids) => {
            setPicking(false);
            void run('add', () =>
              getChatAgent().chat.bsky.group.addMembers({ convoId, members: dids })
            );
          }}
        />
      ) : null}
      {invite ? (
        <ChatInviteLinkSheet
          convoId={convoId}
          link={kind?.joinLink}
          onClose={() => setInvite(false)}
          onUpdated={(link) => {
            setConvo((prev: any) =>
              prev
                ? { ...prev, kind: { ...(prev.kind || {}), joinLink: link } }
                : prev
            );
            setInvite(false);
          }}
        />
      ) : null}
      {reporting ? (
        <ChatReportSheet
          target={{ kind: 'convo', convoId, members }}
          onClose={() => setReporting(false)}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: CARD_RADIUS, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: CARD_RADIUS, paddingHorizontal: 12, fontSize: 15, marginTop: 10 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    borderWidth: 1,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  button: { flex: 1, minHeight: 44, borderRadius: CARD_RADIUS, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.06)', paddingVertical: 4 },
  small: { minHeight: 44, borderWidth: 1, borderRadius: CARD_RADIUS, paddingHorizontal: 10, justifyContent: 'center' },
  primary: { minHeight: 44, borderRadius: CARD_RADIUS, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 8 },
});
