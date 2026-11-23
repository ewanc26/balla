/**
 * Framework-free rules for the community calendar records Balla reads and the
 * one RSVP record it can write. The lexicons live outside the app's generated
 * API package, so these readers validate the published JSON shapes directly
 * and never infer fields from a particular server response.
 */
import { TID } from '@atproto/common-web';

export const EVENT_COLLECTION = 'community.lexicon.calendar.event';
export const RSVP_COLLECTION = 'community.lexicon.calendar.rsvp';
export const PROFILE_EVENT_LIMIT = 8;

export type EventLocationKind = 'uri' | 'address' | 'fsq' | 'geo' | 'hthree';

export type EventLocation = {
  kind: EventLocationKind;
  text: string;
  link: string | null;
  linkLabel: string | null;
};

export type EventLink = {
  uri: string;
  text: string;
  link: string | null;
};

export type CalendarEvent = {
  uri: string;
  cid: string;
  name: string;
  description: string;
  createdAt: string;
  startsAt: string | null;
  endsAt: string | null;
  mode: string;
  status: string;
  locations: EventLocation[];
  links: EventLink[];
  rsvpExpected: boolean;
};

export type EventRef = {
  uri: string;
  cid?: string;
};

export type RsvpStatus = 'going' | 'interested' | 'notgoing';

export type RsvpRecord = {
  uri: string;
  rkey: string;
  subjectUri: string;
  status: RsvpStatus;
};

type AtUriParts = {
  did: string;
  collection: string;
  rkey: string;
};

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function typeOf(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const type = (value as Record<string, unknown>).$type;
  return typeof type === 'string' ? type : '';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** The final token segment, for both nsids and #tokens. */
function tokenName(value: unknown): string {
  const full = cleanText(value);
  if (!full) return '';
  const hash = full.lastIndexOf('#');
  if (hash >= 0) return full.slice(hash + 1);
  return full.split('.').pop() || full;
}

function usableTimestamp(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) ? text : null;
}

/** Parse exactly the three AT URI components a repository record needs. */
export function parseAtUri(uri: string): AtUriParts | null {
  if (typeof uri !== 'string' || !uri.startsWith('at://')) return null;
  const rest = uri.slice('at://'.length);
  const first = rest.indexOf('/');
  if (first <= 0) return null;
  const did = rest.slice(0, first);
  const tail = rest.slice(first + 1);
  const second = tail.indexOf('/');
  if (second <= 0) return null;
  const collection = tail.slice(0, second);
  const rkey = tail.slice(second + 1);
  if (!did.startsWith('did:') || !collection || !rkey || rkey.includes('/')) return null;
  return { did, collection, rkey };
}

function httpLink(value: unknown): string | null {
  const text = cleanText(value);
  return /^https?:\/\/\S+$/i.test(text) ? text : null;
}

function osmCoordinates(latitude: unknown, longitude: unknown): string | null {
  const lat = Number(cleanText(latitude));
  const lon = Number(cleanText(longitude));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`;
}

function osmSearch(text: string): string | null {
  return text ? `https://www.openstreetmap.org/search?query=${encodeURIComponent(text)}` : null;
}

function addressLocation(value: Record<string, unknown>): EventLocation | null {
  const parts = [
    cleanText(value.name),
    cleanText(value.street),
    cleanText(value.locality),
    cleanText(value.region),
    cleanText(value.postalCode),
    cleanText(value.country),
  ].filter(Boolean);
  if (parts.length === 0) return null;
  const text = parts.join(', ');
  return { kind: 'address', text, link: osmSearch(text), linkLabel: 'Open map' };
}

function uriLocation(value: Record<string, unknown>): EventLocation | null {
  const uri = cleanText(value.uri);
  if (!uri) return null;
  const name = cleanText(value.name);
  const link = httpLink(uri);
  return { kind: 'uri', text: name || uri, link, linkLabel: link ? 'Open link' : null };
}

function fsqLocation(value: Record<string, unknown>): EventLocation | null {
  const id = cleanText(value.fsq_place_id);
  if (!id) return null;
  const name = cleanText(value.name);
  const text = name || `Foursquare place ${id}`;
  const link =
    osmCoordinates(value.latitude, value.longitude) || (name ? osmSearch(name) : null);
  return { kind: 'fsq', text, link, linkLabel: link ? 'Open map' : null };
}

