/**
 * Reply and quote controls built strictly from the published lexicons:
 * `app.bsky.feed.threadgate` and `app.bsky.feed.postgate`. Both records use the
 * post's own rkey, and "everyone" means no gate record at all rather than an
 * invented permissive rule. A list rule needs a real list AT-URI from a picker;
 * a made-up URI is never written. Hidden replies use the lexicon's
 * `hiddenReplies` field, not a local hide.
 */

export type ReplyAccess =
  | 'everyone'
  | 'mentioned'
  | 'following'
  | 'followers'
  | 'list'
  | 'nobody';

export type QuoteAccess = 'everyone' | 'nobody';

export type InteractionGates = {
  reply: ReplyAccess;
  quote: QuoteAccess;
  /** Only meaningful with `reply: 'list'`; a real app.bsky.graph.list AT-URI. */
  listUri?: string | null;
};

const LIST_COLLECTION = 'app.bsky.graph.list';

export type GateWrite = {
  collection: string;
  rkey: string;
  record: Record<string, unknown>;
};

export const DEFAULT_INTERACTION_GATES: InteractionGates = {
  reply: 'everyone',
  quote: 'everyone',
};

const REPLY_VALUES: ReplyAccess[] = [
  'everyone',
  'mentioned',
  'following',
  'followers',
  'list',
  'nobody',
];

