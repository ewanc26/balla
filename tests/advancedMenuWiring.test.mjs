import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEB_LINKING_CONFIG } from '../src/lib/webLinking.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../App.tsx');
const settings = read('../src/screens/SettingsScreen.tsx');
const advanced = read('../src/screens/AdvancedScreen.tsx');
const contentFilters = read('../src/screens/ContentFiltersScreen.tsx');
const mediaOrigin = read('../src/screens/MediaOriginScreen.tsx');
const postCard = read('../src/components/PostCard.tsx');
const imageViewer = read('../src/components/ImageViewer.tsx');
const remoteImage = read('../src/components/RemoteImage.tsx');
const identityModel = read('../src/lib/identityModel.ts');
const identityCache = read('../src/lib/identityCache.ts');
const identityResolver = read('../src/lib/identityResolver.ts');
const identityProfile = read('../src/lib/identityProfile.ts');
const identityScreen = read('../src/screens/IdentitySettingsScreen.tsx');
const profileScreen = read('../src/screens/ProfileScreen.tsx');
const chatServiceScreen = read('../src/screens/ChatServiceScreen.tsx');
const labelerProbe = read('../src/lib/labelerProbe.ts');
const videoServiceProbe = read('../src/lib/videoServiceProbe.ts');
const videoUpload = read('../src/lib/videoUpload.ts');

test('Advanced is a real stack screen with a stable web path', () => {
  assert.match(app, /<Stack\.Screen name="Advanced" component=\{AdvancedScreen\} \/>/);
  assert.equal(WEB_LINKING_CONFIG.screens.Advanced, 'settings/advanced');
});

test('Settings exposes Advanced, and Advanced links only to a working surface', () => {
  assert.match(settings, /label="Advanced"/);
  assert.match(settings, /navigation\.navigate\('Advanced'\)/);
  assert.match(
    advanced,
    /navigation\.navigate\('ContentFilters', \{ section: 'labelers' \}\)/
  );
  // No inert placeholders: every row must navigate to a registered screen.
  assert.ok(!/onPress=\{\(\) => \{\}\}/.test(advanced));
  assert.match(advanced, /Labels are advisory metadata from services you choose/);
});

test('the labeler surface shows real per-service state and local-filter resilience', () => {
  assert.match(contentFilters, /route\?\.params\?\.section !== 'labelers'/);
  assert.match(contentFilters, /labelersRef\.current\?\.measureLayout/);
  assert.match(contentFilters, /setServicesAvailable/);
  assert.match(contentFilters, /Subscribed · listed by the AppView/);
  assert.match(contentFilters, /not listed by the AppView, local rules still apply/);
  // Existing add/remove and test-subscribe paths remain intact.
  assert.match(contentFilters, /agent\.getLabelers\(\{ dids: \[did\], detailed: true \}\)/);
  assert.match(contentFilters, /agent\.addLabeler\(did\)/);
  assert.match(contentFilters, /agent\.removeLabeler\(labeler\.did\)/);
});

