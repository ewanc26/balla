import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  VIDEO_LIMITS_LXM,
  VIDEO_SERVICE_DID,
  VIDEO_SERVICE_ENDPOINT,
  checkingVideoQuota,
  idleVideoQuota,
  normaliseVideoQuota,
  probeVideoQuota,
  videoQuotaProblem,
  videoQuotaText,
} from '../src/lib/videoServiceProbe.ts';

const source = readFileSync(
  new URL('../src/lib/videoServiceProbe.ts', import.meta.url),
  'utf8'
);

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  };
}

test('normalisation keeps only published quota fields', () => {
  const quota = normaliseVideoQuota({
    canUpload: true,
    remainingDailyVideos: 3,
    remainingDailyBytes: 5_000,
    message: 'provider prose that must not be retained',
    error: 'more provider prose',
  });
  assert.deepEqual(quota, {
    canUpload: true,
    remainingDailyVideos: 3,
    remainingDailyBytes: 5_000,
  });
  assert.equal(JSON.stringify(quota).includes('provider prose'), false);
  assert.equal(normaliseVideoQuota(null), null);
  assert.equal(normaliseVideoQuota({ canUpload: 'yes' }), null);
  assert.deepEqual(
    normaliseVideoQuota({
      canUpload: false,
      remainingDailyVideos: -1,
      remainingDailyBytes: 1.5,
    }),
    { canUpload: false, remainingDailyVideos: null, remainingDailyBytes: null }
  );
});

test('quota copy never claims a number before the service supplies one', () => {
  assert.match(videoQuotaText(idleVideoQuota()), /not checked yet/);
  assert.match(videoQuotaText(checkingVideoQuota()), /checking/);
  assert.equal(
    videoQuotaText({
      state: 'unavailable',
      status: 401,
      quota: null,
      detail: 'Service answered HTTP 401; no usable response.',
    }),
    'Video service quota: Service answered HTTP 401; no usable response.'
  );
  assert.match(
    videoQuotaText({
      state: 'blocked',
      status: 200,
      quota: { canUpload: false, remainingDailyVideos: null, remainingDailyBytes: null },
      detail: 'Uploads are not allowed for this account right now.',
    }),
    /uploads are not allowed/
  );
  assert.equal(
    videoQuotaText({
      state: 'ok',
      status: 200,
      quota: { canUpload: true, remainingDailyVideos: 2, remainingDailyBytes: 1_500_000 },
      detail: 'Quota read from the video service.',
    }),
    'Video service quota: uploads allowed · 2 videos left today · 1.5 MB left today'
  );
  assert.equal(
    videoQuotaText({
      state: 'ok',
      status: 200,
      quota: { canUpload: true, remainingDailyVideos: null, remainingDailyBytes: null },
      detail: 'Quota read from the video service.',
    }),
    'Video service quota: uploads allowed · no daily counts published'
  );
});

test('structured quota stops a doomed upload before any bytes are sent', () => {
  assert.equal(videoQuotaProblem(10, null), null);
  assert.match(
    videoQuotaProblem(10, {
      canUpload: false,
      remainingDailyVideos: null,
      remainingDailyBytes: null,
    }) || '',
    /not accepting uploads/
  );
  assert.match(
    videoQuotaProblem(10, {
      canUpload: true,
      remainingDailyVideos: 0,
      remainingDailyBytes: null,
    }) || '',
    /no uploads left/
  );
  assert.match(
    videoQuotaProblem(2_000, {
      canUpload: true,
      remainingDailyVideos: 3,
      remainingDailyBytes: 1_000,
    }) || '',
    /larger than the 1 KB/
  );
  assert.equal(
    videoQuotaProblem(1_000, {
      canUpload: true,
      remainingDailyVideos: null,
      remainingDailyBytes: 1_000,
    }),
    null
  );
});

