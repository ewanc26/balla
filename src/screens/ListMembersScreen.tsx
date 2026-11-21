import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
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
import { Avatar } from '../components/Avatar';
import {
  listActionError,
  listPurposeMeta,
} from '../lib/listModel';
import {
  addListMember,
  loadAllListMembers,
  removeListMember,
} from '../lib/lists';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';

export function ListMembersScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const p = usePalette();
  const uri = typeof route.params?.uri === 'string' ? route.params.uri : '';
  const listName =
    typeof route.params?.name === 'string' ? route.params.name : 'list';
  const purpose = listPurposeMeta(route.params?.purpose);
  const [members, setMembers] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Manage list people' });
  }, [navigation]);

  const load = useCallback(async () => {
    if (!uri) {
      setError('This list has no address.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setMembers(await loadAllListMembers(uri));
    } catch (cause) {
      setError(
        listActionError(
          cause,
          'Could not load the people on this list. Check your connection and try again.'
        )
      );
    } finally {
      setLoading(false);
    }
  }, [uri]);

  useEffect(() => {
    void load();
  }, [load]);

  const membershipFor = (did: string) =>
    members.find((item: any) => item.subject?.did === did);

  async function toggle(person: any) {
    if (!uri || !person?.did || busy) return;
    const membership = membershipFor(person.did);
    setBusy(person.did);
    setError(null);
    try {
      if (membership) {
        await removeListMember(membership.uri);
        setMembers((prev) =>
          prev.filter((item) => item.subject?.did !== person.did)
        );
      } else {
        const itemUri = await addListMember(uri, person.did);
        setMembers((prev) => [...prev, { uri: itemUri, subject: person }]);
      }
    } catch (cause) {
      setError(
        listActionError(
          cause,
          `Could not ${membership ? 'remove' : 'add'} @${person.handle || 'this account'}. Try again.`
        )
      );
    } finally {
      setBusy(null);
    }
  }

  async function search() {
    const term = query.trim();
    if (!term || searching) return;
    setSearching(true);
    setSearched(true);
    setError(null);
    try {
      const response = await agent.searchActors({ q: term, limit: 30 });
      setResults(response.data.actors || []);
    } catch (cause) {
      setResults([]);
      setError(
        listActionError(
          cause,
          'Could not search for accounts. Check your connection and try again.'
        )
      );
    } finally {
      setSearching(false);
    }
  }

  function clearSearch() {
    setQuery('');
    setResults([]);
    setSearched(false);
    setError(null);
  }

  function openProfile(did: string) {
    navigation.navigate('UserProfile', { actor: did });
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 36 }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={[
          styles.intro,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <View style={[styles.introIcon, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="people-outline" size={21} color={p.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>
            {listName}
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
            {purpose.shortLabel === 'Moderation'
              ? 'Add accounts you want to mute or block together. Membership is public.'
              : 'Add people to this curation list. Membership is public.'}
          </Text>
        </View>
      </View>

      {error ? (
        <View style={[styles.notice, { backgroundColor: p.card, borderColor: p.danger }]}>
          <Ionicons name="alert-circle-outline" size={18} color={p.danger} />
          <Text style={{ color: p.danger, fontSize: 13, lineHeight: 19, flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : null}

      <View
        style={[
          styles.searchRow,
          { backgroundColor: p.card, borderColor: p.divider },
        ]}
      >
        <Ionicons name="search-outline" size={18} color={p.secondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => void search()}
          placeholder="Search accounts by handle or name"
          placeholderTextColor={p.secondary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Search accounts to add"
          style={[styles.searchInput, { color: p.text }, webInputReset]}
        />
        {query ? (
          <Pressable
            onPress={clearSearch}
            accessibilityRole="button"
            accessibilityLabel="Clear account search"
            style={styles.clearButton}
          >
            <Ionicons name="close-circle" size={19} color={p.secondary} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => void search()}
          disabled={!query.trim() || searching}
          accessibilityRole="button"
          accessibilityLabel="Search accounts"
          style={({ pressed }) => [
            styles.searchButton,
            {
              backgroundColor: p.accent,
              opacity: !query.trim() || searching ? 0.45 : pressed ? 0.65 : 1,
            },
          ]}
        >
          {searching ? (
            <ActivityIndicator size="small" color={p.onAccent} />
          ) : (
            <Text style={{ color: p.onAccent, fontSize: 13, fontWeight: '700' }}>
              Search
            </Text>
          )}
        </Pressable>
      </View>

      {query.trim() ? (
        <View style={{ marginBottom: 16 }}>
          <View style={styles.heading}>
            <Text style={{ color: p.text, fontSize: 16, fontWeight: '700', flex: 1 }}>
              Search results
            </Text>
            <Text style={{ color: p.secondary, fontSize: 12 }}>
              {results.length} found
            </Text>
          </View>
          {searching && results.length === 0 ? (
            <View style={{ paddingVertical: 22 }}>
              <ActivityIndicator color={p.accent} />
            </View>
          ) : results.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: p.card, borderColor: p.divider }]}>
              <Text style={{ color: p.secondary, fontSize: 13 }}>
                {searched
                  ? 'No accounts matched that search.'
                  : 'Press Search to find accounts.'}
              </Text>
            </View>
          ) : (
            results.map((person: any) => (
              <PersonActionRow
                key={person.did}
                person={person}
                membership={membershipFor(person.did)}
                busy={busy === person.did}
                onOpenProfile={() => openProfile(person.did)}
                onToggle={() => void toggle(person)}
              />
            ))
          )}
        </View>
      ) : null}

      <View style={styles.heading}>
        <Text style={{ color: p.text, fontSize: 16, fontWeight: '700', flex: 1 }}>
          People on this list
        </Text>
        <Text style={{ color: p.secondary, fontSize: 12 }}>
          {loading ? 'Loading…' : `${members.length} total`}
        </Text>
      </View>

      {loading && members.length === 0 ? (
        <View style={{ paddingVertical: 26 }}>
          <ActivityIndicator color={p.accent} />
        </View>
      ) : members.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: p.card, borderColor: p.divider }]}>
          <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
            No one is on this list yet. Search for an account above to add them.
          </Text>
        </View>
      ) : (
        members.map((item: any) => (
          <PersonActionRow
            key={item.uri}
            person={item.subject}
            membership={item}
            busy={busy === item.subject?.did}
            onOpenProfile={() => item.subject?.did && openProfile(item.subject.did)}
            onToggle={() => void toggle(item.subject)}
          />
        ))
      )}

      <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 16, paddingHorizontal: 20, marginTop: 4 }}>
        List membership is public. Adding someone does not notify them. Balla
        writes the list item to your PDS and does not store a separate copy.
      </Text>
    </ScrollView>
  );
}

