// Builds the sideload release from the committed tree: a signed Android APK, an
// unsigned iOS package for AltStore, and the metadata describing those exact
// files. Publishes nothing. See docs/distribution.md.
//
//   node scripts/package-release.mjs
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  rmSync, statSync, writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  altstoreSource, apkName, buildNumber, ipaName, releaseNotes, BUNDLE_ID,
} from './distribution.mjs';

const root = process.cwd();
const keys = process.env.BALLA_RELEASE_HOME || join(homedir(), '.balla-release');
const androidHome = process.env.ANDROID_HOME || join(homedir(), 'Library/Android/sdk');
const javaHome =
  process.env.JAVA_HOME || '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home';

if (Object.keys(process.env).some((name) => name.startsWith('EXPO_PUBLIC_'))) {
  throw new Error('unset every EXPO_PUBLIC_ variable: a release must not be a preview build');
}

const run = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: 'inherit', ...options });
const read = (command, args, options = {}) =>
  execFileSync(command, args, { encoding: 'utf8', ...options }).trim();
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
// Read into the child environment only; never printed or passed as an argument.
const secret = (service) =>
  read('security', ['find-generic-password', '-s', service, '-w']);

if (read('git', ['status', '--porcelain'])) throw new Error('commit or stash changes first');
const commit = read('git', ['rev-parse', 'HEAD']);
const work = mkdtempSync(join(tmpdir(), 'balla-release-'));
const tree = join(work, 'tree');
run('git', ['worktree', 'add', '--detach', tree, commit]);

