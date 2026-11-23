/**
 * Framework-free rules for reporting chat-service availability. Message text is
 * private: nothing here reads a message, preview or conversation body, and no
 * failure copy includes provider-supplied message content.
 */
import { CHAT_AUDIENCE, CHAT_SERVICE_DID, CHAT_SERVICE_TYPE } from './chatModel.ts';

export { CHAT_AUDIENCE, CHAT_SERVICE_DID, CHAT_SERVICE_TYPE };

/** Public guide for the atproto-proxy header chat uses. */
export const CHAT_SERVICE_DOCS_URL = 'https://atproto.blue/guides/proxies-and-labelers/';

export const CHAT_SERVICE_STATES = [
  'checking',
  'reachable',
  'unreachable',
  'not-advertised',
  'unauthorised',
  'disabled',
  'limited',
  'unknown',
] as const;

export type ChatServiceState = (typeof CHAT_SERVICE_STATES)[number];

function statusOf(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const candidate =
    (err as { status?: unknown }).status ?? (err as { statusCode?: unknown }).statusCode;
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : null;
}

/**
 * Only the XRPC error code and HTTP status are inspected. Reading an error
 * message could surface private conversation details, so it is deliberately
 * not used for classification or display.
 */
export function chatServiceStateFromError(err: unknown): ChatServiceState {
  const status = statusOf(err);
  const raw =
    err && typeof err === 'object'
      ? (err as { error?: unknown }).error ?? (err as { name?: unknown }).name
      : null;
  const code = String(raw || '').toLowerCase();

  if (/messagesdisabled|chatdisabled/.test(code)) return 'disabled';
  if (status === 404 || status === 405 || status === 501) return 'not-advertised';
  if (/unknownmethod|methodnotfound|notimplemented|notsupported|unsupported|proxyunsupported/.test(code)) {
    return 'not-advertised';
  }
  if (status === 401 || status === 403) return 'unauthorised';
  if (status === 429 || /ratelimit|rate.?limit/.test(code)) return 'limited';
  if (status !== null && status >= 500) return 'unreachable';
  if (/offline|network|fetch|connection|timeout/.test(code)) return 'unreachable';
  return 'unknown';
}

/** A DID document advertises chat when it has a real HTTPS service for this type. */
export function chatServiceFromDidDocument(document: unknown): Record<string, unknown> | null {
  if (!document || typeof document !== 'object') return null;
  const services = (document as Record<string, unknown>).service;
  if (!Array.isArray(services)) return null;
  for (const entry of services) {
    if (!entry || typeof entry !== 'object') continue;
    const service = entry as Record<string, unknown>;
    const id = typeof service.id === 'string' ? service.id.toLowerCase() : '';
    const type = typeof service.type === 'string' ? service.type.toLowerCase() : '';
    const endpoint = typeof service.serviceEndpoint === 'string' ? service.serviceEndpoint : '';
    if (!/^https?:\/\/\S+$/i.test(endpoint)) continue;
    if (id.includes(CHAT_SERVICE_TYPE) || type.includes('chat')) return service;
  }
  return null;
}

export function chatServiceAdvertised(document: unknown): boolean {
  return chatServiceFromDidDocument(document) !== null;
}

/** True when the whole Messages screen should show an explanatory state. */
export function isServiceWideFailure(state: ChatServiceState): boolean {
  return (
    state === 'not-advertised' ||
    state === 'unauthorised' ||
    state === 'disabled' ||
    state === 'unreachable'
  );
}

/** Plain-language, honest copy. Never includes message text or credentials. */
export function chatServiceCopy(state: ChatServiceState): string {
  switch (state) {
    case 'checking':
      return 'Checking the chat service…';
    case 'reachable':
      return 'The chat service answered. Messages are available on this host.';
    case 'not-advertised':
      return 'DMs need a chat service your host doesn’t run. Your posts, profiles and other Balla screens keep working.';
    case 'unauthorised':
      return 'This session does not have chat access. Sign in again to grant chat permissions, or ask your host.';
    case 'disabled':
      return 'Chat is turned off for this account. Change that in your provider’s chat settings.';
    case 'unreachable':
      return 'The chat service could not be reached. Your posts, profiles and other Balla screens keep working.';
    case 'limited':
      return 'The chat service is limiting requests just now. Try again shortly.';
    default:
      return 'Chat status could not be determined. The rest of Balla is unaffected.';
  }
}
