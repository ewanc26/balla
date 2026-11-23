/**
 * Uploads one composer video through Bluesky's video service and waits for the
 * processing job. Nothing reaches the post composer until the job is COMPLETED
 * and carries a blob, so a failed or abandoned job can never produce a false
 * "posted" state.
 *
 * The AppView does not implement app.bsky.video.uploadVideo; requests go
 * directly to video.bsky.app. getUploadLimits needs a service token with the
 * video service as its audience, while the upload token is scoped to the
 * account's own PDS with the uploadBlob lxm because the video service uploads
 * the finished blob there. getJobStatus is public.
 */

import { AppBskyVideoDefs } from '@atproto/api';
import { agent } from './agent';
import { describeFailure } from './reliability';
import { serviceStatusDetail } from './servicesProbe.ts';
import {
  VIDEO_LIMITS_LXM,
  VIDEO_SERVICE_DID,
  VIDEO_SERVICE_ENDPOINT,
  normaliseVideoQuota,
  videoQuotaProblem,
} from './videoServiceProbe.ts';
import {
  videoJobDone,
  videoJobFailed,
  videoStatusFromUpload,
  type ComposerVideo,
  type VideoJobStatus,
} from './videoModel.ts';
const POLL_MS = 2000;
const MAX_POLLS = 150;
const SERVICE_AUTH_TTL_SECONDS = 30 * 60;

/** Keeps explicit upload failures intact when the composer reports them. */
export class VideoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VideoUploadError';
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException('Upload cancelled', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Upload cancelled', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function serviceUrl(method: string, params?: Record<string, string>): string {
  const url = new URL(`${VIDEO_SERVICE_ENDPOINT}/xrpc/${method}`);
  for (const [key, value] of Object.entries(params || {})) {
    url.searchParams.set(key, value);
  }
  return url.href;
}

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    const error = body && typeof body.error === 'string' ? body.error : '';
    const message = body && typeof body.message === 'string' ? body.message : '';
    if (response.status === 409 && error === 'already_exists') {
      return body?.blob
        ? 'This video was uploaded before. Balla is using its existing result.'
        : 'Bluesky saw this video before but did not return its result, so it cannot be reused.';
    }
    if (error === 'unconfirmed_email' || message.includes('unconfirmed email')) {
      return 'Bluesky needs a verified email address before this account can upload video.';
    }
    const detail = `${error} ${message}`.toLowerCase();
    if (
      (response.status === 401 || response.status === 403) &&
      detail.includes('scope')
    ) {
      return 'This sign-in does not allow video uploads. Sign out and back in to grant the video permission.';
    }
    return message || error || fallback;
  } catch {
    return fallback;
  }
}

async function serviceToken(
  aud: string,
  lxm: string,
  signal: AbortSignal
): Promise<string> {
  const { data } = await agent.com.atproto.server.getServiceAuth(
    {
      aud,
      lxm,
      exp: Math.floor(Date.now() / 1000) + SERVICE_AUTH_TTL_SECONDS,
    },
    { signal }
  );
  return data.token;
}

/** The upload token names the PDS; the upload itself names the account. */
async function accountIdentity(
  signal: AbortSignal
): Promise<{ did: string; pdsDid: string }> {
  const { data } = await agent.com.atproto.server.getSession(undefined, {
    signal,
  });
  const services = Array.isArray(data.didDoc?.service)
    ? (data.didDoc.service as Array<{
        id?: unknown;
        serviceEndpoint?: unknown;
      }>)
    : [];
  const pds = services.find(
    (item) =>
      typeof item.id === 'string' && item.id.endsWith('#atproto_pds')
  );
  if (pds && typeof pds.id === 'string' && pds.id.startsWith('did:')) {
    return { did: data.did, pdsDid: pds.id };
  }
  if (typeof pds?.serviceEndpoint === 'string') {
    try {
      return {
        did: data.did,
        pdsDid: `did:web:${new URL(pds.serviceEndpoint).host}`,
      };
    } catch {
      // Fall through to the explicit failure below.
    }
  }
  throw new VideoUploadError(
    'Balla could not identify your PDS, so the video cannot be uploaded.'
  );
}

