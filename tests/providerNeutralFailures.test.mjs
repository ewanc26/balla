import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

// These are the exact old strings that blamed a named provider for a technical
// failure. Naming the provider was an overclaim: the failing host may be one
// the user configured, so the failure must use Balla's fixed neutral labels.
// Factual provider references ("Bluesky moderation approved your appeal",
// "stored on your Bluesky account") are true and deliberately left intact.
const OLD_FAILURE_STRINGS = [
  ['../src/screens/SearchScreen.tsx', 'Bluesky is rate-limiting search'],
  ['../src/screens/SearchScreen.tsx', 'Bluesky rejected this query'],
  ['../src/screens/SearchScreen.tsx', 'Bluesky’s search service is unavailable'],
  ['../src/screens/SearchScreen.tsx', 'Could not reach Bluesky. Check your connection'],
  ['../src/lib/chatModel.ts', 'Bluesky is limiting requests just now'],
  ['../src/lib/moderationInbox.ts', 'Could not reach Bluesky moderation'],
  ['../src/lib/videoUpload.ts', 'Bluesky saw this video before'],
  ['../src/lib/videoUpload.ts', 'Bluesky needs a verified email address'],
  ['../src/lib/videoUpload.ts', 'Bluesky returned a video job status'],
  ['../src/lib/videoUpload.ts', 'Could not reach Bluesky’s video service'],
  ['../src/lib/videoUpload.ts', 'Bluesky’s video service could not check your quota'],
  ['../src/lib/videoUpload.ts', 'Bluesky’s video service returned no usable'],
  ['../src/lib/videoUpload.ts', 'Bluesky could not accept this video'],
  ['../src/lib/videoUpload.ts', 'Bluesky accepted the file but did not return'],
  ['../src/lib/videoUpload.ts', 'Bluesky did not return this video’s progress'],
  ['../src/lib/videoUpload.ts', 'Bluesky could not process this video'],
  ['../src/lib/videoModel.ts', 'Bluesky could not process this file'],
  ['../src/lib/feedsContext.tsx', 'Bluesky returned no details'],
  ['../src/lib/externalLink.ts', 'Bluesky could not build a preview'],
  ['../src/lib/postTextLimit.ts', "over Bluesky's 3,000-byte text cap"],
  ['../src/screens/FeedGeneratorScreen.tsx', 'Bluesky says this generator'],
  ['../src/screens/ContentFiltersScreen.tsx', 'Bluesky moderation is already subscribed'],
  ['../src/screens/FeedsScreen.tsx', 'Bluesky returned no popular feeds'],
  ['../src/screens/AccountSettingsScreen.tsx', 'Visit bsky.app/settings/account in a browser.'],
  ['../src/screens/PrivacySecurityScreen.tsx', 'Visit bsky.app/settings/privacy-and-security in a browser.'],
  ['../src/screens/PrivacySecurityScreen.tsx', 'Visit bsky.app/settings/app-passwords in a browser.'],
  ['../src/screens/AccountLifecycleScreen.tsx', 'Visit bsky.app/settings/account in a browser.'],
  ['../src/screens/AccountLifecycleScreen.tsx', 'Opens Bluesky’s account settings'],
  ['../src/screens/AccountLifecycleScreen.tsx', 'then opens the official control'],
];

const NEW_FAILURE_STRINGS = [
  ['../src/screens/SearchScreen.tsx', 'The service is rate-limiting search'],
  ['../src/screens/SearchScreen.tsx', 'Could not reach the service. Check your connection'],
  ['../src/lib/chatModel.ts', 'The service is limiting requests just now'],
  ['../src/lib/moderationInbox.ts', 'Could not reach the moderation service'],
  ['../src/lib/videoUpload.ts', 'The video service could not check your quota'],
  ['../src/lib/videoFailureModel.ts', 'The video service could not process this file'],
  ['../src/lib/feedsContext.tsx', 'The service returned no details'],
  ['../src/lib/externalLink.ts', 'The service could not build a preview'],
  ['../src/lib/postTextLimit.ts', 'bytes over the 3,000-byte text cap'],
  ['../src/screens/FeedsScreen.tsx', 'The service returned no popular feeds'],
  ['../src/screens/AccountSettingsScreen.tsx', 'providerControlPanelUrl(service, BLUESKY_ACCOUNT_SETTINGS)'],
  ['../src/screens/PrivacySecurityScreen.tsx', 'providerControlPanelUrl(service, BLUESKY_PRIVACY_SETTINGS)'],
  ['../src/screens/PrivacySecurityScreen.tsx', 'providerControlPanelUrl(service, BLUESKY_APP_PASSWORDS)'],
  ['../src/screens/AccountLifecycleScreen.tsx', 'providerControlPanelUrl(service, ACCOUNT_SETTINGS)'],
];

test('technical failure copy never blames a named provider', () => {
  for (const [path, oldText] of OLD_FAILURE_STRINGS) {
    assert.doesNotMatch(read(path), new RegExp(escapeRegExp(oldText)), `${path} still says "${oldText}"`);
  }
});

test('the neutral failure labels are present where they replaced provider names', () => {
  for (const [path, newText] of NEW_FAILURE_STRINGS) {
    assert.match(read(path), new RegExp(escapeRegExp(newText)), `${path} is missing "${newText}"`);
  }
});

test('factual provider references that say where data lives are kept', () => {
  assert.match(read('../src/screens/ModerationNoticeScreen.tsx'), /Bluesky moderation approved your appeal/);
  assert.match(read('../src/screens/AccountSettingsScreen.tsx'), /real Bluesky personal-details preference/);
});

test('no account screen opens a canonical Bluesky panel without the session check', () => {
  const gatedScreens = [
    '../src/screens/AccountSettingsScreen.tsx',
    '../src/screens/PrivacySecurityScreen.tsx',
    '../src/screens/AccountLifecycleScreen.tsx',
  ];
  for (const path of gatedScreens) {
    assert.doesNotMatch(read(path), /openExternalUrl\(BLUESKY_/, `${path} opens a canonical link directly`);
    assert.match(read(path), /useSessionSummary\(\)/, `${path} does not read the signed-in session`);
    assert.match(read(path), /providerOwnedPanelText\(/, `${path} has no provider-owned fallback`);
  }
});

test('the release documents the correction with no new scope', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  const changelog = read('../CHANGELOG.md');
  const features = read('../site/features.html');
  assert.equal(pkg.version, '0.88.0');
  assert.equal(appJson.expo.version, '0.88.0');
  assert.match(changelog, /^## 0\.72\.0$/m);
  assert.match(changelog, /scope count stays 112/);
  assert.match(features, /Failure messages name no provider/);
  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 112);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
