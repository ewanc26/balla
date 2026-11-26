import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WEB_LINKING_CONFIG } from '../src/lib/webLinking.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../App.tsx');
const advanced = read('../src/screens/AdvancedScreen.tsx');
const account = read('../src/screens/AccountSettingsScreen.tsx');
const screen = read('../src/screens/MigrationPreflightScreen.tsx');
const model = read('../src/lib/migrationPreflightModel.ts');
const exporter = read('../src/lib/preferenceExport.ts');
const changelog = read('../CHANGELOG.md');
const metadata = JSON.parse(read('../oauth-client-metadata.json'));

test('migration pre-flight is registered with a stable web path', () => {
  assert.match(app, /<Stack\.Screen name="MigrationPreflight" component=\{MigrationPreflightScreen\} \/>/);
  assert.equal(WEB_LINKING_CONFIG.screens.MigrationPreflight, 'settings/advanced/migration-preflight');
  assert.match(advanced, /navigation\.navigate\('MigrationPreflight'\)/);
  assert.match(advanced, /label="Move to another PDS"/);
  assert.match(account, /navigation\.navigate\('MigrationPreflight'\)/);
});

test('the pre-flight performs real reads and has no inert controls', () => {
  assert.match(screen, /useSessionSummary\(\)/);
  assert.match(screen, /loadPdsDirectory\(fetch, fresh\)/);
  assert.match(screen, /probeHost\(chosen\.url\)/);
  assert.match(screen, /probeHost\(customUrl\)/);
  assert.match(screen, /agent\.app\.bsky\.actor\.getPreferences\(\{\}\)/);
  assert.match(screen, /buildPreferenceExport\(preferences, did, new Date\(\)\.toISOString\(\)\)/);
  assert.match(screen, /exportPreferencesJson\(preferenceExportName\(did\), json\)/);
  assert.match(screen, /Balla cannot move your account/);
  assert.match(screen, /Read preferences/);
  assert.match(screen, /preferenceExportAction\(\)/);
  assert.ok(!/onPress=\{\(\) => \{\}\}/.test(screen));
});

test('the pre-flight never calls a migration write or a PLC operation', () => {
  assert.doesNotMatch(screen, /\.createAccount\(/);
  assert.doesNotMatch(screen, /\.importRepo\(/);
  assert.doesNotMatch(screen, /\.activateAccount\(/);
  assert.doesNotMatch(screen, /\.deactivateAccount\(/);
  assert.doesNotMatch(screen, /submitPlcOperation|signPlcOperation/);
  assert.doesNotMatch(screen, /deleteAccount/);
  assert.match(model, /MIGRATION_OUTSIDE_GRANT/);
  assert.match(model, /Provider response text and preference/);
  assert.match(model, /values are never logged or rendered as status copy/);
});

test('the local export uses a real browser download or native clipboard', () => {
  assert.match(exporter, /Platform\.OS === 'web'/);
  assert.match(exporter, /URL\.createObjectURL\(blob\)/);
  assert.match(exporter, /anchor\.download = filename/);
  assert.match(exporter, /Clipboard\.setStringAsync\(json\)/);
  assert.doesNotMatch(exporter, /console\.|fetch\(/);
});

test('the assisted links are external and the source is documented', () => {
  for (const label of [
    'AT Protocol migration guide',
    'PDS migration safety notes',
    'goat account migration',
    'PDS MOOVER',
    'First-person migration walkthrough',
  ]) {
    const start = screen.indexOf(`label="${label}"`);
    assert.notEqual(start, -1, `${label} is present`);
    assert.match(screen.slice(start, start + 700), /external/);
  }
  assert.match(screen, /openLink\(ATPROTO_MIGRATION_GUIDE\)/);
  assert.match(screen, /openLink\(PDS_MOOVER_TOOL\)/);
  assert.match(model, /atproto\.com\/guides\/account-migration/);
  assert.match(model, /pdsmoover\.com/);
});

test('no new OAuth scope or dependency enables the move', () => {
  const scopes = metadata.scope.split(/\s+/).filter(Boolean);
  assert.equal(scopes.length, 112);
  assert.equal(
    scopes.some((scope) =>
      /^(?:rpc|repo|blob):[^\s]*(createAccount|importRepo|checkAccountStatus|listMissingBlobs|activateAccount|deactivateAccount|signPlcOperation|submitPlcOperation)/i.test(scope)
    ),
    false
  );
  assert.equal(scopes.includes('transition:generic'), false);
});

test('release notes and version describe the read-only pre-flight', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.96.0');
  assert.equal(appJson.expo.version, '0.96.0');
  assert.match(changelog, /## 0\.37\.0/);
  assert.match(changelog, /read-only migration pre-flight/);
  assert.match(changelog, /scope count remains 111/);
});