function parseJobStatus(body: unknown): VideoJobStatus {
  // The lexicon wraps the status in `jobStatus`; the video service has also
  // returned the status object directly. Accept both without guessing fields.
  const candidate =
    body && typeof body === 'object' && 'jobStatus' in body
      ? (body as { jobStatus: unknown }).jobStatus
      : body;
  const result = AppBskyVideoDefs.validateJobStatus(candidate);
  if (!result.success) {
    throw new VideoUploadError(
      'Bluesky returned a video job status Balla cannot read.'
    );
  }
  return result.value as VideoJobStatus;
}

async function fetchJson(
  url: string,
  init: RequestInit,
  signal: AbortSignal
): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new VideoUploadError(
      describeFailure(
        err,
        'Could not reach Bluesky’s video service. Video upload may not work in this browser.'
      )
    );
  }
}

export async function uploadComposerVideo({
  video,
  signal,
  onStatus,
}: {
  video: ComposerVideo;
  signal: AbortSignal;
  onStatus: (status: VideoJobStatus | null) => void;
}): Promise<{ blob: unknown }> {
  onStatus(null);

  const limitsToken = await serviceToken(VIDEO_SERVICE_DID, VIDEO_LIMITS_LXM, signal);
  const limitsResponse = await fetchJson(
    serviceUrl(VIDEO_LIMITS_LXM),
    { headers: { Authorization: `Bearer ${limitsToken}` } },
    signal
  );
  if (!limitsResponse.ok) {
    throw new VideoUploadError(
      `Bluesky’s video service could not check your quota. ${serviceStatusDetail(limitsResponse.status)}`
    );
  }
  const limits = await limitsResponse.json().catch(() => null);
  const quota = normaliseVideoQuota(limits);
  if (!quota) {
    throw new VideoUploadError(
      'Bluesky’s video service returned no usable canUpload quota.'
    );
  }
  const quotaProblem = videoQuotaProblem(video.byteSize, quota);
  if (quotaProblem) throw new VideoUploadError(quotaProblem);

  const identity = await accountIdentity(signal);
  const uploadToken = await serviceToken(
    identity.pdsDid,
    'com.atproto.repo.uploadBlob',
    signal
  );
  const uploadResponse = await fetchJson(
    serviceUrl('app.bsky.video.uploadVideo', {
      did: identity.did,
      name: `${video.key}.${video.mimeType === 'image/gif' ? 'gif' : 'mp4'}`,
    }),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${uploadToken}`,
        'Content-Type': video.mimeType === 'image/gif' ? 'image/gif' : 'video/mp4',
      },
      // React Native's fetch accepts a byte array; the DOM BodyInit type does
      // not list it explicitly.
      body: video.bytes as unknown as BodyInit,
    },
    signal
  );
  const uploadBody = await uploadResponse.json().catch(() => null);
  // A 409 can still carry the BlobRef of the earlier, completed job. Read the
  // body before deciding the request failed; never guess a job from an error.
  const reused = videoStatusFromUpload(uploadBody);
  if (!uploadResponse.ok && !reused) {
    throw new VideoUploadError(
      await readError(uploadResponse, 'Bluesky could not accept this video.')
    );
  }

  let status: VideoJobStatus;
  if (reused) {
    status = reused;
  } else {
    status = parseJobStatus(uploadBody);
  }
  onStatus(status);

  if (!videoJobDone(status) && !videoJobFailed(status) && !status.jobId) {
    throw new VideoUploadError(
      'Bluesky accepted the file but did not return a job to follow.'
    );
  }

  for (
    let attempt = 0;
    !videoJobDone(status) &&
    !videoJobFailed(status) &&
    attempt < MAX_POLLS;
    attempt += 1
  ) {
    await wait(POLL_MS, signal);
    const response = await fetchJson(
      serviceUrl('app.bsky.video.getJobStatus', { jobId: status.jobId || '' }),
      {},
      signal
    );
    if (!response.ok) {
      throw new VideoUploadError(
        await readError(response, 'Bluesky did not return this video’s progress.')
      );
    }
    status = parseJobStatus(await response.json().catch(() => null));
    onStatus(status);
  }

  if (videoJobFailed(status)) {
    throw new VideoUploadError(
      status.message ||
        status.error ||
        status.failureCode ||
        'Bluesky could not process this video.'
    );
  }
  if (!videoJobDone(status)) {
    throw new VideoUploadError(
      'Video processing is still running. Check back in a moment and try again.'
    );
  }
  return { blob: status.blob };
}
