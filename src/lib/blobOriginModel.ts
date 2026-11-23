/**
 * Framework-free rules for PDS-origin image fallback. AppView image URLs can
 * fail independently of the blob itself: blobs are content-addressed and are
 * served by the author's PDS by DID + CID. These helpers only ever use a CID
 * taken from the raw post record; they never fabricate one from a CDN URL.
 */

export type BlobFallback = {
  did: string;
  cid: string;
  mimeType?: string;
};

export type BlobRef = { cid: string; mimeType?: string };

/** In-memory cap for fetched blobs, in bytes (8 MB). */
export const MAX_BLOB_CACHE_BYTES = 8 * 1024 * 1024;

/** The two strategies are real behaviour, not inert labels. */
export const BLOB_ORIGIN_STRATEGIES = ['follow-url', 'pds-first'] as const;
export type BlobOriginStrategy = (typeof BLOB_ORIGIN_STRATEGIES)[number];

const DID_RE = /^did:[a-z0-9]+:[a-zA-Z0-9._:%-]+$/i;
// AT Protocol CIDs are base32/base58; require a plausible, URL-safe length.
const CID_RE = /^[a-zA-Z0-9]{20,}$/;

export function isValidDid(value: unknown): value is string {
  return typeof value === 'string' && DID_RE.test(value);
}

export function isValidCid(value: unknown): value is string {
  return typeof value === 'string' && CID_RE.test(value);
}

export function normaliseBlobOriginStrategy(value: unknown): BlobOriginStrategy {
  return value === 'pds-first' ? 'pds-first' : 'follow-url';
}

function blobRef(image: unknown): BlobRef | null {
  if (!image || typeof image !== 'object') return null;
  const blob = (image as Record<string, unknown>).image;
  if (!blob || typeof blob !== 'object') return null;
  const link = (blob as Record<string, unknown>).ref;
  if (!link || typeof link !== 'object') return null;
  const cid = (link as Record<string, unknown>).$link;
  if (!isValidCid(cid)) return null;
  const mimeType = (blob as Record<string, unknown>).mimeType;
  return { cid, mimeType: typeof mimeType === 'string' ? mimeType : undefined };
}

function refsFromEmbed(embed: unknown): (BlobRef | null)[] {
  if (!embed || typeof embed !== 'object') return [];
  const value = embed as Record<string, unknown>;
  const type = typeof value.$type === 'string' ? value.$type : '';
  if (type.endsWith('app.bsky.embed.images')) {
    return Array.isArray(value.images) ? value.images.map(blobRef) : [];
  }
  if (type.endsWith('app.bsky.embed.gallery')) {
    return Array.isArray(value.items) ? value.items.map(blobRef) : [];
  }
  if (type.endsWith('app.bsky.embed.recordWithMedia')) {
    return refsFromEmbed(value.media);
  }
  return [];
}

/**
 * Blob descriptors aligned, in order, with the view images `extractImages()`
 * reads from the same post. A `null` means that image has no trustworthy CID,
 * so no PDS fallback can be attempted for it.
 */
export function blobFallbacksForPost(post: unknown): (BlobFallback | null)[] {
  if (!post || typeof post !== 'object') return [];
  const value = post as Record<string, unknown>;
  const author = value.author as Record<string, unknown> | undefined;
  const did = author?.did;
  if (!isValidDid(did)) return [];
  const record = value.record as Record<string, unknown> | undefined;
  return refsFromEmbed(record?.embed).map((ref) =>
    ref ? { did, cid: ref.cid, mimeType: ref.mimeType } : null
  );
}

export function blobCacheKey(did: string, cid: string): string {
  return `${did}|${cid}`;
}

/** Build a public `sync.getBlob` read against the author's own PDS. */
export function getBlobUrl(endpoint: string, did: string, cid: string): string {
  const base = endpoint.replace(/\/+$/, '');
  return `${base}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;
}

export type SizedCacheEntry = { key: string; bytes: number };

/**
 * Given entries from newest to oldest, return the keys to evict until the
 * total fits the cap. A single entry larger than the cap is always evicted.
 */
export function evictToCap(
  entries: SizedCacheEntry[],
  maxBytes: number = MAX_BLOB_CACHE_BYTES
): string[] {
  let total = 0;
  const evicted: string[] = [];
  for (const entry of entries) {
    if (total + entry.bytes <= maxBytes) total += entry.bytes;
    else evicted.push(entry.key);
  }
  return evicted;
}