function geoLocation(value: Record<string, unknown>): EventLocation | null {
  const latitude = cleanText(value.latitude);
  const longitude = cleanText(value.longitude);
  const link = osmCoordinates(latitude, longitude);
  if (!link) return null;
  const text = cleanText(value.name) || `${latitude}, ${longitude}`;
  return { kind: 'geo', text, link, linkLabel: 'Open map' };
}

function hthreeLocation(value: Record<string, unknown>): EventLocation | null {
  const cell = cleanText(value.value);
  if (!cell) return null;
  return {
    kind: 'hthree',
    text: cleanText(value.name) || `H3 cell ${cell}`,
    link: null,
    linkLabel: null,
  };
}

/** A location union member, rendered as text and, where possible, a map link. */
export function normaliseEventLocation(value: unknown): EventLocation | null {
  if (!isObject(value)) return null;
  const kind = tokenName(typeOf(value));
  if (kind === 'uri') return uriLocation(value);
  if (kind === 'address') return addressLocation(value);
  if (kind === 'fsq') return fsqLocation(value);
  if (kind === 'geo') return geoLocation(value);
  if (kind === 'hthree') return hthreeLocation(value);
  return null;
}

function normaliseEventLink(value: unknown): EventLink | null {
  if (!isObject(value)) return null;
  const uri = cleanText(value.uri);
  if (!uri) return null;
  return {
    uri,
    text: cleanText(value.name) || uri,
    link: httpLink(uri),
  };
}

export function eventModeLabel(mode: string): string {
  const token = tokenName(mode);
  if (token === 'inperson') return 'In person';
  if (token === 'virtual') return 'Virtual';
  if (token === 'hybrid') return 'Hybrid';
  return token ? token.replace(/[-_]/g, ' ') : 'Attendance not stated';
}

export function eventStatusLabel(status: string): string {
  const token = tokenName(status);
  if (token === 'scheduled') return 'Scheduled';
  if (token === 'planned') return 'Planned';
  if (token === 'rescheduled') return 'Rescheduled';
  if (token === 'cancelled') return 'Cancelled';
  if (token === 'postponed') return 'Postponed';
  return token ? token.replace(/[-_]/g, ' ') : 'Status not stated';
}

export function rsvpLabel(status: RsvpStatus): string {
  if (status === 'going') return 'Going';
  if (status === 'interested') return 'Interested';
  return 'Not going';
}

/**
 * Normalise one `community.lexicon.calendar.event` record. The name is the
 * only required display field; malformed dates and locations are dropped rather
 * than guessed. Missing mode and status use the lexicon's published defaults.
 */
export function normaliseCalendarEvent(
  value: unknown,
  uri: string,
  cid: string
): CalendarEvent | null {
  if (!isObject(value)) return null;
  const recordType = typeOf(value);
  if (recordType && recordType !== EVENT_COLLECTION) return null;
  const name = cleanText(value.name);
  if (!name) return null;

  const locations = Array.isArray(value.locations)
    ? value.locations
        .map(normaliseEventLocation)
        .filter((item): item is EventLocation => item !== null)
    : [];
  const links = Array.isArray(value.uris)
    ? value.uris
        .map(normaliseEventLink)
        .filter((item): item is EventLink => item !== null)
    : [];

  return {
    uri,
    cid,
    name,
    description: cleanText(value.description),
    createdAt: usableTimestamp(value.createdAt) || '',
    startsAt: usableTimestamp(value.startsAt),
    endsAt: usableTimestamp(value.endsAt),
    mode: cleanText(value.mode) || `${EVENT_COLLECTION}#inperson`,
    status: cleanText(value.status) || `${EVENT_COLLECTION}#scheduled`,
    locations,
    links,
    rsvpExpected: value.rsvpExpected === true,
  };
}

function startTime(event: CalendarEvent, fallback: number): number {
  const time = event.startsAt ? Date.parse(event.startsAt) : Number.NaN;
  return Number.isFinite(time) ? time : fallback;
}

/**
 * Upcoming events first, soonest first; undated events next; past events last,
 * most recent first. Ties are broken by name then URI so the strip is stable.
 */
