/**
 * Read-only Standard.site social-signal loader.
 *
 * Follows come from the granted AppView RPC. The subscription and recommend
 * records themselves are public repo data, so each followed account's own PDS
 * is read with unauthenticated `com.atproto.repo.listRecords`. No graph write,
 * new scope or private data is involved. Only HTTP status and structured
 * fields are used; a provider's free-form message text is never read, stored
 * or displayed.
 */

import {
  DOCUMENT_COLLECTION,
  PUBLICATION_COLLECTION,
  parseAtUri,
} from './standardSiteModel.ts';
import {
  NOT_CHECKED_SOCIAL_SIGNALS,
  normaliseSocialRecord,
  RECOMMEND_COLLECTIONS,
  SOCIAL_FOLLOW_LIMIT,
  SOCIAL_PAGE_LIMIT,
  SUBSCRIPTION_COLLECTIONS,
  uniqueMatches,
  type SocialCollection,
  type SocialMatch,
  type SocialSignalResult,
} from './standardSiteSocialModel.ts';

export type SocialFollow = { did: string; handle?: string | null };

export type StandardSiteSocialDeps = {
  /** The signed-in account's first page of follows, from the granted AppView RPC. */
  listFollows: () => Promise<SocialFollow[]>;
  /** Resolve a DID document to its advertised PDS, without an access token. */
  resolveEndpoint: (did: string) => Promise<string | null>;
  fetchImpl?: typeof fetch;
};

type ListedRecord = { uri: unknown; value: unknown };

type CollectionRead = {
  records: ListedRecord[];
  cursor: boolean;
  readable: boolean;
};

async function listCollection(
  endpoint: string,
  did: string,
  collection: SocialCollection,
  fetchImpl: typeof fetch,
): Promise<CollectionRead> {
  const params = new URLSearchParams({
    repo: did,
    collection,
    limit: String(SOCIAL_PAGE_LIMIT),
  });
  try {
    const response = await fetchImpl(
      `${endpoint}/xrpc/com.atproto.repo.listRecords?${params}`,
      { headers: { Accept: 'application/json' } },
    );
    // Most accounts have no social records; an empty collection is a real read.
    if (response.status === 400 || response.status === 404) {
      return { records: [], cursor: false, readable: true };
    }
    if (!response.ok) return { records: [], cursor: false, readable: false };
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object') {
      return { records: [], cursor: false, readable: false };
    }
    const data = body as Record<string, unknown>;
    const values = Array.isArray(data.records) ? data.records : [];
    const records = values
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
      .map((entry) => ({ uri: entry.uri, value: entry.value }));
    return {
      records,
      cursor: typeof data.cursor === 'string' && data.cursor.length > 0,
      readable: true,
    };
  } catch {
    return { records: [], cursor: false, readable: false };
  }
}

/**
 * Check the first page of followed accounts. An account whose PDS or any
 * relevant collection could not be read is excluded from the counts and added
 * to `unreadableFollows`, so a blocked request never appears as zero signals.
 */
export async function loadStandardSiteSocialSignals(
  documentUri: string,
  publicationUri: string | null,
  deps: StandardSiteSocialDeps,
): Promise<SocialSignalResult> {
  const documentParts = parseAtUri(documentUri);
  if (!documentParts || documentParts.collection !== DOCUMENT_COLLECTION) {
    return { ...NOT_CHECKED_SOCIAL_SIGNALS, state: 'unavailable' };
  }
  const publicationParts = publicationUri ? parseAtUri(publicationUri) : null;
  const canCheckSubscriptions =
    publicationParts !== null && publicationParts.collection === PUBLICATION_COLLECTION;

  let follows: SocialFollow[];
  try {
    follows = await deps.listFollows();
  } catch {
    return { ...NOT_CHECKED_SOCIAL_SIGNALS, state: 'unavailable' };
  }
  if (!Array.isArray(follows)) {
    return { ...NOT_CHECKED_SOCIAL_SIGNALS, state: 'unavailable' };
  }

  const checkedFollows = follows
    .map((follow) => (follow && typeof follow.did === 'string' ? follow.did : ''))
    .filter((did, index, all) => did && all.indexOf(did) === index)
    .slice(0, SOCIAL_FOLLOW_LIMIT);
  const fetchImpl = deps.fetchImpl ?? fetch;
  const subscriptions: SocialMatch[] = [];
  const recommends: SocialMatch[] = [];
  let unreadableFollows = 0;
  let checkedCollections = 0;
  let unreadableCollections = 0;
  let firstPageOnly = false;

  for (const did of checkedFollows) {
    const endpoint = await deps.resolveEndpoint(did);
    if (!endpoint) {
      unreadableFollows += 1;
      continue;
    }
    const collections: SocialCollection[] = [
      ...(canCheckSubscriptions ? SUBSCRIPTION_COLLECTIONS : []),
      ...RECOMMEND_COLLECTIONS,
    ];
    const reads = await Promise.all(
      collections.map((collection) => listCollection(endpoint, did, collection, fetchImpl)),
    );
    for (const read of reads) {
      if (read.readable) checkedCollections += 1;
      else unreadableCollections += 1;
      if (read.cursor) firstPageOnly = true;
    }
    // An account with any unreadable collection is excluded entirely: a partial
    // read must never be shown as though it were a complete account check.
    if (reads.some((read) => !read.readable)) {
      unreadableFollows += 1;
      continue;
    }
    reads.forEach((read, index) => {
      const collection = collections[index];
      const isSubscription = (SUBSCRIPTION_COLLECTIONS as readonly string[]).includes(collection);
      const targetUri = isSubscription ? publicationUri : documentUri;
      if (!targetUri) return;
      for (const record of read.records) {
        const match = normaliseSocialRecord(collection, record.value, record.uri, targetUri);
        if (!match) continue;
        if (match.kind === 'subscription') subscriptions.push(match);
        else recommends.push(match);
      }
    });
  }

  return {
    state: 'ok',
    checkedFollows: Math.max(0, checkedFollows.length - unreadableFollows),
    unreadableFollows,
    checkedCollections,
    unreadableCollections,
    limited: follows.length > SOCIAL_FOLLOW_LIMIT,
    firstPageOnly,
    subscriptions: uniqueMatches(subscriptions),
    recommends: uniqueMatches(recommends),
  };
}
