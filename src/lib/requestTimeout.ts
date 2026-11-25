/**
 * Bounded deadline for token-free public provider reads (#156, partial).
 *
 * A provider that accepts a request but never answers must not leave an
 * indefinite spinner. The clock and abort signal are injectable, so
 * deterministic tests never wait in real time. Provider prose is never read,
 * logged or displayed: a timeout is reported only in Balla's own words.
 */

export const DEFAULT_TIMEOUT_MS = 12_000;
/** Kept as the places-facing name for the one shared deadline. */
export const PLACES_TIMEOUT_MS = DEFAULT_TIMEOUT_MS;
export const PLACES_TIMEOUT_DETAIL = 'The places provider did not answer in time.';
/** Fixed copy for the other public service checks in Advanced. */
export const SERVICE_TIMEOUT_DETAIL = 'The service did not answer in time.';

export type TimeoutDeps = {
  timeoutMs?: number;
  setTimeoutImpl?: (fn: () => void, ms: number) => unknown;
  clearTimeoutImpl?: (handle: unknown) => void;
};

export type DeadlineResult<T> =
  | { state: 'value'; value: T }
  | { state: 'timeout' };

/**
 * Race one public read against a fixed deadline. The work receives an abort
 * signal so a real fetch is cancelled rather than left running. Work is
 * expected to resolve with its own fail-closed result rather than reject.
 */
export async function withDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  deps: TimeoutDeps = {},
): Promise<DeadlineResult<T>> {
  const ms = Math.max(1, Math.min(Math.trunc(deps.timeoutMs ?? DEFAULT_TIMEOUT_MS), 60_000));
  const controller = new AbortController();
  const setTimer = deps.setTimeoutImpl ?? ((fn: () => void, delay: number) => setTimeout(fn, delay));
  const clearTimer = deps.clearTimeoutImpl ??
    ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let handle: unknown;
  const deadline = new Promise<{ state: 'timeout' }>((resolve) => {
    handle = setTimer(() => {
      controller.abort();
      resolve({ state: 'timeout' });
    }, ms);
  });
  try {
    return await Promise.race([
      work(controller.signal).then((value) => ({ state: 'value' as const, value })),
      deadline,
    ]);
  } finally {
    clearTimer(handle);
  }
}
