import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_SERVICES,
  DEFAULT_SERVICES_CONFIG,
  SERVICES_STORAGE_KEY,
  effectiveResolver,
  normaliseServicesConfig,
  type ServicesConfig,
} from './servicesModel.ts';

/**
 * Persisted service choices. Only the pre-auth resolver is editable; every
 * other slot is derived from the OAuth grant or the account's DID document.
 * Storage failures are non-fatal: the app falls back to the compiled default.
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

export async function resetServicesConfig(): Promise<ServicesConfig> {
  await persist({ ...DEFAULT_SERVICES_CONFIG });
  return getServicesConfig();
}

/** Exposed for tests and diagnostics; never returns token material. */
export function configuredResolverOr(fallback: string = DEFAULT_SERVICES.handleResolver): string {
  return cached ? effectiveResolver(cached) : fallback;
}
