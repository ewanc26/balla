import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { probeLabeler, labelerProbeText } from '../src/lib/labelerProbe.ts';
import { DEFAULT_SERVICES } from '../src/lib/servicesModel.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const screen = read('../src/screens/ServicesScreen.tsx');

test('the default labeler DID is a valid public probe target with one audited source', () => {
  assert.match(DEFAULT_SERVICES.labelerDid, /^did:plc:[a-z0-9]+$/);
  assert.equal(DEFAULT_SERVICES.labelerDid, DEFAULT_SERVICES.labelerAudience.split('#')[0]);
});

test('the labeler probe resolves the DID document and makes one public query', async () => {
  const calls = [];
  const document = {
    service: [
      { id: '#atproto_labeler', type: 'AtprotoLabeler', serviceEndpoint: 'https://labels.example.org' },
    ],
  };
  const result = await probeLabeler(DEFAULT_SERVICES.labelerDid, {
    resolveDocument: async (did) => {
      assert.equal(did, DEFAULT_SERVICES.labelerDid);
      return document;
    },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        json: async () => ({ labels: [] }),
      };
    },
  });

  assert.equal(result.state, 'ok');
  assert.equal(result.endpoint, 'https://labels.example.org');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /com\.atproto\.label\.queryLabels/);
  assert.doesNotMatch(JSON.stringify(calls[0].init.headers), /Authorization/);
  assert.match(labelerProbeText(result), /reachable/);
});

test('Advanced → Services exposes the labeler check as a visible, read-only control', () => {
  assert.match(screen, /resolveDidDocument/);
  assert.match(screen, /probeLabeler\(DEFAULT_SERVICES\.labelerDid, \{ resolveDocument: resolveDidDocument \}\)/);
  assert.match(screen, /checkingLabelerProbe\(\)/);
  assert.match(screen, /Test labeler/);
  assert.match(screen, /checkLabeler\(\)/);
  assert.match(screen, /labelerProbeText\(labelerProbe\)/);
  assert.match(screen, /does not change which labels Balla applies/);
  assert.equal((screen.match(/<SettingSwitch\b/g) || []).length, 1);
  assert.match(screen, /label="Places search"/);
  assert.doesNotMatch(screen, /onPress=\{\(\) => \{\}\}/);
});

test('the release documents the labeler check as partial #97 without new scope', () => {
  const pkg = JSON.parse(read('../package.json'));
  const appJson = JSON.parse(read('../app.json'));
  const changelog = read('../CHANGELOG.md');
  const compliance = read('../docs/bluesky-compliance.md');
  const features = read('../site/features.html');
  assert.equal(pkg.version, '0.91.0');
  assert.equal(appJson.expo.version, '0.91.0');
  assert.match(changelog, /^## 0\.72\.0$/m);
  assert.match(changelog, /#97, partial/);
  assert.match(changelog, /labeler/i);
  assert.match(changelog, /scope count remains 111/);
  assert.match(compliance, /labeler test reuses `labelerProbe\.ts`/);
  assert.match(features, /labeler endpoint/);
  const metadata = JSON.parse(read('../oauth-client-metadata.json'));
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 112);
});
