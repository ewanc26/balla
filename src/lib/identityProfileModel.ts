/**
 * Pure rules for reading a profile record straight from a repository's PDS.
 * A blob URL is only built from a CID in the raw record, never from a view URL.
 */
import { getBlobUrl, isValidCid } from './blobOriginModel.ts';

function handleFromDidDoc(document: unknown): string | null {
  const aliases = document && typeof document === 'object'
    ? (document as Record<string, unknown>).alsoKnownAs
    : null;
  if (!Array.isArray(aliases)) return null;
  for (const alias of aliases) {
    if (typeof alias !== 'string') continue;
    const match = /^at:\/\/([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)$/i.exec(alias);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

function imageUrl(value: unknown, endpoint: string, did: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const blob = value as Record<string, unknown>;
  const link = blob.ref;
  const cid = link && typeof link === 'object'
    ? (link as Record<string, unknown>).$link
    : undefined;
  return isValidCid(cid) ? getBlobUrl(endpoint, did, cid) : undefined;
}

/** Build a small, honest profile view from the raw record on the author's PDS. */
export function profileViewFromRecord(
  did: string,
  handle: string | null,
  value: unknown,
  endpoint: string
): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  return {
    did,
    handle: handle || '',
    displayName: typeof record.displayName === 'string' ? record.displayName : undefined,
    description: typeof record.description === 'string' ? record.description : undefined,
    avatar: imageUrl(record.avatar, endpoint, did),
    banner: imageUrl(record.banner, endpoint, did),
    indexedAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
    labels: [],
  };
}

export { handleFromDidDoc };
