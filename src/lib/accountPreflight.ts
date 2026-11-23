/**
 * Read-only pre-login checks for an account on any AT Protocol host (#100,
 * partial). A handle is only a label: the DID document decides the PDS, and
 * the PDS's public metadata decides whether OAuth sign-in can be offered.
 *
 * Nothing here signs in, creates an account, writes a record, or reads a
 * provider's free-form error text. Only HTTP status and structured fields are
 * classified, so a failed check is never presented as a successful login.
 */

import {
  classifyHandleInput,
  didFromWellKnown,
  normaliseHostUrl,
  serverFacts,
  wellKnownUrl,
  type ServerFacts,
} from './hostingModel.ts';
import { plcDocumentUrl } from './serviceHosts.ts';
import { DEFAULT_SERVICES, didWebUrl } from './servicesModel.ts';
import { atprotoPdsEndpoint } from './tealModel.ts';

export type AccountPreflightState =
  | 'invalid'
  | 'unresolved'
  | 'no-pds'
  | 'incompatible'
  | 'no-oauth'
  | 'oauth-incompatible'
  | 'ok';

export type AccountPreflightSource = 'did' | 'well-known' | 'resolver';

/**
 * Fields atproto OAuth makes mandatory for a public client like Balla. The PAR
 * *endpoint* is required; the optional `require_pushed_authorization_requests`
 * hint is not, because a server may allow PAR without setting it.
 */
export type OAuthCapabilityKey =
  | 'code-response'
  | 'auth-code-grant'
  | 'refresh-grant'
  | 's256-pkce'
  | 'public-client'
  | 'atproto-scope'
  | 'issuer-parameter'
  | 'pushed-auth-endpoint'
  | 'dpop-es256'
  | 'client-metadata-document';

export type OAuthCapabilityReport = {
  supported: OAuthCapabilityKey[];
  missing: OAuthCapabilityKey[];
};

export type AccountPreflightResult = {
  state: AccountPreflightState;
  source: AccountPreflightSource | null;
  did: string | null;
  pds: string | null;
  authorizationServer: string | null;
  facts: ServerFacts | null;
  oauthCapabilities: OAuthCapabilityReport | null;
  detail: string;
};

/** Fixed labels for the public-client fields this build's OAuth flow uses. */
export const OAUTH_CAPABILITY_LABELS: Record<OAuthCapabilityKey, string> = {
  'code-response': 'code response type',
  'auth-code-grant': 'authorization_code grant',
  'refresh-grant': 'refresh_token grant',
  's256-pkce': 'S256 PKCE',
  'public-client': 'public client token authentication',
  'atproto-scope': 'atproto scope',
  'issuer-parameter': 'issuer response parameter',
  'pushed-auth-endpoint': 'pushed authorization request endpoint',
  'dpop-es256': 'ES256 DPoP signing',
  'client-metadata-document': 'client_id metadata document support',
};

export const ACCOUNT_PREFLIGHT_COPY = {
  detail:
    'Reads public identity, server and OAuth metadata only. It does not sign you in, create an account, or guarantee that the provider’s approval page will succeed.',
  capabilities:
    'The authorization server’s published fields are checked against the capabilities Balla’s public OAuth client needs: code and refresh grants, S256 PKCE, public-client auth, the atproto scope, issuer responses, PAR, ES256 DPoP and client metadata documents. These are advertised facts, not a promise that sign-in will succeed.',
  limits:
    'A successful check does not grant any scope. AppView, chat and video audiences stay bound to the OAuth grant, so changing them still needs a new authorisation. Account reviews and sign-up approval belong to the host.',
} as const;

/** Shared result labels so every surface describes the same checks identically. */
export const ACCOUNT_PREFLIGHT_STATE_LABELS: Record<AccountPreflightState, string> = {
  invalid: 'Invalid input',
  unresolved: 'Identity not resolved',
  'no-pds': 'No PDS advertised',
  incompatible: 'Not an AT Protocol PDS',
  'no-oauth': 'No usable OAuth metadata',
  'oauth-incompatible': 'OAuth capabilities not advertised',
  ok: 'Public checks passed',
};