export function sortProfileEvents(
  events: CalendarEvent[],
  now: number = Date.now()
): CalendarEvent[] {
  const rank = (event: CalendarEvent): number => {
    const at = startTime(event, Number.NaN);
    if (!Number.isFinite(at)) return 1;
    return at >= now ? 0 : 2;
  };
  return [...events].sort((a, b) => {
    const rankDifference = rank(a) - rank(b);
    if (rankDifference !== 0) return rankDifference;
    if (rank(a) === 0) {
      const difference = startTime(a, 0) - startTime(b, 0);
      if (difference !== 0) return difference;
    } else if (rank(a) === 2) {
      const difference = startTime(b, 0) - startTime(a, 0);
      if (difference !== 0) return difference;
    }
    const nameDifference = a.name.localeCompare(b.name);
    return nameDifference !== 0 ? nameDifference : a.uri.localeCompare(b.uri);
  });
}

export function profileEventStrip(
  events: CalendarEvent[],
  now: number = Date.now(),
  limit: number = PROFILE_EVENT_LIMIT
): CalendarEvent[] {
  return sortProfileEvents(events, now).slice(0, Math.max(0, limit));
}

/** A map/place line for compact cards; the full union stays in the sheet. */
export function eventPrimaryLocation(event: CalendarEvent): string {
  return event.locations[0]?.text || '';
}

function rawRecordRef(embed: unknown): unknown {
  if (!isObject(embed)) return null;
  const type = typeOf(embed);
  if (type === 'app.bsky.embed.record' || type.endsWith('#app.bsky.embed.record')) {
    return embed.record;
  }
  if (
    type === 'app.bsky.embed.recordWithMedia' ||
    type.endsWith('#app.bsky.embed.recordWithMedia')
  ) {
    return embed.record;
  }
  return null;
}

/**
 * Find an event strongRef in a raw post record's embed. The AppView does not
 * have a view type for community events, so the raw post record is the only
 * honest place to discover one.
 */
export function eventRefFromRecordEmbed(embed: unknown): EventRef | null {
  const record = rawRecordRef(embed);
  if (!isObject(record)) return null;
  const uri = cleanText(record.uri);
  const parts = parseAtUri(uri);
  if (!parts || parts.collection !== EVENT_COLLECTION) return null;
  const cid = cleanText(record.cid);
  return cid ? { uri, cid } : { uri };
}

/**
 * The RSVP lexicon declares `key: "tid"`. New records therefore use a real
 * TID; an existing record is updated in place so a status change never adds a
 * second RSVP.
 */
export function newRsvpRkey(): string {
  return TID.nextStr();
}

export function rsvpStatusFrom(value: unknown): RsvpStatus | null {
  const token = tokenName(value);
  if (token === 'going' || token === 'interested' || token === 'notgoing') return token;
  return null;
}

export function normaliseRsvpRecord(value: unknown, uri: string): RsvpRecord | null {
  if (!isObject(value)) return null;
  const recordType = typeOf(value);
  if (recordType && recordType !== RSVP_COLLECTION) return null;
  const parts = parseAtUri(uri);
  if (!parts || parts.collection !== RSVP_COLLECTION) return null;
  const subject = isObject(value.subject) ? cleanText(value.subject.uri) : '';
  const subjectParts = parseAtUri(subject);
  if (!subjectParts || subjectParts.collection !== EVENT_COLLECTION) return null;
  const status = rsvpStatusFrom(value.status);
  if (!status) return null;
  return { uri, rkey: parts.rkey, subjectUri: subject, status };
}

/** Newest rkey first; TIDs sort chronologically in normal repository writes. */
export function rsvpsForEvent(records: RsvpRecord[], eventUri: string): RsvpRecord[] {
  return records
    .filter((record) => record.subjectUri === eventUri)
    .sort((a, b) => b.rkey.localeCompare(a.rkey));
}

export function buildRsvpRecord(
  event: CalendarEvent,
  status: RsvpStatus
): Record<string, unknown> | null {
  if (!event.uri || !event.cid) return null;
  return {
    $type: RSVP_COLLECTION,
    subject: { uri: event.uri, cid: event.cid },
    status: `${RSVP_COLLECTION}#${status}`,
  };
}
