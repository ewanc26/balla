import {
  hostProbeCopy,
  normaliseHostUrl,
  serverFacts,
  type HostProbeState,
  type ServerFacts,
} from './hostingModel.ts';
import {
  HOST_TIMEOUT_DETAIL,
  withDeadline,
  type TimeoutDeps,
} from './requestTimeout.ts';

/**
 * Public, unauthenticated host check. `describeServer` is the AT Protocol
 * handshake every PDS serves; it needs no OAuth scope and writes nothing.
 * Only the HTTP status and structured fields are kept — a provider's error
 * message is never read, logged or shown. The read shares the one bounded
 * deadline used by every other public probe, so a host that accepts a request
 * but never answers cannot leave the check spinner running forever.
 */

export type HostProbeDeps = { fetchImpl?: typeof fetch } & TimeoutDeps;

export type HostProbeResult = {
  state: HostProbeState;
  host: string | null;
  facts: ServerFacts | null;
  detail: string;
};

function result(state: HostProbeState, host: string | null, facts: ServerFacts | null): HostProbeResult {
  return { state, host, facts, detail: hostProbeCopy(state) };
}

export async function probeHost(input: string, deps: HostProbeDeps = {}): Promise<HostProbeResult> {
  const host = normaliseHostUrl(input);
  if (!host) return result('invalid', null, null);

  const outcome = await withDeadline(async (signal) => {
    try {
      const response = await (deps.fetchImpl ?? fetch)(`${host}/xrpc/com.atproto.server.describeServer`, {
        headers: { Accept: 'application/json' },
        signal,
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
  }, deps);

  if (outcome.state === 'timeout') {
    return { state: 'unreachable', host, facts: null, detail: HOST_TIMEOUT_DETAIL };
  }
  return outcome.value;
}