test('labeler reachability is a real public check, separate from AppView listing', () => {
  assert.match(contentFilters, /probeLabelers\(dids\)/);
  assert.match(contentFilters, /probeLabeler\(did, \{ resolveDocument: resolveDidDocument \}\)/);
  assert.match(contentFilters, /labelerProbeText\(probe\)/);
  assert.match(contentFilters, /Check labeler endpoints again/);
  assert.match(contentFilters, /does not report queue lag or a service's\s+mute state/);
  assert.match(labelerProbe, /#atproto_labeler/);
  assert.match(labelerProbe, /com\.atproto\.label\.queryLabels/);
  assert.match(labelerProbe, /uriPatterns/);
  assert.match(labelerProbe, /response\.ok/);
  assert.match(labelerProbe, /serviceStatusDetail/);
  assert.doesNotMatch(labelerProbe, /\.message\b/);
  assert.doesNotMatch(labelerProbe, /uriPatterns=\*/);
  assert.doesNotMatch(labelerProbe, /AsyncStorage/);
  assert.doesNotMatch(labelerProbe, /authorization/);
});

test('release notes and version describe the live video quota check', () => {
  const pkg = JSON.parse(read('../package.json'));
  const changelog = read('../CHANGELOG.md');
  assert.equal(pkg.version, '0.53.0');
  assert.equal(JSON.parse(read('../app.json')).expo.version, '0.53.0');
  assert.match(changelog, /## 0\.36\.0/);
  assert.match(changelog, /getUploadLimits/);
  assert.match(changelog, /grant-bound/);
  assert.match(changelog, /no fake side-car field|No fake side-car field/);
  assert.match(changelog, /scope count remains 111/);
});

test('Advanced exposes a working Media origin screen with real cache and quota controls', () => {
  assert.match(app, /<Stack\.Screen name="MediaOrigin" component=\{MediaOriginScreen\} \/>/);
  assert.equal(WEB_LINKING_CONFIG.screens.MediaOrigin, 'settings/advanced/media');
  assert.match(advanced, /navigation\.navigate\('MediaOrigin'\)/);
  assert.match(mediaOrigin, /setBlobOriginStrategy/);
  assert.match(mediaOrigin, /clearBlobCache\(\)/);
  assert.match(mediaOrigin, /formatBytes\(info\.bytes\)/);
  assert.match(mediaOrigin, /formatBytes\(MAX_BLOB_CACHE_BYTES\)/);
  assert.match(mediaOrigin, /probeVideoQuota\(\{/);
  assert.match(mediaOrigin, /getServiceAuth\(\{/);
  assert.match(mediaOrigin, /Check video quota/);
  assert.match(mediaOrigin, /videoQuotaText\(videoQuota\)/);
  assert.match(mediaOrigin, /Changing them needs a new grant/);
  assert.ok(!/onPress=\{\(\) => \{\}\}/.test(mediaOrigin));
});

test('video quota is grant-bound, structured and shared with the upload pre-flight', () => {
  assert.match(videoServiceProbe, /app\.bsky\.video\.getUploadLimits/);
  assert.match(videoServiceProbe, /VIDEO_SERVICE_DID = SERVICE_HOSTS\.videoAudience/);
  assert.match(videoServiceProbe, /serviceStatusDetail/);
  assert.match(videoServiceProbe, /normaliseVideoQuota/);
  assert.match(videoServiceProbe, /\.canUpload/);
  assert.match(videoServiceProbe, /remainingDailyVideos/);
  assert.match(videoServiceProbe, /remainingDailyBytes/);
  assert.doesNotMatch(videoServiceProbe, /\.message\b/);
  assert.doesNotMatch(videoServiceProbe, /AsyncStorage/);
  assert.match(videoUpload, /normaliseVideoQuota\(limits\)/);
  assert.match(videoUpload, /videoQuotaProblem\(video\.byteSize, quota\)/);
  assert.match(videoUpload, /VIDEO_LIMITS_LXM/);
  assert.doesNotMatch(videoUpload, /limits\.message/);
  assert.doesNotMatch(videoUpload, /const VIDEO_SERVICE =/);
});

test('post images retry from the PDS through one shared image seam', () => {
  assert.match(postCard, /blobFallbacksForPost\(post\)/);
  assert.match(postCard, /fallback: fallbacks\[index\]/);
  assert.equal((postCard.match(/<RemoteImage/g) || []).length, 2);
  assert.match(imageViewer, /fallback=\{image\.fallback\}/);
  assert.match(remoteImage, /resolveBlobUri\(fallback\)/);
  assert.match(remoteImage, /onError=\{handleError\}/);
  assert.match(remoteImage, /Image unavailable/);
  assert.match(remoteImage, /pdsFirst/);
});

test('Advanced exposes a working Identity screen with real cache state', () => {
  assert.match(app, /<Stack\.Screen name="IdentitySettings" component=\{IdentitySettingsScreen\} \/>/);
  assert.equal(WEB_LINKING_CONFIG.screens.IdentitySettings, 'settings/advanced/identity');
  assert.match(advanced, /navigation\.navigate\('IdentitySettings'\)/);
  assert.match(identityScreen, /setIdentityStrategy/);
  assert.match(identityScreen, /clearIdentityCache\(\)/);
  assert.match(identityScreen, /identityCacheStats/);
  assert.match(identityScreen, /lastIdentitySource/);
  assert.match(identityScreen, /A DID document is the source of truth/);
  assert.ok(!/onPress=\{\(\) => \{\}\}/.test(identityScreen));
});

test('identity resolution stores a bounded on-device cache and honours strategy', () => {
  assert.match(identityModel, /MAX_IDENTITY_CACHE_ENTRIES = 120/);
  assert.match(identityModel, /'local-only'/);
  assert.match(identityModel, /plcDirectoryUrl/);
  assert.match(identityModel, /didWebDocumentUrl/);
  assert.match(identityCache, /AsyncStorage\.getItem\(IDENTITY_CACHE_KEY\)/);
  assert.match(identityCache, /AsyncStorage\.setItem\(IDENTITY_CACHE_KEY/);
  assert.match(identityCache, /normaliseIdentityCache/);
  assert.match(identityCache, /invalidateIdentity/);
  // A re-sign-in invalidates the DID document so a migrated PDS is re-resolved.
  assert.match(app, /invalidateIdentity\(did\)/);
  assert.match(identityResolver, /resolveDidDocument/);
  assert.match(identityResolver, /resolveHandleToDid/);
  assert.match(identityResolver, /publicHandleResolver\.resolve\(handle\)/);
  assert.doesNotMatch(identityResolver, /agent\.com\.atproto\.identity\.resolveHandle/);
});

test('Advanced exposes a working Chat service screen with a real proxy probe', () => {
  assert.match(app, /<Stack\.Screen name="ChatService" component=\{ChatServiceScreen\} \/>/);
  assert.equal(WEB_LINKING_CONFIG.screens.ChatService, 'settings/advanced/chat');
  assert.match(advanced, /navigation\.navigate\('ChatService'\)/);
  assert.match(chatServiceScreen, /checkChatService\(\)/);
  assert.match(chatServiceScreen, /SettingButton label="Check chat service"/);
  assert.ok(!/onPress=\{\(\) => \{\}\}/.test(chatServiceScreen));
});

test('a previously seen profile falls back to a public PDS read', () => {
  assert.match(profileScreen, /readProfileFromPds\(actor\)/);
  assert.match(profileScreen, /noteProfileHandle\(detail\.handle, detail\.did\)/);
  assert.match(profileScreen, /Identity from this device’s cache · profile read from its PDS/);
  assert.match(identityProfile, /com\.atproto\.repo\.getRecord/);
  assert.match(identityProfile, /atprotoPdsEndpoint\(document\)/);
  assert.match(identityProfile, /identityFromCache = lastIdentitySource\(\) === 'cache'/);
  // The teal reader shares the same cached resolver, not a direct AppView call.
  assert.match(read('../src/lib/teal.ts'), /resolveDidDocument\(did\)/);
});