const DID_RE = /^did:[a-z]+:[A-Za-z0-9._:%-]+$/i;
const PLC_RE = /^did:plc:[a-z0-9]+$/i;

function result(
  state: AccountPreflightState,
  detail: string,
  fields: Partial<AccountPreflightResult> = {},
): AccountPreflightResult {
  return {
    state,
    source: null,
    did: null,
    pds: null,
    authorizationServer: null,
    facts: null,
    oauthCapabilities: null,
    detail,
    ...fields,
  };
}

async function request(fetchImpl: typeof fetch, url: string): Promise<Response | null> {
  try {
    return await fetchImpl(url, { headers: { Accept: 'application/json' } });
  } catch {
    return null;
  }
}

async function readJson(fetchImpl: typeof fetch, url: string): Promise<unknown | null> {
  const response = await request(fetchImpl, url);
  if (!response?.ok) return null;
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function documentUrl(did: string, plcDirectory: string): string | null {
  if (did.startsWith('did:web:')) {
    const base = didWebUrl(did);
    return base ? `${base}/.well-known/did.json` : null;
  }
  if (PLC_RE.test(did)) return plcDocumentUrl(did, plcDirectory);
  return null;
}

function declaredAuthorizationServers(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const value = (payload as Record<string, unknown>).authorization_servers;
  if (!Array.isArray(value)) return [];
  const origins: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const origin = normaliseHostUrl(item);
    if (origin && !origins.includes(origin)) origins.push(origin);
  }
  return origins;
}

function authorizationServerOk(payload: unknown, origin: string): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const value = payload as Record<string, unknown>;
  return (
    value.issuer === origin &&
    typeof value.authorization_endpoint === 'string' &&
    typeof value.token_endpoint === 'string'
  );
}

const REQUIRED_OAUTH_CAPABILITIES: OAuthCapabilityKey[] = [
  'code-response',
  'auth-code-grant',
  'refresh-grant',
  's256-pkce',
  'public-client',
  'atproto-scope',
  'issuer-parameter',
  'pushed-auth-endpoint',
  'dpop-es256',
  'client-metadata-document',
];

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/** Classify only published structured fields; never read provider prose. */
function classifyOAuthCapabilities(payload: unknown): OAuthCapabilityReport {
  const value = payload && typeof payload === 'object'
    ? (payload as Record<string, unknown>)
    : {};
  const has = (key: OAuthCapabilityKey): boolean => {
    switch (key) {
      case 'code-response':
        return stringList(value.response_types_supported).includes('code');
      case 'auth-code-grant':
        return stringList(value.grant_types_supported).includes('authorization_code');
      case 'refresh-grant':
        return stringList(value.grant_types_supported).includes('refresh_token');
      case 's256-pkce':
        return stringList(value.code_challenge_methods_supported).includes('S256');
      case 'public-client':
        return stringList(value.token_endpoint_auth_methods_supported).includes('none');
      case 'atproto-scope':
        return stringList(value.scopes_supported).includes('atproto');
      case 'issuer-parameter':
        return value.authorization_response_iss_parameter_supported === true;
      case 'pushed-auth-endpoint':
        return (
          typeof value.pushed_authorization_request_endpoint === 'string' &&
          value.pushed_authorization_request_endpoint.length > 0
        );
      case 'dpop-es256':
        return stringList(value.dpop_signing_alg_values_supported).includes('ES256');
      case 'client-metadata-document':
        return value.client_id_metadata_document_supported === true;
    }
  };
  const supported = REQUIRED_OAUTH_CAPABILITIES.filter(has);
  const missing = REQUIRED_OAUTH_CAPABILITIES.filter((key) => !supported.includes(key));
  return { supported, missing };
}

export type AccountPreflightDeps = {
  fetchImpl?: typeof fetch;
  /** Public pre-auth resolver; the screen passes the saved override. */
  resolver?: string;
  /** Public did:plc directory; the screen passes the saved override. */
  plcDirectory?: string;
};

