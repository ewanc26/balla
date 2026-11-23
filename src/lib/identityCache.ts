import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  IDENTITY_CACHE_KEY,
  IDENTITY_STRATEGY_KEY,
  MAX_IDENTITY_CACHE_ENTRIES,
  cachedEntryForDid,
  cachedEntryForHandle,
  forgetPlcDidDocuments,
  isFresh,
  normaliseIdentityCache,
  normaliseIdentityStrategy,
  upsertIdentity,
  type IdentityEntry,
  type IdentityStrategy,
} from './identityModel';

// One in-memory mirror per process; AsyncStorage is the durable backing store.
// Storage failures are non-fatal: the cache is a convenience, never a gate.
let entries: IdentityEntry[] | null = null;
let strategy: IdentityStrategy | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeIdentityCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function load(): Promise<IdentityEntry[]> {
  if (entries) return entries;
  try {
    const raw = await AsyncStorage.getItem(IDENTITY_CACHE_KEY);
    entries = normaliseIdentityCache(raw ? JSON.parse(raw) : []);
  } catch {
    entries = [];
  }
  return entries;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(IDENTITY_CACHE_KEY, JSON.stringify(entries || []));
  } catch {
    // A full or unavailable store must not break identity reads.
  }
}

export async function cachedDidDoc(did: string): Promise<unknown | null> {
  const entry = cachedEntryForDid(await load(), did);
  return entry && isFresh(entry) && entry.didDoc ? entry.didDoc : null;
}

export async function cachedHandleDid(handle: string): Promise<string | null> {
  const entry = cachedEntryForHandle(await load(), handle);
  return entry && isFresh(entry) ? entry.did : null;
}

/** Stale entries still count as "seen" when only offline browsing is available. */
export async function knownHandleDid(handle: string): Promise<string | null> {
  const entry = cachedEntryForHandle(await load(), handle);
  return entry?.did ?? null;
}

export async function rememberIdentity(entry: IdentityEntry): Promise<void> {
  entries = upsertIdentity(await load(), entry);
  await persist();
  notify();
}

export async function rememberHandle(handle: string, did: string): Promise<void> {
  const clean = handle.trim().replace(/^@/, '').toLowerCase();
  if (!clean || !did.startsWith('did:')) return;
  const existing = cachedEntryForDid(await load(), did);
  await rememberIdentity({
    did,
    handle: clean,
    didDoc: existing?.didDoc ?? null,
    source: existing?.source ?? null,
    updatedAt: Date.now(),
  });
}

export async function clearIdentityCache(): Promise<void> {
  entries = [];
  await persist();
  notify();
}

/**
 * A public did:plc directory change must take effect for identities already
 * seen on this device. Drop cached did:plc documents so a fresh read uses the
 * configured host, while handle mappings and did:web documents survive for
 * offline browsing.
 */
export async function forgetDirectoryDidDocuments(): Promise<void> {
  const current = await load();
  const next = forgetPlcDidDocuments(current);
  if (next === current) return;
  entries = next;
  await persist();
  notify();
}

/**
 * An account migration changes the DID document's service endpoints. Drop only
 * that identity so its PDS is resolved again; other cached identities remain
 * usable offline. The handle mapping is keyed by DID, so both go together.
 */
export async function invalidateIdentity(did: string): Promise<void> {
  const current = await load();
  const next = current.filter((entry) => entry.did !== did);
  if (next.length === current.length) return;
  entries = next;
  await persist();
  notify();
}

export function identityCacheStats(): { entries: number; limit: number } {
  return { entries: entries?.length ?? 0, limit: MAX_IDENTITY_CACHE_ENTRIES };
}

export async function getIdentityStrategy(): Promise<IdentityStrategy> {
  if (strategy) return strategy;
  try {
    const raw = await AsyncStorage.getItem(IDENTITY_STRATEGY_KEY);
    strategy = normaliseIdentityStrategy(raw);
  } catch {
    strategy = 'auto';
  }
  return strategy;
}

export async function setIdentityStrategy(value: IdentityStrategy): Promise<void> {
  strategy = normaliseIdentityStrategy(value);
  try {
    await AsyncStorage.setItem(IDENTITY_STRATEGY_KEY, strategy);
  } catch {
    // Device-local choice; a failed write keeps the in-memory value for now.
  }
  notify();
}
