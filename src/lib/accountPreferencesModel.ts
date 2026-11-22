/**
 * Deterministic mapping between the account-level `app.bsky.actor` preferences
 * Bluesky publishes and the settings Balla exposes. No value is invented: an
 * absent preference means the published default (badges shown, open replies
 * and quotes, no interests). The record shapes mirror the threadgate and
 * postgate rules used for single posts.
 */
import {
  DEFAULT_INTERACTION_GATES,
  listUriFromRecord,
  normaliseGates,
  quoteAccessFromRecord,
  replyAccessFromRecord,
  type InteractionGates,
} from './interactionGates.ts';

export type AccountPreferences = {
  hideVerificationBadges: boolean;
  defaultGates: InteractionGates;
  interests: string[];
};

export const DEFAULT_ACCOUNT_PREFERENCES: AccountPreferences = {
  hideVerificationBadges: false,
  defaultGates: DEFAULT_INTERACTION_GATES,
  interests: [],
};

export function readAccountPreferences(preferences: any): AccountPreferences {
  const gates = interactionPrefToGates(preferences?.postInteractionSettings);
  return {
    hideVerificationBadges: preferences?.verificationPrefs?.hideBadges === true,
    defaultGates: gates,
    interests: normaliseInterests(preferences?.interests?.tags),
  };
}

export function normaliseInterests(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    const value = tag.trim().replace(/^#+/, '').toLowerCase();
    if (!value || value.length > 50 || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
    if (result.length === 30) break;
  }
  return result;
}

export function interactionPrefToGates(value: unknown): InteractionGates {
  const allow = value && typeof value === 'object' ? (value as any).threadgateAllowRules : undefined;
  const embedding =
    value && typeof value === 'object' ? (value as any).postgateEmbeddingRules : undefined;
  const gates: InteractionGates = {
    reply: replyAccessFromRecord({ allow }),
    quote: quoteAccessFromRecord({ embeddingRules: embedding }),
  };
  if (gates.reply === 'list') {
    gates.listUri = listUriFromRecord({ allow });
  }
  return normaliseGates(gates);
}

/** The exact shape accepted by `agent.setPostInteractionSettings`. */
export function gatesToInteractionPref(gates: InteractionGates): {
  threadgateAllowRules?: Array<Record<string, unknown>>;
  postgateEmbeddingRules?: Array<Record<string, unknown>>;
} {
  const value = normaliseGates(gates);
  let threadgateAllowRules: Array<Record<string, unknown>> | undefined;
  if (value.reply === 'nobody') threadgateAllowRules = [];
  if (value.reply === 'mentioned') {
    threadgateAllowRules = [{ $type: 'app.bsky.feed.threadgate#mentionRule' }];
  }
  if (value.reply === 'following') {
    threadgateAllowRules = [{ $type: 'app.bsky.feed.threadgate#followingRule' }];
  }
  if (value.reply === 'followers') {
    threadgateAllowRules = [{ $type: 'app.bsky.feed.threadgate#followerRule' }];
  }
  if (value.reply === 'list' && value.listUri) {
    threadgateAllowRules = [
      { $type: 'app.bsky.feed.threadgate#listRule', list: value.listUri },
    ];
  }
  return {
    threadgateAllowRules,
    postgateEmbeddingRules:
      value.quote === 'nobody'
        ? [{ $type: 'app.bsky.feed.postgate#disableRule' }]
        : undefined,
  };
}
