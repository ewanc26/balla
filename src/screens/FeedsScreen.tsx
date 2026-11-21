import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
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
import { useFeeds } from '../lib/feedsContext';
import type { SavedFeedItem } from '../lib/feedPreferences';
import { Avatar } from '../components/Avatar';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

type Palette = ReturnType<typeof usePalette>;

export function FeedsScreen({ navigation }: { navigation: any }) {
  const p = usePalette();
  const {
    savedFeeds,
    pinnedFeeds,
    generators,
    loading,
    refreshing,
    error,
    detailsError,
    refresh,
    saveFeed,
    removeFeed,
    setPinned,
    movePinned,
  } = useFeeds();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [discoveryCursor, setDiscoveryCursor] = useState<
    string | undefined
  >(undefined);
  const [discovering, setDiscovering] = useState(true);
  const [discoveringMore, setDiscoveringMore] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const requestId = useRef(0);
  const cursorRef = useRef<string | undefined>(undefined);
  const submittedQuery = useRef('');
  const moreInFlight = useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Feeds' });
  }, [navigation]);

  const loadDiscovery = useCallback(
    async (term: string, fresh: boolean) => {
      if (!fresh && (!cursorRef.current || moreInFlight.current)) return;
      const id = fresh ? ++requestId.current : requestId.current;
      if (fresh) {
        setDiscovering(true);
        setDiscoveryError(null);
        submittedQuery.current = term;
      } else {
        moreInFlight.current = true;
        setDiscoveringMore(true);
      }
      try {
        const response =
          await agent.app.bsky.unspecced.getPopularFeedGenerators({
            ...(term ? { query: term } : {}),
            limit: 20,
            ...(fresh ? {} : { cursor: cursorRef.current }),
          });
        if (id !== requestId.current) return;
        const feeds = response.data.feeds || [];
        setResults((previous) => {
          if (fresh) return feeds;
          const seen = new Set(previous.map((item: any) => item.uri));
          return previous.concat(
            feeds.filter((item: any) => item.uri && !seen.has(item.uri))
          );
        });
        cursorRef.current = response.data.cursor;
        setDiscoveryCursor(response.data.cursor);
        setSearched(term.length > 0);
        setDiscoveryError(null);
      } catch {
        if (id === requestId.current) {
          if (fresh) setResults([]);
          setDiscoveryError(
            fresh
              ? 'Could not load feed discovery.'
              : 'Could not load more feeds.'
          );
        }
      } finally {
        if (id === requestId.current) {
          setDiscovering(false);
          setDiscoveringMore(false);
        }
        moreInFlight.current = false;
      }
    },
    []
  );

  useEffect(() => {
    void loadDiscovery('', true);
    return () => {
      requestId.current += 1;
    };
  }, [loadDiscovery]);

  async function run(key: string, task: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setActionError(null);
    try {
      await task();
    } catch {
      setActionError(
        'Could not confirm your saved-feed update. Pull to refresh before trying again.'
      );
    } finally {
      setBusy(null);
    }
  }

  function submitSearch() {
    const term = query.trim();
    void loadDiscovery(term, true);
  }

  function clearSearch() {
    setQuery('');
    void loadDiscovery('', true);
  }

  async function refreshAll() {
    await Promise.allSettled([
      refresh(),
      loadDiscovery(submittedQuery.current, true),
    ]);
  }

  const unpinnedFeeds = savedFeeds.filter((feed) => !feed.pinned);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refreshAll()}
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
          <Ionicons name="albums-outline" size={21} color={p.accent} />
        </View>
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, flex: 1 }}>
          Following is always the first, chronological feed. Pinned custom feeds
          get their own tab and keep the generator’s order.
        </Text>
      </View>

      {error ? (
        <Pressable
          onPress={() => void refresh()}
          accessibilityRole="button"
          accessibilityLabel="Retry loading saved feeds"
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

      {actionError ? (
        <View style={[styles.notice, { backgroundColor: p.card, borderColor: p.danger }]}>
          <Ionicons name="alert-circle-outline" size={18} color={p.danger} />
          <Text style={{ color: p.danger, fontSize: 13, lineHeight: 19, flex: 1 }}>
            {actionError}
          </Text>
        </View>
      ) : null}

      {detailsError ? (
        <View style={[styles.notice, { backgroundColor: p.card, borderColor: p.divider }]}>
          <Ionicons name="information-circle-outline" size={18} color={p.secondary} />
          <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, flex: 1 }}>
            {detailsError} You can still pin and remove the saved feeds.
          </Text>
        </View>
      ) : null}

      <Section
        title="Pinned to Home"
        detail={`${pinnedFeeds.length} ${pinnedFeeds.length === 1 ? 'feed' : 'feeds'}`}
      >
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, paddingHorizontal: 18, marginBottom: 8 }}>
          Following stays first. Use the arrows to change the order of the other
          pinned tabs.
        </Text>
        {loading && savedFeeds.length === 0 ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={p.accent} />
          </View>
        ) : pinnedFeeds.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: p.card, borderColor: p.divider }]}>
            <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
              No custom feeds are pinned. Pin one below to add a tab to Home.
            </Text>
          </View>
        ) : (
          pinnedFeeds.map((feed, index) => (
            <SavedFeedRow
              key={feed.id}
              feed={feed}
              generator={generators[feed.value]}
              palette={p}
              index={index}
              total={pinnedFeeds.length}
              busy={busy === `saved:${feed.value}`}
              disabled={!!busy}
              onOpen={() =>
                navigation.navigate('FeedGenerator', { feed: feed.value })
              }
              onTogglePin={() =>
                void run(`saved:${feed.value}`, () =>
                  setPinned(feed.value, false)
                )
              }
              onMove={(direction) =>
                void run(`saved:${feed.value}`, () =>
                  movePinned(feed.value, direction)
                )
              }
              onRemove={() =>
                void run(`saved:${feed.value}`, () => removeFeed(feed.value))
              }
            />
          ))
        )}
      </Section>

      <Section
        title="Saved feeds"
        detail={`${unpinnedFeeds.length} ${unpinnedFeeds.length === 1 ? 'feed' : 'feeds'}`}
      >
        {loading && savedFeeds.length === 0 ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={p.accent} />
          </View>
        ) : unpinnedFeeds.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: p.card, borderColor: p.divider }]}>
            <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
              No unpinned saved feeds. Saved feeds are opt-in and never replace
              Following.
            </Text>
          </View>
        ) : (
          unpinnedFeeds.map((feed) => (
            <SavedFeedRow
              key={feed.id}
              feed={feed}
              generator={generators[feed.value]}
              palette={p}
              index={0}
              total={1}
              busy={busy === `saved:${feed.value}`}
              disabled={!!busy}
              onOpen={() =>
                navigation.navigate('FeedGenerator', { feed: feed.value })
              }
              onTogglePin={() =>
                void run(`saved:${feed.value}`, () =>
                  setPinned(feed.value, true)
                )
              }
              onMove={() => {}}
              onRemove={() =>
                void run(`saved:${feed.value}`, () => removeFeed(feed.value))
              }
            />
          ))
        )}
      </Section>

      <Section
        title={searched ? `Search results for “${submittedQuery.current}”` : 'Discover feeds'}
        detail={searched ? 'Matching public feed generators' : 'Popular on Bluesky'}
      >
        <View
          style={[
            styles.searchRow,
            { backgroundColor: p.card, borderColor: p.divider },
          ]}
        >
          <Ionicons name="search-outline" size={19} color={p.secondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={submitSearch}
            placeholder="Search feed generators"
            placeholderTextColor={p.secondary}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search feed generators"
            style={[styles.searchInput, { color: p.text }]}
          />
          {query ? (
            <Pressable
              onPress={clearSearch}
              accessibilityRole="button"
              accessibilityLabel="Clear feed search"
              style={styles.searchClear}
            >
              <Ionicons name="close-circle" size={20} color={p.secondary} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={submitSearch}
            accessibilityRole="button"
            accessibilityLabel="Search feeds"
            style={({ pressed }) => [
              styles.searchButton,
              { backgroundColor: p.accent, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={{ color: p.onAccent, fontSize: 14, fontWeight: '700' }}>
              Search
            </Text>
          </Pressable>
        </View>

        {discovering ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={p.accent} />
          </View>
        ) : discoveryError ? (
          <Pressable
            onPress={() => void loadDiscovery(submittedQuery.current, true)}
            accessibilityRole="button"
            accessibilityLabel="Retry loading feed discovery"
            style={({ pressed }) => [
              styles.emptyCard,
              {
                backgroundColor: p.card,
                borderColor: p.danger,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={{ color: p.danger, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
              {discoveryError} Tap to try again.
            </Text>
          </Pressable>
        ) : results.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: p.card, borderColor: p.divider }]}>
            <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, textAlign: 'center' }}>
              {searched
                ? 'No feed generators matched that search.'
                : 'Bluesky returned no popular feeds right now.'}
            </Text>
          </View>
        ) : (
          results.map((feed: any) => {
            const saved = savedFeeds.find((item) => item.value === feed.uri);
            return (
              <DiscoveryFeedRow
                key={feed.uri}
                feed={feed}
                palette={p}
                saved={saved}
                busy={busy === `discover:${feed.uri}`}
                disabled={!!busy}
                onOpen={() =>
                  navigation.navigate('FeedGenerator', { feed: feed.uri })
                }
                onAction={() =>
                  void run(`discover:${feed.uri}`, async () => {
                    if (saved) await setPinned(feed.uri, !saved.pinned);
                    else await saveFeed(feed.uri, false);
                  })
                }
              />
            );
          })
        )}

        {discoveryCursor && !searched ? (
          <Pressable
            onPress={() => void loadDiscovery('', false)}
            disabled={discoveringMore}
            accessibilityRole="button"
            accessibilityLabel="Load more popular feeds"
            style={({ pressed }) => [
              styles.moreButton,
              {
                backgroundColor: p.card,
                borderColor: p.divider,
                opacity: pressed || discoveringMore ? 0.65 : 1,
              },
            ]}
          >
            {discoveringMore ? (
              <ActivityIndicator color={p.accent} />
            ) : (
              <Text style={{ color: p.accent, fontSize: 14, fontWeight: '700' }}>
                Load more feeds
              </Text>
            )}
          </Pressable>
        ) : null}
      </Section>

      <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, paddingHorizontal: 20, marginTop: 2 }}>
        Custom feeds are algorithms made by other people. Balla only adds one to
        Home when you pin it, and the Following feed is never replaced.
      </Text>
    </ScrollView>
  );
}

