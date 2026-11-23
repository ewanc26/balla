/**
 * Pure identity rules. Handles and DID documents are public data, so a
 * size-capped on-device cache lets Balla keep reading profiles when an upstream
 * directory is unreachable. The DID document stays the source of truth for
 * where an account lives; a handle suffix never implies a Bluesky host.
 */

import { SERVICE_HOSTS } from './serviceHosts.ts';

export const IDENTITY_CACHE_KEY = 'balla.identity.cache.v1';
export const IDENTITY_STRATEGY_KEY = 'balla.identity.strategy.v1';

/** Bounded: profiles are a convenience, not an archive. */
export const MAX_IDENTITY_CACHE_ENTRIES = 120;
/** Re-resolve after a day so migrations are eventually noticed. */
export const IDENTITY_TTL_MS = 24 * 60 * 60 * 1000;

export const IDENTITY_STRATEGIES = [
  'auto',
  'registry-first',
  'web-first',
  'local-only',
] as const;
export type IdentityStrategy = (typeof IDENTITY_STRATEGIES)[number];

export type IdentitySource = 'plc' | 'web' | 'pds';
export type LookupSource = 'cache' | 'network' | 'none';

export type IdentityEntry = {
  did: string;
  handle: string | null;
  didDoc: unknown | null;
  source: IdentitySource | null;
  updatedAt: number;
};

const DID_RE = /^did:[a-z]+:[A-Za-z0-9._:%-]+$/i;
const HANDLE_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

export function isDid(value: unknown): value is string {
  return typeof value === 'string' && DID_RE.test(value);
}

export function normaliseHandle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(/^@/, '').toLowerCase();
  return HANDLE_RE.test(cleaned) ? cleaned : null;
}

export function normaliseIdentityStrategy(value: unknown): IdentityStrategy {
  return IDENTITY_STRATEGIES.find((strategy) => strategy === value) ?? 'auto';
}

/** The public directory URL for a did:plc identifier. */
export function plcDirectoryUrl(did: string): string | null {
  return isDid(did) && did.startsWith('did:plc:')
    ? `${SERVICE_HOSTS.plcDirectory}/${encodeURIComponent(did)}`
    : null;
}

/**
 * did:web maps its identifier to a host and optional path. Percent-encoding is
 * decoded so `did:web:example.com:user` resolves to `/user/did.json`.
 */
export function didWebDocumentUrl(did: string): string | null {
  if (!isDid(did) || !did.startsWith('did:web:')) return null;
  try {
    const raw = did.slice('did:web:'.length).replace(/%3A/gi, ':');
    const [host, ...path] = raw.split(':');
    if (!host || !/^[a-z0-9.-]+$/i.test(host)) return null;
    const suffix = path.length ? `/${path.map(encodeURIComponent).join('/')}` : '/.well-known';
    return `https://${host}${suffix}/did.json`;
  } catch {
    return null;
  }
}

/**
 * Resolution order for one DID. The cache is always consulted first; local
 * only skips the network. "Auto" follows the DID's own method, which matches
 * current behaviour, while the two explicit strategies reverse the order.
 */
export function resolverOrder(strategy: IdentityStrategy, did: string): Array<'cache' | 'plc' | 'web'> {
  if (strategy === 'local-only') return ['cache'];
  if (strategy === 'registry-first') return ['cache', 'plc', 'web'];
  if (strategy === 'web-first') return ['cache', 'web', 'plc'];
  return isDid(did) && did.startsWith('did:web:')
    ? ['cache', 'web', 'plc']
    : ['cache', 'plc', 'web'];
}

export function isFresh(entry: IdentityEntry, now = Date.now()): boolean {
  return Number.isFinite(entry.updatedAt) && now - entry.updatedAt <= IDENTITY_TTL_MS;
}

export function cachedEntryForDid(entries: IdentityEntry[], did: string): IdentityEntry | null {
  return entries.find((entry) => entry.did === did) ?? null;
}

export function cachedEntryForHandle(entries: IdentityEntry[], handle: string | null): IdentityEntry | null {
  const key = normaliseHandle(handle);
  if (!key) return null;
  return entries.find((entry) => entry.handle === key) ?? null;
}

/** Drop malformed, duplicate and overflowing entries; newest first. */
export function normaliseIdentityCache(value: unknown): IdentityEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: IdentityEntry[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Record<string, unknown>;
    const did = candidate.did;
    if (!isDid(did) || seen.has(did)) continue;
    const handle = normaliseHandle(candidate.handle);
    const source = ['plc', 'web', 'pds'].includes(String(candidate.source))
      ? (candidate.source as IdentitySource)
      : null;
    const updatedAt = typeof candidate.updatedAt === 'number' && candidate.updatedAt > 0
      ? candidate.updatedAt
      : 0;
    seen.add(did);
    result.push({
      did,
      handle,
      didDoc: candidate.didDoc ?? null,
      source,
      updatedAt,
    });
  }
  return result
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_IDENTITY_CACHE_ENTRIES);
}

/** Insert or replace one identity, keeping the same bounded cap. */
export function upsertIdentity(entries: IdentityEntry[], entry: IdentityEntry): IdentityEntry[] {
  if (!isDid(entry.did)) return normaliseIdentityCache(entries);
  return normaliseIdentityCache([entry, ...entries.filter((item) => item.did !== entry.did)]);
}
