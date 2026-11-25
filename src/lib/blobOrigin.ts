import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { readBoundedPublic } from './boundedPublicFetch.ts';
import { resolveDidDocument } from './identityResolver';
import type { TimeoutDeps } from './requestTimeout.ts';
import { atprotoPdsEndpoint } from './tealModel';
import {
  MAX_BLOB_CACHE_BYTES,
  blobCacheKey,
  evictToCap,
  getBlobUrl,
  type BlobFallback,
} from './blobOriginModel';

type CachedBlob = { uri: string; bytes: number; release: () => void };

// Insertion order is oldest -> newest. Only resolved blob bytes are stored;
// no credentials, post text or account data ever enter this cache.
const cache = new Map<string, CachedBlob>();
let totalBytes = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeBlobCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function blobCacheInfo(): { entries: number; bytes: number; cap: number } {
  return { entries: cache.size, bytes: totalBytes, cap: MAX_BLOB_CACHE_BYTES };
}

export function clearBlobCache(): void {
  for (const entry of cache.values()) entry.release();
  cache.clear();
  totalBytes = 0;
  notify();
}

function evictIfNeeded(): void {
  // Pass newest -> oldest so evictToCap keeps recent images and drops old ones.
  const newestFirst = Array.from(cache, ([key, value]) => ({ key, bytes: value.bytes })).reverse();
  for (const key of evictToCap(newestFirst)) {
    const entry = cache.get(key);
    if (!entry) continue;
    entry.release();
    totalBytes -= entry.bytes;
    cache.delete(key);
  }
}

async function displayUri(
  bytes: Uint8Array,
  mimeType: string,
  key: string
): Promise<{ uri: string; release: () => void }> {
  if (Platform.OS === 'web') {
    const blob = new Blob([bytes as BlobPart], {
      type: mimeType || 'application/octet-stream',
    });
    const uri = URL.createObjectURL(blob);
    return { uri, release: () => URL.revokeObjectURL(uri) };
  }
  // Native cannot display a getBlob HTTP URL directly, so write the bytes to
  // the app cache and render the file. Filenames are derived from DID + CID.
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(-140);
  const file = new File(Paths.cache, `balla-blob-${safe}`);
  await file.write(bytes);
  return {
    uri: file.uri,
    release: () => {
      try {
        file.delete();
      } catch {
        // Cache eviction is best-effort; a stale cache file is harmless.
      }
    },
  };
}

/**
 * Resolve one blob from its author's PDS. Returns a displayable URI or null;
 * failures are always non-fatal so a broken CDN URL can keep its placeholder.
 * The HTTP read is public and unauthenticated: getBlob needs no OAuth scope.
 */
export type BlobReadDeps = { fetchImpl?: typeof fetch } & TimeoutDeps;

export async function resolveBlobUri(
  fallback: BlobFallback,
  deps: BlobReadDeps = {}
): Promise<string | null> {
  if (!fallback?.did || !fallback?.cid) return null;
  const key = blobCacheKey(fallback.did, fallback.cid);
  const hit = cache.get(key);
  if (hit) return hit.uri;

  try {
    // The DID document is the source of truth for the author's repo host.
    // Reuse the strategy-aware resolver so this public read honours the
    // configured did:plc directory instead of an implicit Bluesky host.
    const document = await resolveDidDocument(fallback.did);
    const endpoint = atprotoPdsEndpoint(document);
    if (!endpoint) return null;

    // A plain fetch avoids the AppView proxy that the SDK agent attaches to
    // every XRPC call; getBlob must be read from the PDS itself. The shared
    // bounded reader cancels a PDS that never finishes the byte stream, so a
    // broken image cannot leave a placeholder waiting forever.
    const result = await readBoundedPublic(
      getBlobUrl(endpoint, fallback.did, fallback.cid),
      {
        ...deps,
        accept: 'image/*',
        parse: async (response) => ({
          bytes: new Uint8Array(await response.arrayBuffer()),
          contentType: response.headers.get('Content-Type')?.split(';')[0] ?? '',
        }),
      },
    );
    if (result.state !== 'value' || !result.value.bytes.byteLength) return null;
    const { bytes, contentType } = result.value;

    const mime = fallback.mimeType || contentType || 'image/jpeg';
    const stored = await displayUri(bytes, mime, key);
    cache.set(key, { uri: stored.uri, bytes: bytes.byteLength, release: stored.release });
    totalBytes += bytes.byteLength;
    evictIfNeeded();
    notify();
    // A blob larger than the cap would be evicted immediately; never hand out
    // a URI whose object URL or file has just been released.
    return cache.has(key) ? stored.uri : null;
  } catch {
    return null;
  }
}
