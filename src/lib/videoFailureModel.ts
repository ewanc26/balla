/**
 * Fixed failure copy for the video service (#102, partial).
 *
 * A provider's free-text `message` is never read, logged, stored or displayed.
 * Only an HTTP status and the structured `error`/`blob` fields are consulted;
 * every unfamiliar answer falls back to one of Balla's own sentences.
 */

export const VIDEO_JOB_FAILURE = 'The video service could not process this file.';

export function videoUploadErrorCopy(
  body: unknown,
  status: number,
  fallback: string,
): string {
  const value = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const code = typeof value.error === 'string' ? value.error.trim().toLowerCase() : '';

  if (status === 409 && code === 'already_exists') {
    return value.blob
      ? 'This video was uploaded before. Balla is using its existing result.'
      : 'The video service saw this video before but did not return its result, so it cannot be reused.';
  }
  if (code === 'unconfirmed_email') {
    return 'The video service needs a verified email address before this account can upload video.';
  }
  if ((status === 401 || status === 403) && /scope/.test(code)) {
    return 'This sign-in does not allow video uploads. Sign out and back in to grant the video permission.';
  }
  return fallback;
}

export function videoJobFailureCopy(): string {
  return VIDEO_JOB_FAILURE;
}
