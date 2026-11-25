/**
 * Real, read-only connection checks for the service roles shown in Advanced →
 * Services. Every probe performs an unauthenticated public GET and reports the
 * HTTP status, latency and structured fields it needs. Provider error text is
 * never read, logged or displayed.
 */

import { VIDEO_LIMITS_LXM, didWebDocumentUrl, plcDocumentUrl } from './serviceHosts.ts';
import {
  DEFAULT_SERVICES,
  advertisedEndpoint,
  didWebUrl,
} from './servicesModel.ts';

export type ProbeState = 'checking' | 'ok' | 'unavailable' | 'invalid';

export type ServiceProbe = {
  state: ProbeState;
  status: number | null;
  latencyMs: number | null;
  endpoint: string | null;
  detail: string;
};

const DID_RE = /^did:[a-z]+:[A-Za-z0-9._:%-]+$/i;
/** A public handle with a DID, so an XRPC resolver must actually resolve it. */
const RESOLVER_CANARY = 'selfhosted.social';

function probe(state: ProbeState, status: number | null, latencyMs: number | null, endpoint: string | null, detail: string): ServiceProbe {
  return { state, status, latencyMs, endpoint, detail };
}

export type ServiceProbeDeps = { fetchImpl?: typeof fetch };

async function timed(url: string, fetchImpl: typeof fetch = fetch): Promise<{ response: Response | null; latencyMs: number }> {
  const started = Date.now();
  try {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    return { response, latencyMs: Date.now() - started };
  } catch {
    return { response: null, latencyMs: Date.now() - started };
  }
}

export function serviceStatusDetail(status: number): string {
  if (status >= 500) return 'Service returned a server error.';
  if (status === 429) return 'Service is rate limiting requests.';
  if (status >= 400) return `Service answered HTTP ${status}; no usable response.`;
  return `Service answered HTTP ${status}.`;
}

/** Public handle → DID through the configured XRPC resolver. */
export async function probeResolver(endpoint: string): Promise<ServiceProbe> {
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(endpoint)) {
    return probe('invalid', null, null, endpoint, 'Enter an https host without a path.');
  }
  const url = `${endpoint}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(RESOLVER_CANARY)}`;
  const { response, latencyMs } = await timed(url);
  if (!response) return probe('unavailable', null, latencyMs, endpoint, 'Could not reach this resolver.');
  if (!response.ok) return probe('unavailable', response.status, latencyMs, endpoint, serviceStatusDetail(response.status));
  try {
    const payload = await response.json() as Record<string, unknown>;
    const did = typeof payload.did === 'string' && DID_RE.test(payload.did) ? payload.did : null;
    return did
      ? probe('ok', response.status, latencyMs, endpoint, `Resolved a public handle to ${did.slice(0, 24)}…`)
      : probe('unavailable', response.status, latencyMs, endpoint, 'Response had no valid DID field.');
  } catch {
    return probe('unavailable', response.status, latencyMs, endpoint, 'Response was not JSON.');
  }
}

/**
 * Public did:plc directory check against the configured host. Reads one known
 * public DID document and verifies its structured `id` field; provider error
 * text is never read, logged or displayed.
 */
export async function probePlcDirectory(directory: string, deps: ServiceProbeDeps = {}): Promise<ServiceProbe> {
  const base = /^https:\/\/[a-z0-9.-]+$/i.test(directory) ? directory : null;
  if (!base) return probe('invalid', null, null, directory, 'Enter an https host without a path.');
  const canary = DEFAULT_SERVICES.labelerDid;
  const url = plcDocumentUrl(canary, base);
  if (!url) return probe('invalid', null, null, base, 'Invalid directory address.');
  const { response, latencyMs } = await timed(url, deps.fetchImpl);
  if (!response) return probe('unavailable', null, latencyMs, base, 'Could not reach this directory.');
  if (!response.ok) return probe('unavailable', response.status, latencyMs, base, serviceStatusDetail(response.status));
  try {
    const document = await response.json() as Record<string, unknown>;
    return document.id === canary
      ? probe('ok', response.status, latencyMs, base, 'Read a public did:plc document from this directory.')
      : probe('unavailable', response.status, latencyMs, base, 'Response was not the requested DID document.');
  } catch {
    return probe('unavailable', response.status, latencyMs, base, 'Response was not JSON.');
  }
}

