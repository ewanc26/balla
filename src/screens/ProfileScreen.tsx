import React, { useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { moderateProfile } from '@atproto/api';
import { agent } from '../lib/agent';
import { describeFailure, readWithRetry } from '../lib/reliability';
import { PostCard } from '../components/PostCard';
import { Avatar } from '../components/Avatar';
import { ProfileMenu } from '../components/ProfileMenu';
import { ContentWarning } from '../components/ContentWarning';
import { useModeration } from '../lib/moderationContext';
import { accountLabelCauses, hiddenByLabel } from '../lib/labelVisibility';
import { useViewer } from '../lib/viewer';
import { profileLinkHost, profileLinkLabel } from '../lib/profileLinks';
import {
  listMemberCount,
  listPurposeMeta,
  listViewerState,
} from '../lib/listModel';
import { subscribeActorHidden } from '../lib/moderation';
import { VerificationSheet } from '../components/VerificationSheet';
import {
  profileAssociatedCounts,
  profileIsLabeler,
  profilePinnedUri,
  profileVerification,
  verificationBadgeLabel,
  type VerificationSummary,
} from '../lib/profileModel';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

export function ProfileScreen({ route, navigation }: { route?: any; navigation: any }) {
  const p = usePalette();
  const { opts } = useModeration();
  const { profile: viewerProfile } = useViewer();
  const actor = (route && route.params && route.params.actor) || agent.did;
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [followingUri, setFollowingUri] = useState<string | undefined>(undefined);
  const [followBusy, setFollowBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileRevealed, setProfileRevealed] = useState(false);
  const [knownFollowers, setKnownFollowers] = useState<any[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [feeds, setFeeds] = useState<any[]>([]);
  const [starterPacks, setStarterPacks] = useState<any[]>([]);
  const [pinnedPost, setPinnedPost] = useState<any>(null);
  const [verificationOpen, setVerificationOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setProfile(null);
    setPosts([]);
    setFailed(false);
    setFailureMessage(null);
    setActionError(null);
    setFollowingUri(undefined);
    setProfileRevealed(false);
    setKnownFollowers([]);
    setLists([]);
    setFeeds([]);
    setStarterPacks([]);
    setPinnedPost(null);
    setVerificationOpen(false);

    if (!actor) {
      setFailed(true);
      setFailureMessage('This profile has no address.');
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        const [prof, feed] = await readWithRetry(() =>
          Promise.all([
            agent.getProfile({ actor }),
            agent.getAuthorFeed({ actor, limit: 30 }),
          ])
        );
        if (!active) return;
        const detail = prof.data;
        setProfile(detail);
        setFollowingUri(detail.viewer && detail.viewer.following);
        setPosts((feed.data.feed || []).map((item: any) => item.post));

        // The sections below are additive: a missing optional AppView endpoint
        // must never hide the profile or its posts.
        void Promise.all([
          agent.app.bsky.graph
            .getLists({ actor, limit: 20 })
            .then((res) => {
              if (active) setLists(res.data.lists || []);
            })
            .catch(() => {}),
          agent.app.bsky.feed
            .getActorFeeds({ actor, limit: 20 })
            .then((res: any) => {
              if (active) setFeeds(res.data.feeds || []);
            })
            .catch(() => {}),
          agent.app.bsky.graph
            .getActorStarterPacks({ actor, limit: 20 })
            .then((res: any) => {
              if (active) setStarterPacks(res.data.starterPacks || []);
            })
            .catch(() => {}),
        ]);

        const pinnedUri = profilePinnedUri(detail);
        if (pinnedUri) {
          agent
            .getPosts({ uris: [pinnedUri] })
            .then((res) => {
              const post = res.data.posts?.[0];
              if (active && post) setPinnedPost(post);
            })
            .catch(() => {});
        }

        if (detail.did !== agent.did) {
          // Social proof is optional: a failed lookup must not block the profile.
          agent.app.bsky.graph
            .getKnownFollowers({ actor: detail.did, limit: 3 })
            .then((known) => {
              if (active) setKnownFollowers(known.data.followers || []);
            })
            .catch(() => {});
        }
      } catch (err) {
        if (active) {
          setFailed(true);
          setFailureMessage(describeFailure(err, 'Could not load this profile.'));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [actor, reloadToken]);

  useEffect(() => {
    return subscribeActorHidden((did) => {
      setPosts((prev) => prev.filter((item: any) => item.author.did !== did));
      setPinnedPost((prev: any) => (prev && prev.author.did === did ? null : prev));
    });
  }, []);

  // Edit Profile updates the viewer context optimistically. Mirror its own
  // profile here so the tab does not show the old photo or bio on return.
  useEffect(() => {
    if (!viewerProfile || actor !== agent.did || viewerProfile.did !== profile?.did) {
      return;
    }
    setProfile((prev: any) => (prev ? { ...prev, ...viewerProfile } : prev));
  }, [viewerProfile, actor, profile?.did]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: profile ? `@${profile.handle}` : 'Profile' });
  }, [navigation, profile]);

  async function toggleFollow() {
    if (!profile || followBusy) return;
    if (profile.viewer?.blocking || profile.viewer?.blockedBy) return;
    setFollowBusy(true);
    setActionError(null);
    try {
      if (followingUri) {
        await agent.deleteFollow(followingUri);
        setFollowingUri(undefined);
        setProfile((prev: any) =>
          prev
            ? { ...prev, followersCount: Math.max(0, (prev.followersCount || 0) - 1) }
            : prev
        );
      } else {
        const result = await agent.follow(profile.did);
        setFollowingUri(result.uri);
        setProfile((prev: any) =>
          prev ? { ...prev, followersCount: (prev.followersCount || 0) + 1 } : prev
        );
      }
    } catch (err) {
      // Keep the previous state and say so; the button can be tried again.
      setActionError(
        describeFailure(err, `Could not ${followingUri ? 'unfollow' : 'follow'} @${profile.handle}. Try again.`)
      );
    }
    setFollowBusy(false);
  }

  function openThread(uri: string) {
    navigation.navigate('Thread', { uri });
  }

  function openProfile(did: string) {
    if (did === profile?.did) return;
    navigation.navigate('UserProfile', { actor: did });
  }

  function updateViewer(viewer: Record<string, any>) {
    setProfile((prev: any) =>
      prev
        ? { ...prev, viewer: { ...(prev.viewer || {}), ...viewer } }
        : prev
    );
    if (viewer.blocking) {
      setPosts([]);
      setPinnedPost(null);
    }
  }

  function reloadProfile() {
    setReloadToken((value) => value + 1);
  }

  function hidePost(post: any, scope: 'post' | 'author') {
    setPosts((prev) =>
      prev.filter((item: any) =>
        scope === 'author'
          ? item.author.did !== post.author.did
          : item.uri !== post.uri
      )
    );
    if (
      pinnedPost &&
      (scope === 'author'
        ? post.author.did === pinnedPost.author.did
        : post.uri === pinnedPost.uri)
    ) {
      setPinnedPost(null);
    }
    if (scope === 'post' && post.author.did === profile.did) {
      setProfile((prev: any) =>
        prev
          ? { ...prev, postsCount: Math.max(0, (prev.postsCount || 0) - 1) }
          : prev
      );
    }
  }

  if (failed) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
        <Text style={{ color: p.secondary, textAlign: 'center' }}>
          {failureMessage || 'Could not load this profile.'}
        </Text>
        <Pressable
          onPress={reloadProfile}
          accessibilityRole="button"
          accessibilityLabel="Retry loading the profile"
          style={({ pressed }) => ({
            minHeight: 44,
            minWidth: 120,
            paddingHorizontal: 18,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: p.accent,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Text style={{ color: p.accent, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={p.accent} />
      </View>
    );
  }

  const isSelf = profile.did === agent.did;
  const isBlocked = !!(profile.viewer?.blocking || profile.viewer?.blockedBy);
  const verification: VerificationSummary = profileVerification(profile);
  const badgeLabel = verificationBadgeLabel(verification);
  const isLabeler = profileIsLabeler(profile);
  const associatedCounts = profileAssociatedCounts(profile);
  const profileDecision = moderateProfile(profile, opts);
  const profileUi = profileDecision.ui('profileView');
  const avatarUi = profileDecision.ui('avatar');
  const displayNameUi = profileDecision.ui('displayName');
  const profileWarningCauses = accountLabelCauses(profileDecision.labelCauses);
  const showProfileWarning = !profileRevealed && profileWarningCauses.length > 0;
  const noOverrideProfile =
    profileUi.noOverride || avatarUi.noOverride || displayNameUi.noOverride;

  if (hiddenByLabel(profileDecision.ui('profileList'))) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: p.bg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Ionicons name="eye-off-outline" size={34} color={p.secondary} />
        <Text
          style={{
            color: p.text,
            fontSize: 18,
            fontWeight: '700',
            textAlign: 'center',
            marginTop: 12,
          }}
        >
          Account hidden by a label
        </Text>
        <Text
          style={{
            color: p.secondary,
            fontSize: 14,
            lineHeight: 20,
            textAlign: 'center',
            marginTop: 8,
          }}
        >
          Your label settings hide this account. Change the label to Warn or
          Show in Content filters if you want to see it.
        </Text>
      </View>
    );
  }

  function Header() {
    return (
      <View>
        {actionError ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 4 }}>
            <Text style={{ color: p.danger, fontSize: 13 }}>{actionError}</Text>
            <Pressable
              onPress={() => setActionError(null)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss follow error"
              style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 8 }}
            >
              <Text style={{ color: p.accent, fontWeight: '700' }}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}
        <View
          style={[
            styles.profileCard,
            { backgroundColor: p.card, borderColor: p.divider },
            cardShadow,
          ]}
        >
          <View style={{ height: 200, backgroundColor: p.accent, overflow: 'hidden' }}>
            {profile.banner ? (
              <Image
                source={{ uri: profile.banner }}
                style={{ width: '100%', height: 200 }}
                resizeMode="cover"
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text
                  style={{
                    color: 'rgba(255, 255, 255, 0.2)',
                    fontSize: 128,
                    fontWeight: '800',
                    lineHeight: 140,
                  }}
                >
                  b
                </Text>
              </View>
            )}
          </View>

          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <View
              style={{
                flexDirection: 'row',
                marginTop: -56,
                alignItems: 'flex-end',
              }}
            >
              <View
                style={{
                  borderRadius: 60,
                  borderWidth: 4,
                  borderColor: p.card,
                  backgroundColor: p.card,
                }}
              >
                <Avatar
                  avatar={profile.avatar}
                  displayName={profile.displayName || profile.handle}
                  size={104}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    marginTop: 8,
                  }}
                >
                  <Text style={{ color: p.text, fontSize: 24, fontWeight: '700' }}>
                    {profile.displayName || profile.handle}
                  </Text>
                  {badgeLabel ? (
                    <Pressable
                      onPress={() => setVerificationOpen(true)}
                      accessibilityRole="button"
                      accessibilityLabel={`${badgeLabel}. Show verification details`}
                      accessibilityHint={`Shows the verification records Bluesky reports for @${profile.handle}`}
                      style={({ pressed }) => [
                        styles.verificationBadge,
                        { opacity: pressed ? 0.6 : 1 },
                      ]}
                    >
                      <Ionicons
                        name={
                          verification.verified
                            ? 'checkmark-circle'
                            : 'shield-checkmark-outline'
                        }
                        size={22}
                        color={p.accent}
                      />
                    </Pressable>
                  ) : null}
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}
                >
                  <Text style={{ color: p.secondary, fontSize: 15 }}>@{profile.handle}</Text>
                  {isLabeler ? (
                    <View style={[styles.labelerChip, { backgroundColor: p.accentSoft }]}>
                      <Text style={{ color: p.accent, fontSize: 11, fontWeight: '700' }}>
                        LABELER
                      </Text>
                    </View>
                  ) : null}
                  {profile.pronouns?.trim() ? (
                    <Text style={{ color: p.secondary, fontSize: 15 }}>
                      {profile.pronouns.trim()}
                    </Text>
                  ) : null}
                </View>
              </View>
              {!isSelf ? (
                <Pressable
                  onPress={() => setMenuOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Account options"
                  accessibilityHint="Report, mute, block or unblock this account"
                  style={({ pressed }) => [
                    styles.menuButton,
                    { backgroundColor: pressed ? p.bg : 'transparent' },
                  ]}
                >
                  <Ionicons name="ellipsis-horizontal" size={21} color={p.secondary} />
                </Pressable>
              ) : null}
            </View>

            {showProfileWarning ? (
              <ContentWarning
                causes={profileWarningCauses}
                noOverride={noOverrideProfile}
                onReveal={() => setProfileRevealed(true)}
              />
            ) : null}

            <View style={{ flexDirection: 'row', gap: 18, marginTop: 10 }}>
              <Stat value={profile.postsCount || 0} label="posts" />
              <Stat
                value={profile.followsCount || 0}
                label="following"
                onPress={() =>
                  navigation.navigate('PeopleList', {
                    actor: profile.did,
                    mode: 'following',
                  })
                }
              />
              <Stat
                value={profile.followersCount || 0}
                label="followers"
                onPress={() =>
                  navigation.navigate('PeopleList', {
                    actor: profile.did,
                    mode: 'followers',
                  })
                }
              />
            </View>

            {profile.description && !showProfileWarning ? (
              <Text style={{ color: p.text, fontSize: 15, lineHeight: 21, marginTop: 10 }}>
                {profile.description}
              </Text>
            ) : null}

            {profile.links?.length && !showProfileWarning ? (
              <View style={styles.profileLinks}>
                {profile.links.map((link: any) => (
                  <Pressable
                    key={link.uri || link.url}
                    onPress={() => {
                      void Linking.openURL(link.url).catch(() => {});
                    }}
                    accessibilityRole="link"
                    accessibilityLabel={profileLinkLabel(link)}
                    accessibilityHint={`Opens ${profileLinkHost(link.url)} in your browser`}
                    style={({ pressed }) => [
                      styles.profileLink,
                      {
                        backgroundColor: pressed ? p.divider : p.bg,
                        borderColor: p.divider,
                      },
                    ]}
                  >
                    {link.icon ? (
                      <Image source={{ uri: link.icon }} style={styles.profileLinkIcon} />
                    ) : (
                      <Ionicons name="link-outline" size={15} color={p.accent} />
                    )}
                    <Text
                      style={{ color: p.text, fontSize: 13, fontWeight: '600', marginLeft: 6 }}
                      numberOfLines={1}
                    >
                      {profileLinkLabel(link)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {knownFollowers.length > 0 && !showProfileWarning ? (
              <Pressable
                onPress={() =>
                  navigation.navigate('PeopleList', {
                    actor: profile.did,
                    mode: 'known',
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="See followers you know"
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginTop: 10,
                  minHeight: 44,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <View style={{ flexDirection: 'row', marginRight: 8 }}>
                  {knownFollowers.slice(0, 3).map((person: any, index: number) => (
                    <View
                      key={person.did}
                      style={{
                        marginLeft: index === 0 ? 0 : -8,
                        borderRadius: 20,
                        borderWidth: 2,
                        borderColor: p.card,
                      }}
                    >
                      <Avatar
                        avatar={person.avatar}
                        displayName={person.displayName || person.handle}
                        size={26}
                      />
                    </View>
                  ))}
                </View>
                <Text style={{ color: p.secondary, fontSize: 14, flex: 1 }} numberOfLines={2}>
                  Followed by{' '}
                  <Text style={{ color: p.text, fontWeight: '600' }}>
                    {joinNames(knownFollowers.slice(0, 3))}
                  </Text>
                </Text>
                <Ionicons name="chevron-forward" size={16} color={p.secondary} />
              </Pressable>
            ) : null}

            {isBlocked ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: 8,
                  backgroundColor: p.bg,
                  borderRadius: CARD_RADIUS,
                  padding: 10,
                  marginTop: 12,
                }}
              >
                <Ionicons name="ban-outline" size={18} color={p.danger} />
                <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 18, flex: 1 }}>
                  {profile.viewer?.blocking
                    ? `You blocked @${profile.handle}. Unblock them from the account menu to see their posts again.`
                    : `@${profile.handle} has blocked you. You cannot follow or interact with this account.`}
                </Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', marginTop: 14, gap: 8 }}>
              {isSelf ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  <Pressable
                    onPress={() => navigation.navigate('EditProfile')}
                    accessibilityRole="button"
                    accessibilityLabel="Edit profile"
                    accessibilityHint="Change your name, bio, pronouns, links, photo and banner"
                    style={({ pressed }) => ({
                      backgroundColor: p.accent,
                      borderRadius: CARD_RADIUS,
                      minHeight: 44,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 18,
                      opacity: pressed ? 0.72 : 1,
                    })}
                  >
                    <Ionicons name="create-outline" size={18} color={p.onAccent} />
                    <Text
                      style={{ color: p.onAccent, fontWeight: '700', fontSize: 15, marginLeft: 6 }}
                    >
                      Edit profile
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => navigation.navigate('Settings')}
                    accessibilityRole="button"
                    accessibilityLabel="Open settings"
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? p.divider : p.bg,
                      borderRadius: CARD_RADIUS,
                      minHeight: 44,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 18,
                    })}
                  >
                    <Ionicons name="settings-outline" size={18} color={p.text} />
                    <Text
                      style={{ color: p.text, fontWeight: '600', fontSize: 15, marginLeft: 6 }}
                    >
                      Settings
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={toggleFollow}
                  disabled={followBusy || isBlocked}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isBlocked
                      ? 'Following unavailable while blocked'
                      : followingUri
                        ? `Unfollow @${profile.handle}`
                        : `Follow @${profile.handle}`
                  }
                  style={({ pressed }) => ({
                    backgroundColor: followingUri ? p.soft : p.accent,
                    borderRadius: CARD_RADIUS,
                    minHeight: 44,
                    minWidth: 132,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 18,
                    opacity: pressed || followBusy || isBlocked ? 0.55 : 1,
                  })}
                >
                  {followBusy ? (
                    <ActivityIndicator color={followingUri ? p.text : p.onAccent} />
                  ) : (
                    <>
                      <Ionicons
                        name={isBlocked ? 'ban-outline' : followingUri ? 'checkmark' : 'person-add-outline'}
                        size={18}
                        color={followingUri ? p.text : p.onAccent}
                      />
                      <Text
                        style={{
                          color: followingUri ? p.text : p.onAccent,
                          fontWeight: '700',
                          fontSize: 15,
                          marginLeft: 6,
                        }}
                      >
                        {isBlocked ? 'Blocked' : followingUri ? 'Following' : 'Follow'}
                      </Text>
                    </>
                  )}
                </Pressable>
              )}
            </View>

            {lists.some(
              (list: any) => isSelf || !listViewerState(list).hidden
            ) ? (
              <View style={[styles.listsBlock, { borderTopColor: p.divider }]}>
                <View style={styles.listsHeading}>
                  <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
                    Lists
                  </Text>
                  <Pressable
                    onPress={() =>
                      navigation.navigate('Lists', {
                        actor: profile.did,
                        handle: profile.handle,
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${isSelf ? 'Manage' : 'See all'} @${profile.handle}’s lists`}
                    style={({ pressed }) => [
                      styles.seeAll,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <Text style={{ color: p.accent, fontSize: 12, fontWeight: '700' }}>
                      {isSelf ? 'Manage' : 'See all'}
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={p.accent} />
                  </Pressable>
                </View>
                {lists
                  .filter((list: any) => isSelf || !listViewerState(list).hidden)
                  .slice(0, 3)
                  .map((list: any) => {
                  const purpose = listPurposeMeta(list.purpose);
                  return (
                    <Pressable
                      key={list.uri}
                      onPress={() => navigation.navigate('ListDetail', { uri: list.uri })}
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${list.name} list`}
                      style={({ pressed }) => [
                        styles.listLink,
                        { backgroundColor: pressed ? p.bg : 'transparent' },
                      ]}
                    >
                      <View style={[styles.listIcon, { backgroundColor: p.accentSoft }]}>
                        <Ionicons name="list-outline" size={16} color={p.accent} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: p.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                          {list.name}
                        </Text>
                        <Text style={{ color: p.secondary, fontSize: 11 }} numberOfLines={1}>
                          {purpose.shortLabel} · {listMemberCount(list)}{' '}
                          {listMemberCount(list) === 1 ? 'person' : 'people'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={15} color={p.secondary} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {!isBlocked ? (
              <Pressable
                onPress={() =>
                  navigation.navigate('Tabs', {
                    screen: 'Search',
                    params: {
                      author: profile.handle,
                      nonce: Date.now(),
                    },
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Search posts by @${profile.handle}`}
                accessibilityHint={`Opens search limited to @${profile.handle}’s posts`}
                style={({ pressed }) => [
                  styles.searchPostsRow,
                  { borderTopColor: p.divider, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="search-outline" size={18} color={p.accent} />
                <Text
                  style={{
                    color: p.accent,
                    fontSize: 14,
                    fontWeight: '600',
                    marginLeft: 10,
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  Search @{profile.handle}’s posts
                </Text>
                <Ionicons name="chevron-forward" size={16} color={p.accent} />
              </Pressable>
            ) : null}

            {feeds.length > 0 ? (
              <View style={[styles.listsBlock, { borderTopColor: p.divider }]}>
                <View style={styles.listsHeading}>
                  <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
                    Feeds
                  </Text>
                  <Text style={{ color: p.secondary, fontSize: 12 }}>
                    {associatedCounts.feeds || feeds.length}
                  </Text>
                </View>
                {feeds.slice(0, 3).map((feed: any) => (
                  <ProfileSectionRow
                    key={feed.uri}
                    icon="albums-outline"
                    title={feed.displayName || 'Untitled feed'}
                    detail={`Feed · ${Number(feed.likeCount || 0)} likes`}
                    label={`Open ${feed.displayName || 'Untitled feed'} feed`}
                    onPress={() =>
                      navigation.navigate('FeedGenerator', { feed: feed.uri })
                    }
                  />
                ))}
              </View>
            ) : null}

            {starterPacks.length > 0 ? (
              <View style={[styles.listsBlock, { borderTopColor: p.divider }]}>
                <View style={styles.listsHeading}>
                  <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', flex: 1 }}>
                    Starter packs
                  </Text>
                  <Text style={{ color: p.secondary, fontSize: 12 }}>
                    {associatedCounts.starterPacks || starterPacks.length}
                  </Text>
                </View>
                {starterPacks.slice(0, 2).map((pack: any) => (
                  <ProfileSectionRow
                    key={pack.uri}
                    icon="people-outline"
                    title={pack.record?.name || 'Starter pack'}
                    detail={`Starter pack · ${Number(pack.list?.listItemCount || 0)} people`}
                    label={`Open ${pack.record?.name || 'Starter pack'} starter pack`}
                    onPress={() =>
                      navigation.navigate('StarterPack', { uri: pack.uri })
                    }
                  />
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View
          style={{
            backgroundColor: p.card,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderColor: p.divider,
            marginBottom: 8,
          }}
        >
          <View
            style={{
              alignSelf: 'flex-start',
              marginLeft: 16,
              paddingVertical: 14,
              borderBottomWidth: 3,
              borderBottomColor: p.accent,
            }}
          >
            <Text style={{ color: p.accent, fontSize: 15, fontWeight: '700' }}>Posts</Text>
          </View>
        </View>
      </View>
    );
  }

  // The pinned post appears once: in its natural place if it is in the feed,
  // or at the top if it is older than the posts we fetched.
  const feedItems: Array<{ post: any; pinned: boolean }> = posts.map((post) => ({
    post,
    pinned: !!pinnedPost && post.uri === pinnedPost.uri,
  }));
  if (pinnedPost && !feedItems.some((item) => item.post.uri === pinnedPost.uri)) {
    feedItems.unshift({ post: pinnedPost, pinned: true });
  }

  return (
    <>
      <FlashList
        data={isBlocked ? [] : feedItems}
        keyExtractor={(item) => item.post.uri}
        renderItem={({ item }) => (
          <View>
            {item.pinned ? (
              <View style={[styles.pinnedRow, { borderBottomColor: p.divider }]}>
                <Ionicons name="pin-outline" size={14} color={p.secondary} />
                <Text
                  style={{
                    color: p.secondary,
                    fontSize: 12,
                    fontWeight: '600',
                    marginLeft: 6,
                  }}
                >
                  Pinned
                </Text>
              </View>
            ) : null}
            <PostCard
              post={item.post}
              onOpenThread={openThread}
              onOpenProfile={openProfile}
              onPostHidden={hidePost}
            />
          </View>
        )}
        // FlashList v2 measures items itself; estimatedItemSize is gone.
        style={{ flex: 1, backgroundColor: p.bg }}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
        ListHeaderComponent={Header}
        ListEmptyComponent={
          <Text style={{ color: p.secondary, textAlign: 'center', marginTop: 32 }}>
            {isBlocked ? 'Posts are hidden while this account is blocked.' : 'No posts here yet.'}
          </Text>
        }
      />
      <ProfileMenu
        profile={profile}
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onViewerChange={updateViewer}
        onReload={reloadProfile}
      />
      <VerificationSheet
        visible={verificationOpen}
        handle={profile.handle}
        summary={verification}
        onClose={() => setVerificationOpen(false)}
      />
    </>
  );
}

function Stat({
  value,
  label,
  onPress,
}: {
  value: number;
  label: string;
  onPress?: () => void;
}) {
  const p = usePalette();
  const text = (
    <Text style={{ color: p.secondary, fontSize: 15 }}>
      <Text style={{ color: p.text, fontWeight: '700' }}>{value}</Text> {label}
    </Text>
  );
  if (!onPress) return text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View ${value} ${label}`}
      style={({ pressed }) => ({
        minHeight: 44,
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {text}
    </Pressable>
  );
}

function ProfileSectionRow({
  icon,
  title,
  detail,
  label,
  onPress,
}: {
  icon: any;
  title: string;
  detail: string;
  label: string;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.listLink,
        { backgroundColor: pressed ? p.bg : 'transparent' },
      ]}
    >
      <View style={[styles.listIcon, { backgroundColor: p.accentSoft }]}>
        <Ionicons name={icon} size={16} color={p.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ color: p.text, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: p.secondary, fontSize: 11 }} numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={p.secondary} />
    </Pressable>
  );
}

function joinNames(people: any[]): string {
  const names = people.map((person) => person.displayName || person.handle);
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]}, ${names.slice(1, -1).join(', ')} and ${names[names.length - 1]}`;
}

const styles = StyleSheet.create({
  profileCard: {
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginHorizontal: 8,
    marginBottom: 8,
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginRight: -8,
  },
  listsBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
    paddingTop: 10,
  },
  listsHeading: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
  },
  seeAll: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  listLink: {
    minHeight: 48,
    borderRadius: 8,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  listIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
  },
  labelerChip: {
    minHeight: 20,
    borderRadius: 10,
    paddingHorizontal: 7,
    justifyContent: 'center',
  },
  searchPostsRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 14,
  },
  pinnedRow: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'transparent',
  },
  profileLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  profileLink: {
    minHeight: 44,
    maxWidth: '100%',
    borderWidth: 1,
    borderRadius: 19,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileLinkIcon: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: '#E4E6EB',
  },
});
