/**
 * Read-only community-lexicon reaction reader.
 *
 * Reaction records are public repository records, so each account's own PDS is
 * read with unauthenticated `com.atproto.repo.listRecords`. Balla reads them
 * beside a post; it does not rank or aggregate beyond counting values. No
 * graph write is involved in this read-first phase.
 */

import { agent } from './agent';
import { fetchPublicJsonObject } from './publicJsonRead.ts';
import { resolveDidDocument } from './identityResolver';
import { atprotoPdsEndpoint } from './tealModel';
import { readWithRetry } from './reliability';
import { parseAtUri } from './reactionsModel';
import {
  REACTION_COLLECTION,
  filterReactionRecords,
  groupReactions,
  normaliseReactionRecord,
  type ReactionRecord,
  type ReactionSummary,
} from './reactionsModel';

const PUBLIC_PAGE_SIZE = 50;
const PUBLIC_MAX_PAGES = 2;

type ListedRecord = { uri: string; cid: string; value: unknown };

type ListedPage = { records: ListedRecord[]; cursor?: string; missing?: boolean };

async function publicListPage(
  endpoint: string,
  did: string,
  cursor?: string
): Promise<ListedPage> {
  const params = new URLSearchParams({
    repo: did,
    collection: REACTION_COLLECTION,
    limit: String(PUBLIC_PAGE_SIZE),
    reverse: 'true',
  });
  if (cursor) params.set('cursor', cursor);

  let value: Record<string, unknown>;
  try {
    const body = await fetchPublicJsonObject(
      `${endpoint}/xrpc/com.atproto.repo.listRecords?${params.toString()}`
    );
    // A timeout is an unavailable source: no reaction strip, no retry loop.
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

async function publicReactionRecords(did: string): Promise<ReactionRecord[]> {
  if (!did.startsWith('did:')) return [];
  const document = await resolveDidDocument(did);
  const endpoint = atprotoPdsEndpoint(document);
  if (!endpoint) return [];

  const listed: ListedRecord[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < PUBLIC_MAX_PAGES; page += 1) {
    const result = await readWithRetry(() =>
      publicListPage(endpoint, did, cursor)
    );
    if (result.missing) break;
    listed.push(...result.records);
    if (!result.cursor || result.cursor === cursor) break;
    cursor = result.cursor;
  }

  return listed
    .map((record) => normaliseReactionRecord(record.value, record.uri, record.cid))
    .filter((record): record is ReactionRecord => record !== null);
}

export async function loadReactionRecords(subjectUri: string): Promise<ReactionRecord[]> {
  const parts = parseAtUri(subjectUri);
  if (!parts) return [];
  try {
    const records = await publicReactionRecords(parts.did);
    return records.filter((record) => record.subjectUri === subjectUri);
  } catch {
    return [];
  }
}

export async function loadPostReactions(
  subjectUri: string,
  viewerDid: string = agent.did || ''
): Promise<ReactionSummary[]> {
  const records = await loadReactionRecords(subjectUri);
  const filtered = filterReactionRecords(records);
  return groupReactions(filtered, viewerDid);
}

export const loadReactions = loadPostReactions;
export const readPostReactions = loadPostReactions;
export const readReactions = loadPostReactions;

export function clearReactionsCache(): void {
  // Reads are not cached yet; kept for symmetry with other readers.
}
