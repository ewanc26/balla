import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildProfileShareUrl,
  profileShareText,
} from '../src/lib/profileShareModel.ts';
import {
  buildProfileLinkReportSubject,
  reportableProfileLinks,
} from '../src/lib/reportModel.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const postMenu = read('../src/components/PostMenu.tsx');
const contentFilters = read('../src/screens/ContentFiltersScreen.tsx');
const profileMenu = read('../src/components/ProfileMenu.tsx');
const profileScreen = read('../src/screens/ProfileScreen.tsx');
const moderation = read('../src/lib/moderation.ts');
const reportSheet = read('../src/components/ReportLinkSheet.tsx');

test('profile share links use the canonical public profile URL', () => {
  assert.equal(
    buildProfileShareUrl({ handle: 'alice.bsky.social', did: 'did:plc:abc' }),
    'https://bsky.app/profile/alice.bsky.social'
  );
  assert.equal(
    buildProfileShareUrl({ did: 'did:plc:abc' }),
    'https://bsky.app/profile/did:plc:abc'
  );
  assert.equal(buildProfileShareUrl({}), null);
  assert.equal(
    profileShareText({ handle: 'alice.bsky.social' }),
    'Follow @alice.bsky.social on Bluesky'
  );
});

test('profile share controls are visible with native and web fallbacks', () => {
  assert.match(profileMenu, /Share\.share\(\{ message:/);
  assert.match(profileMenu, /Clipboard\.setStringAsync\(profileUrl\)/);
  assert.match(profileMenu, /webNavigator\.share/);
  assert.match(profileMenu, /label="Share via…"/);
  assert.match(profileMenu, /label="Copy link to profile"/);
  assert.match(profileMenu, /Profile link copied to the clipboard\./);
  assert.match(profileMenu, /buildProfileShareUrl\(profile\)/);
});

test('post menu opens Content filters at the muted-words section', () => {
  assert.match(postMenu, /label="Mute words & tags"/);
  assert.match(
    postMenu,
    /navigation\.navigate\('ContentFilters', \{ section: 'muted-words' \}\)/
  );
  assert.match(contentFilters, /route\?\.params\?\.section !== 'muted-words'/);
  assert.match(contentFilters, /mutedWordsRef\.current\?\.measureLayout/);
  assert.match(contentFilters, /scrollRef\.current\?\.scrollTo/);
});

test('repost-only mute is a scoped actor write with reversible viewer state', () => {
  assert.match(
    moderation,
    /muteActor\(\{ actor: did, onlyReposts: true \}\)/
  );
  assert.match(profileMenu, /muteRepostsActor\(profile\.did\)/);
  assert.match(profileMenu, /viewer\.mutedOnlyReposts/);
  assert.match(profileMenu, /label=\{\s*isMutedOnlyReposts\s*\?/);
  assert.match(profileMenu, /Hide reposts in feeds/);
  assert.match(profileMenu, /Show reposts in feeds/);
  assert.match(profileMenu, /onViewerChange\(\{ muted: false, mutedOnlyReposts: true \}\)/);
});

test('profile-link reports use the published link-view subject', () => {
  const link = {
    uri: 'at://did:plc:abc/app.bsky.actor.profile/self#link-1',
    cid: 'bafyreifake',
    url: 'https://example.com/',
    title: 'Example',
  };
  assert.deepEqual(buildProfileLinkReportSubject(link), {
    $type: 'app.bsky.actor.defs#profileLinkView',
    uri: link.uri,
    cid: link.cid,
    url: link.url,
  });
  assert.deepEqual(
    reportableProfileLinks([link, { url: 'https://no-ref.example/' }]),
    [link]
  );
  assert.deepEqual(reportableProfileLinks(null), []);
  assert.match(moderation, /buildProfileLinkReportSubject\(link\)/);
  assert.match(moderation, /'profile-link'/);
  assert.match(profileMenu, /label="Report a link"/);
  assert.match(profileMenu, /reportableProfileLinks\(profile\.links\)/);
  assert.match(profileScreen, /<ReportLinkSheet/);
  assert.match(reportSheet, /reportProfileLink\(selected, reason, details\)/);
  assert.match(reportSheet, /not an official moderation status/);
});
