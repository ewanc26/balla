/**
 * User-initiated typed place search for the composer (#156, partial).
 *
 * The query is sent only after the person presses Search, and the request body
 * carries `q` and `limit` alone: no device position, no nearby lookup. Provider
 * error prose is never read, logged or displayed; failures are reported with
 * Balla's own words and the picker can still insert the typed name as text.
 */

import {
  parsePlacesSearch,
  placesSearchBody,
  placesSearchUrl,
  type PlaceHit,
} from './placesModel.ts';
import { PLACES_TIMEOUT_DETAIL, withDeadline, type TimeoutDeps } from './requestTimeout.ts';

export type PlacesSearchState = 'ready' | 'invalid' | 'unavailable' | 'off' | 'timeout';

export type PlacesSearchResult = {
  state: PlacesSearchState;
  status: number | null;
  hits: PlaceHit[];
};

export type PlacesSearchDeps = {
  fetchImpl?: typeof fetch;
  enabled?: boolean;
} & TimeoutDeps;

export async function searchPlaces(
  query: string,
  endpoint: string,
  deps: PlacesSearchDeps = {},
): Promise<PlacesSearchResult> {
  if (deps.enabled === false) return { state: 'off', status: null, hits: [] };
  const url = placesSearchUrl(endpoint, query);
  if (!url) return { state: 'invalid', status: null, hits: [] };

  // One bounded read: a provider that never answers cannot hold the picker in
  // a permanent spinner. The signal cancels a real fetch on timeout; no
  // provider text is read on any path.
  const outcome = await withDeadline(async (signal) => {
    let response: Response | null = null;
    try {
      response = await (deps.fetchImpl ?? fetch)(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: placesSearchBody(query),
        signal,
      });
    } catch {
      // No response: report unreachable without reading any provider text.
    }
    if (!response) return { state: 'unavailable' as const, status: null, hits: [] };
    if (!response.ok) {
      return { state: 'unavailable' as const, status: response.status, hits: [] };
    }
    try {
      return {
        state: 'ready' as const,
        status: response.status,
        hits: parsePlacesSearch(await response.json()),
      };
    } catch {
      return { state: 'unavailable' as const, status: response.status, hits: [] };
    }
  }, deps);

  if (outcome.state === 'timeout') return { state: 'timeout', status: null, hits: [] };
  return outcome.value;
}

/** Fixed, provider-neutral copy so a failed service cannot write Balla's UI. */
export function placesSearchCopy(state: PlacesSearchState): string {
  if (state === 'off') {
    return 'Places search is off. Turn it on in Advanced → Services, or use the name you typed as plain text.';
  }
  if (state === 'invalid') {
    return 'Enter an https provider without a path in Advanced → Services.';
  }
  if (state === 'timeout') {
    return `${PLACES_TIMEOUT_DETAIL} You can still add the name you typed as plain text.`;
  }
  return 'Place search is unavailable. You can still add the name you typed as plain text.';
}
