import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import { Avatar } from '../components/Avatar';
import { PersonRow } from '../components/PersonRow';
import { isFeedSaved } from '../lib/feedPreferences';
import { useFeeds } from '../lib/feedsContext';
import {
  isBlockedCreator,
  starterPackShareUrl,
} from '../lib/starterPackModel';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

function recordText(record: any, key: string): string {
  return record && typeof record[key] === 'string' ? record[key] : '';
}

export function StarterPackScreen({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const p = usePalette();
  const { savedFeeds, saveFeed } = useFeeds();
  const uri = typeof route.params?.uri === 'string' ? route.params.uri : '';
  const [pack, setPack] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [feedErrors, setFeedErrors] = useState<Record<string, string>>({});
  const [savingFeed, setSavingFeed] = useState<string | null>(null);

  const load = useCallback(
    async (fresh: boolean) => {
      if (!uri) {
        setError('This starter pack has no address.');
        setLoading(false);
        return;
      }
      if (fresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      setShareError(null);
      setFeedErrors({});
      try {
        const response = await agent.app.bsky.graph.getStarterPack({
          starterPack: uri,
        });
        setPack(response.data.starterPack);
      } catch {
        setError('Could not load this starter pack. It may have been removed.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [uri]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useLayoutEffect(() => {
    const record = pack?.record;
    navigation.setOptions({
      title: recordText(record, 'name') || 'Starter pack',
    });
  }, [navigation, pack]);

  function openProfile(did: string) {
    navigation.navigate('UserProfile', { actor: did });
  }

  async function sharePack(url: string) {
    setShareError(null);
    try {
      await Share.share({ message: url, url });
    } catch {
      setShareError(
        'Sharing could not open. The link below is selectable so you can copy it.'
      );
    }
  }

  async function addFeed(feedUri: string) {
    setSavingFeed(feedUri);
    setFeedErrors((current) => ({ ...current, [feedUri]: '' }));
    try {
      await saveFeed(feedUri, false);
    } catch {
      setFeedErrors((current) => ({
        ...current,
        [feedUri]: 'Could not save this feed. Try again.',
      }));
    } finally {
      setSavingFeed(null);
    }
  }

  if (loading && !pack) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={p.accent} />
      </View>
    );
  }

  if (!pack) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Ionicons name="people-outline" size={34} color={p.secondary} />
        <Text style={{ color: p.text, fontSize: 17, fontWeight: '700', marginTop: 12, textAlign: 'center' }}>
          Starter pack unavailable
        </Text>
        <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 5 }}>
          {error || 'This starter pack could not be loaded.'}
        </Text>
        <Pressable
          onPress={() => void load(false)}
          accessibilityRole="button"
          accessibilityLabel="Retry loading this starter pack"
          style={({ pressed }) => ({
            minHeight: 44,
            borderRadius: CARD_RADIUS,
            backgroundColor: p.accent,
            paddingHorizontal: 22,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 16,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: p.onAccent, fontWeight: '700' }}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const record = pack.record || {};
  const creator = pack.creator || {};
  const name = recordText(record, 'name') || 'Starter pack';
  const description = recordText(record, 'description');
  const members = (pack.listItemsSample || [])
    .map((item: any) => item?.subject)
    .filter(Boolean);
  const totalMembers =
    pack.list?.listItemCount ??
    pack.listItemCount ??
    members.length;
  const feeds = Array.isArray(pack.feeds) ? pack.feeds : [];
  const blocked = isBlockedCreator(creator);
  const shareUrl = blocked ? null : starterPackShareUrl(uri, creator);
  const isOwner = !!creator.did && creator.did === agent.did;
  const sectionTitleStyle = {
    color: p.text,
    fontSize: 16,
    fontWeight: '700' as const,
    marginBottom: 6,
  };

  const Header = (
    <View>
      <View
        style={[
          styles.hero,
          { backgroundColor: p.card, borderColor: p.divider },
          cardShadow,
        ]}
      >
        <View
          style={[
            styles.heroBand,
            { backgroundColor: p.accentSoft, borderColor: p.divider },
          ]}
        >
          <Ionicons name="people" size={34} color={p.accent} />
        </View>
        <View style={{ padding: 16 }}>
          <Text style={{ color: p.text, fontSize: 22, fontWeight: '800' }}>
            {name}
          </Text>
          <Pressable
            onPress={() =>
              creator.did && navigation.navigate('UserProfile', { actor: creator.did })
            }
            disabled={!creator.did}
            accessibilityRole="button"
            accessibilityLabel={`Open ${creator.handle || 'creator'}'s profile`}
            style={({ pressed }) => [
              styles.creatorRow,
              { opacity: pressed ? 0.65 : 1 },
            ]}
          >
            <Avatar
              avatar={creator.avatar}
              displayName={creator.displayName || creator.handle}
              size={28}
            />
            <Text style={{ color: p.secondary, fontSize: 13, marginLeft: 8, flex: 1 }}>
              By <Text style={{ color: p.text, fontWeight: '600' }}>@{creator.handle || 'unknown'}</Text>
              {totalMembers ? ` · ${totalMembers} ${totalMembers === 1 ? 'person' : 'people'}` : ''}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={p.secondary} />
          </Pressable>

          {description ? (
            <Text style={{ color: p.text, fontSize: 14, lineHeight: 20, marginTop: 10 }}>
              {description}
            </Text>
          ) : null}

          {error ? (
            <Pressable
              onPress={() => void load(true)}
              accessibilityRole="button"
              accessibilityLabel="Retry refreshing this starter pack"
              style={({ pressed }) => [
                styles.notice,
                { backgroundColor: p.bg, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Ionicons name="alert-circle-outline" size={17} color={p.danger} />
              <Text style={{ color: p.danger, fontSize: 12, flex: 1 }}>
                {error} Tap to try again.
              </Text>
            </Pressable>
          ) : null}

          {blocked ? (
            <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 10 }}>
              This account is blocked, so Balla does not offer sharing here.
            </Text>
          ) : null}

          {shareUrl ? (
            <View style={{ marginTop: 12, gap: 8 }}>
              <Pressable
                onPress={() => void sharePack(shareUrl)}
                accessibilityRole="button"
                accessibilityLabel="Share starter pack"
                style={({ pressed }) => [
                  styles.action,
                  { backgroundColor: p.accent, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Ionicons name="share-outline" size={18} color={p.onAccent} />
                <Text style={{ color: p.onAccent, fontWeight: '700', fontSize: 14 }}>
                  Share starter pack
                </Text>
              </Pressable>
              <Text
                selectable
                style={{ color: p.secondary, fontSize: 11, lineHeight: 16 }}
                accessibilityLabel={`Starter pack link ${shareUrl}`}
              >
                {shareUrl}
              </Text>
            </View>
          ) : blocked ? null : (
            <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 10 }}>
              This starter pack has no shareable address.
            </Text>
          )}

          {shareError ? (
            <Text
              accessibilityRole="alert"
              style={{ color: p.danger, fontSize: 12, lineHeight: 17, marginTop: 6 }}
            >
              {shareError}
            </Text>
          ) : null}

          {isOwner ? (
            <Pressable
              onPress={() => navigation.navigate('StarterPackEdit', { uri })}
              accessibilityRole="button"
              accessibilityLabel="Edit starter pack"
              style={({ pressed }) => [
                styles.action,
                { backgroundColor: p.soft, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Ionicons name="create-outline" size={18} color={p.text} />
              <Text style={{ color: p.text, fontWeight: '700', fontSize: 14 }}>
                Edit starter pack
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {feeds.length > 0 ? (
        <View
          style={[
            styles.card,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <Text style={sectionTitleStyle}>Feeds in this pack</Text>
          {feeds.map((feed: any) => {
            const saved = isFeedSaved(savedFeeds, feed.uri);
            const saving = savingFeed === feed.uri;
            const feedError = feedErrors[feed.uri];
            return (
              <View key={feed.uri}>
                <View
                  style={[
                    styles.feedRow,
                    { borderTopColor: p.divider },
                  ]}
                >
                  <Pressable
                    onPress={() => navigation.navigate('FeedGenerator', { feed: feed.uri })}
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${feed.displayName || 'recommended'} feed`}
                    style={({ pressed }) => [
                      styles.feedIdentity,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Avatar
                      avatar={feed.avatar}
                      displayName={feed.displayName}
                      size={38}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={{ color: p.text, fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
                        {feed.displayName || 'Recommended feed'}
                      </Text>
                      <Text style={{ color: p.secondary, fontSize: 12 }} numberOfLines={1}>
                        Feed by @{feed.creator?.handle || 'unknown'}
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => void addFeed(feed.uri)}
                    disabled={saved || saving}
                    accessibilityRole="button"
                    accessibilityLabel={
                      saved
                        ? `${feed.displayName || 'Recommended'} feed is saved`
                        : `Add ${feed.displayName || 'recommended'} feed`
                    }
                    accessibilityState={{ disabled: saved || saving, busy: saving }}
                    style={({ pressed }) => [
                      styles.feedAction,
                      {
                        backgroundColor: saved ? p.soft : p.accent,
                        opacity: saved || saving ? 0.7 : pressed ? 0.7 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: saved ? p.text : p.onAccent,
                        fontWeight: '700',
                        fontSize: 13,
                      }}
                    >
                      {saved ? 'Saved feed' : saving ? 'Saving…' : 'Add feed'}
                    </Text>
                  </Pressable>
                </View>
                {feedError ? (
                  <Text
                    accessibilityRole="alert"
                    style={{ color: p.danger, fontSize: 12, lineHeight: 17, paddingBottom: 8 }}
                  >
                    {feedError}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 }}>
        <Text style={sectionTitleStyle}>People</Text>
        {members.length > 0 && totalMembers > members.length ? (
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17 }}>
            Showing {members.length} of {totalMembers} members. Bluesky supplies
            only this preview.
          </Text>
        ) : null}
      </View>
    </View>
  );

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 28 }}
      data={members}
      keyExtractor={(item: any) => item.did}
      renderItem={({ item }) => (
        <PersonRow person={item} onOpenProfile={openProfile} />
      )}
      ListHeaderComponent={Header}
      ListEmptyComponent={
        <Text style={{ color: p.secondary, textAlign: 'center', marginTop: 20, paddingHorizontal: 24 }}>
          No member preview is available for this starter pack.
        </Text>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load(true)}
          tintColor={p.accent}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  heroBand: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  creatorRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  notice: {
    minHeight: 44,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
  },
  action: {
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  card: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 4,
  },
  feedRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  feedIdentity: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  feedAction: {
    minHeight: 44,
    minWidth: 96,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
});
