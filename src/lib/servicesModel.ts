/**
 * Framework-free service facts and defaults.
 *
 * AT Protocol splits a session into roles. Three read-only hosts can honestly be
 * changed at runtime: the pre-authorisation XRPC handle resolver, the public
 * did:plc directory and the token-free places provider used for typed search.
 * None needs a token or changes an existing grant. The
 * AppView, chat, video and labeler audiences are written into the OAuth grant
 * scope (112 tokens in oauth-client-metadata.json), so pointing them somewhere
 * else needs a fresh authorisation. Balla shows those as facts, never as inert
 * toggles. Keeping every default here makes "no host outside config" auditable.
 */

import { normaliseHostUrl } from './hostingModel.ts';
import { SERVICE_HOSTS } from './serviceHosts.ts';

export const DEFAULT_SERVICES = {
  /** Unauthenticated resolver used before sign-in. Runtime-editable. */
  handleResolver: SERVICE_HOSTS.handleResolver,
  /** Discovered from the signed-in account's DID document, not configured. */
  pds: SERVICE_HOSTS.pds,
  appviewDid: SERVICE_HOSTS.appviewDid,
  appviewAudience: SERVICE_HOSTS.appviewAudience,
  chatDid: SERVICE_HOSTS.chatDid,
  chatAudience: SERVICE_HOSTS.chatAudience,
  videoService: SERVICE_HOSTS.videoService,
  videoAudience: SERVICE_HOSTS.videoAudience,
  labelerDid: SERVICE_HOSTS.labelerDid,
  labelerAudience: SERVICE_HOSTS.labelerAudience,
  plcDirectory: SERVICE_HOSTS.plcDirectory,
  places: SERVICE_HOSTS.places,
} as const;

export const SERVICES_STORAGE_KEY = 'balla.services.v1';

/** Only public, token-free read hosts are editable; `null` means "use the default". */
export type ServicesConfig = {
  handleResolver: string | null;
  plcDirectory: string | null;
  places: string | null;
};

export const DEFAULT_SERVICES_CONFIG: ServicesConfig = {
  handleResolver: null,
  plcDirectory: null,
  places: null,
};

function override(value: unknown, fallback: string): string | null {
  const endpoint = typeof value === 'string' ? normaliseHostUrl(value) : null;
  // Persisting the default explicitly is pointless; null keeps one source of truth.
  return endpoint && endpoint !== fallback ? endpoint : null;
}

export function normaliseServicesConfig(raw: unknown): ServicesConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SERVICES_CONFIG };
  const value = raw as Record<string, unknown>;
  return {
    handleResolver: override(value.handleResolver, DEFAULT_SERVICES.handleResolver),
    plcDirectory: override(value.plcDirectory, DEFAULT_SERVICES.plcDirectory),
    places: override(value.places, DEFAULT_SERVICES.places),
  };
}

export function effectiveResolver(config: ServicesConfig): string {
  return config.handleResolver ?? DEFAULT_SERVICES.handleResolver;
}

export function isDefaultResolver(config: ServicesConfig): boolean {
  return config.handleResolver === null;
}

export function effectivePlcDirectory(config: ServicesConfig): string {
  return config.plcDirectory ?? DEFAULT_SERVICES.plcDirectory;
}

export function isDefaultPlcDirectory(config: ServicesConfig): boolean {
  // Treat a missing field as "default" so config persisted before this setting
  // existed, and partial diagnostic fixtures, stay on the safe compiled host.
  return config.plcDirectory == null;
}

export function effectivePlaces(config: ServicesConfig): string {
  return config.places ?? DEFAULT_SERVICES.places;
}

export function isDefaultPlaces(config: ServicesConfig): boolean {
  // Config persisted before this setting existed has no field: keep the default.
  return config.places == null;
}

const DID_WEB_RE = /^did:web:([a-z0-9.-]+)(?::(.+))?$/i;

/** did:web is a hostname with optional ':' path segments. */
export function didWebUrl(did: string): string | null {
  const match = DID_WEB_RE.exec(did);
  if (!match) return null;
  const host = match[1].replace(/%[0-9a-f]{2}/gi, (part) => decodeURIComponent(part).toLowerCase());
  if (!/^[a-z0-9.-]+$/i.test(host)) return null;
  const path = match[2] ? `/${match[2].split(':').map(encodeURIComponent).join('/')}` : '';
  return `https://${host}${path}`;
}

/** An https endpoint belonging to a service DID document. */
export function advertisedEndpoint(document: unknown, fragment: string): string | null {
  if (!document || typeof document !== 'object') return null;
  const services = (document as Record<string, unknown>).service;
  if (!Array.isArray(services)) return null;
  for (const item of services) {
    if (!item || typeof item !== 'object') continue;
    const service = item as Record<string, unknown>;
    const id = typeof service.id === 'string' ? service.id : '';
    const type = typeof service.type === 'string' ? service.type : '';
    const endpoint = service.serviceEndpoint;
    if ((id === fragment || id.endsWith(fragment) || type === fragment.slice(1)) && typeof endpoint === 'string') {
      const url = normaliseHostUrl(endpoint);
      if (url) return url;
    }
  }
  return null;
}

export type ServiceSlot = 'resolver' | 'plcDirectory' | 'places' | 'appview' | 'chat' | 'pds' | 'video' | 'labeler';

export const SERVICE_SLOT_COPY: Record<ServiceSlot, { label: string; detail: string }> = {
  resolver: {
    label: 'Handle resolver',
    detail: 'Bluesky fallback. Used before sign-in for handles without a well-known file. Changeable now.',
  },
  plcDirectory: {
    label: 'PLC directory',
    detail: 'Bluesky fallback. Public did:plc DID document directory for identity resolution and pre-flight checks. Changeable now.',
  },
  places: {
    label: 'Places provider',
    detail: 'Eurosky default. Typed place search only; Balla never sends your device position. No check-in record is written while the pin lexicon is a draft.',
  },
  appview: {
    label: 'AppView',
    detail: 'Eurosky-operated. Serves timelines, profiles and notifications for this grant. Grant-bound.',
  },
  chat: {
    label: 'Chat service',
    detail: 'Bluesky fallback. Serves direct messages through a service proxy. Grant-bound.',
  },
  pds: {
    label: 'Account PDS',
    detail: 'Eurosky for new sign-ups; otherwise discovered from this account’s DID document. Cannot be overridden.',
  },
  video: {
    label: 'Video service',
    detail: 'Bluesky fallback. Handles video upload limits and uploads. Grant-bound.',
  },
  labeler: {
    label: 'Moderation labeler',
    detail: 'Bluesky fallback. Default report and label service. Grant-bound; other labelers are an Advanced choice.',
  },
};
