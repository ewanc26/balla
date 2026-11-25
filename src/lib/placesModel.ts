/**
 * Places provider facts and pure parsing (#156, partial).
 *
 * The only request Balla makes is a typed search: the user's text goes in the
 * POST body, with no latitude or longitude in the URL or body. Nearby
 * suggestions would need the device's position, so they are deliberately not
 * implemented. Response coordinates are parsed away here, so no position from
 * the answer reaches app state either.
 *
 * The check-in record in eurosky-places is still a draft and its NSID can
 * change, so this slice writes no repository record and renders no place chip.
 */

import { normaliseHostUrl } from './hostingModel.ts';

export const DEFAULT_PLACES_ENDPOINT = 'https://places.eurosky.tech';
export const PLACES_SEARCH_PATH = '/v1/search';
export const PLACES_SEARCH_CANARY = 'Berlin';
export const PLACES_SEARCH_LIMIT = 10;
const MAX_QUERY_LENGTH = 100;

export type PlaceHit = {
  kind: 'place' | 'area';
  origin: string | null;
  name: string;
  category: string | null;
  group: string | null;
  subtype: string | null;
  cityState: boolean;
  country: string | null;
};

/** Only an https origin is accepted; a path would change the public contract. */
export function normalisePlacesEndpoint(value: unknown): string | null {
  return typeof value === 'string' ? normaliseHostUrl(value) : null;
}

/** The query travels in the POST body, so the URL never carries a position. */
export function placesSearchUrl(endpoint: string, query: string): string | null {
  if (!normalisePlacesEndpoint(endpoint)) return null;
  if (typeof query !== 'string' || !query.trim()) return null;
  return `${normalisePlacesEndpoint(endpoint)}${PLACES_SEARCH_PATH}`;
}

export function placesSearchBody(query: string, limit: number = PLACES_SEARCH_LIMIT): string {
  const bounded = Math.min(Math.max(Math.trunc(limit) || PLACES_SEARCH_LIMIT, 1), 30);
  return JSON.stringify({ q: query.trim().slice(0, MAX_QUERY_LENGTH), limit: bounded });
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function urn(value: unknown): string | null {
  return typeof value === 'string' && /^urn:atgeo:[a-z0-9.-]+:[a-z0-9.-]+:.+$/i.test(value)
    ? value
    : null;
}

/** Keep only structured display fields; drop coordinates and check-in counts. */
export function parsePlacesSearch(payload: unknown): PlaceHit[] {
  if (!payload || typeof payload !== 'object') return [];
  const results = (payload as Record<string, unknown>).results;
  if (!Array.isArray(results)) return [];
  const hits: PlaceHit[] = [];
  for (const item of results.slice(0, PLACES_SEARCH_LIMIT)) {
    if (!item || typeof item !== 'object') continue;
    const value = item as Record<string, unknown>;
    const name = text(value.name);
    const kind = value.kind === 'place' || value.kind === 'area' ? value.kind : null;
    if (!name || !kind) continue;
    hits.push({
      kind,
      origin: urn(value.origin),
      name,
      category: text(value.category),
      group: text(value.group),
      subtype: text(value.subtype),
      cityState: value.cityState === true,
      country: text(value.country),
    });
  }
  return hits;
}

export type PlaceSelection = { start: number; end: number };

/** A place name is ordinary text: no URN, coordinate or check-in count travels. */
export function normalisePlaceName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH);
  return name || null;
}

/** Insert a picked name at the cursor, keeping surrounding punctuation intact. */
export function insertPlaceName(
  value: string,
  selection: PlaceSelection,
  name: unknown
): { text: string; cursor: number } {
  const cleaned = normalisePlaceName(name);
  if (!cleaned) return { text: value, cursor: selection.end };
  const start = Math.max(0, Math.min(selection.start, value.length));
  const end = Math.max(start, Math.min(selection.end, value.length));
  const before = value.slice(0, start);
  const after = value.slice(end);
  // Keep a picked name legible whether it lands after punctuation or mid-word.
  // A name inserted at the end leaves one space so the person can keep typing;
  // the caret stays after the name itself, before that trailing space.
  const leading = before && !/\s$/.test(before) ? ' ' : '';
  const trailing = !after || !/^[\s.,;:!?)\]}]/.test(after) ? ' ' : '';
  return {
    text: `${before}${leading}${cleaned}${trailing}${after}`,
    cursor: before.length + leading.length + cleaned.length,
  };
}
