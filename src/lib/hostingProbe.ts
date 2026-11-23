import {
  hostProbeCopy,
  normaliseHostUrl,
  serverFacts,
  type HostProbeState,
  type ServerFacts,
} from './hostingModel';

/**
 * Public, unauthenticated host check. `describeServer` is the AT Protocol
 * handshake every PDS serves; it needs no OAuth scope and writes nothing.
 * Only the HTTP status and structured fields are kept — a provider's error
 * message is never read, logged or shown.
 */

export type HostProbeResult = {
  state: HostProbeState;
  host: string | null;
  facts: ServerFacts | null;
  detail: string;
};

function result(state: HostProbeState, host: string | null, facts: ServerFacts | null): HostProbeResult {
  return { state, host, facts, detail: hostProbeCopy(state) };
}

export async function probeHost(input: string): Promise<HostProbeResult> {
  const host = normaliseHostUrl(input);
  if (!host) return result('invalid', null, null);

  try {
    const response = await fetch(`${host}/xrpc/com.atproto.server.describeServer`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      // A non-2xx answer proves the host is up but cannot be classified as an
      // AT Protocol PDS from its public description. Status only, no text.
      return result(response.status >= 500 ? 'unreachable' : 'not-atproto', host, null);
    }
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return result('not-atproto', host, null);
    }
    const facts = serverFacts(payload);
    return facts ? result('reachable', host, facts) : result('not-atproto', host, null);
  } catch {
    return result('unreachable', host, null);
  }
}
