/**
 * Real, read-only reachability check for an arbitrary labeler DID.
 *
 * The DID document is the trust anchor: its #atproto_labeler service endpoint
 * is the only host Balla probes. The public com.atproto.label.queryLabels call
 * needs no OAuth scope, so this works for third-party Ozone operators as well
 * as Bluesky's own labeler. Only status codes and structured fields are
 * classified; provider response text is never read, stored or displayed.
 *
 * A public label query does not expose queue lag or a service's mute state, so
 * Balla does not pretend to report either.
 */

import { isDid } from './identityModel.ts';
import { serviceStatusDetail } from './servicesProbe.ts';
import { advertisedEndpoint } from './servicesModel.ts';

/** A valid AT-URI that need not exist; an empty labels array is a valid answer. */
export const LABELER_PROBE_URI = 'at://did:web:example.com/app.bsky.feed.post/selfcheck';
export const LABELER_QUERY_METHOD = '/xrpc/com.atproto.label.queryLabels';

export type LabelerProbeState = 'checking' | 'ok' | 'unavailable' | 'invalid';

export type LabelerProbe = {
  state: LabelerProbeState;
  status: number | null;
  latencyMs: number | null;
  endpoint: string | null;
  detail: string;
};

export type LabelerProbeDeps = {
  resolveDocument: (did: string) => Promise<unknown | null>;
  fetchImpl?: typeof fetch;
};

function probe(
  state: LabelerProbeState,
  status: number | null,
  latencyMs: number | null,
  endpoint: string | null,
  detail: string
): LabelerProbe {
  return { state, status, latencyMs, endpoint, detail };
}

export function checkingLabelerProbe(): LabelerProbe {
  return probe('checking', null, null, null, 'Checking the public label endpoint.');
}

/** The endpoint advertised by the labeler's own DID document. */
export function labelerEndpointFromDocument(document: unknown): string | null {
  return advertisedEndpoint(document, '#atproto_labeler');
}

/** Short, factual UI copy. Failures are never called "down" or "offline". */
export function labelerProbeText(value: LabelerProbe | null | undefined): string {
  if (!value) return 'Public label endpoint: not checked yet.';
  if (value.state === 'checking') return 'Public label endpoint: checking…';
  const status = value.status === null ? '' : ` · HTTP ${value.status}`;
  const latency = value.latencyMs === null ? '' : ` · ${value.latencyMs} ms`;
  if (value.state === 'ok') return `Public label endpoint: reachable${status}${latency}`;
  if (value.state === 'invalid') return 'Public label endpoint: not a valid DID.';
  return `Public label endpoint: not reachable from this device${status}${latency}`;
}

/** Resolve a DID, then make one unauthenticated public label query. */
export async function probeLabeler(
  did: string,
  { resolveDocument, fetchImpl = fetch }: LabelerProbeDeps
): Promise<LabelerProbe> {
  if (!isDid(did)) {
    return probe('invalid', null, null, null, 'That is not a valid DID.');
  }

  let document: unknown | null = null;
  try {
    document = await resolveDocument(did);
  } catch {
    document = null;
  }
  if (!document) {
    return probe('unavailable', null, null, null, 'Could not read the labeler DID document.');
  }

  const endpoint = labelerEndpointFromDocument(document);
  if (!endpoint) {
    return probe('unavailable', null, null, null, 'No labeler service in the DID document.');
  }

  const url = `${endpoint}${LABELER_QUERY_METHOD}?uriPatterns=${encodeURIComponent(LABELER_PROBE_URI)}&limit=1`;
  const started = Date.now();
  let response: Response | null = null;
  try {
    response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  } catch {
    // A blocked CORS request or a failed connection is reported as unmeasured,
    // never as proof that the labeler itself is unavailable.
  }
  const latencyMs = Date.now() - started;

  if (!response) {
    return probe(
      'unavailable',
      null,
      latencyMs,
      endpoint,
      'Could not reach the public label endpoint from this device.'
    );
  }
  if (!response.ok) {
    return probe('unavailable', response.status, latencyMs, endpoint, serviceStatusDetail(response.status));
  }

  try {
    const payload = await response.json() as Record<string, unknown>;
    if (!payload || !Array.isArray(payload.labels)) {
      return probe('unavailable', response.status, latencyMs, endpoint, 'Label response had no labels array.');
    }
    return probe('ok', response.status, latencyMs, endpoint, 'Public label query succeeded.');
  } catch {
    return probe('unavailable', response.status, latencyMs, endpoint, 'Label response was not JSON.');
  }
}
