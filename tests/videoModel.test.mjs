import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  buildCaptionTracks,
  buildVideoEmbed,
  captionSelectionError,
  describeVideoJob,
  isGifMime,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_MS,
  videoAspectRatio,
  videoJobDone,
  videoJobFailed,
  videoSelectionError,
  videoStatusFromUpload,
} from '../src/lib/videoModel.ts';

const mp4 = {
  key: 'v1',
  uri: 'file:///clip.mp4',
  mimeType: 'video/mp4',
  bytes: new Uint8Array([1, 2, 3]),
  byteSize: 3,
  width: 1920,
  height: 1080,
  durationMs: 12000,
  alt: 'A clip of the sea',
};
const blob = { $type: 'blob', ref: { $link: 'bafy-video' }, mimeType: 'video/mp4', size: 3 };

test('only MP4 and GIF files pass selection', () => {
  assert.equal(videoSelectionError({ mimeType: 'video/mp4', byteSize: 10 }), null);
  assert.equal(videoSelectionError({ mimeType: 'image/gif', byteSize: 10 }), null);
  assert.match(videoSelectionError({ mimeType: 'image/jpeg', byteSize: 10 }), /MP4 video or an animated GIF/);
  assert.match(videoSelectionError({ mimeType: 'video/quicktime', byteSize: 10 }), /converting first/);
  assert.equal(videoSelectionError({ mimeType: null, byteSize: 10 }) !== null, true);
});

test('size and duration rejections state their real limits', () => {
  assert.match(videoSelectionError({ mimeType: 'video/mp4', byteSize: MAX_VIDEO_BYTES + 1 }), /100 MB/);
  assert.match(videoSelectionError({ mimeType: 'video/mp4', byteSize: 0 }), /no readable size/);
  assert.match(videoSelectionError({ mimeType: 'video/mp4', byteSize: 10, durationMs: MAX_VIDEO_DURATION_MS + 1 }), /over 10 minutes/);
  assert.equal(videoSelectionError({ mimeType: 'video/mp4', byteSize: 10, durationMs: undefined }), null);
});

test('the embed uses only published lexicon fields', () => {
  const embed = buildVideoEmbed(mp4, blob);
  assert.equal(embed.$type, 'app.bsky.embed.video');
  assert.deepEqual(embed.video, blob);
  assert.equal(embed.alt, 'A clip of the sea');
  assert.deepEqual(embed.aspectRatio, { width: 1920, height: 1080 });
  assert.equal('presentation' in embed, false);
});

test('a GIF is marked with the published presentation hint', () => {
  assert.equal(isGifMime('image/gif'), true);
  assert.equal(isGifMime('video/mp4'), false);
  const embed = buildVideoEmbed({ ...mp4, mimeType: 'image/gif' }, blob);
  assert.equal(embed.presentation, 'gif');
});

test('no embed is built without a completed blob; alt text stays optional', () => {
  assert.equal(buildVideoEmbed(mp4, null), undefined);
  assert.equal('alt' in buildVideoEmbed({ ...mp4, alt: '   ' }, blob), false);
});

test('an already_exists response reuses its blob without inventing a job', () => {
  const reused = { error: 'already_exists', blob, message: 'Video already processed' };
  assert.deepEqual(videoStatusFromUpload(reused), {
    state: 'JOB_STATE_COMPLETED',
    blob,
  });
  assert.deepEqual(videoStatusFromUpload({ jobStatus: { jobId: 'job-1', state: 'JOB_STATE_ENCODING', progress: 12 } }), {
    jobId: 'job-1',
    state: 'JOB_STATE_ENCODING',
    progress: 12,
  });
  assert.equal(videoStatusFromUpload({ error: 'already_exists' }), null);
  assert.equal(videoStatusFromUpload({ jobId: 'job-2' }), null);
});

test('aspect ratios are bounded and never zero', () => {
  assert.deepEqual(videoAspectRatio({ width: 0, height: -4 }), { width: 1, height: 1 });
  assert.deepEqual(videoAspectRatio({ width: 20000, height: 100 }), { width: 10000, height: 100 });
});

test('captions must be small WebVTT files with a language', () => {
  const vtt = new TextEncoder().encode('WEBVTT\n\n00:00.000 --> 00:01.000\nHello');
  assert.equal(captionSelectionError(vtt, 'en'), null);
  assert.match(captionSelectionError(vtt, ''), /language/);
  assert.match(captionSelectionError(new TextEncoder().encode('NOT VTT'), 'en'), /WebVTT/);
  const oversized = new Uint8Array(20_001);
  oversized.set(new TextEncoder().encode('WEBVTT'));
  assert.match(captionSelectionError(oversized, 'en'), /kB/);
});

test('caption tracks use the published video caption shape only', () => {
  const tracks = buildCaptionTracks([
    { lang: 'en', blob: { $link: 'bafy-caption' } },
  ]);
  assert.deepEqual(tracks, [
    {
      $type: 'app.bsky.embed.video#caption',
      lang: 'en',
      file: { $link: 'bafy-caption' },
    },
  ]);
  const embed = buildVideoEmbed(mp4, blob, tracks);
  assert.deepEqual(embed.captions, tracks);
});

test('video upload declares exact service and caption scopes', () => {
  const metadata = JSON.parse(
    readFileSync(new URL('../oauth-client-metadata.json', import.meta.url), 'utf8')
  );
  const scopes = metadata.scope.split(/\s+/).filter(Boolean);
  for (const scope of [
    'blob:text/vtt',
    'rpc:com.atproto.repo.uploadBlob?aud=*',
    'rpc:app.bsky.video.getUploadLimits?aud=did:web:video.bsky.app',
  ]) {
    assert.ok(scopes.includes(scope), scope);
  }
  assert.equal(/repo:\*|rpc:\*|blob:\*/.test(metadata.scope), false);
});

test('only a completed job with a blob counts as ready', () => {
  assert.equal(videoJobDone({ state: 'JOB_STATE_COMPLETED', blob }), true);
  assert.equal(videoJobDone({ state: 'JOB_STATE_COMPLETED' }), false);
  assert.equal(videoJobDone({ state: 'JOB_STATE_UPLOADED', blob }), false);
  assert.equal(videoJobFailed({ state: 'JOB_STATE_FAILED' }), true);
  assert.equal(videoJobFailed({ state: 'JOB_STATE_COMPLETED' }), false);
});

test('progress copy never claims success early or echoes provider prose', () => {
  assert.equal(describeVideoJob(null), 'Starting upload…');
  assert.equal(describeVideoJob({ state: 'JOB_STATE_ENCODING', progress: 0.42 }), 'Encoding… 42%');
  assert.equal(describeVideoJob({ state: 'JOB_STATE_UPLOADING' }), 'Uploading…');
  assert.equal(describeVideoJob({ state: 'JOB_STATE_COMPLETED', blob }), 'Ready to post');
  assert.equal(describeVideoJob({ state: 'JOB_STATE_COMPLETED' }), 'Processing…');
  const failed = describeVideoJob({ state: 'JOB_STATE_FAILED', message: 'bad codec' });
  assert.equal(failed, 'The video service could not process this file.');
  assert.doesNotMatch(failed, /bad codec/);
});
