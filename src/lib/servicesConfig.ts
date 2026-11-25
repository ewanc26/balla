import AsyncStorage from '@react-native-async-storage/async-storage';
import { forgetDirectoryDidDocuments } from './identityCache.ts';
import {
  DEFAULT_SERVICES,
  DEFAULT_SERVICES_CONFIG,
  SERVICES_STORAGE_KEY,
  effectivePlcDirectory,
  effectiveResolver,
  isPlacesEnabled,
  normaliseServicesConfig,
  type ServicesConfig,
} from './servicesModel.ts';

/**
 * Persisted service choices. Only the three public, token-free read hosts are
 * editable: the pre-auth resolver, the did:plc directory and the places
 * provider used for typed search, which can also be switched off. Every other
 * slot is derived from the OAuth grant or the account's DID document. Storage
 * failures are non-fatal: the app falls back to the compiled default.
 */
let cached: ServicesConfig | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeServicesConfig(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function getServicesConfig(): Promise<ServicesConfig> {
  if (cached) return cached;
  try {
    const raw = await AsyncStorage.getItem(SERVICES_STORAGE_KEY);
    cached = normaliseServicesConfig(raw ? JSON.parse(raw) : DEFAULT_SERVICES_CONFIG);
  } catch {
    cached = { ...DEFAULT_SERVICES_CONFIG };
  }
  return cached;
}

/** The endpoint the native-first resolver should use for its XRPC fallback. */
export async function getHandleResolverEndpoint(fallback: string = DEFAULT_SERVICES.handleResolver): Promise<string> {
  const config = await getServicesConfig();
  return config.handleResolver ?? fallback;
}

/** The public did:plc directory used for identity reads and pre-flight checks. */
export async function getPlcDirectoryEndpoint(fallback: string = DEFAULT_SERVICES.plcDirectory): Promise<string> {
  const config = await getServicesConfig();
  return config.plcDirectory ?? fallback;
}

/** The public places host used for typed search; no position is ever stored. */
export async function getPlacesEndpoint(fallback: string = DEFAULT_SERVICES.places): Promise<string> {
  const config = await getServicesConfig();
  return config.places ?? fallback;
}

/** Whether typed place search is allowed at all. Legacy config stays on. */
export async function getPlacesEnabled(): Promise<boolean> {
  return isPlacesEnabled(await getServicesConfig());
}

async function persist(config: ServicesConfig): Promise<void> {
  cached = normaliseServicesConfig(config);
  try {
    await AsyncStorage.setItem(SERVICES_STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // Keep the in-memory value for this process; a storage failure is not an
    // error the user can fix, and the default remains safe.
  }
  notify();
}

/** Pass null to restore the compiled default. */
export async function setHandleResolverEndpoint(endpoint: string | null): Promise<ServicesConfig> {
  const config = await getServicesConfig();
  const next = { ...config, handleResolver: endpoint };
  await persist(next);
  return getServicesConfig();
}

/** Pass null to restore the compiled default did:plc directory. */
export async function setPlcDirectoryEndpoint(endpoint: string | null): Promise<ServicesConfig> {
  const config = await getServicesConfig();
  const before = effectivePlcDirectory(config);
  const next = { ...config, plcDirectory: endpoint };
  await persist(next);
  const after = await getServicesConfig();
  if (effectivePlcDirectory(after) !== before) await forgetDirectoryDidDocuments();
  return after;
}

/** Pass null to restore the compiled default places provider. */
export async function setPlacesEndpoint(endpoint: string | null): Promise<ServicesConfig> {
  const config = await getServicesConfig();
  await persist({ ...config, places: endpoint });
  return getServicesConfig();
}

/** Switch typed place search off without touching the configured host. */
export async function setPlacesEnabled(enabled: boolean): Promise<ServicesConfig> {
  const config = await getServicesConfig();
  await persist({ ...config, placesEnabled: enabled });
  return getServicesConfig();
}

export async function resetServicesConfig(): Promise<ServicesConfig> {
  const before = effectivePlcDirectory(await getServicesConfig());
  await persist({ ...DEFAULT_SERVICES_CONFIG });
  const after = await getServicesConfig();
  if (effectivePlcDirectory(after) !== before) await forgetDirectoryDidDocuments();
  return after;
}

/** Exposed for tests and diagnostics; never returns token material. */
export function configuredResolverOr(fallback: string = DEFAULT_SERVICES.handleResolver): string {
  return cached ? effectiveResolver(cached) : fallback;
}
