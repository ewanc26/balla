/**
 * Framework-free rules for read-only Standard.site social signals.
 *
 * Subscription and recommend records are public repo data on the account that
 * created them. This module never writes a record or reads a private message:
 * it matches exact AT-URIs from published fields and reports only DIDs, counts
 * and unreadable-account counts. A missing collection means no records, not a
 * zero-confidence claim about the whole network.
 */

import { parseAtUri } from './standardSiteModel.ts';

export const SOCIAL_FOLLOW_LIMIT = 20;
export const SOCIAL_PAGE_LIMIT = 100;

export const SUBSCRIPTION_COLLECTIONS = [
  'site.standard.graph.subscription',
  'pub.leaflet.graph.subscription',
] as const;

export const RECOMMEND_COLLECTIONS = [
  'site.standard.graph.recommend',
  'pub.leaflet.interactions.recommend',
] as const;

export type SocialSignalKind = 'subscription' | 'recommend';

export type SocialMatch = {
  kind: SocialSignalKind;
  did: string;
  uri: string;
};

export type SocialCollection =
  | (typeof SUBSCRIPTION_COLLECTIONS)[number]
  | (typeof RECOMMEND_COLLECTIONS)[number];

export type SocialSignalResult = {
  state: 'not-checked' | 'unavailable' | 'ok';
  checkedFollows: number;
  unreadableFollows: number;
  checkedCollections: number;
  unreadableCollections: number;
  limited: boolean;
  firstPageOnly: boolean;
  subscriptions: SocialMatch[];
  recommends: SocialMatch[];
};

export const NOT_CHECKED_SOCIAL_SIGNALS: SocialSignalResult = {
  state: 'not-checked',
  checkedFollows: 0,
  unreadableFollows: 0,
  checkedCollections: 0,
  unreadableCollections: 0,
  limited: false,
  firstPageOnly: false,
  subscriptions: [],
  recommends: [],
};

const FIELD_BY_COLLECTION: Record<SocialCollection, string> = {
  'site.standard.graph.subscription': 'publication',
  'pub.leaflet.graph.subscription': 'publication',
  'site.standard.graph.recommend': 'document',
  'pub.leaflet.interactions.recommend': 'subject',
};

export function socialKind(collection: string): SocialSignalKind | null {
  if ((SUBSCRIPTION_COLLECTIONS as readonly string[]).includes(collection)) return 'subscription';
  if ((RECOMMEND_COLLECTIONS as readonly string[]).includes(collection)) return 'recommend';
  return null;
}

/** An exact field match and a valid record AT-URI are both required. */
export function normaliseSocialRecord(
  collection: SocialCollection,
  value: unknown,
  uri: unknown,
  targetUri: string,
): SocialMatch | null {
  const kind = socialKind(collection);
  if (!kind || !value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record.$type !== collection) return null;
  if (record[FIELD_BY_COLLECTION[collection]] !== targetUri) return null;
  if (typeof uri !== 'string') return null;
  const parts = parseAtUri(uri);
  if (!parts) return null;
  return { kind, did: parts.did, uri };
}

/** Deduplicate by DID so one account's repeat records cannot inflate a count. */
export function uniqueMatches(matches: SocialMatch[]): SocialMatch[] {
  const seen = new Set<string>();
  return matches.filter((match) => {
    if (seen.has(match.did)) return false;
    seen.add(match.did);
    return true;
  });
}

export function socialSignalCounts(result: SocialSignalResult): {
  subscriptions: number;
  recommends: number;
} {
  return {
    subscriptions: uniqueMatches(result.subscriptions).length,
    recommends: uniqueMatches(result.recommends).length,
  };
}

export const SOCIAL_SIGNAL_COPY = {
  title: 'Signals from people you follow',
  scope: `Up to ${SOCIAL_FOLLOW_LIMIT} accounts from the first page of your follows, one page of each public record collection per account.`,
  action: 'Check followed accounts',
  busy: 'Checking…',
  noPublication: 'No publication record was found, so subscriptions cannot be matched here.',
  noFollows: 'The first page of your follows is empty.',
  noMatches: 'No matching records were found in the accounts that could be read.',
  partial: 'Accounts or collections that could not be read are excluded from these counts.',
  limited: 'There are more follows beyond the first page; they were not checked.',
  firstPage: 'Only the first page of each collection was checked.',
  readLimit:
    'These are public records on other people’s servers, not a network-wide total. Subscribing and recommending need new permissions Balla does not request here.',
} as const;
