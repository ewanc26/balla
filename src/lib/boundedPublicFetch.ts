/**
 * One bounded, token-free HTTP read for public services (#96/#97/#100, partial).
 *
 * A service that accepts a connection but never completes it must not hold a
 * spinner open. This helper owns the shared deadline, passes its abort signal
 * to `fetch` and reads the body inside the same deadline. The caller supplies
 * the parser, so JSON objects, JSON arrays and image bytes all get the same
 * cancellation behaviour without a second timing rule.
 *
 * Nothing here reads provider prose. A transport failure is `unavailable`, an
 * HTTP error keeps only its numeric `status`, and a parser failure is `invalid`;
 * each caller turns those structured states into its own fixed copy.
 */

import { withDeadline, type TimeoutDeps } from './requestTimeout.ts';

export type BoundedPublicRead<T> =
  | { state: 'value'; value: T; status: number }
  | { state: 'status'; status: number }
  | { state: 'unavailable' }
  | { state: 'invalid' }
  | { state: 'timeout' };

export type BoundedPublicDeps<T> = {
  fetchImpl?: typeof fetch;
  accept?: string;
  parse: (response: Response) => Promise<T>;
} & TimeoutDeps;

export async function readBoundedPublic<T>(
  url: string,
  deps: BoundedPublicDeps<T>,
): Promise<BoundedPublicRead<T>> {
  if (typeof url !== 'string' || !url) return { state: 'unavailable' };

  const outcome = await withDeadline(async (signal) => {
    let response: Response;
    try {
      response = await (deps.fetchImpl ?? fetch)(url, {
        headers: { Accept: deps.accept ?? 'application/json' },
        signal,
      });
    } catch {
      return { state: 'unavailable' as const };
    }
    if (!response.ok) return { state: 'status' as const, status: response.status };
    try {
      const value = await deps.parse(response);
      return { state: 'value' as const, value, status: response.status };
    } catch {
      return { state: 'invalid' as const };
    }
  }, deps);

  return outcome.state === 'timeout' ? { state: 'timeout' } : outcome.value;
}
