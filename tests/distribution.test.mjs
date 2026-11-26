import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  altstoreSource, apkName, buildNumber, privacyPermissions, releaseNotes,
} from '../scripts/distribution.mjs';

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

test('the site sends repository APK requests to the matching GitHub release', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const rule = vercel.redirects.find((item) => item.source.startsWith('/fdroid/repo/'));
  assert.equal(rule.source, '/fdroid/repo/balla-:version(\\d+\\.\\d+\\.\\d+).apk');
  assert.equal(
    rule.destination.replaceAll(':version', '0.98.0'),
    `https://github.com/ewanc26/balla/releases/download/v0.98.0/${apkName('0.98.0')}`,
  );
  assert.equal(rule.permanent, false);
});

test('packaging keeps keys and binaries out of the repository', () => {
  const script = read('scripts/package-release.mjs');
  assert.match(script, /startsWith\('EXPO_PUBLIC_'\)/);
  assert.match(script, /find-generic-password/);
  assert.match(script, /filter: \(path\) => !path\.endsWith\('\.apk'\)/);
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
