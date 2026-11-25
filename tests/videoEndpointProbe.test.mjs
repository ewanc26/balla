import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { probeVideoEndpoint } from '../src/lib/servicesProbe.ts';
import { VIDEO_LIMITS_LXM } from '../src/lib/serviceHosts.ts';
import { VIDEO_LIMITS_LXM as REEXPORTED_LXM } from '../src/lib/videoServiceProbe.ts';
import { DEFAULT_SERVICES } from '../src/lib/servicesModel.ts';

const screen = readFileSync(new URL('../src/screens/ServicesScreen.tsx', import.meta.url), 'utf8');

function response(status) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new Error('the response body must never be read');
    },
  };
}

test('the video lexicon lives in one auditable host module', () => {
  assert.equal(VIDEO_LIMITS_LXM, 'app.bsky.video.getUploadLimits');
  assert.equal(REEXPORTED_LXM, VIDEO_LIMITS_LXM);
});

test('a public 401 proves the video endpoint exists without reading provider prose', async () => {
  const calls = [];
  const result = await probeVideoEndpoint({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(401);
    },
  });

  assert.equal(result.state, 'ok');
  assert.equal(result.status, 401);
  assert.equal(result.endpoint, DEFAULT_SERVICES.videoService);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${DEFAULT_SERVICES.videoService}/xrpc/app.bsky.video.getUploadLimits`);
  assert.equal(calls[0].init.headers.Accept, 'application/json');
  assert.doesNotMatch(JSON.stringify(calls[0].init.headers), /Authorization/);
  assert.match(result.detail, /reachable/i);
  assert.doesNotMatch(result.detail, /missing_token/i);
});

test('other statuses are classified from the code alone', async () => {
  const blocked = await probeVideoEndpoint({ fetchImpl: async () => response(403) });
  assert.equal(blocked.state, 'ok');
  assert.equal(blocked.status, 403);

  const failed = await probeVideoEndpoint({ fetchImpl: async () => response(500) });
  assert.equal(failed.state, 'unavailable');
  assert.equal(failed.status, 500);
  assert.match(failed.detail, /server error/i);

  const unmeasured = await probeVideoEndpoint({ fetchImpl: async () => { throw new Error('blocked'); } });
  assert.equal(unmeasured.state, 'unavailable');
  assert.equal(unmeasured.status, null);
});

test('the Services screen exposes the video check as a visible, read-only control', () => {
  assert.match(screen, /Test video endpoint/);
  assert.match(screen, /checkVideo\(\)/);
  assert.match(screen, /probeVideoEndpoint\(\)/);
  assert.match(screen, /Video result/);
  assert.equal((screen.match(/<SettingSwitch\b/g) || []).length, 1);
  assert.match(screen, /label="Places search"/);
  assert.doesNotMatch(screen, /onPress=\{\(\) => \{\}\}/);
});

test('the release documents the video check as partial #97', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
  const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
  const compliance = readFileSync(new URL('../docs/bluesky-compliance.md', import.meta.url), 'utf8');
  assert.equal(pkg.version, '0.93.0');
  assert.equal(appJson.expo.version, '0.93.0');
  assert.match(changelog, /^## 0\.72\.0$/m);
  assert.match(changelog, /#97, partial/);
  assert.match(changelog, /video endpoint/);
  assert.match(changelog, /scope count remains 111/);
  assert.match(compliance, /video endpoint reachability/);
  const metadata = JSON.parse(readFileSync(new URL('../oauth-client-metadata.json', import.meta.url), 'utf8'));
  assert.equal(metadata.scope.split(/\s+/).filter(Boolean).length, 112);
});
