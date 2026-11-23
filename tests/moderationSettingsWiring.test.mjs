import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEB_LINKING_CONFIG } from '../src/lib/webLinking.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../App.tsx');
const settings = read('../src/screens/SettingsScreen.tsx');
const provider = read('../src/lib/accountPreferences.tsx');
const composer = read('../src/screens/ComposeScreen.tsx');
const profile = read('../src/screens/ProfileScreen.tsx');
const gates = read('../src/lib/interactionGates.ts');
const mock = read('../src/lib/mock.ts');
const hidden = read('../src/lib/hiddenReplies.ts');
const postMenu = read('../src/components/PostMenu.tsx');
const thread = read('../src/screens/ThreadScreen.tsx');
const info = read('../src/screens/InfoScreen.tsx');
const moderation = read('../src/lib/moderation.ts');
const reportSheet = read('../src/components/ReportListSheet.tsx');
const feedGenerator = read('../src/screens/FeedGeneratorScreen.tsx');
const feedFeedback = read('../src/lib/feedFeedback.ts');
const feedFeedbackModel = read('../src/lib/feedFeedbackModel.ts');
const hiddenPosts = read('../src/lib/hiddenPosts.ts');
const moderationContext = read('../src/lib/moderationContext.tsx');
const verificationActions = read('../src/lib/verificationActions.ts');
const profileMenu = read('../src/components/ProfileMenu.tsx');
const liveStatus = read('../src/lib/liveStatus.ts');
const activityPrivacy = read('../src/lib/activityPrivacy.ts');
const activityPrivacyModel = read('../src/lib/activityPrivacyModel.ts');
const activitySubscriptions = read('../src/lib/activitySubscriptions.ts');
const activitySubscriptionsModel = read('../src/lib/activitySubscriptionsModel.ts');
const subscribeProfileSheet = read('../src/components/SubscribeProfileSheet.tsx');
const activityNotificationsScreen = read('../src/screens/ActivityNotificationsScreen.tsx');
const notificationSettingsScreen = read('../src/screens/NotificationSettingsScreen.tsx');
const privacySecurity = read('../src/screens/PrivacySecurityScreen.tsx');
const profileScreen = read('../src/screens/ProfileScreen.tsx');
const oauthMetadata = JSON.parse(read('../oauth-client-metadata.json'));
const postCard = read('../src/components/PostCard.tsx');
const feedScreen = read('../src/screens/FeedScreen.tsx');
const postActions = read('../src/lib/postActions.ts');

const NEW_SCREENS = [
  ['VerificationSettings', 'settings/verification'],
  ['InterestsSettings', 'settings/interests'],
  ['DefaultInteractionSettings', 'settings/interaction-defaults'],
  ['BlockedAccounts', 'settings/blocked-accounts'],
];

test('account-level moderation screens are registered with stable web paths', () => {
  for (const [name, path] of NEW_SCREENS) {
    assert.match(app, new RegExp(`<Stack\\.Screen\\s+name="${name}"`), `${name} registered`);
    assert.equal(WEB_LINKING_CONFIG.screens[name], path, `${name} has a web path`);
  }
});

test('Settings reaches every new account-level control', () => {
  for (const label of [
    'Blocked and muted accounts',
    'Default interaction settings',
    'Verification settings',
    'Your interests',
  ]) {
    assert.ok(settings.includes(`label="${label}"`), `${label} visible in Settings`);
  }
  assert.match(settings, /navigation\.navigate\('BlockedAccounts'\)/);
  assert.match(settings, /navigation\.navigate\('DefaultInteractionSettings'\)/);
  assert.match(settings, /navigation\.navigate\('VerificationSettings'\)/);
  assert.match(settings, /navigation\.navigate\('InterestsSettings'\)/);
});

