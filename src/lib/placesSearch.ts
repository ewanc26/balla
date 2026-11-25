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

export type PlacesSearchState = 'ready' | 'invalid' | 'unavailable' | 'off';

export type PlacesSearchResult = {
  state: PlacesSearchState;
  status: number | null;
  hits: PlaceHit[];
};

export type PlacesSearchDeps = { fetchImpl?: typeof fetch; enabled?: boolean };

export async function searchPlaces(
  query: string,
  endpoint: string,
  deps: PlacesSearchDeps = {},
): Promise<PlacesSearchResult> {
  if (deps.enabled === false) return { state: 'off', status: null, hits: [] };
  const url = placesSearchUrl(endpoint, query);
  if (!url) return { state: 'invalid', status: null, hits: [] };

  let response: Response | null = null;
  try {
    response = await (deps.fetchImpl ?? fetch)(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: placesSearchBody(query),
    });
  } catch {
    // No response: report unreachable without reading any provider text.
  }
  if (!response) return { state: 'unavailable', status: null, hits: [] };
  if (!response.ok) {
    return { state: 'unavailable', status: response.status, hits: [] };
  }
  try {
    return {
      state: 'ready',
      status: response.status,
      hits: parsePlacesSearch(await response.json()),
    };
  } catch {
    return { state: 'unavailable', status: response.status, hits: [] };
  }
}

/** Fixed, provider-neutral copy so a failed service cannot write Balla's UI. */
export function placesSearchCopy(state: PlacesSearchState): string {
  if (state === 'off') {
    return 'Places search is off. Turn it on in Advanced → Services, or use the name you typed as plain text.';
  }
  if (state === 'invalid') {
    return 'Enter an https provider without a path in Advanced → Services.';
  }
  return 'Place search is unavailable. You can still add the name you typed as plain text.';
}
