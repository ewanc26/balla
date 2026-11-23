/**
 * Read-only teal.fm play reader. Plays live in a person's own repository, so
 * we resolve their PDS from their DID and read the public `listRecords`
 * endpoint there. Balla never writes to a teal collection and needs no extra
 * OAuth scope: these are unauthenticated, public repository reads.
 */
import { readWithRetry } from './reliability';
import { resolveDidDocument } from './identityResolver';
import {
  TEAL_COLLECTIONS,
  atprotoPdsEndpoint,
  normaliseTealPlay,
  recentTealPlays,
  type TealCollection,
  type TealPlay,
} from './tealModel';

export {
  TEAL_COLLECTIONS,
  TEAL_PROFILE_BASE,
  TEAL_STRIP_LIMIT,
  atprotoPdsEndpoint,
  normaliseTealPlay,
  recentTealPlays,
  sortTealPlays,
  tealArtistNames,
  tealDuration,
  tealProfileUrl,
  type TealCollection,
  type TealPlay,
} from './tealModel';

/** Enough pages for a compact strip without walking a 100k-record import. */
const PAGE_LIMIT = 50;
const MAX_PAGES = 2;

type ListedRecord = { uri: string; value: unknown };

async function listCollection(
  endpoint: string,
  did: string,
  collection: TealCollection
): Promise<ListedRecord[]> {
  const records: ListedRecord[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      repo: did,
      collection,
      limit: String(PAGE_LIMIT),
    });
    if (cursor) params.set('cursor', cursor);

    const response = await fetch(`${endpoint}/xrpc/com.atproto.repo.listRecords?${params}`);
    // A missing collection is the normal case for most profiles.
    if (response.status === 400 || response.status === 404) break;
    if (!response.ok) throw new Error(`teal.fm read failed (${response.status})`);

    const body = (await response.json()) as {
      records?: Array<{ uri?: unknown; value?: unknown }>;
      cursor?: unknown;
    };
    for (const record of body.records || []) {
      if (record && typeof record.uri === 'string') {
        records.push({ uri: record.uri, value: record.value });
      }
    }

    const next = typeof body.cursor === 'string' ? body.cursor : undefined;
    if (!next || next === cursor) break;
    cursor = next;
  }

  return records;
}

/**
 * Load a profile's newest plays from both current and legacy collections.
 * Any failure yields an empty strip: music activity is optional and must
 * never break the profile.
 */
export async function loadTealPlays(did: string): Promise<TealPlay[]> {
  if (!did) return [];
  try {
    const document = await resolveDidDocument(did);
    const endpoint = atprotoPdsEndpoint(document);
    if (!endpoint) return [];

    const pages = await Promise.allSettled(
      TEAL_COLLECTIONS.map((collection) =>
        readWithRetry(() => listCollection(endpoint, did, collection))
      )
    );

    const plays: TealPlay[] = [];
    pages.forEach((page, index) => {
      if (page.status !== 'fulfilled') return;
      const collection = TEAL_COLLECTIONS[index];
      for (const record of page.value) {
        const play = normaliseTealPlay(record.value, record.uri, collection);
        if (play) plays.push(play);
      }
    });
    return recentTealPlays(plays);
  } catch {
    return [];
  }
}
