/**
 * Calendar event reads and RSVP writes. Event records are public repository
 * records, so profiles and embedded refs are read from the author's PDS with
 * unauthenticated `listRecords`/`getRecord`. The viewer's RSVPs are read and
 * written with one narrow `community.lexicon.calendar.rsvp` grant. No AppView,
 * event feed or recommendation path is involved.
 */
import { agent } from './agent';
import { resolveDidDocument } from './identityResolver';
import { fetchPublicJsonObject } from './publicJsonRead.ts';
import { atprotoPdsEndpoint } from './tealModel';
import { readWithRetry } from './reliability';
import {
  EVENT_COLLECTION,
  RSVP_COLLECTION,
  buildRsvpRecord,
  newRsvpRkey,
  normaliseCalendarEvent,
  normaliseRsvpRecord,
  parseAtUri,
  rsvpsForEvent,
  sortProfileEvents,
  type CalendarEvent,
  type RsvpRecord,
  type RsvpStatus,
} from './eventsModel';

const PUBLIC_PAGE_SIZE = 50;
const PUBLIC_MAX_PAGES = 2;
const RSVP_PAGE_SIZE = 100;
const RSVP_MAX_PAGES = 3;

type ListedRecord = {
  uri: string;
  cid: string;
  value: unknown;
};

type ListedPage = {
  records: ListedRecord[];
  cursor?: string;
  missing?: boolean;
};

const eventCache = new Map<string, Promise<CalendarEvent | null>>();

async function publicListPage(
  endpoint: string,
  did: string,
  collection: string,
  cursor?: string
): Promise<ListedPage> {
  const params = new URLSearchParams({
    repo: did,
    collection,
    limit: String(PUBLIC_PAGE_SIZE),
    reverse: 'true',
  });
  if (cursor) params.set('cursor', cursor);

  let value: Record<string, unknown>;
  try {
    const body = await fetchPublicJsonObject(
      `${endpoint}/xrpc/com.atproto.repo.listRecords?${params.toString()}`
    );
    // A timeout is an unavailable source: no event section, no retry loop.
    if (!body) return { records: [], missing: true };
    value = body;
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 400 || status === 404) {
      return { records: [], missing: true };
    }
    throw err;
  }
  const records = Array.isArray(value.records)
    ? value.records.flatMap((entry: unknown) => {
        if (!entry || typeof entry !== 'object') return [];
        const record = entry as Record<string, unknown>;
        const uri = typeof record.uri === 'string' ? record.uri : '';
        const cid = typeof record.cid === 'string' ? record.cid : '';
        if (!uri || !cid) return [];
        return [{ uri, cid, value: record.value }];
      })
    : [];
  return {
    records,
    cursor:
      typeof value.cursor === 'string' && value.cursor.length > 0
        ? value.cursor
        : undefined,
  };
}

async function publicEvents(did: string): Promise<CalendarEvent[]> {
  const document = await resolveDidDocument(did);
  const endpoint = atprotoPdsEndpoint(document);
  if (!endpoint) return [];

  const records: ListedRecord[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < PUBLIC_MAX_PAGES; page += 1) {
    const result = await readWithRetry(() =>
      publicListPage(endpoint, did, EVENT_COLLECTION, cursor)
    );
    if (result.missing) break;
    records.push(...result.records);
    if (!result.cursor || result.cursor === cursor) break;
    cursor = result.cursor;
  }

  return records
    .map((record) => normaliseCalendarEvent(record.value, record.uri, record.cid))
    .filter((event): event is CalendarEvent => event !== null);
}

/** A missing collection or unreadable profile simply means no event section. */
export async function loadProfileEvents(did: string): Promise<CalendarEvent[]> {
  if (!did.startsWith('did:')) return [];
  try {
    return sortProfileEvents(await publicEvents(did));
  } catch {
    return [];
  }
}