/** AppView DID document plus an optional public profile read for this account. */
export async function probeAppView(actorDid?: string | null): Promise<ServiceProbe> {
  const endpoint = didWebUrl(DEFAULT_SERVICES.appviewDid);
  const documentUrl = didWebDocumentUrl(DEFAULT_SERVICES.appviewDid);
  if (!endpoint || !documentUrl) return probe('invalid', null, null, null, 'Invalid AppView DID.');
  const { response, latencyMs } = await timed(documentUrl);
  if (!response) return probe('unavailable', null, latencyMs, endpoint, 'Could not read the AppView DID document.');
  if (!response.ok) return probe('unavailable', response.status, latencyMs, endpoint, serviceStatusDetail(response.status));
  try {
    const document = await response.json();
    const advertised = advertisedEndpoint(document, '#bsky_appview');
    if (!advertised) return probe('unavailable', response.status, latencyMs, endpoint, 'No AppView service in the DID document.');
    if (actorDid && DID_RE.test(actorDid)) {
      const readUrl = `${advertised}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actorDid)}`;
      const read = await timed(readUrl);
      if (!read.response) return probe('unavailable', null, read.latencyMs, advertised, 'DID document reachable; profile read failed.');
      if (!read.response.ok) return probe('unavailable', read.response.status, read.latencyMs, advertised, serviceStatusDetail(read.response.status));
      try {
        const profile = await read.response.json() as Record<string, unknown>;
        if (typeof profile.did !== 'string' || profile.did !== actorDid) {
          return probe('unavailable', read.response.status, read.latencyMs, advertised, 'Profile read returned a different DID.');
        }
      } catch {
        return probe('unavailable', read.response.status, read.latencyMs, advertised, 'Profile read was not JSON.');
      }
      return probe('ok', read.response.status, read.latencyMs, advertised, 'DID document and profile read succeeded.');
    }
    return probe('ok', response.status, latencyMs, advertised, 'AppView service advertised in its DID document.');
  } catch {
    return probe('unavailable', response.status, latencyMs, endpoint, 'DID document was not JSON.');
  }
}

/**
 * The video XRPC endpoint is checked without a token. A 401 is a real, useful
 * answer: it proves the endpoint exists and that quota needs this sign-in's
 * grant. The response body is never parsed, so provider prose cannot surface.
 */
export async function probeVideoEndpoint(deps: ServiceProbeDeps = {}): Promise<ServiceProbe> {
  const endpoint = DEFAULT_SERVICES.videoService;
  const url = `${endpoint}/xrpc/${VIDEO_LIMITS_LXM}`;
  const { response, latencyMs } = await timed(url, deps.fetchImpl);
  if (!response) return probe('unavailable', null, latencyMs, endpoint, 'Could not reach the video endpoint.');
  if (response.status === 401 || response.status === 403) {
    return probe('ok', response.status, latencyMs, endpoint, 'Endpoint reachable; quota needs a sign-in token.');
  }
  if (!response.ok) return probe('unavailable', response.status, latencyMs, endpoint, serviceStatusDetail(response.status));
  return probe('ok', response.status, latencyMs, endpoint, 'Endpoint answered without requiring a token.');
}

/** Chat service DID document advertises a bsky_chat proxy endpoint. */
export async function probeChat(): Promise<ServiceProbe> {
  const endpoint = didWebUrl(DEFAULT_SERVICES.chatDid);
  const documentUrl = didWebDocumentUrl(DEFAULT_SERVICES.chatDid);
  if (!endpoint || !documentUrl) return probe('invalid', null, null, null, 'Invalid chat service DID.');
  const { response, latencyMs } = await timed(documentUrl);
  if (!response) return probe('unavailable', null, latencyMs, endpoint, 'Could not read the chat DID document.');
  if (!response.ok) return probe('unavailable', response.status, latencyMs, endpoint, serviceStatusDetail(response.status));
  try {
    const advertised = advertisedEndpoint(await response.json(), '#bsky_chat');
    return advertised
      ? probe('ok', response.status, latencyMs, advertised, 'Chat service advertised in its DID document.')
      : probe('unavailable', response.status, latencyMs, endpoint, 'No chat service in the DID document.');
  } catch {
    return probe('unavailable', response.status, latencyMs, endpoint, 'DID document was not JSON.');
  }
}