test('probe asks the grant-bound endpoint with a service token and reads real fields', async () => {
  const tokenCalls = [];
  const fetchCalls = [];
  const result = await probeVideoQuota({
    serviceToken: async (aud, lxm) => {
      tokenCalls.push([aud, lxm]);
      return 'service-token';
    },
    fetchImpl: async (url, init) => {
      fetchCalls.push([url, init]);
      return jsonResponse(200, {
        canUpload: true,
        remainingDailyVideos: 4,
        remainingDailyBytes: 2_000_000,
        message: 'private provider sentence',
      });
    },
  });
  assert.deepEqual(tokenCalls, [[VIDEO_SERVICE_DID, VIDEO_LIMITS_LXM]]);
  assert.equal(fetchCalls[0][0], `${VIDEO_SERVICE_ENDPOINT}/xrpc/${VIDEO_LIMITS_LXM}`);
  assert.equal(fetchCalls[0][1].headers.Authorization, 'Bearer service-token');
  assert.equal(fetchCalls[0][1].headers.Accept, 'application/json');
  assert.equal(result.state, 'ok');
  assert.equal(result.status, 200);
  assert.deepEqual(result.quota, {
    canUpload: true,
    remainingDailyVideos: 4,
    remainingDailyBytes: 2_000_000,
  });
  assert.equal(JSON.stringify(result).includes('private provider sentence'), false);
});

test('a service that refuses uploads is blocked without provider prose', async () => {
  const result = await probeVideoQuota({
    serviceToken: async () => 'service-token',
    fetchImpl: async () =>
      jsonResponse(200, {
        canUpload: false,
        remainingDailyVideos: 0,
        message: 'account is on a secret provider list',
      }),
  });
  assert.equal(result.state, 'blocked');
  assert.equal(result.quota?.canUpload, false);
  assert.equal(JSON.stringify(result).includes('secret provider list'), false);
  assert.doesNotMatch(videoQuotaText(result), /secret provider list/);
});

test('token, network, HTTP and bad-response failures never invent a quota', async () => {
  const tokenFailure = await probeVideoQuota({
    serviceToken: async () => {
      throw new Error('secret token detail');
    },
    fetchImpl: async () => jsonResponse(200, { canUpload: true }),
  });
  assert.equal(tokenFailure.state, 'unavailable');
  assert.equal(tokenFailure.status, null);
  assert.equal(tokenFailure.quota, null);
  assert.equal(JSON.stringify(tokenFailure).includes('secret token detail'), false);

  const networkFailure = await probeVideoQuota({
    serviceToken: async () => 'service-token',
    fetchImpl: async () => {
      throw new Error('secret network detail');
    },
  });
  assert.equal(networkFailure.state, 'unavailable');
  assert.equal(JSON.stringify(networkFailure).includes('secret network detail'), false);

  const httpFailure = await probeVideoQuota({
    serviceToken: async () => 'service-token',
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      json: async () => {
        throw new Error('the body must not be read');
      },
    }),
  });
  assert.equal(httpFailure.state, 'unavailable');
  assert.equal(httpFailure.status, 401);
  assert.equal(httpFailure.quota, null);

  const badJson = await probeVideoQuota({
    serviceToken: async () => 'service-token',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('not json');
      },
    }),
  });
  assert.equal(badJson.state, 'unavailable');
  assert.match(badJson.detail, /not JSON/);

  const missingFlag = await probeVideoQuota({
    serviceToken: async () => 'service-token',
    fetchImpl: async () => jsonResponse(200, { remainingDailyVideos: 1 }),
  });
  assert.equal(missingFlag.state, 'unavailable');
  assert.match(missingFlag.detail, /no usable canUpload flag/);
});

test('probe source stays grant-bound and free of provider prose or local secrets', () => {
  assert.match(source, /VIDEO_SERVICE_ENDPOINT = SERVICE_HOSTS\.videoService/);
  assert.match(source, /VIDEO_SERVICE_DID = SERVICE_HOSTS\.videoAudience/);
  assert.match(source, /serviceStatusDetail/);
  assert.doesNotMatch(source, /\.message\b/);
  assert.doesNotMatch(source, /AsyncStorage/);
  assert.doesNotMatch(source, /canUpload:\s*true\s*\/\/.*guess/);
});