async function publicEvent(uri: string): Promise<CalendarEvent | null> {
  const parts = parseAtUri(uri);
  if (!parts || parts.collection !== EVENT_COLLECTION) return null;
  const document = await resolveDidDocument(parts.did);
  const endpoint = atprotoPdsEndpoint(document);
  if (!endpoint) return null;

  const params = new URLSearchParams({
    repo: parts.did,
    collection: EVENT_COLLECTION,
    rkey: parts.rkey,
  });
  const response = await readWithRetry(async () => {
    try {
      return await fetchPublicJsonObject(
        `${endpoint}/xrpc/com.atproto.repo.getRecord?${params.toString()}`
      );
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 400 || status === 404) return null;
      throw err;
    }
  });
  if (!response || typeof response !== 'object') return null;
  const body = response as Record<string, unknown>;
  const cid = typeof body.cid === 'string' ? body.cid : '';
  if (!cid) return null;
  return normaliseCalendarEvent(body.value, uri, cid);
}

/** Session-cached so a repeated card render cannot turn into repeated reads. */
export function loadCalendarEvent(uri: string): Promise<CalendarEvent | null> {
  const existing = eventCache.get(uri);
  if (existing) return existing;
  const read = publicEvent(uri).catch(() => null);
  eventCache.set(uri, read);
  return read;
}

export function clearEventsCache(): void {
  eventCache.clear();
}

function normaliseListedRsvp(record: ListedRecord): RsvpRecord | null {
  return normaliseRsvpRecord(record.value, record.uri);
}

/**
 * Read the viewer's RSVP collection through the authenticated repository API.
 * The walk is bounded, and only records whose subject is this event survive.
 */
export async function loadEventRsvps(
  did: string,
  eventUri: string
): Promise<RsvpRecord[]> {
  if (!did || !eventUri) return [];
  const records: RsvpRecord[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < RSVP_MAX_PAGES; page += 1) {
    const result = await readWithRetry(() =>
      agent.com.atproto.repo.listRecords({
        repo: did,
        collection: RSVP_COLLECTION,
        limit: RSVP_PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      })
    );
    for (const entry of result.data.records || []) {
      const uri = typeof entry.uri === 'string' ? entry.uri : '';
      if (!uri) continue;
      const normalised = normaliseRsvpRecord(entry.value, uri);
      if (normalised) records.push(normalised);
    }
    const next = typeof result.data.cursor === 'string' ? result.data.cursor : undefined;
    if (!next || next === cursor) break;
    cursor = next;
  }
  return rsvpsForEvent(records, eventUri);
}

export type RsvpWriteResult = {
  status: RsvpStatus;
  rkey: string;
  duplicateCleanupFailed: boolean;
};

/**
 * Write exactly one RSVP for this event. The collection is read first so an
 * existing record can be updated in place; a new record uses the lexicon's TID
 * key. If an older client left duplicates, the newest is kept and the extras
 * are deleted. A failed lookup aborts before writing, because a blind write
 * could stack a second RSVP.
 */
export async function setEventRsvp(
  event: CalendarEvent,
  status: RsvpStatus
): Promise<RsvpWriteResult> {
  const did = agent.did;
  if (!did) throw new Error('Sign in to RSVP.');
  const record = buildRsvpRecord(event, status);
  if (!record) throw new Error('This event has no strong reference.');

  const existing = await loadEventRsvps(did, event.uri);
  const rkey = existing[0]?.rkey || newRsvpRkey();
  await agent.com.atproto.repo.putRecord({
    repo: did,
    collection: RSVP_COLLECTION,
    rkey,
    record,
    validate: false,
  });

  let duplicateCleanupFailed = false;
  for (const duplicate of existing.slice(1)) {
    try {
      await agent.com.atproto.repo.deleteRecord({
        repo: did,
        collection: RSVP_COLLECTION,
        rkey: duplicate.rkey,
      });
    } catch {
      duplicateCleanupFailed = true;
    }
  }
  return { status, rkey, duplicateCleanupFailed };
}

/** Removing is visible, deletes every matching RSVP, and is a no-op if none. */
export async function removeEventRsvp(event: CalendarEvent): Promise<number> {
  const did = agent.did;
  if (!did) throw new Error('Sign in to remove an RSVP.');
  const existing = await loadEventRsvps(did, event.uri);
  for (const record of existing) {
    await agent.com.atproto.repo.deleteRecord({
      repo: did,
      collection: RSVP_COLLECTION,
      rkey: record.rkey,
    });
  }
  return existing.length;
}
