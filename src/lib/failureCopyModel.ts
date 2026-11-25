/**
 * Fixed copy for failures that originate outside Balla.
 *
 * Third-party response text is never read, logged, stored or shown. This module
 * looks only at local library cancellation results and structured signals
 * (HTTP status, registered error codes). Anything else gets Balla's own
 * fallback sentence, so an unfamiliar provider cannot write Balla's UI.
 */

export const SIGN_IN_FALLBACK = 'Could not sign in. Check the handle and try again.';
export const LABELER_FALLBACK = 'Could not add that labeler. Try again.';

const CANCELLATION_RESULTS = ['cancel', 'dismiss', 'locked'] as const;

/** The Expo OAuth client throws a fixed local error for these three results. */
export function isExpoOAuthCancellation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return CANCELLATION_RESULTS.some(
    (result) => err.message === `Authentication cancelled: ${result}`,
  );
}

function fields(err: unknown): Record<string, unknown> | null {
  if (!err || typeof err !== 'object') return null;
  return err as Record<string, unknown>;
}

/** Structured HTTP status only; error prose is never inspected. */
export function statusCode(err: unknown): number | null {
  const value = fields(err);
  const candidate = value?.status ?? value?.statusCode;
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
}

/** Structured error code only; error prose is never inspected. */
export function errorCode(err: unknown): string | null {
  const value = fields(err);
  for (const key of ['code', 'error', 'failureCode', 'name']) {
    const candidate = value?.[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim().toLowerCase();
    }
  }
  return null;
}

/** True for the structured signals that mean a session must be renewed. */
export function isAuthFailure(err: unknown): boolean {
  const status = statusCode(err);
  const code = errorCode(err) ?? '';
  return (
    status === 401 ||
    status === 403 ||
    /auth|permission|scope|unauthori[sz]ed|forbidden/.test(code)
  );
}

/** Classify from structured fields only; never inspect or echo error prose. */
export function structuredFailureCopy(err: unknown, fallback: string): string {
  const status = statusCode(err);
  const code = errorCode(err) ?? '';
  if (status === 429 || /rate.?limit|too_?many_?requests/.test(code)) {
    return 'The service is limiting requests. Wait a moment and try again.';
  }
  if (status === 1 || /network|offline|abort|timeout|timed_out/.test(code)) {
    return 'Could not reach the service. Check your connection and try again.';
  }
  if (
    status === 401 ||
    status === 403 ||
    /auth|permission|scope|unauthori[sz]ed|forbidden/.test(code)
  ) {
    return 'Your session needs renewing. Sign out, sign in again, then retry.';
  }
  if ((status !== null && status >= 500) || /server|unavailable|bad_gateway/.test(code)) {
    return 'The service is having trouble. Try again shortly.';
  }
  return fallback;
}

/** A cancelled sign-in is not a failure; null means show no error. */
export function signInFailureCopy(err: unknown): string | null {
  if (isExpoOAuthCancellation(err)) return null;
  return structuredFailureCopy(err, SIGN_IN_FALLBACK);
}

export const LABELER_COPY = {
  default_subscribed: 'The moderation service is already subscribed.',
  already_subscribed: 'That labeler is already subscribed.',
  unreachable: 'Could not verify that DID as a reachable labeler.',
} as const;

export type LabelerErrorCode = keyof typeof LABELER_COPY;

/** Balla-authored input errors carry a code, never free text. */
export function labelerInputError(code: LabelerErrorCode): { code: LabelerErrorCode } {
  return { code };
}

export function labelerFailureCopy(err: unknown): string {
  const code = errorCode(err);
  if (code && code in LABELER_COPY) {
    return LABELER_COPY[code as LabelerErrorCode];
  }
  return structuredFailureCopy(err, LABELER_FALLBACK);
}
