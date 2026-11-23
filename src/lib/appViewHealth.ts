/**
 * Read-only AppView health facts for Advanced → AppView (#99, partial).
 *
 * The AppView DID and audience are written into this sign-in's OAuth grant, so
 * Balla cannot switch providers at runtime. This module only performs public,
 * unauthenticated reads and reports structured facts: HTTP status, latency and
 * the advertised service endpoint. It deliberately reports neither sync lag nor
 * feed freshness, because these public reads do not expose either.
 */

import {
  DEFAULT_SERVICES,
  advertisedEndpoint,
  didWebUrl,
} from './servicesModel.ts';
import { serviceStatusDetail, type ProbeState } from './servicesProbe.ts';

export const APPVIEW_HEALTH_DID = DEFAULT_SERVICES.appviewDid;
export const APPVIEW_HEALTH_AUDIENCE = DEFAULT_SERVICES.appviewAudience;

export const APPVIEW_HEALTH_COPY = {
  grant:
    'This AppView is fixed in this sign-in’s OAuth grant. Balla cannot repoint it without a new authorisation.',
  measures:
    'Check makes unauthenticated public reads: the AppView’s did:web document and, when signed in, one profile canary for this account. It reports HTTP status and elapsed time from this device.',
  limits:
    'These reads do not report sync lag, feed freshness or any other provider. This build has no mirror, failover or per-function routing, so #99 remains open. The grant-bound AppView and its hydration facts are shown only on this screen; they are a fact of the grant, not a switch or a live check.'
} as const;

export type AppViewHealthProbe = {
  state: ProbeState;
  status: number | null;
  latencyMs: number | null;
  endpoint: string | null;
  documentLatencyMs: number | null;
  profileLatencyMs: number | null;
  detail: string;
};

const ACTOR_DID_RE = /^did:[a-z]+:[A-Za-z0-9._:%-]+$/i;

function result(
  state: ProbeState,
  status: number | null,
  latencyMs: number | null,
  endpoint: string | null,
  documentLatencyMs: number | null,
  profileLatencyMs: number | null,
  detail: string,
): AppViewHealthProbe {
  return { state, status, latencyMs, endpoint, documentLatencyMs, profileLatencyMs, detail };
}

/** Formats only measured values and status-only classifications. */
export function appViewHealthText(probe: AppViewHealthProbe | null): string {
  if (!probe) return 'Not checked';
  if (probe.state === 'checking') return 'Checking…';
  if (probe.state === 'invalid') return probe.detail;
  const measured: string[] = [];
  if (probe.status !== null) measured.push(`HTTP ${probe.status}`);
  if (probe.documentLatencyMs !== null) measured.push(`DID document ${probe.documentLatencyMs} ms`);
  if (probe.profileLatencyMs !== null) measured.push(`profile read ${probe.profileLatencyMs} ms`);
  const prefix = probe.state === 'ok' ? 'OK' : 'Unavailable';
  return measured.length ? `${prefix} · ${measured.join(' · ')}` : `${prefix} · ${probe.detail}`;
}

export type AppViewHealthDeps = {
  /** Defaults to the grant-bound AppView; injectable for deterministic tests. */
  did?: string;
  /** Only a signed-in account's own DID is used for the public profile canary. */
  actorDid?: string | null;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

async function timedFetch(
  fetchImpl: typeof fetch,
  now: () => number,
  url: string,
): Promise<{ response: Response | null; latencyMs: number }> {
  const started = now();
  try {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    return { response, latencyMs: Math.max(0, now() - started) };
  } catch {
    return { response: null, latencyMs: Math.max(0, now() - started) };
  }
}

/**
 * Reads the grant-bound AppView's DID document and advertised endpoint, then
 * optionally checks one public profile. Failures are classified from HTTP
 * status and structured fields alone; provider error prose is never read.
 */
export async function probeAppViewHealth(
  deps: AppViewHealthDeps = {},
): Promise<AppViewHealthProbe> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? Date.now;
  const did = deps.did ?? APPVIEW_HEALTH_DID;
  const base = didWebUrl(did);
  if (!base) {
    return result('invalid', null, null, null, null, null, 'Grant-bound AppView DID has no did:web document URL.');
  }

  const documentUrl = `${base}/.well-known/did.json`;
  const documentRead = await timedFetch(fetchImpl, now, documentUrl);
  if (!documentRead.response) {
    return result('unavailable', null, documentRead.latencyMs, base, documentRead.latencyMs, null, 'Could not read the AppView DID document from this device.');
  }
  const status = documentRead.response.status;
  if (!documentRead.response.ok) {
    return result('unavailable', status, documentRead.latencyMs, base, documentRead.latencyMs, null, serviceStatusDetail(status));
  }

  let endpoint: string | null = null;
  try {
    endpoint = advertisedEndpoint(await documentRead.response.json(), '#bsky_appview');
  } catch {
    return result('unavailable', status, documentRead.latencyMs, base, documentRead.latencyMs, null, 'AppView DID document was not JSON.');
  }
  if (!endpoint) {
    return result('unavailable', status, documentRead.latencyMs, base, documentRead.latencyMs, null, 'DID document does not advertise #bsky_appview.');
  }

  const actorDid = deps.actorDid;
  if (!actorDid || !ACTOR_DID_RE.test(actorDid)) {
    return result('ok', status, documentRead.latencyMs, endpoint, documentRead.latencyMs, null, 'AppView service advertised in its DID document. Sign in for the profile canary.');
  }

  const readUrl = `${endpoint}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actorDid)}`;
  const profileRead = await timedFetch(fetchImpl, now, readUrl);
  if (!profileRead.response) {
    return result('unavailable', null, profileRead.latencyMs, endpoint, documentRead.latencyMs, profileRead.latencyMs, 'DID document reachable; profile canary could not be read.');
  }
  const readStatus = profileRead.response.status;
  if (!profileRead.response.ok) {
    return result('unavailable', readStatus, profileRead.latencyMs, endpoint, documentRead.latencyMs, profileRead.latencyMs, serviceStatusDetail(readStatus));
  }
  try {
    const profile = await profileRead.response.json() as Record<string, unknown>;
    if (profile.did !== actorDid) {
      return result('unavailable', readStatus, profileRead.latencyMs, endpoint, documentRead.latencyMs, profileRead.latencyMs, 'Profile canary returned a different DID.');
    }
  } catch {
    return result('unavailable', readStatus, profileRead.latencyMs, endpoint, documentRead.latencyMs, profileRead.latencyMs, 'Profile canary was not JSON.');
  }
  return result('ok', readStatus, profileRead.latencyMs, endpoint, documentRead.latencyMs, profileRead.latencyMs, 'DID document and public profile canary succeeded.');
}