test('the account preference provider wraps the authenticated tree', () => {
  assert.match(app, /<AccountPreferencesProvider>/);
  assert.match(provider, /agent\.setVerificationPrefs\(/);
  assert.match(provider, /agent\.setPostInteractionSettings\(/);
  assert.match(provider, /agent\.setInterestsPref\(/);
  assert.match(provider, /agent\.getPreferences\(\)/);
});

test('verification and default gates are actually honoured', () => {
  assert.match(profile, /useAccountPreferences\(\)/);
  assert.match(profile, /hideBadges \? '' : verificationBadgeLabel\(verification\)/);
  assert.match(composer, /useAccountPreferences\(\)/);
  assert.match(composer, /setGates\(normaliseGates\(accountSettings\.defaultGates\)\)/);
});

test('threadgate list rules and hidden replies use published lexicon fields', () => {
  assert.match(gates, /app\.bsky\.feed\.threadgate#listRule/);
  assert.match(gates, /hiddenReplies/);
  assert.match(composer, /<ReplyListPicker/);
  assert.match(mock, /mock\.app\.bsky\.graph\.getBlocks =/);
  assert.match(mock, /mock\.app\.bsky\.graph\.getMutes =/);
  assert.match(mock, /mock\.setVerificationPrefs =/);
});

test('interaction settings preserve hidden replies and detached quotes on save', () => {
  const interaction = read('../src/screens/InteractionSettingsScreen.tsx');
  assert.match(interaction, /hiddenRepliesFromRecord\(threadgate\)/);
  assert.match(interaction, /detachedEmbeddingUrisFromRecord\(postgate\)/);
  assert.match(interaction, /threadgateWrite\(uri, gates, createdAt, hiddenReplies\)/);
  assert.match(interaction, /postgateWrite\(uri, gates, createdAt, detachedEmbeddingUris\)/);
});

test('hidden replies are a real threadgate write, never a local-only hide', () => {
  assert.match(hidden, /app\.bsky\.feed\.threadgate/);
  assert.match(hidden, /hiddenReplyWrite\(/);
  assert.match(hidden, /agent\.com\.atproto\.repo\.putRecord/);
  assert.match(hidden, /agent\.com\.atproto\.repo\.deleteRecord/);
  assert.match(hidden, /rootPostUri/);
  assert.match(postMenu, /Hide reply for everyone/);
  assert.match(postMenu, /onHiddenReplyChange/);
  assert.match(thread, /partitionHiddenReplies/);
  assert.match(thread, /hidden replies/);
  assert.match(thread, /loadHiddenReplyUris/);
});

test('every Settings row now reaches real content or a real screen', () => {
  assert.match(settings, /navigation\.navigate\('ContentAndMediaSettings'\)/);
  assert.match(settings, /openInfo\('about', 'About Balla'\)/);
  assert.match(info, /media: \{/);
  assert.match(info, /about: \{/);
});

test('feed reports use the published strongRef path and a real report action', () => {
  assert.match(moderation, /export async function reportFeed/);
  assert.match(moderation, /\$type: 'com\.atproto\.repo\.strongRef'/);
  assert.match(reportSheet, /isFeed \? reportFeed : reportList/);
  assert.match(feedGenerator, /accessibilityLabel="Report this feed"/);
  assert.match(feedGenerator, /<ReportListSheet feed=\{generator\}/);
});

test('pin, thread mute and quote detach are real writes wired into the post menu', () => {
  assert.match(postActions, /agent\.upsertProfile/);
  assert.match(postActions, /app\.bsky\.graph\.muteThread/);
  assert.match(postActions, /app\.bsky\.graph\.unmuteThread/);
  assert.match(postActions, /POSTGATE_COLLECTION/);
  assert.match(postActions, /agent\.com\.atproto\.repo\.putRecord/);
  assert.match(postActions, /agent\.com\.atproto\.repo\.deleteRecord/);
  assert.match(postMenu, /Pin to profile/);
  assert.match(postMenu, /Mute thread/);
  assert.match(postMenu, /Detach quote/);
});

test('feed feedback is a real sendInteractions call wired into the post menu', () => {
  assert.match(feedFeedback, /app\.bsky\.feed\.sendInteractions/);
  assert.match(feedFeedback, /atproto-proxy/);
  assert.match(feedFeedbackModel, /#bsky_fg/);
  assert.ok(
    oauthMetadata.scope
      .split(/\s+/)
      .includes('rpc:app.bsky.feed.sendInteractions?aud=*')
  );
  assert.match(mock, /app\.bsky\.feed\.sendInteractions/);
  assert.match(postMenu, /Show more like this/);
  assert.match(postMenu, /Show less like this/);
  assert.match(postCard, /onFeedback=\{onFeedback\}/);
  assert.match(feedScreen, /feedbackFeed=\{/);
  assert.match(feedScreen, /activeIsList\s*\? undefined/);
});

test('hide post for me is a device-local hide wired into moderation', () => {
  assert.match(hiddenPosts, /AsyncStorage/);
  assert.match(hiddenPosts, /export async function hidePostForMe/);
  assert.match(hiddenPosts, /subscribeHiddenPosts/);
  assert.match(moderationContext, /hiddenPosts/);
  assert.match(moderationContext, /prefs: \{ \.\.\.opts\.prefs, hiddenPosts \}/);
  assert.match(postMenu, /Hide post for me/);
  assert.match(postMenu, /Hide reply for me/);
  assert.match(postMenu, /hidePostForMe\(post\.uri\)/);
});

test('verifier actions are real repo writes wired into the profile menu', () => {
  assert.match(verificationActions, /app\.bsky\.graph\.verification|VERIFICATION_COLLECTION/);
  assert.match(verificationActions, /agent\.com\.atproto\.repo\.createRecord/);
  assert.match(verificationActions, /agent\.com\.atproto\.repo\.deleteRecord/);
  assert.match(verificationActions, /canVerifyProfile/);
  assert.match(profileMenu, /Verify account/);
  assert.match(profileMenu, /Remove verification/);
  assert.match(profileMenu, /issueVerificationAsViewer/);
  assert.match(profileMenu, /removeMyVerification/);
});

test('live status is a real self-rkey status write with a visible indicator', () => {
  assert.match(liveStatus, /com\.atproto\.repo\.putRecord/);
  assert.match(liveStatus, /com\.atproto\.repo\.deleteRecord/);
  assert.match(liveStatus, /InvalidSwap/i);
  assert.match(profileMenu, /Go live/);
  assert.match(profileMenu, /End live status/);
  assert.match(profileMenu, /upsertLiveStatus/);
  assert.match(profileScreen, /statusIsActive\(profile\.status\)/);
  assert.match(profileScreen, /liveLinkFromStatus\(profile\.status\)/);
  // The account-options button is the Go-live entry point and must be reachable
  // on your own profile even before a status record exists.
  assert.doesNotMatch(profileScreen, /\{!isSelf \|\| profile\.status \? \(/);
  assert.ok(
    oauthMetadata.scope.split(/\s+/).includes(
      'repo:app.bsky.actor.status?action=create&action=update&action=delete'
    )
  );
});

test('activity privacy is a real self-rkey declaration wired from privacy settings', () => {
  assert.match(activityPrivacy, /com\.atproto\.repo\.getRecord/);
  assert.match(activityPrivacy, /com\.atproto\.repo\.putRecord/);
  assert.match(activityPrivacyModel, /app\.bsky\.notification\.declaration/);
  assert.match(activityPrivacyModel, /DECLARATION_RKEY\s*=\s*'self'/);
  assert.match(app, /<Stack\.Screen name="ActivityPrivacy"/);
  assert.equal(WEB_LINKING_CONFIG.screens.ActivityPrivacy, 'settings/activity-privacy');
  assert.match(privacySecurity, /navigation\.navigate\('ActivityPrivacy'\)/);
  assert.doesNotMatch(privacySecurity, /Activity privacy[\s\S]{0,140}Provider-controlled/);
  assert.ok(
    oauthMetadata.scope.split(/\s+/).includes(
      'repo:app.bsky.notification.declaration?action=create&action=update'
    )
  );
});

test('activity subscriptions are real AppView RPCs wired into the profile header', () => {
  assert.match(activitySubscriptions, /listActivitySubscriptions/);
  assert.match(activitySubscriptions, /putActivitySubscription/);
  assert.match(activitySubscriptionsModel, /app\.bsky\.notification\.defs#activitySubscription/);
  assert.match(subscribeProfileSheet, /putActivitySubscription/);
  assert.match(profile, /SubscribeProfileSheet/);
  assert.match(profile, /activity notifications for @/i);
  assert.match(profile, /notifications-outline/);
  assert.match(mock, /putActivitySubscription/);
  const tokens = oauthMetadata.scope.split(/\s+/);
  assert.ok(tokens.includes('rpc:app.bsky.notification.listActivitySubscriptions?aud=did:web:api.eurosky.network#bsky_appview'));
  assert.ok(tokens.includes('rpc:app.bsky.notification.putActivitySubscription?aud=did:web:api.eurosky.network#bsky_appview'));
  assert.match(activityNotificationsScreen, /listActivitySubscriptions/);
  assert.match(activityNotificationsScreen, /SubscribeProfileSheet/);
  assert.match(app, /<Stack\.Screen name="ActivityNotifications"/);
  assert.equal(WEB_LINKING_CONFIG.screens.ActivityNotifications, 'notification-settings/activity');
  assert.match(notificationSettingsScreen, /navigation\.navigate\('ActivityNotifications'\)/);
});

test('profile tabs use published author-feed filters and the actor-likes RPC', () => {
  const tabsModel = read('../src/lib/profileTabsModel.ts');
  assert.match(tabsModel, /posts_and_author_threads/);
  assert.match(tabsModel, /posts_and_replies_only/);
  assert.match(tabsModel, /posts_with_media/);
  assert.match(tabsModel, /posts_with_video/);
  assert.match(profileScreen, /getActorLikes/);
  assert.match(profileScreen, /loadTabPosts/);
  assert.match(profileScreen, /visibleProfileTabs/);
  assert.match(profileScreen, /accessibilityRole="tab"/);
  assert.match(mock, /getActorLikes/);
  const tokens = oauthMetadata.scope.split(/\s+/);
  assert.ok(
    tokens.some((t) => t.startsWith('rpc:app.bsky.feed.getActorLikes?')),
    'getActorLikes needs a real RPC scope'
  );
});

test('feed likes are real like-record writes with a Liked by link', () => {
  const objectLikes = read('../src/lib/objectLikes.ts');
  assert.match(objectLikes, /app\.bsky\.feed\.like/);
  assert.match(objectLikes, /agent\.like\(/);
  assert.match(objectLikes, /agent\.deleteLike\(/);
  assert.match(feedGenerator, /toggleObjectLike/);
  assert.match(feedGenerator, /Liked by/);
  assert.match(feedGenerator, /navigation\.navigate\('EngagementList'/);
  assert.match(feedGenerator, /heart/);
});

test('labeler likes reuse the same strong-ref like records on the profile header', () => {
  assert.match(profile, /toggleLabelerLike/);
  assert.match(profile, /getServices/);
  assert.match(profile, /Liked by/);
  assert.match(profile, /Like labeler/);
  assert.match(mock, /labeler\.getServices/);
  assert.match(mock, /app\.bsky\.labeler\.service/);
  const tokens = oauthMetadata.scope.split(/\s+/);
  assert.ok(
    tokens.some((t) => t.startsWith('rpc:app.bsky.labeler.getServices?')),
    'getServices needs a real RPC scope'
  );
});
