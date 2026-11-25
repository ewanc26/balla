/**
 * One bounded, token-free DID document read (#96/#97/#100, partial).
 *
 * A directory or `did:web` host that accepts a request but never completes it
 * must not leave sign-in pre-flight, identity checks or a loading card waiting
 * forever. This is the public JSON reader with the DID Accept type, so the
 * deadline, abort signal and "never read provider prose" rule live in one
 * place. A failed read fails closed to null and the caller's own cached
 * document or next source still applies.
 */

import { fetchPublicJsonObject } from './publicJsonRead.ts';
import type { TimeoutDeps } from './requestTimeout.ts';

export type IdentityDocumentReadDeps = { fetchImpl?: typeof fetch } & TimeoutDeps;

const DID_ACCEPT = 'application/did+ld+json, application/json';

export async function fetchIdentityDocument(
  url: string,
  deps: IdentityDocumentReadDeps = {},
): Promise<unknown | null> {
  if (typeof url !== 'string' || !url) return null;
  try {
    return await fetchPublicJsonObject(url, { ...deps, accept: DID_ACCEPT });
  } catch {
    return null;
  }
}
