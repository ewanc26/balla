/**
 * Framework-free service facts and defaults.
 *
 * AT Protocol splits a session into roles. Only one of them can honestly be
 * changed at runtime: the pre-authorisation XRPC handle resolver. The AppView,
 * chat, video and labeler audiences are written into the OAuth grant scope
 * (111 tokens in oauth-client-metadata.json), so pointing them somewhere else
 * needs a fresh authorisation. Balla shows those as facts, never as inert
 * toggles. Keeping every default here makes "no host outside config" auditable.
 */

import { normaliseHostUrl } from './hostingModel.ts';

export const DEFAULT_SERVICES = {
  /** Unauthenticated resolver used before sign-in. Runtime-editable. */
  handleResolver: 'https://bsky.social',
  /** Discovered from the signed-in account's DID document, not configured. */
  pds: 'https://bsky.social',
  appviewDid: 'did:web:api.bsky.app',
  appviewAudience: 'did:web:api.bsky.app#bsky_appview',
  chatDid: 'did:web:api.bsky.chat',
  chatAudience: 'did:web:api.bsky.chat#bsky_chat',
  videoService: 'https://video.bsky.app',
  videoAudience: 'did:web:video.bsky.app',
  labelerDid: 'did:plc:ar7c4by46qjdydhdevvrndac',
  labelerAudience: 'did:plc:ar7c4by46qjdydhdevvrndac#atproto_labeler',
  plcDirectory: 'https://plc.directory',
} as const;

export const SERVICES_STORAGE_KEY = 'balla.services.v1';

/** Only the resolver is editable; `null` means "use the default". */
export type ServicesConfig = {
  handleResolver: string | null;
};

export const DEFAULT_SERVICES_CONFIG: ServicesConfig = { handleResolver: null };

export function normaliseServicesConfig(raw: unknown): ServicesConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SERVICES_CONFIG };
  const value = raw as Record<string, unknown>;
  const endpoint = typeof value.handleResolver === 'string' ? normaliseHostUrl(value.handleResolver) : null;
  // Persisting the default explicitly is pointless; null keeps one source of truth.
  return {
    handleResolver: endpoint && endpoint !== DEFAULT_SERVICES.handleResolver ? endpoint : null,
  };
}

export function effectiveResolver(config: ServicesConfig): string {
  return config.handleResolver ?? DEFAULT_SERVICES.handleResolver;
}

export function isDefaultResolver(config: ServicesConfig): boolean {
  return config.handleResolver === null;
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

export type ServiceSlot = 'resolver' | 'appview' | 'chat' | 'pds' | 'video' | 'labeler';

export const SERVICE_SLOT_COPY: Record<ServiceSlot, { label: string; detail: string }> = {
  resolver: {
    label: 'Handle resolver',
    detail: 'Used before sign-in for handles without a well-known file. Changeable now.',
  },
  appview: {
    label: 'AppView',
    detail: 'Serves timelines, profiles and notifications for this grant. Grant-bound.',
  },
  chat: {
    label: 'Chat service',
    detail: 'Serves direct messages through a service proxy. Grant-bound.',
  },
  pds: {
    label: 'Account PDS',
    detail: 'Discovered from this account’s DID document. Cannot be overridden.',
  },
  video: {
    label: 'Video service',
    detail: 'Handles video upload limits and uploads. Grant-bound.',
  },
  labeler: {
    label: 'Moderation labeler',
    detail: 'Default report and label service. Grant-bound; other labelers are an Advanced choice.',
  },
};