try {
  const app = JSON.parse(readFileSync(join(tree, 'app.json'), 'utf8')).expo;
  const { version } = app;
  const code = buildNumber(version);
  if (app.android.versionCode !== code || app.ios.buildNumber !== String(code)) {
    throw new Error(`app.json build numbers must be ${code}`);
  }
  const notes = releaseNotes(readFileSync(join(tree, 'CHANGELOG.md'), 'utf8'), version);
  const fingerprints = JSON.parse(
    readFileSync(join(tree, 'distribution/fingerprints.json'), 'utf8'),
  );
  const out = join(keys, 'out', `v${version}`);
  if (existsSync(out)) {
    throw new Error(`${out} exists. Published files must not be rebuilt; move it aside.`);
  }

  const env = {
    ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1',
    JAVA_HOME: javaHome, ANDROID_HOME: androidHome,
  };
  run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: tree, env });
  run('npx', ['expo', 'prebuild', '--clean'], { cwd: tree, env });

  // Android: Expo signs release builds with the debug key, so sign again.
  const android = join(tree, 'android');
  run('./gradlew', [
    'assembleRelease', '-PreactNativeArchitectures=arm64-v8a,armeabi-v7a', '--no-daemon', '-q',
  ], { cwd: android, env });
  const tools = join(androidHome, 'build-tools', readdirSync(join(androidHome, 'build-tools')).sort().at(-1));
  mkdirSync(out, { recursive: true });
  const apk = join(out, apkName(version));
  const aligned = join(work, 'aligned.apk');
  run(join(tools, 'zipalign'), [
    '-p', '-f', '4', join(android, 'app/build/outputs/apk/release/app-release.apk'), aligned,
  ]);
  run(join(tools, 'apksigner'), [
    'sign', '--ks', join(keys, 'android-signing.p12'), '--ks-key-alias', 'balla-apk',
    '--ks-pass', 'env:BALLA_APK_PASSWORD', '--key-pass', 'env:BALLA_APK_PASSWORD',
    '--out', apk, aligned,
  ], { env: { ...env, BALLA_APK_PASSWORD: secret('balla-android-signing') } });
  rmSync(`${apk}.idsig`, { force: true });
  const certificates = read(join(tools, 'apksigner'), ['verify', '--print-certs', apk], { env });
  const expected = fingerprints.androidSigningCertificate.replaceAll(':', '').toLowerCase();
  if (!certificates.includes(`SHA-256 digest: ${expected}`)) {
    throw new Error('the APK is not signed with the published certificate');
  }
  const badging = read(join(tools, 'aapt2'), ['dump', 'badging', apk]);
  if (!badging.includes(`name='${BUNDLE_ID}' versionCode='${code}' versionName='${version}'`)) {
    throw new Error('the APK does not carry the release identity');
  }

  // iOS: an unsigned device build. AltStore signs it with the user's own account.
  const derived = join(work, 'derived');
  run('xcodebuild', [
    '-workspace', 'ios/Balla.xcworkspace', '-scheme', 'Balla', '-configuration', 'Release',
    '-sdk', 'iphoneos', '-destination', 'generic/platform=iOS', '-derivedDataPath', derived,
    'CODE_SIGNING_ALLOWED=NO', '-quiet', 'build',
  ], { cwd: tree, env });
  const payload = join(work, 'ipa', 'Payload');
  mkdirSync(payload, { recursive: true });
  const bundle = join(payload, 'Balla.app');
  cpSync(join(derived, 'Build/Products/Release-iphoneos/Balla.app'), bundle, {
    recursive: true, verbatimSymlinks: true,
  });
  const info = join(bundle, 'Info.plist');
  const readPlist = () => JSON.parse(read('plutil', ['-convert', 'json', '-o', '-', info]));
  // The development launcher declares local-network use that a release never makes.
  for (const key of ['NSLocalNetworkUsageDescription', 'NSBonjourServices']) {
    if (key in readPlist()) run('plutil', ['-remove', key, info]);
  }
  const plist = readPlist();
  const archs = read('lipo', ['-archs', join(bundle, plist.CFBundleExecutable)]);
  if (archs !== 'arm64') throw new Error(`expected an arm64 device binary, found ${archs}`);
  const ipa = join(out, ipaName(version));
  run('zip', ['-qry', ipa, 'Payload'], { cwd: join(work, 'ipa') });

  // Metadata is written into the real checkout, to be reviewed and committed.
  const sourcePath = join(root, 'site/altstore.json');
  const previous = existsSync(sourcePath) ? JSON.parse(readFileSync(sourcePath, 'utf8')) : null;
  const date = new Date().toISOString().slice(0, 10);
  const source = altstoreSource({ plist, size: statSync(ipa).size, date, notes, previous });
  writeFileSync(sourcePath, `${JSON.stringify(source, null, 2)}\n`);

  const fdroid = join(keys, 'fdroid');
  mkdirSync(join(fdroid, 'metadata'), { recursive: true });
  mkdirSync(join(fdroid, 'repo'), { recursive: true });
  cpSync(join(tree, 'distribution/fdroid/config.yml'), join(fdroid, 'config.yml'));
  run('chmod', ['600', join(fdroid, 'config.yml')]);
  cpSync(
    join(tree, `distribution/fdroid/${BUNDLE_ID}.yml`),
    join(fdroid, `metadata/${BUNDLE_ID}.yml`),
  );
  cpSync(apk, join(fdroid, 'repo', apkName(version)));
  run('fdroid', ['update', '--pretty'], {
    cwd: fdroid,
    env: { ...env, BALLA_REPO_PASSWORD: secret('balla-fdroid-repo') },
  });
  // The site carries the index and images; APKs are served from GitHub releases.
  const published = join(root, 'site/fdroid/repo');
  rmSync(published, { recursive: true, force: true });
  cpSync(join(fdroid, 'repo'), published, {
    recursive: true,
    filter: (path) => !path.endsWith('.apk'),
  });

  const sums = [apk, ipa].map((file) => `${sha256(file)}  ${file.slice(out.length + 1)}`);
  writeFileSync(join(out, 'SHA256SUMS'), `${sums.join('\n')}\n`);
  writeFileSync(join(out, 'BUILD-COMMIT'), `${commit}\n`);
  console.log(`\nBuilt ${version} from ${commit}\n${out}\n${sums.join('\n')}`);
} finally {
  execFileSync('git', ['worktree', 'remove', '--force', tree], { stdio: 'inherit' });
  rmSync(work, { recursive: true, force: true });
}
