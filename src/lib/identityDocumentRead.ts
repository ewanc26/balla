/**
 * One bounded, token-free DID document read (#96/#97/#100, partial).
 *
 * A directory or `did:web` host that accepts a request but never completes it
 * must not leave sign-in pre-flight, identity checks or a loading card waiting
 * forever. The read shares the fixed deadline used by the other public probes,
 * passes its abort signal to `fetch`, and keeps only the structured JSON object
 * or null. Provider error prose is never read, logged or displayed.
 */

import { withDeadline, type TimeoutDeps } from './requestTimeout.ts';

export type IdentityDocumentReadDeps = { fetchImpl?: typeof fetch } & TimeoutDeps;

export async function fetchIdentityDocument(
  url: string,
  deps: IdentityDocumentReadDeps = {},
): Promise<unknown | null> {
  if (typeof url !== 'string' || !url) return null;

  const outcome = await withDeadline(async (signal) => {
    try {
      const response = await (deps.fetchImpl ?? fetch)(url, {
        headers: { Accept: 'application/did+ld+json, application/json' },
        signal,
      });
      if (!response.ok) return null;
      const document = await response.json();
      return document && typeof document === 'object' ? document : null;
    } catch {
      return null;
    }
  }, deps);

  // A timeout is an unavailable source, not a copy-worthy event. The caller's
  // own fail-closed fallback (cached document or next source) still applies.
  return outcome.state === 'timeout' ? null : outcome.value;
}
