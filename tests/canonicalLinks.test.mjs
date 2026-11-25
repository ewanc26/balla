import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  BLUESKY_SOCIAL,
  BLUESKY_WEB,
  CREATOR,
  SERVICE_HOSTS,
} from '../src/lib/serviceHosts.ts';
import { DEFAULT_PLACES_ENDPOINT } from '../src/lib/placesModel.ts';
import {
  BLUESKY_ACCOUNT_SETTINGS,
  BLUESKY_APP_PASSWORDS,
  BLUESKY_PRIVACY_SETTINGS,
  isBlueskyService,
} from '../src/lib/accountSettingsModel.ts';
import { buildProfileShareUrl } from '../src/lib/profileShareModel.ts';
import { subjectWebUrl } from '../src/lib/moderationInboxModel.ts';
import { starterPackShareUrl } from '../src/lib/starterPackModel.ts';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

function sourceFiles(dir) {
  return readdirSync(join(root.pathname, dir), { recursive: true })
    .map((entry) => String(entry).replaceAll('\\', '/'))
    .filter((entry) => /\.(ts|tsx)$/.test(entry));
}

test('official web links keep their exact canonical shapes', () => {
  assert.equal(BLUESKY_WEB.host, 'bsky.app');
  assert.equal(BLUESKY_WEB.origin, 'https://bsky.app');
  assert.equal(
    BLUESKY_WEB.accountSettings,
    'https://bsky.app/settings/account'
  );
  assert.equal(
    BLUESKY_WEB.privacySettings,
    'https://bsky.app/settings/privacy-and-security'
  );
  assert.equal(
    BLUESKY_WEB.appPasswords,
    'https://bsky.app/settings/app-passwords'
  );
  assert.equal(BLUESKY_WEB.chatSettings, 'https://bsky.app/settings/chat');
  assert.equal(
    BLUESKY_WEB.profile('alice.bsky.social'),
    'https://bsky.app/profile/alice.bsky.social'
  );
  assert.equal(
    BLUESKY_WEB.post('did:plc:abc', '3post'),
    'https://bsky.app/profile/did:plc:abc/post/3post'
  );
  assert.equal(
    BLUESKY_WEB.feed('alice.test', '3feed'),
    'https://bsky.app/profile/alice.test/feed/3feed'
  );
  assert.equal(
    BLUESKY_WEB.list('alice.test', '3list'),
    'https://bsky.app/profile/alice.test/lists/3list'
  );
  assert.equal(
    BLUESKY_WEB.starterPack('alice.test', '3pack'),
    'https://bsky.app/profile/alice.test/starter-pack/3pack'
  );
  assert.equal(
    BLUESKY_WEB.starterPackShort('alice.test', '3pack'),
    'https://bsky.app/start/alice.test/3pack'
  );
  assert.equal(
    BLUESKY_WEB.chatInvite('abc-def'),
    'https://bsky.app/chat/abc-def'
  );
  assert.equal(BLUESKY_SOCIAL.host, 'bsky.social');
  assert.equal(
    BLUESKY_SOCIAL.communityGuidelines,
    'https://bsky.social/about/support/community-guidelines'
  );
  assert.equal(CREATOR.webProfile, 'https://bsky.app/profile/ewancroft.uk');
});

test('only serviceHosts.ts holds official Bluesky web literals', () => {
  // The one placeholder is an example value in an input field, not a link-out.
  const placeholder = 'components/SearchFiltersModal.tsx';
  const placeholderText = read(`src/${placeholder}`);
  assert.match(placeholderText, /placeholder="https:\/\/bsky\.app\/about"/);

  for (const file of sourceFiles('src')) {
    if (file === 'lib/serviceHosts.ts' || file === placeholder) continue;
    const text = read(`src/${file}`);
    assert.doesNotMatch(
      text,
      /https:\/\/bsky\.app\//,
      `${file} must derive its Bluesky web link`
    );
    assert.doesNotMatch(
      text,
      /https:\/\/bsky\.social\//,
      `${file} must derive its Bluesky social link`
    );
  }
});

test('link-out consumers derive from the canonical builders', () => {
  assert.equal(BLUESKY_ACCOUNT_SETTINGS, BLUESKY_WEB.accountSettings);
  assert.equal(BLUESKY_PRIVACY_SETTINGS, BLUESKY_WEB.privacySettings);
  assert.equal(BLUESKY_APP_PASSWORDS, BLUESKY_WEB.appPasswords);
  assert.equal(
    buildProfileShareUrl({ handle: 'alice.test' }),
    BLUESKY_WEB.profile('alice.test')
  );
  assert.equal(
    subjectWebUrl({
      uri: 'at://did:plc:abc/app.bsky.feed.post/3post',
      did: 'did:plc:abc',
      rkey: '3post',
    }),
    BLUESKY_WEB.post('did:plc:abc', '3post')
  );
  assert.equal(
    starterPackShareUrl(
      'at://did:plc:abc/app.bsky.graph.starterpack/3pack',
      { handle: 'alice.test' }
    ),
    BLUESKY_WEB.starterPackShort('alice.test', '3pack')
  );
  assert.equal(isBlueskyService('https://bsky.social'), true);
  assert.equal(isBlueskyService('https://alice.bsky.social'), true);
  assert.equal(isBlueskyService('https://eurosky.social'), false);
});

test('the places default is the one configured provider host', () => {
  assert.equal(DEFAULT_PLACES_ENDPOINT, SERVICE_HOSTS.places);
  assert.equal(DEFAULT_PLACES_ENDPOINT, 'https://places.eurosky.tech');
  assert.match(read('src/lib/placesModel.ts'), /DEFAULT_PLACES_ENDPOINT = SERVICE_HOSTS\.places/);
});

test('version and release notes match this slice', () => {
  const pkg = JSON.parse(read('package.json'));
  const appJson = JSON.parse(read('app.json'));
  assert.equal(pkg.version, '0.82.0');
  assert.equal(appJson.expo.version, '0.82.0');
  assert.match(read('CHANGELOG.md'), /^## 0\.72\.0$/m);

  const plist = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plist)) {
    assert.match(readFileSync(plist, 'utf8'), /<string>0\.82\.0<\/string>/);
  }
});
