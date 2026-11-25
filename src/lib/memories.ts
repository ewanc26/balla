/**
 * One bounded PDS walk per account and launch day. This reads the viewer's own
 * public repository directly, using the PDS advertised in their DID document.
 * It never calls the AppView and never writes anything.
 *
 * The walk asks for the newest records first and stops after a fixed number of
 * pages. The card and screen disclose when that cap truncated the history; no
 * post outside the walk is claimed to be a complete archive.
 */
import { resolveDidDocument } from './identityResolver';
import { fetchPublicJsonObject } from './publicJsonRead.ts';
import { atprotoPdsEndpoint } from './tealModel';
import { readWithRetry } from './reliability';
import {
  MEMORIES_MAX_PAGES,
  MEMORIES_PAGE_SIZE,
  collectMemories,
  normaliseMemoriesDateKey,
  type MemoriesDay,
} from './memoriesModel';

type Page = {
  records: unknown[];
  cursor?: string;
};

const walkCache = new Map<string, Promise<MemoriesDay | null>>();

async function fetchPage(url: string): Promise<Page> {
  const body = await fetchPublicJsonObject(url);
  // No cursor means the bounded walk ends here, so a timed-out page fails
  // closed as an empty walk instead of becoming a retry loop.
  if (!body) return { records: [] };
  return {
    records: Array.isArray(body.records) ? body.records : [],
    cursor:
      typeof body.cursor === 'string' && body.cursor.length > 0
        ? body.cursor
        : undefined,
  };
}

async function walkRepository(did: string, dateKey: string): Promise<MemoriesDay | null> {
  const document = await resolveDidDocument(did);
  const endpoint = atprotoPdsEndpoint(document);
  if (!endpoint) return null;

  const records: unknown[] = [];
  let cursor: string | undefined;
  let truncated = false;

  for (let page = 0; page < MEMORIES_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      repo: did,
      collection: 'app.bsky.feed.post',
      limit: String(MEMORIES_PAGE_SIZE),
      reverse: 'true',
    });
    if (cursor) params.set('cursor', cursor);

    const result = await readWithRetry(() =>
      fetchPage(
        `${endpoint}/xrpc/com.atproto.repo.listRecords?${params.toString()}`
      )
    );
    records.push(...result.records);

    if (!result.cursor || result.cursor === cursor) {
      cursor = undefined;
      break;
    }
    cursor = result.cursor;
    if (page === MEMORIES_MAX_PAGES - 1) truncated = true;
  }

  const collected = collectMemories(records, dateKey, did);
  return {
    dateKey,
    items: collected.items,
    truncated,
    scanned: records.length,
  };
}

/**
 * Cached by account + day and deduplicated while the walk is in flight. A
 * failed walk is cached as null for this app session, so a card cannot turn one
 * PDS error into a retry loop on every scroll or tab switch.
 */
export function loadMemories(
  did: string,
  dateKey: string
): Promise<MemoriesDay | null> {
  const clean = normaliseMemoriesDateKey(dateKey);
  if (!did.startsWith('did:') || !clean) return Promise.resolve(null);

  const key = `${did}|${clean}`;
  const existing = walkCache.get(key);
  if (existing) return existing;

  const walk = walkRepository(did, clean)
    .catch(() => null)
    .then((result) => result);
  walkCache.set(key, walk);
  return walk;
}

/** Test and sign-out helper; the normal session cache lives for the app launch. */
export function clearMemoriesCache(): void {
  walkCache.clear();
}
