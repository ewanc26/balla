/**
 * Framework-free rules for video and GIF posts. The published lexicon is
 * `app.bsky.embed.video`: an mp4 blob, optional alt text, aspect ratio and a
 * `presentation` hint. An animated GIF is uploaded as-is and marked with
 * `presentation: 'gif'`; Bluesky does the conversion, so Balla never claims to
 * transcode locally.
 *
 * Before a post is published the upload job must reach JOB_STATE_COMPLETED and
 * supply a blob. There is no optimistic "posted" state. Provider `message`
 * text is never kept: only allowlisted structured job fields reach app state.
 */

import { videoJobFailureCopy } from './videoFailureModel.ts';

export type ComposerVideo = {
  key: string;
  uri: string;
  mimeType: string;
  bytes: Uint8Array;
  byteSize: number;
  width: number;
  height: number;
  durationMs: number;
  alt: string;
};

export const VIDEO_MIME_TYPES = ['video/mp4', 'image/gif'] as const;
export const MAX_VIDEO_BYTES = 100_000_000;
export const MAX_VIDEO_DURATION_MS = 10 * 60 * 1000;
export const MAX_CAPTIONS = 20;
export const MAX_CAPTION_BYTES = 20_000;

export type CaptionAttachment = {
  key: string;
  name: string;
  lang: string;
  bytes: Uint8Array;
  byteSize: number;
  blob?: unknown;
};

export function isGifMime(mimeType: string): boolean {
  return mimeType === 'image/gif';
}

/** Returns a user-facing reason, or null when the file can be uploaded. */
export function videoSelectionError({
  mimeType,
  byteSize,
  durationMs,
}: {
  mimeType?: string | null;
  byteSize?: number | null;
  durationMs?: number | null;
}): string | null {
  const mime = typeof mimeType === 'string' ? mimeType.toLowerCase() : '';
  if (!VIDEO_MIME_TYPES.includes(mime as (typeof VIDEO_MIME_TYPES)[number])) {
    return 'Choose an MP4 video or an animated GIF. Other formats need converting first.';
  }
  if (!Number.isFinite(byteSize) || (byteSize || 0) <= 0) {
    return 'That file has no readable size, so it cannot be uploaded.';
  }
  if ((byteSize || 0) > MAX_VIDEO_BYTES) {
    return `That file is too large for Balla. The limit is ${Math.round(MAX_VIDEO_BYTES / 1_000_000)} MB.`;
  }
  if (
    Number.isFinite(durationMs) &&
    (durationMs || 0) > MAX_VIDEO_DURATION_MS
  ) {
    return `That clip is over ${MAX_VIDEO_DURATION_MS / 60_000} minutes long.`;
  }
  return null;
}

export function videoAspectRatio(video: {
  width: number;
  height: number;
}): { width: number; height: number } {
  const width = Math.min(10000, Math.max(1, Math.round(video.width) || 1));
  const height = Math.min(10000, Math.max(1, Math.round(video.height) || 1));
  return { width, height };
}

export function isWebVtt(bytes: Uint8Array): boolean {
  const marker = [87, 69, 66, 86, 84, 84]; // WEBVTT in ASCII
  return (
    bytes.length >= marker.length &&
    marker.every((byte, index) => bytes[index] === byte)
  );
}

/** Caption files are plain WebVTT, bounded by the published video lexicon. */
export function captionSelectionError(bytes: Uint8Array, lang: string): string | null {
  if (!lang.trim()) return 'Choose a language for these captions first.';
  if (bytes.byteLength <= 0) return 'That caption file is empty.';
  if (!isWebVtt(bytes)) return 'Captions must be a WebVTT file starting with WEBVTT.';
  if (bytes.byteLength > MAX_CAPTION_BYTES) {
    return `A caption file must be under ${MAX_CAPTION_BYTES / 1000} kB.`;
  }
  return null;
}

/** Only published `app.bsky.embed.video#caption` fields are emitted. */
export function buildCaptionTracks(
  captions: Array<{ lang: string; blob: unknown }>
): Array<Record<string, unknown>> | undefined {
  if (!captions.length) return undefined;
  return captions.slice(0, MAX_CAPTIONS).map(({ lang, blob }) => ({
    $type: 'app.bsky.embed.video#caption',
    lang: lang.trim(),
    file: blob,
  }));
}

