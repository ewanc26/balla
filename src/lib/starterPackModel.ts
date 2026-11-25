import { countGraphemes } from 'unicode-segmenter/grapheme';
import { REFERENCE_LIST } from './listModel.ts';
import { BLUESKY_WEB } from './serviceHosts.ts';

export const STARTER_PACK_NAME_MAX = 64;
export const STARTER_PACK_DESCRIPTION_MAX = 300;

const STARTER_PACK_COLLECTION = 'app.bsky.graph.starterpack' as const;
const FEED_ITEM_TYPE = 'app.bsky.graph.starterpack#feedItem' as const;

export type StarterPackUri = { did: string; rkey: string };

/** Accepts only a canonical starter-pack AT URI, never a short link or a bare rkey. */
export function parseStarterPackUri(uri: string): StarterPackUri | null {
  const match =
    /^at:\/\/([^/?#]+)\/app\.bsky\.graph\.starterpack\/([^/?#]+)$/.exec(uri);
  if (!match) return null;
  return { did: match[1], rkey: match[2] };
}

export type StarterPackListUri = { did: string; rkey: string };

/** A starter pack's `list` field must point at app.bsky.graph.list, not a pack. */
export function parseStarterPackListUri(
  uri: unknown
): StarterPackListUri | null {
  const match =
    typeof uri === 'string'
      ? /^at:\/\/([^/?#]+)\/app\.bsky\.graph\.list\/([^/?#]+)$/.exec(uri)
      : null;
  if (!match) return null;
  return { did: match[1], rkey: match[2] };
}

/**
 * Bluesky's official short link uses the creator handle, falling back to the
 * DID when a handle is not present. The rkey comes from the record's AT URI.
 */
export function starterPackShareUrl(
  uri: string,
  creator: { handle?: string; did?: string } | null | undefined
): string | null {
  const parsed = parseStarterPackUri(uri);
  if (!parsed) return null;
  const name = creator?.handle || creator?.did;
  if (!name) return null;
  return BLUESKY_WEB.starterPackShort(name, parsed.rkey);
}

export function isBlockedCreator(creator: any): boolean {
  return !!(creator?.viewer?.blocking || creator?.viewer?.blockedBy);
}

export function validateStarterPackDraft(
  name: unknown,
  description: unknown
): string | null {
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanDescription =
    typeof description === 'string' ? description.trim() : '';

  if (!cleanName) return 'Give the starter pack a name.';
  if (countGraphemes(cleanName) > STARTER_PACK_NAME_MAX) {
    return `Starter pack names can be at most ${STARTER_PACK_NAME_MAX} characters.`;
  }
  if (countGraphemes(cleanDescription) > STARTER_PACK_DESCRIPTION_MAX) {
    return `Starter pack descriptions can be at most ${STARTER_PACK_DESCRIPTION_MAX} characters.`;
  }
  return null;
}

export function starterPackListRecord(
  name: string,
  description: string,
  createdAt: string
) {
  const cleanDescription = description.trim();
  return {
    $type: 'app.bsky.graph.list',
    purpose: REFERENCE_LIST,
    name: name.trim(),
    ...(cleanDescription ? { description: cleanDescription } : {}),
    createdAt,
  };
}

export function starterPackListItemRecord(
  subject: string,
  list: string,
  createdAt: string
) {
  return {
    $type: 'app.bsky.graph.listitem',
    subject,
    list,
    createdAt,
  };
}

export function starterPackRecord({
  name,
  description,
  list,
  feeds,
  createdAt,
}: {
  name: string;
  description: string;
  list: string;
  feeds: string[];
  createdAt: string;
}) {
  const cleanDescription = description.trim();
  return {
    $type: STARTER_PACK_COLLECTION,
    name: name.trim(),
    ...(cleanDescription ? { description: cleanDescription } : {}),
    list,
    feeds: feeds.map((uri) => ({ $type: FEED_ITEM_TYPE, uri })),
    createdAt,
  };
}

export function diffStarterPackMembers(
  current: string[],
  next: string[]
): { added: string[]; removed: string[] } {
  const currentSet = new Set(current);
  const nextSet = new Set(next);
  return {
    added: next.filter((did) => !currentSet.has(did)),
    removed: current.filter((did) => !nextSet.has(did)),
  };
}

/**
 * A retried deletion may find the reference list already gone. Only the PDS's
 * own RecordNotFound response is safe to treat as success; transport and auth
 * failures still surface.
 */
export function isRecordNotFoundError(cause: unknown): boolean {
  const error = cause as any;
  const status = Number(error?.status ?? error?.statusCode);
  const text = `${error?.error || ''} ${error?.message || ''}`;
  return (
    (status === 400 || status === 404) &&
    /record.?not.?found|could not locate record/i.test(text)
  );
}

export function starterPackActionError(
  cause: unknown,
  fallback: string
): string {
  const message = cause instanceof Error ? cause.message : String(cause || '');
  if (
    /\b(scope|permission|unauthorised|unauthorized|forbidden|authentication|authorization)\b/i.test(
      message
    )
  ) {
    return 'Your session needs renewing before Balla can manage starter packs. Sign out, sign in again, and retry.';
  }
  return fallback;
}
