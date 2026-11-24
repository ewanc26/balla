/**
 * Public, token-free reachability check for the configured places provider
 * (#156, partial). It performs one typed search with a fixed word and never
 * sends a device position. The response body is parsed only after a successful
 * status; provider error prose is never read, logged or displayed.
 */

import {
  PLACES_SEARCH_CANARY,
  parsePlacesSearch,
  placesSearchBody,
  placesSearchUrl,
} from './placesModel.ts';
import { serviceStatusDetail, type ServiceProbe } from './servicesProbe.ts';

export type PlacesProbeDeps = { fetchImpl?: typeof fetch };

export async function probePlaces(
  endpoint: string,
  deps: PlacesProbeDeps = {},
): Promise<ServiceProbe> {
  const url = placesSearchUrl(endpoint, PLACES_SEARCH_CANARY);
  if (!url) {
    return {
      state: 'invalid',
      status: null,
      latencyMs: null,
      endpoint: null,
      detail: 'Enter an https host without a path.',
    };
  }
  const started = Date.now();
  let response: Response | null = null;
  try {
    response = await (deps.fetchImpl ?? fetch)(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: placesSearchBody(PLACES_SEARCH_CANARY),
    });
  } catch {
    // No response: report unreachable without reading any provider text.
  }
  const latencyMs = Date.now() - started;
  if (!response) {
    return {
      state: 'unavailable',
      status: null,
      latencyMs,
      endpoint,
      detail: 'Could not reach this places provider.',
    };
  }
  if (!response.ok) {
    return {
      state: 'unavailable',
      status: response.status,
      latencyMs,
      endpoint,
      detail: serviceStatusDetail(response.status),
    };
  }
  try {
    const hits = parsePlacesSearch(await response.json());
    return hits.length
      ? {
          state: 'ok',
          status: response.status,
          latencyMs,
          endpoint,
          detail: `Typed search returned ${hits.length} structured place results. No position was sent.`,
        }
      : {
          state: 'unavailable',
          status: response.status,
          latencyMs,
          endpoint,
          detail: 'Response had no usable place results.',
        };
  } catch {
    return {
      state: 'unavailable',
      status: response.status,
      latencyMs,
      endpoint,
      detail: 'Response was not JSON.',
    };
  }
}
