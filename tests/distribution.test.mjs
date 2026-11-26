import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  altstoreSource, buildNumber, privacyPermissions, releaseNotes,
} from '../scripts/distribution.mjs';
import { addReleaseFiles } from '../scripts/fetch-releases.mjs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const app = JSON.parse(read('app.json')).expo;

test('build numbers rise with every release and match app.json', () => {
  assert.equal(buildNumber('0.98.0'), 98000);
  assert.ok(buildNumber('0.98.1') > buildNumber('0.98.0'));
  assert.ok(buildNumber('0.100.0') > buildNumber('0.99.999'));
  assert.ok(buildNumber('1.0.0') > buildNumber('0.999.999'));
  assert.throws(() => buildNumber('1.0'));
  assert.throws(() => buildNumber('0.1000.0'));
  assert.equal(app.android.versionCode, buildNumber(app.version));
  assert.equal(app.ios.buildNumber, String(buildNumber(app.version)));
});

const plist = {
  CFBundleIdentifier: 'click.croft.balla',
  CFBundleShortVersionString: '0.98.0',
  CFBundleVersion: '98000',
  MinimumOSVersion: '16.4',
  NSCameraUsageDescription: 'camera',
  NSPhotoLibraryUsageDescription: 'photos',
  CFBundleName: 'Balla',
};

test('the AltStore listing declares exactly the built permissions', () => {
  assert.deepEqual(privacyPermissions(plist), {
    NSCameraUsageDescription: 'camera',
    NSPhotoLibraryUsageDescription: 'photos',
  });
  const source = altstoreSource({ plist, size: 5, date: '2026-11-26', notes: 'n' });
  const [listed] = source.apps;
  assert.deepEqual(listed.appPermissions, { entitlements: [], privacy: privacyPermissions(plist) });
  assert.deepEqual(listed.versions[0], {
    version: '0.98.0',
    buildVersion: '98000',
    date: '2026-11-26',
    localizedDescription: 'n',
    downloadURL: 'https://github.com/ewanc26/balla/releases/download/v0.98.0/Balla-0.98.0.ipa',
    size: 5,
    minOSVersion: '16.4',
  });
});

test('earlier versions stay listed behind the new one, without repeats', () => {
  const previous = { apps: [{ versions: [{ version: '0.98.0' }, { version: '0.97.0' }] }] };
  const source = altstoreSource({ plist, size: 5, date: 'd', notes: 'n', previous });
  assert.deepEqual(source.apps[0].versions.map((v) => v.version), ['0.98.0', '0.97.0']);
});

test('a package with the wrong identity or build number is refused', () => {
  const build = (change) => altstoreSource({ plist: { ...plist, ...change }, size: 1, date: 'd', notes: 'n' });
  assert.throws(() => build({ CFBundleIdentifier: 'other' }));
  assert.throws(() => build({ CFBundleVersion: '5' }));
});

test('release notes are the one changelog section, in plain text', () => {
  const log = '# Changelog\n\n## 1.0.1\n\n- **New** `thing`.\n\n## 1.0.0\n\n- old\n';
  assert.equal(releaseNotes(log, '1.0.1'), '- New thing.');
  assert.throws(() => releaseNotes(log, '2.0.0'));
});

const BYTES = Buffer.from('apk');
const DIGEST = createHash('sha256').update(BYTES).digest('hex');
const indexFor = (sha256, size = BYTES.length) => ({
  packages: { 'click.croft.balla': { versions: { a: { file: { name: '/balla-0.98.0.apk', sha256, size } } } } },
});
function siteWith(index) {
  const dir = mkdtempSync(join(tmpdir(), 'balla-site-'));
  mkdirSync(join(dir, 'fdroid/repo'), { recursive: true });
  writeFileSync(join(dir, 'fdroid/repo/index-v2.json'), JSON.stringify(index));
  writeFileSync(join(dir, 'altstore.json'), '{}');
  return dir;
}
const answer = (status, body = BYTES) => async () => new Response(status === 200 ? body : null, { status });

