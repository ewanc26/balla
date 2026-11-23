import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('recent activity is a device-local right-rail preference, default on', () => {
  const prefs = read('../src/lib/preferences.tsx');
  assert.match(prefs, /showRecentActivity: boolean/);
  assert.match(prefs, /showRecentActivity: true/);
  assert.match(prefs, /typeof parsed\?\.showRecentActivity === 'boolean'/);
  assert.match(prefs, /setShowRecentActivity/);
  assert.doesNotMatch(prefs, /setShowRecentActivity[\s\S]*agent\.setPreferences/);

  const appearance = read('../src/screens/AppearanceScreen.tsx');
  assert.match(appearance, /Show Recent activity/);
  assert.match(appearance, /value=\{preferences\.showRecentActivity\}/);
  assert.match(appearance, /onChange=\{setShowRecentActivity\}/);
});

test('the activity snapshot comes only from the loaded Following page', () => {
  const feed = read('../src/screens/FeedScreen.tsx');
  assert.match(feed, /activeFeed\s*\? \[\]\s*: buildRecentActivity\(posts/);
  assert.match(feed, /viewerDid: me\?\.did/);
  assert.match(feed, /snoozes: snoozedAccounts/);
  assert.match(feed, /useEffect\(\(\) => \(\) => setRecentActivity\(\[\]\), \[\]\)/);
  assert.match(feed, /networkBackend\.timeline\.getTimeline/);
  // The card must not trigger a second read or any write.
  const card = read('../src/components/RecentActivityCard.tsx');
  assert.doesNotMatch(card, /agent\.|fetch\(|putRecord|createRecord|deleteRecord/);
  assert.doesNotMatch(card, /scrollTo|scrollToIndex/);
});

test('the desktop rail renders the card with a 44pt hide action and thread taps', () => {
  const rail = read('../src/components/AppRail.tsx');
  const card = read('../src/components/RecentActivityCard.tsx');
  const app = read('../App.tsx');

  assert.match(rail, /<RecentActivityCard onOpenThread=\{onOpenThread\} \/>/);
  assert.match(card, /if \(!preferences\.showRecentActivity\) return null/);
  assert.match(card, /Hide this card/);
  assert.match(card, /setShowRecentActivity\(false\)/);
  assert.match(card, /minHeight: 44/);
  assert.match(card, /onPress=\{\(\) => onOpenThread\(activity\.post\.uri\)\}/);
  assert.match(app, /const openThread = useCallback\(\(uri: string\)/);
  assert.match(app, /navigationRef\.navigate\('Thread', \{ uri \}\)/);
  assert.match(app, /<RightRail[\s\S]*onOpenThread=\{openThread\}/);
});

test('the card uses the shared label hide and warn rules', () => {
  const card = read('../src/components/RecentActivityCard.tsx');
  assert.match(card, /hiddenByLabel\(listUi\)/);
  assert.match(card, /warnedByLabel\(/);
  assert.match(card, /A labelled post/);
});

test('no like data is read and the list is capped at twelve', () => {
  const model = read('../src/lib/recentActivityModel.ts');
  assert.match(model, /RECENT_ACTIVITY_LIMIT = 12/);
  assert.match(model, /reasonLike/);
  assert.match(model, /return activity\.slice\(0, limit\)/);
  assert.doesNotMatch(model, /reasonLike[\s\S]{0,80}activity\.push/);
});
