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
import { SERVICE_HOSTS } from './serviceHosts.ts';

/** Derive the public provider default from the one host table (#97). */
export const DEFAULT_PLACES_ENDPOINT = SERVICE_HOSTS.places;
export const PLACES_SEARCH_PATH = '/v1/search';
export const PLACES_SEARCH_CANARY = 'Berlin';
export const PLACES_SEARCH_LIMIT = 10;
const MAX_QUERY_LENGTH = 100;

/** The four match kinds published by the typed-search endpoint. */
export const PLACE_MATCH_KINDS = ['start', 'word', 'other_name', 'approximate'] as const;
export type PlaceMatch = (typeof PLACE_MATCH_KINDS)[number];

export type PlaceHit = {
  kind: 'place' | 'area';
  origin: string | null;
  name: string;
  category: string | null;
  group: string | null;
  subtype: string | null;
  cityState: boolean;
  country: string | null;
  match: PlaceMatch | null;
  matched: string | null;
};

/** Only an https origin is accepted; a path would change the public contract. */
export function normalisePlacesEndpoint(value: unknown): string | null {
  return typeof value === 'string' ? normaliseHostUrl(value) : null;
}

/**
 * One fail-closed label for the configured places host, shared by the composer
 * sheet and Advanced → Services. An unsupported saved value is described in
 * Balla's words; the raw value is never rendered on either surface.
 */
export function placesHostLabel(endpoint: string, enabled: boolean): string {
  const host = normalisePlacesEndpoint(endpoint);
  if (!host) return 'Places host needs an https address';
  return enabled ? `Places host: ${host}` : `Configured places host (off): ${host}`;
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

/** The one ATGeo origin check, shared by result parsing and record links. */
export function atgeoUrn(value: unknown): string | null {
  // A URN carries no whitespace; a trailing phrase is not part of an ID.
  return typeof value === 'string' && /^urn:atgeo:[a-z0-9.-]+:[a-z0-9.-]+:[^\s]+$/i.test(value)
    ? value
    : null;
}

/** Only a published match kind is accepted; an unknown value stays null. */
function matchKind(value: unknown): PlaceMatch | null {
  return typeof value === 'string' && (PLACE_MATCH_KINDS as readonly string[]).includes(value)
    ? (value as PlaceMatch)
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
      origin: atgeoUrn(value.origin),
      name,
      category: text(value.category),
      group: text(value.group),
      subtype: text(value.subtype),
      cityState: value.cityState === true,
      country: text(value.country),
      match: matchKind(value.match),
      matched: text(value.matched)?.slice(0, MAX_QUERY_LENGTH) ?? null,
    });
  }
  return hits;
}

/**
 * One fixed, honest secondary line for a result. Area labels follow the
 * provider's published city-state rule, so a city filed as a region is still
 * called a city. A name found through another name says which one matched, so
 * two similar results can be told apart. No rank, rating, distance or check-in
 * count is shown.
 */
export function placeResultDetail(hit: PlaceHit): string {
  const label =
    hit.kind === 'area'
      ? hit.cityState
        ? 'City'
        : hit.subtype ?? 'Area'
      : hit.category ?? hit.group ?? 'Place';
  const parts = [label];
  if (hit.matched && hit.matched !== hit.name) {
    parts.push(`Matched: ${hit.matched}`);
  } else if (hit.match === 'approximate') {
    parts.push('Approximate match');
  } else if (hit.match === 'other_name' && !hit.matched) {
    parts.push('Other name');
  }
  if (hit.country) parts.push(hit.country);
  return parts.join(' · ');
}

export type PlaceDetailField = { label: string; value: string };

const PLACE_MATCH_LABELS: Record<PlaceMatch, string> = {
  start: 'Start of name',
  word: 'Word in name',
  other_name: 'Other name',
  approximate: 'Approximate match',
};

/**
 * The detail sheet shows only structured fields the provider published. A
 * missing or malformed field is absent rather than guessed; coordinates and
 * check-in counts were discarded by parsePlacesSearch and never reach here.
 */
export function placeDetailFields(hit: PlaceHit): PlaceDetailField[] {
  const fields: PlaceDetailField[] = [
    { label: 'Type', value: hit.kind === 'area' ? 'Area' : 'Place' },
  ];
  if (hit.category) fields.push({ label: 'Category', value: hit.category });
  if (hit.group) fields.push({ label: 'Group', value: hit.group });
  if (hit.subtype) fields.push({ label: 'Subtype', value: hit.subtype });
  if (hit.kind === 'area' && hit.cityState) {
    fields.push({ label: 'Provider class', value: 'City' });
  }
  if (hit.country) fields.push({ label: 'Country', value: hit.country });
  if (hit.matched && hit.matched !== hit.name) {
    fields.push({ label: 'Matched name', value: hit.matched });
  }
  const matchLabel = hit.match ? PLACE_MATCH_LABELS[hit.match] : null;
  if (matchLabel) fields.push({ label: 'Match', value: matchLabel });
  const urn = atgeoUrn(hit.origin);
  if (urn) fields.push({ label: 'Place ID', value: urn });
  return fields;
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
