/**
 * One bounded, token-free JSON object read for public AT Protocol services
 * (#96/#97/#100, partial).
 *
 * Public PDS repository reads for Events, Memories and the offline profile
 * fallback used raw, unbounded `fetch`. A PDS that accepted a connection but
 * never completed it could leave a profile strip, an event card, the On this
 * day card or a loading screen waiting forever. This helper owns the shared
 * deadline, passes its abort signal to `fetch` and keeps only a structured
 * JSON object. DID documents use the same reader with a different Accept type.
 *
 * HTTP status is forwarded as a structured `.status` field, so callers keep the
 * existing `readWithRetry` classification. Network and body failures get fixed
 * Balla-authored errors with no allowlisted code, preserving the previous
 * non-retryable behaviour. Provider message prose is never read, logged,
 * stored or displayed. A timeout returns null so each caller can fail closed
 * without turning one hung host into a retry loop.
 */

import { withDeadline, type TimeoutDeps } from './requestTimeout.ts';

export type PublicJsonReadDeps = {
  fetchImpl?: typeof fetch;
  accept?: string;
} & TimeoutDeps;

function statusError(status: number): Error {
  const error = new Error('Public read failed with an HTTP status.');
  (error as Error & { status?: number }).status = status;
  return error;
}

export async function fetchPublicJsonObject(
  url: string,
  deps: PublicJsonReadDeps = {},
): Promise<Record<string, unknown> | null> {
  if (typeof url !== 'string' || !url) return null;

  const outcome = await withDeadline(async (signal) => {
    let response: Response;
    try {
      response = await (deps.fetchImpl ?? fetch)(url, {
        headers: { Accept: deps.accept ?? 'application/json' },
        signal,
      });
    } catch {
      // No provider text is copied. The fixed error has no classification
      // field, so a network failure stays non-retryable as it was before.
      throw new Error('Could not reach the public service.');
    }

    if (!response.ok) throw statusError(response.status);

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new Error('Public read returned an invalid body.');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('Public read returned an invalid body.');
    }
    return body as Record<string, unknown>;
  }, deps);

  return outcome.state === 'timeout' ? null : outcome.value;
}
