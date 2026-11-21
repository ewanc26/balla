// Shared failure handling for idempotent reads and optimistic mutations.
//
// Reads may be retried with bounded backoff; writes are never repeated here.
// Everything that reaches the UI is described in plain language so a failure
// is never mistaken for success.

export type FailureKind =
  | 'rate-limited'
  | 'offline'
  | 'auth-expired'
  | 'server'
  | 'unknown';

export const MAX_READ_ATTEMPTS = 3;
export const BASE_BACKOFF_MS = 500;
export const MAX_BACKOFF_MS = 8000;
const MAX_ADVERTISED_WAIT_MS = 60000;

export const RETRYABLE_READ_KINDS: readonly FailureKind[] = [
  'rate-limited',
  'offline',
  'server',
];

type HeadersLike = {
  get?: (name: string) => unknown;
  forEach?: (callback: (value: unknown, key: string) => void) => void;
  [key: string]: unknown;
};

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message || '');
  }
  return '';
}

function statusOf(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const candidate =
    (err as { status?: unknown }).status ?? (err as { statusCode?: unknown }).statusCode;
  return typeof candidate === 'number' && Number.isFinite(candidate)
    ? candidate
    : null;
}

function headerOf(err: unknown, name: string): string | null {
  if (!err || typeof err !== 'object') return null;
  const headers = (err as { headers?: unknown }).headers as HeadersLike | undefined;
  if (!headers) return null;
  if (typeof headers.get === 'function') {
    // Real Headers are case-insensitive, but XRPC error headers may be plain
    // objects with a case-sensitive get(). Try both spellings.
    const names = [name, name.replace(/\b\w/g, (c) => c.toUpperCase())];
    for (const candidate of names) {
      const value = headers.get(candidate);
      if (value != null) return String(value);
    }
    return null;
  }
  if (typeof headers.forEach === 'function') {
    let found: string | null = null;
    headers.forEach((value, key) => {
      if (found === null && String(key).toLowerCase() === name) {
        found = value == null ? null : String(value);
      }
    });
    return found;
  }
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name) return value == null ? null : String(value);
  }
  return null;
}

export function retryAfterMsFrom(err: unknown, now = Date.now()): number | null {
  const value = headerOf(err, 'retry-after');
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_ADVERTISED_WAIT_MS);
  }
  const at = Date.parse(value);
  if (!Number.isNaN(at)) {
    return Math.max(0, Math.min(at - now, MAX_ADVERTISED_WAIT_MS));
  }
  return null;
}

export function classifyFailure(err: unknown): FailureKind {
  const status = statusOf(err);
  if (status === 429) return 'rate-limited';
  // @atproto/xrpc uses status 1 for a network failure that never got a reply.
  if (status === 1) return 'offline';
  if (status === 401 || status === 403) return 'auth-expired';
  if (status !== null && status >= 500) return 'server';

  const message = messageOf(err).toLowerCase();
  if (/rate.?limit|too many requests|\b429\b/.test(message)) return 'rate-limited';
  if (
    /offline|network|fetch failed|failed to fetch|connection|timed? ?out|econn|enotfound|abort/.test(
      message
    )
  ) {
    return 'offline';
  }
  if (
    /\b(scope|permission|unauthori[sz]ed|forbidden|authentication|authorization|expired|token)\b/.test(
      message
    )
  ) {
    return 'auth-expired';
  }
  if (
    /server error|unavailable|bad gateway|upstream|\b500\b|\b502\b|\b503\b|\b504\b/.test(
      message
    )
  ) {
    return 'server';
  }
  return 'unknown';
}

function waitSeconds(retryAfterMs: number | null): string {
  if (retryAfterMs === null) return 'Wait a moment and try again.';
  const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
  return `Try again in about ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.`;
}

export function describeFailure(err: unknown, fallback: string): string {
  const kind = classifyFailure(err);
  if (kind === 'rate-limited') {
    return `Bluesky is limiting requests. ${waitSeconds(retryAfterMsFrom(err))}`;
  }
  if (kind === 'offline') {
    return 'Could not reach Bluesky. Check your connection and try again.';
  }
  if (kind === 'auth-expired') {
    return 'Your session needs renewing. Sign out, sign in again, then retry.';
  }
  if (kind === 'server') {
    return "Bluesky's service is having trouble. Try again shortly.";
  }
  return fallback;
}

// Retries are bounded and only for idempotent reads. Callers pass a pure
// read function; no creation, update or deletion is ever replayed here.
export async function readWithRetry<T>(
  read: () => Promise<T>,
  options: {
    attempts?: number;
    delay?: (ms: number) => Promise<void>;
    shouldRetry?: (kind: FailureKind) => boolean;
  } = {}
): Promise<T> {
  const attempts = Math.max(1, Math.min(options.attempts ?? MAX_READ_ATTEMPTS, 5));
  const delay = options.delay ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const shouldRetry = options.shouldRetry ?? ((kind: FailureKind) =>
    RETRYABLE_READ_KINDS.includes(kind));

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await read();
    } catch (err) {
      if (attempt >= attempts || !shouldRetry(classifyFailure(err))) throw err;
      const advertised = classifyFailure(err) === 'rate-limited' ? retryAfterMsFrom(err) : null;
      const backoff = Math.min(
        advertised ?? Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS),
        MAX_BACKOFF_MS
      );
      await delay(backoff);
    }
  }
}

// Apply an optimistic change immediately, then restore the exact prior state
// if the request fails. The error is rethrown so the caller can show it.
export async function withOptimisticRollback(
  apply: () => void,
  request: () => Promise<void>,
  rollback: () => void
): Promise<void> {
  apply();
  try {
    await request();
  } catch (err) {
    rollback();
    throw err;
  }
}
