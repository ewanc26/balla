/**
 * Framework-free rules for account hosting. A DID document is the source of
 * truth for where an account lives; a handle is only a label. These helpers
 * never inspect a provider's free-form error text: the host check classifies
 * the HTTP status and the structured fields of describeServer only.
 */

import { normaliseHandle } from './identityModel.ts';
import { normaliseHttpsOrigin } from './serviceHosts.ts';
import { atprotoPdsEndpoint } from './tealModel.ts';

export const WELL_KNOWN_SUFFIX = '/.well-known/atproto-did';
export const OPEN_PDS_DIRECTORY = 'https://openpds.tijs.org/';
export const IDENTITY_DOCS_URL = 'https://atproto.com/specs/handle';

const DID_RE = /^did:[a-z]+:[A-Za-z0-9._:%-]+$/i;

export type HostProbeState =
  | 'idle'
  | 'checking'
  | 'reachable'
  | 'not-atproto'
  | 'unreachable'
  | 'invalid';

export type ServerFacts = {
  did: string | null;
  domains: string[];
  inviteRequired: boolean | null;
  phoneRequired: boolean | null;
  hasPolicyLinks: boolean;
};

export type HandleInput =
  | { kind: 'handle'; value: string }
  | { kind: 'did'; value: string }
  | { kind: 'host'; value: string }
  | { kind: 'invalid' };

/** Normalise a handle for the protocol-native well-known fetch. */
export function wellKnownUrl(handle: string): string | null {
  const clean = normaliseHandle(handle);
  if (!clean) return null;
  try {
    const url = new URL(`https://${clean}${WELL_KNOWN_SUFFIX}`);
    if (url.hostname !== clean || url.username || url.password || url.port) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Read a DID from the first line of a well-known response. */
export function didFromWellKnown(body: string): string | null {
  if (typeof body !== 'string') return null;
  const first = body.split('\n')[0]?.trim() ?? '';
  return DID_RE.test(first) ? first : null;
}

/** Split free-form sign-in input into the three shapes OAuth accepts. */
export function classifyHandleInput(input: string): HandleInput {
  const value = input.trim().replace(/^@/, '');
  if (!value || /\s/.test(value)) return { kind: 'invalid' };
  if (DID_RE.test(value)) return { kind: 'did', value };
  if (normaliseHandle(value)) return { kind: 'handle', value: value.toLowerCase() };
  const host = normaliseHostUrl(value);
  return host ? { kind: 'host', value: host } : { kind: 'invalid' };
}

/**
 * Accept a bare host or an https URL and return a canonical base URL. Paths,
 * queries, fragments and embedded credentials are rejected: they are not a
 * service origin, and accepting them would make a host check misleading. The
 * rule lives with the service host facts so settings, identity reads, public
 * probes and imports cannot drift into different validators.
 */
export function normaliseHostUrl(input: string): string | null {
  return normaliseHttpsOrigin(input);
}

/** Structured fields only; provider message text is deliberately ignored. */
export function serverFacts(payload: unknown): ServerFacts | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = payload as Record<string, unknown>;
  const did = typeof value.did === 'string' && DID_RE.test(value.did) ? value.did : null;
  if (!did) return null;
  const domains = Array.isArray(value.availableUserDomains)
    ? value.availableUserDomains.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
  const links = value.links && typeof value.links === 'object' ? (value.links as Record<string, unknown>) : {};
  return {
    did,
    domains,
    inviteRequired: typeof value.inviteCodeRequired === 'boolean' ? value.inviteCodeRequired : null,
    phoneRequired: typeof value.phoneVerificationRequired === 'boolean' ? value.phoneVerificationRequired : null,
    hasPolicyLinks: typeof links.privacyPolicy === 'string' || typeof links.termsOfService === 'string',
  };
}

export function hostProbeCopy(state: HostProbeState): string {
  switch (state) {
    case 'idle':
      return 'Enter a host or handle, then check it.';
    case 'checking':
      return 'Reading this host’s public server description…';
    case 'reachable':
      return 'This host answered an AT Protocol server description.';
    case 'not-atproto':
      return 'The host answered, but not with a valid AT Protocol server description.';
    case 'unreachable':
      return 'Could not reach this host. Check the address and try again.';
    case 'invalid':
      return 'Enter a handle (alice.example.com), a did: identifier, or an https host.';
  }
}

export { atprotoPdsEndpoint };
