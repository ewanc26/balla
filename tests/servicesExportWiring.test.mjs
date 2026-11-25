import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const screen = read('../src/screens/ServicesScreen.tsx');
const model = read('../src/lib/servicesExportModel.ts');
const exporter = read('../src/lib/preferenceExport.ts');
const changelog = read('../CHANGELOG.md');
const compliance = read('../docs/bluesky-compliance.md');
const siteFeatures = read('../site/features.html');

test('the Services screen exports a real configuration file or clipboard copy', () => {
  assert.match(screen, /useSessionSummary\(\)/);
  assert.match(screen, /buildServicesExport\(/);
  assert.match(screen, /serialiseServicesExport\(/);
  assert.match(screen, /exportServicesJson\(servicesExportName\(\), json\)/);
  assert.match(screen, /servicesExportAction\(\)/);
  assert.match(screen, /Configuration record/);
  assert.match(screen, /Import configuration/);
  assert.ok(!/onPress=\{\(\) => \{\}\}/.test(screen));
});

test('the shared exporter downloads on web and copies on native without network', () => {
  assert.match(exporter, /Platform\.OS === 'web'/);
  assert.match(exporter, /URL\.createObjectURL\(blob\)/);
  assert.match(exporter, /anchor\.download = filename/);
  assert.match(exporter, /Clipboard\.setStringAsync\(json\)/);
  assert.match(exporter, /exportServicesJson/);
  assert.doesNotMatch(exporter, /console\.|fetch\(/);
});

test('the export model carries no secret path', () => {
  assert.match(model, /SERVICES_EXPORT_SCHEMA/);
  assert.match(model, /new authorisation/);
  assert.doesNotMatch(model, /Clipboard|AsyncStorage|fetch\(|\.message\b/);
});

test('defaults are declared in one host module and the rest derive from it', () => {
  const hosts = read('../src/lib/serviceHosts.ts');
  for (const host of [
    'https://bsky.social',
    'did:web:api.eurosky.network',
    'did:web:api.bsky.chat',
    'https://video.bsky.app',
    'https://plc.directory',
  ]) {
    assert.ok(hosts.includes(host), `default host ${host} lives in serviceHosts.ts`);
  }
  assert.match(hosts, /requiredDidWebDocumentUrl\(SERVICE_HOSTS\.appviewDid\)/);
  assert.match(hosts, /requiredDidWebDocumentUrl\(SERVICE_HOSTS\.chatDid\)/);
  const services = read('../src/lib/servicesModel.ts');
  assert.match(services, /SERVICE_HOSTS\.handleResolver/);
  assert.doesNotMatch(services, /'https:\/\/bsky\.social'/);
});

test('the release documents the partial #97 slice honestly', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  assert.equal(pkg.version, '0.82.0');
  assert.equal(appJson.expo.version, '0.82.0');
  const plistPath = new URL('../ios/Balla/Info.plist', import.meta.url);
  if (existsSync(plistPath)) {
    assert.match(readFileSync(plistPath, 'utf8'), /<string>0\.82\.0<\/string>/);
  }
  assert.match(changelog, /^## 0\.72\.0$/m);
  assert.match(changelog, /#97, partial/);
  assert.match(changelog, /export/);
  assert.match(changelog, /scope count remains 111/);
  assert.match(compliance, /Configuration export/);
  assert.match(compliance, /not a second backend/);
  assert.match(siteFeatures, /Service configuration export/);
  assert.match(siteFeatures, /issues\/97/);
  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 112);
});