test('the site serves the released APK itself, checked against the index', async () => {
  const dir = siteWith(indexFor(DIGEST));
  const asked = [];
  assert.equal(await addReleaseFiles(dir, async (url) => (asked.push(url), answer(200)())), true);
  assert.deepEqual(asked, [
    'https://github.com/ewanc26/balla/releases/download/v0.98.0/balla-0.98.0.apk',
  ]);
  assert.equal(readFileSync(join(dir, 'fdroid/repo/balla-0.98.0.apk'), 'utf8'), 'apk');
});

test('a download that differs from the index stops the build', async () => {
  await assert.rejects(addReleaseFiles(siteWith(indexFor('0'.repeat(64))), answer(200)));
  await assert.rejects(addReleaseFiles(siteWith(indexFor(DIGEST, 99)), answer(200)));
  await assert.rejects(addReleaseFiles(siteWith(indexFor(DIGEST)), answer(500)));
});

test('an unpublished release leaves both listings out rather than dangling', async () => {
  const dir = siteWith(indexFor(DIGEST));
  assert.equal(await addReleaseFiles(dir, answer(404)), false);
  assert.ok(!existsSync(join(dir, 'fdroid')));
  assert.ok(!existsSync(join(dir, 'altstore.json')));
});

test('the host does not redirect repository files, which F-Droid refuses', () => {
  const vercel = JSON.parse(read('vercel.json'));
  assert.ok(!vercel.redirects.some((item) => item.source.startsWith('/fdroid/')));
});

test('every image the repository index names is committed', () => {
  const root = new URL('../site/fdroid/repo', import.meta.url);
  if (!existsSync(root)) return;
  const index = JSON.parse(read('site/fdroid/repo/index-v2.json'));
  const named = [index.repo.icon, ...Object.values(index.packages).map((pkg) => pkg.metadata.icon)]
    .flatMap((icon) => Object.values(icon ?? {}));
  assert.ok(named.length >= 2);
  for (const { name } of named) assert.ok(existsSync(new URL(`../site/fdroid/repo${name}`, import.meta.url)), name);
});

test('packaging keeps keys and binaries out of the repository', () => {
  const script = read('scripts/package-release.mjs');
  assert.match(script, /startsWith\('EXPO_PUBLIC_'\)/);
  assert.match(script, /find-generic-password/);
  assert.match(script, /!path\.endsWith\('\.apk'\) && path !== join\(fdroid, 'repo', 'status'\)/);
  assert.match(read('distribution/fdroid/config.yml'), /keystorepass: \{env: BALLA_REPO_PASSWORD\}/);
});

test('the install page shows the published fingerprints', () => {
  const fingerprints = JSON.parse(read('distribution/fingerprints.json'));
  const page = read('site/install.html');
  for (const value of Object.values(fingerprints)) assert.ok(page.includes(value));
  assert.match(page, /not the F-Droid catalogue/);
  assert.match(page, /seven days/);
});

test('a committed AltStore listing matches the app it names', { skip: !existsSync(new URL('../site/altstore.json', import.meta.url)) }, () => {
  const source = JSON.parse(read('site/altstore.json'));
  const [listed] = source.apps;
  const [latest] = listed.versions;
  assert.equal(listed.bundleIdentifier, app.ios.bundleIdentifier);
  assert.equal(latest.buildVersion, String(buildNumber(latest.version)));
  assert.deepEqual(Object.keys(listed.appPermissions.privacy), [
    'NSCameraUsageDescription',
    'NSPhotoLibraryUsageDescription',
  ]);
});

test('published repository files carry no local paths or run logs', () => {
  const root = new URL('../site/fdroid/repo/', import.meta.url);
  if (!existsSync(root)) return;
  const files = readdirSync(root, { recursive: true });
  assert.ok(!files.some((file) => file.startsWith('status') || file.endsWith('.apk')), files.join());
  for (const file of files.filter((name) => /\.(json|xml|html)$/.test(name))) {
    assert.doesNotMatch(readFileSync(new URL(file, root), 'utf8'), /\/Users\/|\/home\//, file);
  }
});
