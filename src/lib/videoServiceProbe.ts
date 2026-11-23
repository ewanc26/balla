/**
 * Read-only quota discovery for the video side-car named in this app's OAuth
 * grant. The endpoint and audience are grant-time facts, not editable settings:
 * an override would need a new authorisation and would be an inert control.
 *
 * Only the published `app.bsky.video.getUploadLimits` fields are classified.
 * Provider message text is never read, stored or displayed; a failure is
 * described by HTTP status and the structured response shape alone.
 */

import { formatBytes } from './imageBytes.ts';
import { SERVICE_HOSTS, VIDEO_LIMITS_LXM } from './serviceHosts.ts';
import { serviceStatusDetail } from './servicesProbe.ts';

export { VIDEO_LIMITS_LXM };

export const VIDEO_SERVICE_ENDPOINT = SERVICE_HOSTS.videoService;
export const VIDEO_SERVICE_DID = SERVICE_HOSTS.videoAudience;

export type VideoQuota = {
  canUpload: boolean;
  remainingDailyVideos: number | null;
  remainingDailyBytes: number | null;
};

export type VideoQuotaState = 'idle' | 'checking' | 'ok' | 'blocked' | 'unavailable';

export type VideoQuotaProbe = {
  state: VideoQuotaState;
  status: number | null;
  quota: VideoQuota | null;
  detail: string;
};

export type VideoQuotaDeps = {
  serviceToken: (aud: string, lxm: string) => Promise<string>;
  fetchImpl?: typeof fetch;
};

function probe(
  state: VideoQuotaState,
  status: number | null,
  quota: VideoQuota | null,
  detail: string
): VideoQuotaProbe {
  return { state, status, quota, detail };
}

export function idleVideoQuota(): VideoQuotaProbe {
  return probe('idle', null, null, 'Quota has not been checked yet.');
}

export function checkingVideoQuota(): VideoQuotaProbe {
  return probe('checking', null, null, 'Reading the video service quota…');
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

/** Only fields defined by the published lexicon survive normalisation. */
export function normaliseVideoQuota(payload: unknown): VideoQuota | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  if (typeof value.canUpload !== 'boolean') return null;
  return {
    canUpload: value.canUpload,
    remainingDailyVideos: count(value.remainingDailyVideos),
    remainingDailyBytes: count(value.remainingDailyBytes),
  };
}

/** Honest UI copy: no quota is claimed until the service answers. */
export function videoQuotaText(value: VideoQuotaProbe): string {
  if (value.state === 'idle') return 'Video service quota: not checked yet.';
  if (value.state === 'checking') return 'Video service quota: checking…';
  if (value.state === 'unavailable') return `Video service quota: ${value.detail}`;
  if (value.state === 'blocked') return 'Video service quota: uploads are not allowed for this account right now.';
  const quota = value.quota;
  if (!quota) return 'Video service quota: no usable answer.';
  const remaining = [
    quota.remainingDailyVideos === null
      ? null
      : `${quota.remainingDailyVideos} videos left today`,
    quota.remainingDailyBytes === null
      ? null
      : `${formatBytes(quota.remainingDailyBytes)} left today`,
  ].filter((part): part is string => part !== null);
  return remaining.length
    ? `Video service quota: uploads allowed · ${remaining.join(' · ')}`
    : 'Video service quota: uploads allowed · no daily counts published';
}

/**
 * Stops a doomed upload before any bytes are sent. The local MP4/GIF size cap
 * stays in the composer; this is the service's own daily quota.
 */
export function videoQuotaProblem(
  byteSize: number,
  quota: VideoQuota | null
): string | null {
  if (!quota) return null;
  if (!quota.canUpload) {
    return 'This video service is not accepting uploads for this account right now.';
  }
  if (quota.remainingDailyVideos === 0) {
    return 'This video service has no uploads left for today.';
  }
  if (
    quota.remainingDailyBytes !== null &&
    Number.isFinite(byteSize) &&
    byteSize > quota.remainingDailyBytes
  ) {
    return `This file is larger than the ${formatBytes(quota.remainingDailyBytes)} this video service has left today.`;
  }
  return null;
}

/** Mint a short-lived token, query the service, and classify status only. */
export async function probeVideoQuota({
  serviceToken,
  fetchImpl = fetch,
}: VideoQuotaDeps): Promise<VideoQuotaProbe> {
  let token: string;
  try {
    token = await serviceToken(VIDEO_SERVICE_DID, VIDEO_LIMITS_LXM);
  } catch {
    return probe(
      'unavailable',
      null,
      null,
      'Balla could not get a video service token for this sign-in.'
    );
  }
  if (!token) {
    return probe(
      'unavailable',
      null,
      null,
      'Balla could not get a video service token for this sign-in.'
    );
  }

  const url = `${VIDEO_SERVICE_ENDPOINT}/xrpc/${VIDEO_LIMITS_LXM}`;
  let response: Response | null = null;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    });
  } catch {
    return probe(
      'unavailable',
      null,
      null,
      'The video service could not be reached from this device.'
    );
  }
  if (!response.ok) {
    return probe('unavailable', response.status, null, serviceStatusDetail(response.status));
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return probe('unavailable', response.status, null, 'The quota response was not JSON.');
  }
  const quota = normaliseVideoQuota(payload);
  if (!quota) {
    return probe('unavailable', response.status, null, 'The quota response had no usable canUpload flag.');
  }
  if (!quota.canUpload) {
    return probe('blocked', response.status, quota, 'Uploads are not allowed for this account right now.');
  }
  return probe('ok', response.status, quota, 'Quota read from the video service.');
}
