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

import { readBoundedPublic } from './boundedPublicFetch.ts';
import type { TimeoutDeps } from './requestTimeout.ts';

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
  const result = await readBoundedPublic<unknown>(url, {
    ...deps,
    parse: async (response) => {
      const body = await response.json();
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new Error('Public read returned an invalid body.');
      }
      return body;
    },
  });

  if (result.state === 'timeout') return null;
  if (result.state === 'value') return result.value as Record<string, unknown>;
  if (result.state === 'status') throw statusError(result.status);
  if (result.state === 'invalid') {
    throw new Error('Public read returned an invalid body.');
  }
  // A transport failure gets a fixed error with no classification field, so
  // it stays non-retryable exactly as before. No provider prose is copied.
  throw new Error('Could not reach the public service.');
}
