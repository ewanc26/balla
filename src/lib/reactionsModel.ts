/**
 * Framework-free rules for community-lexicon emoji reactions on posts. The
 * lexicon is still settling, so readers tolerate unknown value variants and
 * render the plain emoji rather than failing. No React Native or agent imports.
 */

export const REACTION_COLLECTION = 'community.lexicon.interaction.reaction';
export const REACTIONS_COLLECTION = REACTION_COLLECTION;
export const COMMUNITY_REACTION_COLLECTION = REACTION_COLLECTION;
export const INTERACTION_REACTION_COLLECTION = REACTION_COLLECTION;

export type ReactionSubject = {
  uri: string;
  cid?: string | null;
};

export type ReactionRecord = {
  uri: string;
  cid: string;
  subjectUri: string;
  subjectCid: string | null;
  value: string;
  createdAt: string | null;
  actorDid: string | null;
};

export type ReactionSummary = { value: string; count: number; mine: boolean };

export type ReactionPaletteItem = {
  key: string;
  label: string;
  emoji: string;
  writesLike: boolean;
};

/** Facebook-style reaction set mapped to plain Unicode emoji. */
export const REACTION_PALETTE: readonly ReactionPaletteItem[] = [
  { key: 'like', label: 'Like', emoji: '👍', writesLike: true },
  { key: 'love', label: 'Love', emoji: '❤️', writesLike: false },
  { key: 'care', label: 'Care', emoji: '🤗', writesLike: false },
  { key: 'haha', label: 'Haha', emoji: '😂', writesLike: false },
  { key: 'wow', label: 'Wow', emoji: '😮', writesLike: false },
  { key: 'sad', label: 'Sad', emoji: '😢', writesLike: false },
  { key: 'angry', label: 'Angry', emoji: '😡', writesLike: false },
] as const;

export const FACEBOOK_REACTIONS = REACTION_PALETTE;
export const REACTION_CHOICES = REACTION_PALETTE.map((item) => item.emoji);

const EMOJI_NAMES: Record<string, string> = {
  '👍': 'thumbs up',
  '❤️': 'heart',
  '🤗': 'hugging face',
  '😂': 'face with tears of joy',
  '😮': 'face with open mouth',
  '😢': 'crying face',
  '😡': 'angry face',
};

export function emojiName(value: string): string {
  const text = (value || '').trim();
  return EMOJI_NAMES[text] || 'reaction';
}

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

function usableTimestamp(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) ? text : null;
}

export function parseAtUri(uri: string): { did: string; collection: string; rkey: string } | null {
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

/** Pull a plain emoji out of a record value, tolerating open-union variants. */
export function reactionValueFromRecord(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!isObject(value)) return '';
  for (const key of ['value', 'emoji', 'content', 'text', 'reaction']) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  // Unknown object variant: try its nested value once more, then fall back to
  // the final token of its $type so a reader can still show something honest.
  for (const key of Object.keys(value)) {
    const candidate = value[key];
    if (isObject(candidate)) {
      const nested = reactionValueFromRecord(candidate);
      if (nested) return nested;
    }
  }
  const type = typeOf(value);
  if (type) {
    const token = type.split('#').pop()?.split('.').pop() || '';
    if (token && !token.includes('.') && token.length <= 16) return token;
  }
  return '';
}

export function normaliseReactionRecord(
  value: unknown,
  uri: string,
  cid: string = ''
): ReactionRecord | null {
  if (!isObject(value) && typeof value !== 'string') return null;
  const record = isObject(value) ? value : { value };
  const subjectCandidate =
    record.subject ?? record.target ?? record.post ?? record.ref ?? record.strongRef;
  let subjectUri = '';
  let subjectCid: string | null = null;
  if (typeof subjectCandidate === 'string') {
    subjectUri = subjectCandidate.trim();
  } else if (isObject(subjectCandidate)) {
    subjectUri = cleanText(
      subjectCandidate.uri ?? subjectCandidate.subject ?? subjectCandidate.id
    );
    subjectCid = cleanText(subjectCandidate.cid) || null;
  }
  if (!subjectUri) return null;

  const emoji = reactionValueFromRecord(record.value ?? record);
  if (!emoji) return null;

  const createdAt = usableTimestamp(record.createdAt ?? record.created_at);
  const parts = parseAtUri(uri);
  return {
    uri,
    cid: cleanText(cid) || cleanText(record.cid) || '',
    subjectUri,
    subjectCid,
    value: emoji,
    createdAt,
    actorDid: parts?.did || null,
  };
}

export const normalizeReactionRecord = normaliseReactionRecord;

export function groupReactions(input: unknown, viewerDid: string = ''): ReactionSummary[] {
  const records = Array.isArray(input)
    ? input
    : isObject(input) && Array.isArray((input as any).reactions)
      ? (input as any).reactions
      : isObject(input) && Array.isArray((input as any).records)
        ? (input as any).records
        : [];

  const summaries = new Map<string, ReactionSummary>();
  for (const entry of records) {
    const record = isObject(entry) && 'value' in entry && 'uri' in entry
      ? entry
      : normaliseReactionRecord(entry, cleanText((entry as any)?.uri), cleanText((entry as any)?.cid));
    if (!record) continue;
    const value = (record as any).value || reactionValueFromRecord(entry);
    if (!value) continue;
    const actorDid =
      (record as any).actorDid ||
      (isObject(entry) ? cleanText((entry as any).actorDid) : '') ||
      parseAtUri(cleanText((entry as any)?.uri))?.did ||
      '';
    const existing = summaries.get(value);
    if (existing) {
      existing.count += 1;
      if (actorDid && actorDid === viewerDid) existing.mine = true;
    } else {
      summaries.set(value, {
        value,
        count: 1,
        mine: !!actorDid && actorDid === viewerDid,
      });
    }
  }
  return [...summaries.values()].sort((a, b) => a.value.localeCompare(b.value));
}

export function reactionsForSubject(records: unknown, subjectUri: string): ReactionRecord[] {
  if (!Array.isArray(records)) return [];
  return records
    .map((record) => (isObject(record) ? record : null))
    .filter((record): record is ReactionRecord => !!record && (record as any).subjectUri === subjectUri) as ReactionRecord[];
}

export function filterReactionRecords(
  records: ReactionRecord[],
  isBlocked: (did: string) => boolean = () => false,
  isMuted: (did: string) => boolean = () => false
): ReactionRecord[] {
  return records.filter((record) => {
    if (!record.actorDid) return true;
    if (isBlocked(record.actorDid)) return false;
    if (isMuted(record.actorDid)) return false;
    return true;
  });
}
