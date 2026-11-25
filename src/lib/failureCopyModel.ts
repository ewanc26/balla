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

/**
 * Exact structured-code checks. Codes are protocol fields, not prose: a code
 * must be on Balla's allowlist before it can change copy or control flow.
 */
export function hasErrorCode(err: unknown, codes: readonly string[]): boolean {
  const code = errorCode(err);
  return code !== null && codes.some((allowed) => allowed.toLowerCase() === code);
}

export const RATE_LIMIT_ERROR_CODES = [
  'ratelimitexceeded',
  'ratelimited',
  'rate_limited',
  'toomanyrequests',
  'too_many_requests',
] as const;

export const OFFLINE_ERROR_CODES = [
  'networkerror',
  'networkrequestfailed',
  'fetchfailed',
  'connectionerror',
  'offline',
  'abort',
  'aborterror',
  'timeout',
  'timedout',
  'timed_out',
] as const;

export const AUTH_ERROR_CODES = [
  'authenticationrequired',
  'authrequired',
  'authorizationrequired',
  'unauthorized',
  'unauthorised',
  'forbidden',
  'insufficientscope',
  'permissiondenied',
  'invalidtoken',
  'expiredtoken',
  'tokenexpired',
  'sessionexpired',
  'oauthauthorizationrequired',
] as const;

export const SERVER_ERROR_CODES = [
  'internalservererror',
  'serviceunavailable',
  'badgateway',
  'bad_gateway',
  'upstreamfailure',
  'upstreamtimeout',
  'servererror',
] as const;

export const RECORD_NOT_FOUND_ERROR_CODES = ['recordnotfound', 'notfound'] as const;
export const INVALID_SWAP_ERROR_CODES = ['invalidswap'] as const;

export type StructuredFailureKind =
  | 'rate-limited'
  | 'offline'
  | 'auth-expired'
  | 'server'
  | 'unknown';

/** True for the structured signals that mean a session must be renewed. */
export function isAuthFailure(err: unknown): boolean {
  const status = statusCode(err);
  return (
    status === 401 ||
    status === 403 ||
    hasErrorCode(err, AUTH_ERROR_CODES)
  );
}

/**
 * A missing record is inferred only from an explicit structured code beside a
 * record-status. A free-text message is never used, so an unfamiliar provider
 * cannot make a real failure look like a successful deletion.
 */
export function isRecordNotFoundError(err: unknown): boolean {
  const status = statusCode(err);
  return (
    (status === 400 || status === 404) &&
    hasErrorCode(err, RECORD_NOT_FOUND_ERROR_CODES)
  );
}

/** The published repo-write compare-and-swap error, matched exactly. */
export function isInvalidSwapError(err: unknown): boolean {
  return hasErrorCode(err, INVALID_SWAP_ERROR_CODES);
}

/** Classify from structured fields only; never inspect or echo error prose. */
export function classifyStructuredFailure(err: unknown): StructuredFailureKind {
  const status = statusCode(err);
  if (status === 429 || hasErrorCode(err, RATE_LIMIT_ERROR_CODES)) return 'rate-limited';
  if (status === 1 || hasErrorCode(err, OFFLINE_ERROR_CODES)) return 'offline';
  if (isAuthFailure(err)) return 'auth-expired';
  if (
    (status !== null && status >= 500) ||
    hasErrorCode(err, SERVER_ERROR_CODES)
  ) {
    return 'server';
  }
  return 'unknown';
}

/** Classify from structured fields only; never inspect or echo error prose. */
export function structuredFailureCopy(err: unknown, fallback: string): string {
  switch (classifyStructuredFailure(err)) {
    case 'rate-limited':
      return 'The service is limiting requests. Wait a moment and try again.';
    case 'offline':
      return 'Could not reach the service. Check your connection and try again.';
    case 'auth-expired':
      return 'Your session needs renewing. Sign out, sign in again, then retry.';
    case 'server':
      return 'The service is having trouble. Try again shortly.';
    default:
      return fallback;
  }
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
