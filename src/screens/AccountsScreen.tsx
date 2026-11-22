import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useViewer } from '../lib/viewer';
import {
  getAccounts,
  getActiveDid,
  removeAccount,
  switchAccount,
} from '../lib/agent';
import {
  MOCK_ACCOUNTS,
  accountLabel,
  accountSubtitle,
  type AccountEntry,
} from '../lib/accountModel';
import { MOCK_MODE } from '../lib/mock';
import { touchTargetStyle } from '../lib/accessibility';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

export function AccountsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const { profile } = useViewer();
  const [entries, setEntries] = useState<AccountEntry[]>([]);
  const [activeDid, setActiveDid] = useState<string | null>(null);
  const [busyDid, setBusyDid] = useState<string | null>(null);
  const [confirmingDid, setConfirmingDid] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const accounts = MOCK_MODE ? MOCK_ACCOUNTS : await getAccounts();
      if (!alive) return;
      setEntries(accounts);
      setActiveDid(getActiveDid());
    };
    void load().catch(() => {
      if (alive) setMessage('Could not load the accounts on this device.');
    });
    return () => {
      alive = false;
    };
  }, []);

  async function switchTo(did: string) {
    if (busyDid) return;
    setBusyDid(did);
    setMessage(null);
    if (MOCK_MODE) {
      setMessage('Switching accounts is disabled in the preview.');
      setBusyDid(null);
      return;
    }
    try {
      const ok = await switchAccount(did);
      if (!ok) setMessage('That session could not be restored. It has been removed from the list.');
    } catch {
      setMessage('Could not switch accounts. Try again.');
    } finally {
      setBusyDid(null);
    }
  }

  async function remove(did: string) {
    if (busyDid) return;
    setBusyDid(did);
    setMessage(null);
    if (MOCK_MODE) {
      setMessage('Removing accounts is disabled in the preview.');
      setConfirmingDid(null);
      setBusyDid(null);
      return;
    }
    try {
      await removeAccount(did);
      const next = await getAccounts();
      setEntries(next);
      setActiveDid(getActiveDid());
      setConfirmingDid(null);
    } catch {
      setMessage('Could not remove that account. Try again.');
      setConfirmingDid(null);
    } finally {
      setBusyDid(null);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
    >
      <View style={{ marginHorizontal: 18, marginBottom: 12 }}>
        <Text accessibilityRole="header" style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>
          Accounts on this device
        </Text>
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginTop: 5 }}>
          Each account keeps its own OAuth session here. Switching rebuilds Balla for
          that account; nothing from the previous account carries over.
        </Text>
      </View>

      {MOCK_MODE ? (
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginHorizontal: 18, marginBottom: 10 }}>
          Preview accounts only. Switching and removal do not change accounts here.
        </Text>
      ) : null}

      {entries.map((entry) => {
        const isActive = entry.did === activeDid;
        const label = isActive && profile?.handle ? `@${profile.handle}` : accountLabel(entry);
        const subtitle = accountSubtitle(entry);
        const confirming = confirmingDid === entry.did;
        return (
          <View
            key={entry.did}
            style={[
              styles.card,
              { backgroundColor: p.card, borderColor: p.divider },
              cardShadow,
            ]}
          >
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: p.accentSoft }]}>
                <Ionicons name="person-outline" size={22} color={p.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
                  {label}
                </Text>
                <Text style={{ color: p.secondary, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                  {subtitle}
                </Text>
              </View>
              {isActive ? (
                <Text style={{ color: p.accent, fontSize: 12, fontWeight: '700', marginLeft: 8 }}>
                  Current
                </Text>
              ) : null}
            </View>

            {confirming ? (
              <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: p.divider, paddingTop: 10, marginTop: 4 }}>
                <Text style={{ color: p.text, fontSize: 14, lineHeight: 20 }}>
                  Remove {label}?
                </Text>
                <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 3 }}>
                  Balla asks the server to revoke this grant and deletes its tokens from
                  this device. Your account and posts stay on your PDS.
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Pressable
                    onPress={() => setConfirmingDid(null)}
                    disabled={busyDid !== null}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel removing account"
                    style={({ pressed }) => [
                      styles.button,
                      { backgroundColor: p.bg, borderColor: p.divider, opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Text style={{ color: p.text, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void remove(entry.did)}
                    disabled={busyDid !== null}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${label}`}
                    style={({ pressed }) => [
                      styles.button,
                      { backgroundColor: p.danger, borderColor: p.danger, opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    {busyDid === entry.did ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                        Remove account
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                {!isActive ? (
                  <Pressable
                    onPress={() => void switchTo(entry.did)}
                    disabled={busyDid !== null}
                    accessibilityRole="button"
                    accessibilityLabel={`Switch to ${label}`}
                    style={({ pressed }) => [
                      styles.button,
                      { backgroundColor: p.accentSoft, borderColor: p.accent, opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    {busyDid === entry.did ? (
                      <ActivityIndicator size="small" color={p.accent} />
                    ) : (
                      <Text style={{ color: p.accent, fontSize: 14, fontWeight: '700' }}>Switch</Text>
                    )}
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setConfirmingDid(entry.did)}
                  disabled={busyDid !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${label}`}
                  style={({ pressed }) => [
                    styles.button,
                    { backgroundColor: p.bg, borderColor: p.divider, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text style={{ color: p.danger, fontSize: 14, fontWeight: '600' }}>Remove</Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}

      {entries.length === 0 && !MOCK_MODE ? (
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, marginHorizontal: 18 }}>
          No saved accounts were found. Add one below.
        </Text>
      ) : null}

      {message ? (
        <Text accessibilityRole="alert" style={{ color: p.danger, fontSize: 13, lineHeight: 19, marginHorizontal: 18, marginTop: 10 }}>
          {message}
        </Text>
      ) : null}

      <Pressable
        onPress={() => navigation.navigate('AddAccount')}
        accessibilityRole="button"
        accessibilityLabel="Add account"
        style={({ pressed }) => [
          styles.addButton,
          { backgroundColor: p.accent, opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Ionicons name="add-outline" size={20} color={p.onAccent} />
        <Text style={{ color: p.onAccent, fontSize: 15, fontWeight: '700', marginLeft: 8 }}>
          Add account
        </Text>
      </Pressable>

      <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginHorizontal: 18, marginTop: 12 }}>
        Tokens and DPoP keys stay in the OAuth client's on-device store, one per
        account. Balla remembers only the DID and any handle it was given. There
        are no shared credentials between accounts.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginHorizontal: 8,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  button: {
    ...touchTargetStyle,
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  addButton: {
    ...touchTargetStyle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: CARD_RADIUS,
    marginHorizontal: 8,
    marginTop: 4,
  },
});