function Section({
  title,
  detail,
  children,
}: {
  title: string;
  detail?: string;
  children: React.ReactNode;
}) {
  const p = usePalette();
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={styles.sectionHeading}>
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700', flex: 1 }}>
          {title}
        </Text>
        {detail ? (
          <Text style={{ color: p.secondary, fontSize: 12 }}>{detail}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function SavedFeedRow({
  feed,
  generator,
  palette,
  index,
  total,
  busy,
  disabled,
  onOpen,
  onTogglePin,
  onMove,
  onRemove,
}: {
  feed: SavedFeedItem;
  generator: any;
  palette: Palette;
  index: number;
  total: number;
  busy: boolean;
  disabled: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const name = generator?.displayName || 'Saved feed';
  const creator = generator?.creator?.handle;
  const details = [
    creator ? `by @${creator}` : null,
    generator?.likeCount
      ? `${generator.likeCount} ${generator.likeCount === 1 ? 'like' : 'likes'}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      style={[
        styles.feedCard,
        { backgroundColor: palette.card, borderColor: palette.divider },
        cardShadow,
      ]}
    >
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Open ${name}`}
        style={({ pressed }) => [
          styles.feedIdentity,
          { backgroundColor: pressed ? palette.bg : 'transparent' },
        ]}
      >
        <Avatar avatar={generator?.avatar} displayName={name} size={46} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text
              style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}
              numberOfLines={1}
            >
              {name}
            </Text>
            {feed.pinned ? (
              <View style={[styles.badge, { backgroundColor: palette.accentSoft }]}>
                <Ionicons name="pin" size={11} color={palette.accent} />
                <Text style={{ color: palette.accent, fontSize: 10, fontWeight: '700' }}>
                  Pinned
                </Text>
              </View>
            ) : null}
          </View>
          <Text
            style={{ color: palette.secondary, fontSize: 12, marginTop: 2 }}
            numberOfLines={1}
          >
            {details || 'Custom feed'}
          </Text>
        </View>
        {busy ? (
          <ActivityIndicator size="small" color={palette.accent} />
        ) : (
          <Ionicons name="chevron-forward" size={17} color={palette.secondary} />
        )}
      </Pressable>

      <View style={[styles.feedControls, { borderTopColor: palette.divider }]}>
        <ActionButton
          palette={palette}
          icon={feed.pinned ? 'pin' : 'pin-outline'}
          label={feed.pinned ? 'Unpin' : 'Pin'}
          disabled={disabled}
          onPress={onTogglePin}
        />
        {feed.pinned ? (
          <>
            <ActionButton
              palette={palette}
              icon="arrow-up"
              label="Move up"
              compact
              disabled={disabled || index === 0}
              onPress={() => onMove(-1)}
            />
            <ActionButton
              palette={palette}
              icon="arrow-down"
              label="Move down"
              compact
              disabled={disabled || index >= total - 1}
              onPress={() => onMove(1)}
            />
          </>
        ) : null}
        <ActionButton
          palette={palette}
          icon="trash-outline"
          label="Remove"
          compact
          danger
          disabled={disabled}
          onPress={onRemove}
        />
      </View>
    </View>
  );
}

function DiscoveryFeedRow({
  feed,
  palette,
  saved,
  busy,
  disabled,
  onOpen,
  onAction,
}: {
  feed: any;
  palette: Palette;
  saved?: SavedFeedItem;
  busy: boolean;
  disabled: boolean;
  onOpen: () => void;
  onAction: () => void;
}) {
  const name = feed.displayName || 'Feed';
  const creator = feed.creator?.handle;
  const description =
    feed.description || (creator ? `Feed by @${creator}` : 'Custom feed');

  return (
    <View
      style={[
        styles.feedCard,
        { backgroundColor: palette.card, borderColor: palette.divider },
        cardShadow,
      ]}
    >
      <View style={styles.discoveryRow}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Open ${name}`}
          style={({ pressed }) => [
            styles.feedIdentity,
            { flex: 1, backgroundColor: pressed ? palette.bg : 'transparent' },
          ]}
        >
          <Avatar avatar={feed.avatar} displayName={name} size={46} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={{ color: palette.text, fontSize: 15, fontWeight: '700' }}
              numberOfLines={1}
            >
              {name}
            </Text>
            <Text
              style={{ color: palette.secondary, fontSize: 12, lineHeight: 17, marginTop: 2 }}
              numberOfLines={2}
            >
              {description}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={onAction}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={
            saved
              ? saved.pinned
                ? `Unpin ${name}`
                : `Pin ${name}`
              : `Save ${name}`
          }
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: saved ? palette.bg : palette.accent,
              borderColor: saved ? palette.divider : palette.accent,
              opacity: pressed || disabled ? 0.65 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator
              size="small"
              color={saved ? palette.accent : palette.onAccent}
            />
          ) : (
            <>
              <Ionicons
                name={
                  saved
                    ? saved.pinned
                      ? 'pin'
                      : 'bookmark'
                    : 'add'
                }
                size={16}
                color={saved ? palette.accent : palette.onAccent}
              />
              <Text
                style={{
                  color: saved ? palette.accent : palette.onAccent,
                  fontSize: 13,
                  fontWeight: '700',
                }}
              >
                {saved ? (saved.pinned ? 'Unpin' : 'Pin') : 'Save'}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function ActionButton({
  palette,
  icon,
  label,
  compact,
  danger,
  disabled,
  onPress,
}: {
  palette: Palette;
  icon: any;
  label: string;
  compact?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const color = danger ? palette.danger : palette.accent;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.actionButton,
        compact && styles.actionButtonCompact,
        {
          backgroundColor: pressed ? palette.bg : 'transparent',
          opacity: disabled ? 0.35 : 1,
        },
      ]}
    >
      <Ionicons name={icon} size={17} color={color} />
      {!compact ? (
        <Text style={{ color, fontSize: 13, fontWeight: '600' }}>{label}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginHorizontal: 8,
    marginBottom: 14,
    padding: 14,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    marginBottom: 12,
    padding: 12,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  emptyCard: {
    marginHorizontal: 8,
    padding: 20,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 84,
  },
  feedCard: {
    marginHorizontal: 8,
    marginBottom: 8,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  feedIdentity: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  feedControls: {
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  actionButton: {
    minHeight: 44,
    minWidth: 68,
    paddingHorizontal: 10,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionButtonCompact: {
    minWidth: 44,
    paddingHorizontal: 8,
  },
  discoveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  saveButton: {
    minHeight: 44,
    minWidth: 76,
    paddingHorizontal: 11,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  searchRow: {
    minHeight: 52,
    marginHorizontal: 8,
    marginBottom: 10,
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
  searchClear: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButton: {
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreButton: {
    minHeight: 48,
    marginHorizontal: 8,
    marginTop: 2,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