/**
 * `blob` is the completed job's BlobRef from `app.bsky.video.defs#jobStatus`.
 * The embed is only built once that blob exists. Alt text is optional in the
 * lexicon; the composer's own accessibility setting decides whether it is
 * required, so this function never invents a description.
 */
export function buildVideoEmbed(
  video: ComposerVideo,
  blob: unknown,
  captions?: Array<Record<string, unknown>>
): Record<string, unknown> | undefined {
  if (!blob) return undefined;
  const alt = video.alt.trim();
  return {
    $type: 'app.bsky.embed.video',
    video: blob,
    ...(alt ? { alt } : {}),
    aspectRatio: videoAspectRatio(video),
    ...(isGifMime(video.mimeType) ? { presentation: 'gif' } : {}),
    ...(captions?.length ? { captions } : {}),
  };
}

export type VideoJobStatus = {
  jobId?: string;
  state?: string;
  progress?: number;
  blob?: unknown;
  error?: string;
  failureCode?: string;
};

/**
 * Keep only allowlisted job fields. In particular, a provider's free-text
 * `message` never reaches app state or a progress/failure label.
 */
export function normaliseVideoJobStatus(input: unknown): VideoJobStatus | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const status: VideoJobStatus = {};
  if (typeof value.jobId === 'string') status.jobId = value.jobId;
  if (typeof value.state === 'string') status.state = value.state;
  if (typeof value.progress === 'number' && Number.isFinite(value.progress)) {
    status.progress = value.progress;
  }
  if (value.blob !== undefined && value.blob !== null) status.blob = value.blob;
  if (typeof value.error === 'string') status.error = value.error;
  if (typeof value.failureCode === 'string') status.failureCode = value.failureCode;
  return Object.keys(status).length ? status : null;
}

/**
 * The upload endpoint can answer 409 `already_exists` with a BlobRef for the
 * previously processed file. That blob is as authoritative as a completed job;
 * a jobId alone is not, so nothing is inferred from it.
 */
export function videoStatusFromUpload(body: unknown): VideoJobStatus | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const nested = record.jobStatus;
  const candidate =
    nested && typeof nested === 'object' ? (nested as Record<string, unknown>) : record;
  const status = normaliseVideoJobStatus(candidate);
  if (!status) return null;
  const code = status.error ?? (typeof record.error === 'string' ? record.error : '');

  if (code === 'already_exists') {
    const blob = status.blob ?? (record.blob !== undefined ? record.blob : undefined);
    if (blob === undefined || blob === null) return null;
    return {
      ...(status.jobId ? { jobId: status.jobId } : {}),
      state: 'JOB_STATE_COMPLETED',
      blob,
    };
  }
  if (status.jobId && status.state) return status;
  return null;
}

export function videoJobDone(status: VideoJobStatus | null | undefined): boolean {
  return status?.state === 'JOB_STATE_COMPLETED' && !!status.blob;
}

export function videoJobFailed(status: VideoJobStatus | null | undefined): boolean {
  return status?.state === 'JOB_STATE_FAILED';
}

/** Honest progress copy: only a completed job with a blob is called ready. */
export function describeVideoJob(status: VideoJobStatus | null | undefined): string {
  if (!status) return 'Starting upload…';
  const state = status.state || '';
  if (videoJobDone(status)) return 'Ready to post';
  if (videoJobFailed(status)) return videoJobFailureCopy();
  if (state === 'JOB_STATE_ENCODING') {
    const percent = Math.round((status.progress || 0) * 100);
    return percent > 0 && percent < 100 ? `Encoding… ${percent}%` : 'Encoding…';
  }
  const labels: Record<string, string> = {
    JOB_STATE_CREATED: 'Uploading…',
    JOB_STATE_SCANNING: 'Checking the file…',
    JOB_STATE_SCANNED: 'File checked',
    JOB_STATE_UPLOADING: 'Uploading…',
    JOB_STATE_UPLOADED: 'Uploaded, waiting for processing…',
  };
  return labels[state] || 'Processing…';
}
