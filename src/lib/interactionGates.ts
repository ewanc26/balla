/**
 * Reply and quote controls built strictly from the published lexicons:
 * `app.bsky.feed.threadgate` and `app.bsky.feed.postgate`. Both records use the
 * post's own rkey, and "everyone" means no gate record at all rather than an
 * invented permissive rule. No list rules yet: a list needs a real picker, and
 * a made-up list URI would be worse than leaving the option out.
 */

export type ReplyAccess =
  | 'everyone'
  | 'mentioned'
  | 'following'
  | 'followers'
  | 'nobody';

export type QuoteAccess = 'everyone' | 'nobody';

export type InteractionGates = {
  reply: ReplyAccess;
  quote: QuoteAccess;
};

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
  'nobody',
];

export function normaliseGates(value: unknown): InteractionGates {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    reply: REPLY_VALUES.includes(input.reply as ReplyAccess)
      ? (input.reply as ReplyAccess)
      : 'everyone',
    quote: input.quote === 'nobody' ? 'nobody' : 'everyone',
  };
}

export function gatesEqual(a: InteractionGates, b: InteractionGates): boolean {
  return a.reply === b.reply && a.quote === b.quote;
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
  createdAt: string
): GateWrite | null {
  const reply = normaliseGates(gates).reply;
  if (reply === 'everyone') return null;
  const allow =
    reply === 'nobody'
      ? []
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
    allow,
  });
}

/** `null` means there should be no postgate record: delete any existing one. */
export function postgateWrite(
  postUri: string,
  gates: InteractionGates,
  createdAt: string
): GateWrite | null {
  if (normaliseGates(gates).quote === 'everyone') return null;
  return gateWrite(postUri, 'app.bsky.feed.postgate', {
    $type: 'app.bsky.feed.postgate',
    createdAt,
    embeddingRules: [{ $type: 'app.bsky.feed.postgate#disableRule' }],
  });
}

function ruleType(item: unknown): string {
  if (!item || typeof item !== 'object') return '';
  const value = (item as Record<string, unknown>).$type;
  return typeof value === 'string' ? value : '';
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
  return {
    reply: replyAccessFromRecord(threadgateRecord),
    quote: quoteAccessFromRecord(postgateRecord),
  };
}

export function describeGates(gates: InteractionGates): string {
  const reply = {
    everyone: 'Anyone can reply',
    mentioned: 'Only mentioned accounts can reply',
    following: 'Only people you follow can reply',
    followers: 'Only people who follow you can reply',
    nobody: 'Nobody can reply',
  }[normaliseGates(gates).reply];
  const quote = gates.quote === 'nobody' ? 'Quoting is off' : 'Anyone can quote';
  return `${reply} · ${quote}`;
}