function PersonActionRow({
  person,
  membership,
  busy,
  onOpenProfile,
  onToggle,
}: {
  person: any;
  membership: any;
  busy: boolean;
  onOpenProfile: () => void;
  onToggle: () => void;
}) {
  const p = usePalette();
  if (!person) return null;
  const name = person.displayName || person.handle || 'Account';
  return (
    <View
      style={[
        styles.person,
        { backgroundColor: p.card, borderColor: p.divider },
        cardShadow,
      ]}
    >
      <Pressable
        onPress={onOpenProfile}
        accessibilityRole="button"
        accessibilityLabel={`Open ${person.handle || 'account'}'s profile`}
        style={({ pressed }) => [
          styles.personIdentity,
          { opacity: pressed ? 0.65 : 1 },
        ]}
      >
        <Avatar avatar={person.avatar} displayName={name} size={44} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
            {name}
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={1}>
            @{person.handle || 'unknown'}
          </Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onToggle}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={
          membership
            ? `Remove ${person.handle || 'account'} from the list`
            : `Add ${person.handle || 'account'} to the list`
        }
        style={({ pressed }) => [
          styles.personAction,
          {
            backgroundColor: membership ? p.bg : p.accent,
            borderColor: membership ? p.divider : p.accent,
            opacity: pressed || busy ? 0.6 : 1,
          },
        ]}
      >
        {busy ? (
          <ActivityIndicator
            size="small"
            color={membership ? p.danger : p.onAccent}
          />
        ) : (
          <Text
            style={{
              color: membership ? p.danger : p.onAccent,
              fontSize: 12,
              fontWeight: '700',
            }}
          >
            {membership ? 'Remove' : 'Add'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginHorizontal: 8,
    marginBottom: 12,
    padding: 13,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  introIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    marginHorizontal: 8,
    marginBottom: 10,
    padding: 11,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchRow: {
    minHeight: 52,
    marginHorizontal: 8,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 4,
    gap: 7,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearButton: {
    width: 34,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButton: {
    minHeight: 44,
    minWidth: 66,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 18,
    marginBottom: 7,
  },
  empty: {
    marginHorizontal: 8,
    padding: 20,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  person: {
    minHeight: 66,
    marginHorizontal: 8,
    marginBottom: 7,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  personIdentity: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  personAction: {
    minHeight: 38,
    minWidth: 70,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
});