/** A list rule needs a real list AT-URI; anything else would be a protocol lie. */
export function normaliseListUri(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^at:\/\/([^/]+)\/([^/]+)\/([^/#?]+)$/.exec(value);
  return match && match[2] === LIST_COLLECTION ? value : null;
}

export function normaliseGates(value: unknown): InteractionGates {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const reply = REPLY_VALUES.includes(input.reply as ReplyAccess)
    ? (input.reply as ReplyAccess)
    : 'everyone';
  const gates: InteractionGates = {
    reply,
    quote: input.quote === 'nobody' ? 'nobody' : 'everyone',
  };
  if (reply === 'list') {
    const listUri = normaliseListUri(input.listUri);
    if (listUri) gates.listUri = listUri;
    else gates.reply = 'everyone';
  }
  return gates;
}

export function gatesEqual(a: InteractionGates, b: InteractionGates): boolean {
  const first = normaliseGates(a);
  const second = normaliseGates(b);
  return (
    first.reply === second.reply &&
    first.quote === second.quote &&
    (first.listUri || null) === (second.listUri || null)
  );
}

/** Only a real post AT-URI has an rkey we may reuse for a gate record. */
export function postRkey(uri: string): string | null {
  if (typeof uri !== 'string') return null;
  const match = /^at:\/\/[^/]+\/app\.bsky\.feed\.post\/([^/#?]+)$/.exec(uri);
  return match ? match[1] : null;
}

function gateWrite(
  postUri: string,
  collection: 'app.bsky.feed.threadgate' | 'app.bsky.feed.postgate',
  record: Record<string, unknown>
): GateWrite | null {
  const rkey = postRkey(postUri);
  if (!rkey) return null;
  return { collection, rkey, record: { ...record, post: postUri } };
}

/** `null` means there should be no threadgate record: delete any existing one. */
export function threadgateWrite(
  postUri: string,
  gates: InteractionGates,
  createdAt: string,
  hiddenReplies: string[] = []
): GateWrite | null {
  const normalised = normaliseGates(gates);
  const reply = normalised.reply;
  const hidden = hiddenReplies.filter((uri) => typeof uri === 'string' && uri.length > 0);
  if (reply === 'everyone' && hidden.length === 0) return null;
  const allow =
    reply === 'nobody'
      ? []
      : reply === 'list'
        ? [{ $type: 'app.bsky.feed.threadgate#listRule', list: normalised.listUri }]
        : [
            {
              $type: `app.bsky.feed.threadgate#${
                reply === 'mentioned'
                  ? 'mentionRule'
                  : reply === 'followers'
                    ? 'followerRule'
                    : 'followingRule'
              }`,
            },
          ];
  return gateWrite(postUri, 'app.bsky.feed.threadgate', {
    $type: 'app.bsky.feed.threadgate',
    createdAt,
    // `allow` is optional in the lexicon. Omitting it means anyone can reply,
    // which is how a gate used only for hidden replies stays permissive.
    ...(reply === 'everyone' && hidden.length > 0 ? {} : { allow }),
    ...(hidden.length > 0 ? { hiddenReplies: hidden } : {}),
  });
}

export function hiddenRepliesFromRecord(record: unknown): string[] {
  if (!record || typeof record !== 'object') return [];
  const hidden = (record as Record<string, unknown>).hiddenReplies;
  if (!Array.isArray(hidden)) return [];
  return hidden.filter((uri): uri is string => typeof uri === 'string' && uri.length > 0);
}

/**
 * Toggle one reply in the root post's threadgate. The existing `allow` rules
 * are preserved byte-for-byte: hiding a reply must never loosen or tighten who
 * may reply. `null` means the whole threadgate record can be deleted.
 */
export function hiddenReplyWrite(
  rootPostUri: string,
  existingRecord: unknown,
  replyUri: string,
  action: 'hide' | 'show',
  createdAt: string
): GateWrite | null {
  const rkey = postRkey(rootPostUri);
  if (!rkey || typeof replyUri !== 'string' || replyUri.length === 0) return null;
  const previous =
    existingRecord && typeof existingRecord === 'object'
      ? (existingRecord as Record<string, unknown>)
      : {};
  const hidden = new Set(hiddenRepliesFromRecord(previous));
  if (action === 'hide') hidden.add(replyUri);
  else hidden.delete(replyUri);
  if (hidden.size === 0 && previous.allow === undefined) return null;
  const record: Record<string, unknown> = {
    $type: 'app.bsky.feed.threadgate',
    post: rootPostUri,
    createdAt,
  };
  // `allow: []` is meaningful (nobody can reply), so only omit when truly absent.
  if (previous.allow !== undefined) record.allow = previous.allow;
  if (hidden.size > 0) record.hiddenReplies = [...hidden];
  return { collection: 'app.bsky.feed.threadgate', rkey, record };
}

export function detachedEmbeddingUrisFromRecord(record: unknown): string[] {
  if (!record || typeof record !== 'object') return [];
  const detached = (record as Record<string, unknown>).detachedEmbeddingUris;
  if (!Array.isArray(detached)) return [];
  return detached.filter((uri): uri is string => typeof uri === 'string' && uri.length > 0);
}

/**
 * `null` means there should be no postgate record: delete any existing one.
 * Detached quotes are a separate published field, so they are preserved even
 * when quoting is open again; dropping them would silently re-attach a quote
 * the author deliberately detached.
 */
export function postgateWrite(
  postUri: string,
  gates: InteractionGates,
  createdAt: string,
  detachedEmbeddingUris: string[] = []
): GateWrite | null {
  const detached = detachedEmbeddingUris.filter(
    (uri) => typeof uri === 'string' && uri.length > 0
  );
  if (normaliseGates(gates).quote === 'everyone' && detached.length === 0) return null;
  return gateWrite(postUri, 'app.bsky.feed.postgate', {
    $type: 'app.bsky.feed.postgate',
    createdAt,
    ...(normaliseGates(gates).quote === 'nobody'
      ? { embeddingRules: [{ $type: 'app.bsky.feed.postgate#disableRule' }] }
      : {}),
    ...(detached.length > 0 ? { detachedEmbeddingUris: detached } : {}),
  });
}

function ruleType(item: unknown): string {
  if (!item || typeof item !== 'object') return '';
  const value = (item as Record<string, unknown>).$type;
  return typeof value === 'string' ? value : '';
}

export function listUriFromRecord(record: unknown): string | null {
  if (!record || typeof record !== 'object') return null;
  const allow = (record as Record<string, unknown>).allow;
  if (!Array.isArray(allow)) return null;
  for (const rule of allow) {
    if (ruleType(rule) !== 'app.bsky.feed.threadgate#listRule') continue;
    const list = normaliseListUri(
      rule && typeof rule === 'object' ? (rule as Record<string, unknown>).list : null
    );
    if (list) return list;
  }
  return null;
}

export function replyAccessFromRecord(record: unknown): ReplyAccess {
  if (!record || typeof record !== 'object') return 'everyone';
  const allow = (record as Record<string, unknown>).allow;
  if (!Array.isArray(allow)) return 'everyone';
  if (allow.length === 0) return 'nobody';
  const types = allow.map(ruleType);
  if (types.includes('app.bsky.feed.threadgate#mentionRule')) return 'mentioned';
  if (types.includes('app.bsky.feed.threadgate#followingRule')) return 'following';
  if (types.includes('app.bsky.feed.threadgate#followerRule')) return 'followers';
  if (types.includes('app.bsky.feed.threadgate#listRule')) {
    return listUriFromRecord(record) ? 'list' : 'everyone';
  }
  return 'everyone';
}

export function quoteAccessFromRecord(record: unknown): QuoteAccess {
  if (!record || typeof record !== 'object') return 'everyone';
  const rules = (record as Record<string, unknown>).embeddingRules;
  if (!Array.isArray(rules)) return 'everyone';
  return rules.some(
    (item) => ruleType(item) === 'app.bsky.feed.postgate#disableRule'
  )
    ? 'nobody'
    : 'everyone';
}

export function gatesFromRecords(
  threadgateRecord: unknown,
  postgateRecord: unknown
): InteractionGates {
  const gates: InteractionGates = {
    reply: replyAccessFromRecord(threadgateRecord),
    quote: quoteAccessFromRecord(postgateRecord),
  };
  if (gates.reply === 'list') gates.listUri = listUriFromRecord(threadgateRecord);
  return gates;
}

export function describeGates(gates: InteractionGates): string {
  const normalised = normaliseGates(gates);
  const reply = {
    everyone: 'Anyone can reply',
    mentioned: 'Only mentioned accounts can reply',
    following: 'Only people you follow can reply',
    followers: 'Only people who follow you can reply',
    list: 'Only members of a list can reply',
    nobody: 'Nobody can reply',
  }[normalised.reply];
  const quote = gates.quote === 'nobody' ? 'Quoting is off' : 'Anyone can quote';
  return `${reply} · ${quote}`;
}
