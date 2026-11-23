import { agent } from './agent';
import { createNativeFirstHandleResolver } from './nativeHandleResolver';
import { getPlcDirectoryEndpoint } from './servicesConfig.ts';
import { DEFAULT_SERVICES } from './servicesModel.ts';
import { readWithRetry } from './reliability';
import {
  cachedDidDoc,
  cachedHandleDid,
  getIdentityStrategy,
  knownHandleDid,
  rememberHandle,
  rememberIdentity,
  subscribeIdentityCache,
} from './identityCache';
import {
  didWebDocumentUrl,
  isDid,
  normaliseHandle,
  plcDirectoryUrl,
  type IdentitySource,
  type LookupSource,
} from './identityModel';

/**
 * Strategy-aware identity reads. A DID document is the source of truth for
 * where an account lives; handles are only labels that map to a DID. Every
 * successful read is cached on device so previously seen identities keep
 * working when a directory is unreachable. No new OAuth scope is needed:
 * these are public, unauthenticated directory and DID-document reads.
 */

let lastSource: LookupSource = 'none';
const sourceListeners = new Set<() => void>();

// The same native-first resolver sign-in uses. Its fallback factory reads the
// persisted endpoint on every resolve, so a handle lookup made when the AppView
// is unreachable honours the configured resolver instead of an implicit
// Bluesky host. No scope or new dependency: these are public unauthenticated
// reads already shipped for sign-in.
const publicHandleResolver = createNativeFirstHandleResolver(DEFAULT_SERVICES.handleResolver);

function markSource(source: LookupSource): void {
  lastSource = source;
  for (const listener of sourceListeners) listener();
}

export function lastIdentitySource(): LookupSource {
  return lastSource;
}

export function subscribeIdentitySource(listener: () => void): () => void {
  sourceListeners.add(listener);
  return () => {
    sourceListeners.delete(listener);
  };
}

async function fetchDocument(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/did+ld+json, application/json' },
    });
    if (!response.ok) return null;
    const document = await response.json();
    return document && typeof document === 'object' ? document : null;
  } catch {
    return null;
  }
}

/** Read a DID document, honouring the configured strategy and caching result. */
export async function resolveDidDocument(did: string): Promise<unknown | null> {
  if (!isDid(did)) {
    markSource('none');
    return null;
  }
  const strategy = await getIdentityStrategy();
  const cached = await cachedDidDoc(did);

  if (strategy === 'local-only') {
    markSource(cached ? 'cache' : 'none');
    return cached;
  }
  if (cached && strategy !== 'registry-first' && strategy !== 'web-first') {
    markSource('cache');
    return cached;
  }

  const sources: IdentitySource[] =
    strategy === 'web-first' ? ['web', 'plc', 'pds'] : ['plc', 'web', 'pds'];

  for (const source of sources) {
    let document: unknown | null = null;
    try {
      if (source === 'plc') {
        const url = plcDirectoryUrl(did, await getPlcDirectoryEndpoint());
        if (url) document = await readWithRetry(() => fetchDocument(url));
      } else if (source === 'web') {
        const url = didWebDocumentUrl(did);
        if (url) document = await readWithRetry(() => fetchDocument(url));
      } else {
        const resolved = await readWithRetry(() =>
          agent.com.atproto.identity.resolveDid({ did })
        );
        document = resolved.data;
      }
    } catch {
      document = null;
    }
    if (document) {
      await rememberIdentity({
        did,
        handle: null,
        didDoc: document,
        source,
        updatedAt: Date.now(),
      });
      markSource('network');
      return document;
    }
  }

  // Every network route failed: a stale cached document is still better than
  // pretending we never saw this identity, and is labelled as cached.
  if (cached) {
    markSource('cache');
    return cached;
  }
  markSource('none');
  return null;
}

/** Resolve a handle to a DID, preferring the on-device mapping. */
export async function resolveHandleToDid(input: string): Promise<string | null> {
  const handle = normaliseHandle(input);
  if (!handle) {
    markSource('none');
    return null;
  }
  const strategy = await getIdentityStrategy();
  const cached = await cachedHandleDid(handle);
  if (cached || strategy === 'local-only') {
    markSource(cached ? 'cache' : 'none');
    return cached;
  }

  try {
    const did = await readWithRetry(() => publicHandleResolver.resolve(handle));
    if (isDid(did)) {
      await rememberHandle(handle, did);
      markSource('network');
      return did;
    }
  } catch {
    // Fall through to any previously seen mapping below.
  }

  const known = await knownHandleDid(handle);
  markSource(known ? 'cache' : 'none');
  return known;
}

/** Remember a handle seen during an ordinary profile read for offline use. */
export async function noteProfileHandle(handle: string | null | undefined, did: string): Promise<void> {
  const clean = normaliseHandle(handle);
  if (clean && isDid(did)) await rememberHandle(clean, did);
}

export { subscribeIdentityCache, getIdentityStrategy, setIdentityStrategy } from './identityCache';
