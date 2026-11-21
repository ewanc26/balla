import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import { ListCard } from '../components/ListCard';
import {
  filterLists,
  listActionError,
} from '../lib/listModel';
import {
  loadBlockedLists,
  loadLists,
  loadSubscribedLists,
} from '../lib/lists';
import { CARD_RADIUS, cardShadow, usePalette, webInputReset } from '../theme';

function errorCopy(cause: unknown, fallback: string) {
  return listActionError(cause, fallback);
}

export function ListsScreen({ route, navigation }: { route?: any; navigation: any }) {
  const p = usePalette();
  const actor =
    typeof route?.params?.actor === 'string' ? route.params.actor : '';
  const handle =
    typeof route?.params?.handle === 'string' ? route.params.handle : '';
  const isOwn = !actor || actor === agent.did;
  const [own, setOwn] = useState<any[]>([]);
  const [subscribed, setSubscribed] = useState<any[]>([]);
  const [blocked, setBlocked] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isOwn ? 'Lists' : handle ? `Lists by @${handle}` : 'Profile lists',
    });
  }, [navigation, isOwn, handle]);

  const load = useCallback(
    async (fresh: boolean) => {
      if (fresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      const target = actor || agent.did;
      if (!target) {
        setError('Sign in before loading lists.');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      try {
        const ownResult = await loadLists(target);
        setOwn(ownResult);
        if (isOwn) {
          const [muted, blockedResult] = await Promise.allSettled([
            loadSubscribedLists(),
            loadBlockedLists(),
          ]);
          const ownUris = new Set(ownResult.map((list: any) => list.uri));
          const subscribedLists =
            muted.status === 'fulfilled'
              ? muted.value.filter((list: any) => !ownUris.has(list.uri))
              : [];
          const subscribedUris = new Set(
            subscribedLists.map((list: any) => list.uri)
          );
          setSubscribed(subscribedLists);
          setBlocked(
            blockedResult.status === 'fulfilled'
              ? blockedResult.value.filter(
                  (list: any) =>
                    !ownUris.has(list.uri) && !subscribedUris.has(list.uri)
                )
              : []
          );
        } else {
          setSubscribed([]);
          setBlocked([]);
        }
      } catch (cause) {
        setError(
          errorCopy(
            cause,
            'Could not load lists. Check your connection and try again.'
          )
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [actor, isOwn]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    return navigation.addListener('focus', () => {
      void load(true);
    });
  }, [navigation, load]);

  const visibleOwn = filterLists(own, query);
  const visibleSubscribed = filterLists(subscribed, query);
  const visibleBlocked = filterLists(blocked, query);
  const hasAny = own.length + subscribed.length + blocked.length > 0;
  const noSearchResults =
    !!query.trim() &&
    visibleOwn.length + visibleSubscribed.length + visibleBlocked.length === 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          tintColor={p.accent}
        />
      }
    >
      <View
        style={[
          styles.intro,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <View style={[styles.introIcon, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="list-outline" size={22} color={p.accent} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>
            {isOwn ? 'People, arranged by you' : 'Public lists'}
          </Text>
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
            {isOwn
              ? 'Curation lists have their own feed. Moderation lists can be subscribed to as a mute or block list.'
              : 'Lists are public records. Their contents and moderation state come from Bluesky.'}
          </Text>
        </View>
        {isOwn ? (
          <Pressable
            onPress={() => navigation.navigate('ListEdit')}
            accessibilityRole="button"
            accessibilityLabel="Create a list"
            style={({ pressed }) => [
              styles.newButton,
              { backgroundColor: p.accent, opacity: pressed ? 0.68 : 1 },
            ]}
          >
            <Ionicons name="add" size={18} color={p.onAccent} />
            <Text style={{ color: p.onAccent, fontSize: 13, fontWeight: '700' }}>
              New
            </Text>
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Pressable
          onPress={() => void load(true)}
          accessibilityRole="button"
          accessibilityLabel="Retry loading lists"
          style={({ pressed }) => [
            styles.notice,
            { backgroundColor: p.card, borderColor: p.danger, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Ionicons name="alert-circle-outline" size={18} color={p.danger} />
          <Text style={{ color: p.danger, fontSize: 13, lineHeight: 19, flex: 1 }}>
            {error} Tap to try again.
          </Text>
        </Pressable>
      ) : null}

      {hasAny ? (
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
            placeholder="Filter these lists"
            placeholderTextColor={p.secondary}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Filter these lists"
            style={[styles.searchInput, { color: p.text }, webInputReset]}
          />
          {query ? (
            <Pressable
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Clear list filter"
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={19} color={p.secondary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {loading && !hasAny ? (
        <View style={{ paddingVertical: 40 }}>
          <ActivityIndicator size="large" color={p.accent} />
        </View>
      ) : noSearchResults ? (
        <View style={[styles.empty, { backgroundColor: p.card, borderColor: p.divider }]}>
          <Ionicons name="search-outline" size={25} color={p.secondary} />
          <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', marginTop: 8 }}>
            No lists match “{query.trim()}”
          </Text>
          <Text style={{ color: p.secondary, fontSize: 13, marginTop: 4, textAlign: 'center' }}>
            Names, descriptions and creator handles are searched on this device.
          </Text>
        </View>
      ) : (
        <>
          <ListSection
            title={isOwn ? 'Your lists' : 'Lists'}
            detail={`${visibleOwn.length} ${visibleOwn.length === 1 ? 'list' : 'lists'}`}
            empty={
              isOwn
                ? 'No lists yet. Create a curation list for a feed, or a moderation list for accounts you want to group.'
                : 'This account has no public lists.'
            }
            lists={visibleOwn}
            showCreator={!isOwn}
            onOpen={(uri) => navigation.navigate('ListDetail', { uri })}
          />

          {isOwn ? (
            <>
              <ListSection
                title="Subscribed"
                detail={`${visibleSubscribed.length} ${visibleSubscribed.length === 1 ? 'list' : 'lists'}`}
                empty="No lists are subscribed to. Subscribing to a moderation list applies its mute or block state."
                lists={visibleSubscribed}
                onOpen={(uri) => navigation.navigate('ListDetail', { uri })}
              />
              <ListSection
                title="Blocked"
                detail={`${visibleBlocked.length} ${visibleBlocked.length === 1 ? 'list' : 'lists'}`}
                empty="No lists are blocked."
                lists={visibleBlocked}
                onOpen={(uri) => navigation.navigate('ListDetail', { uri })}
              />
            </>
          ) : null}
        </>
      )}

      <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 16, paddingHorizontal: 20, marginTop: 4 }}>
        Lists are stored on your PDS as public AT Protocol records. Balla does not
        create a separate copy on a Balla server.
      </Text>
    </ScrollView>
  );
}

function ListSection({
  title,
  detail,
  empty,
  lists,
  showCreator = true,
  onOpen,
}: {
  title: string;
  detail: string;
  empty: string;
  lists: any[];
  showCreator?: boolean;
  onOpen: (uri: string) => void;
}) {
  const p = usePalette();
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={styles.sectionHeading}>
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700', flex: 1 }}>
          {title}
        </Text>
        <Text style={{ color: p.secondary, fontSize: 12 }}>{detail}</Text>
      </View>
      {lists.length === 0 ? (
        <View style={[styles.emptySmall, { backgroundColor: p.card, borderColor: p.divider }]}>
          <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
            {empty}
          </Text>
        </View>
      ) : (
        lists.map((list) => (
          <ListCard
            key={list.uri}
            list={list}
            showCreator={showCreator}
            onPress={() => onOpen(list.uri)}
          />
        ))
      )}
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
    gap: 11,
  },
  introIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newButton: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  notice: {
    marginHorizontal: 8,
    marginBottom: 12,
    padding: 12,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  searchRow: {
    minHeight: 50,
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
    width: 42,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  empty: {
    marginHorizontal: 8,
    padding: 24,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  emptySmall: {
    marginHorizontal: 8,
    padding: 18,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