/** Resolve a handle from its own host first, then through the public resolver. */
async function resolveHandle(
  handle: string,
  fetchImpl: typeof fetch,
  resolver: string,
): Promise<{ did: string; source: AccountPreflightSource } | null> {
  const ownUrl = wellKnownUrl(handle);
  if (ownUrl) {
    const response = await request(fetchImpl, ownUrl);
    if (response?.ok) {
      try {
        const did = didFromWellKnown(await response.text());
        if (did && DID_RE.test(did)) return { did, source: 'well-known' };
      } catch {
        // An unreadable well-known file simply falls through to the resolver.
      }
    }
  }
  const base = normaliseHostUrl(resolver);
  if (!base) return null;
  const url = `${base}/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`;
  const payload = await readJson(fetchImpl, url);
  if (!payload || typeof payload !== 'object') return null;
  const did = (payload as Record<string, unknown>).did;
  return typeof did === 'string' && DID_RE.test(did)
    ? { did, source: 'resolver' }
    : null;
}

/**
 * Public, pre-login check of an account's identity, PDS and OAuth metadata.
 * Every network read can be injected for deterministic tests.
 */
export async function probeAccount(
  input: string,
  deps: AccountPreflightDeps = {},
): Promise<AccountPreflightResult> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const resolver = deps.resolver ?? DEFAULT_SERVICES.handleResolver;
  const plcDirectory = deps.plcDirectory ?? DEFAULT_SERVICES.plcDirectory;
  const classified = classifyHandleInput(input);

  let identity: { did: string; source: AccountPreflightSource } | null = null;
  if (classified.kind === 'did') {
    identity = { did: classified.value, source: 'did' };
  } else if (classified.kind === 'handle') {
    identity = await resolveHandle(classified.value, fetchImpl, resolver);
  } else {
    return result(
      'invalid',
      'Enter a handle (alice.example.com) or a DID. For a host without an account, use Check a host in Advanced → Hosting.',
    );
  }
  if (!identity) return result('unresolved', 'Could not resolve this handle or DID from public sources.');

  const url = documentUrl(identity.did, plcDirectory);
  if (!url) return result('unresolved', 'This DID method is not resolved by the public pre-flight.', { ...identity });
  const document = await readJson(fetchImpl, url);
  if (!document) return result('unresolved', 'The DID document could not be read from a public directory.', { ...identity });

  const pds = normaliseHostUrl(atprotoPdsEndpoint(document) ?? '');
  if (!pds) return result('no-pds', 'The DID document does not advertise an https #atproto_pds endpoint.', { ...identity });

  const server = await readJson(fetchImpl, `${pds}/xrpc/com.atproto.server.describeServer`);
  const facts = serverFacts(server);
  if (!facts) {
    return result('incompatible', 'The PDS answered, but not with a valid AT Protocol server description.', {
      ...identity,
      pds,
    });
  }

  const protectedResource = await readJson(fetchImpl, `${pds}/.well-known/oauth-protected-resource`);
  const servers = declaredAuthorizationServers(protectedResource);
  if (!servers.length) {
    return result('no-oauth', 'The PDS did not publish an authorization server for OAuth sign-in.', {
      ...identity,
      pds,
      facts,
    });
  }

  const authorizationServer = servers[0];
  const metadata = await readJson(fetchImpl, `${authorizationServer}/.well-known/oauth-authorization-server`);
  if (!authorizationServerOk(metadata, authorizationServer)) {
    return result('no-oauth', 'The PDS declares OAuth, but its authorization server metadata could not be read.', {
      ...identity,
      pds,
      facts,
      authorizationServer,
    });
  }

  const oauthCapabilities = classifyOAuthCapabilities(metadata);
  if (oauthCapabilities.missing.length) {
    const missing = oauthCapabilities.missing.map((key) => OAUTH_CAPABILITY_LABELS[key]).join(', ');
    return result(
      'oauth-incompatible',
      `The authorization server does not advertise: ${missing}. Balla’s public OAuth client needs these fields.`,
      { ...identity, pds, facts, authorizationServer, oauthCapabilities },
    );
  }

  return result(
    'ok',
    'Public identity, PDS and OAuth metadata checked, including the fields Balla’s public client needs. Sign-in still uses the provider’s own approval page.',
    { ...identity, pds, facts, authorizationServer, oauthCapabilities },
  );
}
