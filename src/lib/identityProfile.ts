/**
 * Public-PDS profile read used when the AppView cannot serve `getProfile`.
 * Identity (handle → DID, DID → PDS endpoint) comes from the on-device cache
 * first, so a profile seen before still renders when only its PDS is reachable.
 * The profile record itself is a public repo read: no new OAuth scope.
 */
import { isDid } from './identityModel';
import {
  lastIdentitySource,
  resolveDidDocument,
  resolveHandleToDid,
} from './identityResolver';
import { fetchPublicJsonObject } from './publicJsonRead.ts';
import { atprotoPdsEndpoint } from './tealModel';
import { handleFromDidDoc, profileViewFromRecord } from './identityProfileModel';

export type OfflineProfile = {
  profile: Record<string, unknown>;
  identityFromCache: boolean;
};

export { profileViewFromRecord } from './identityProfileModel';

/** Resolve identity from cache where possible, then read the profile from its PDS. */
export async function readProfileFromPds(actor: string): Promise<OfflineProfile | null> {
  const did = isDid(actor) ? actor : await resolveHandleToDid(actor);
  if (!did) return null;

  const document = await resolveDidDocument(did);
  const identityFromCache = lastIdentitySource() === 'cache';
  const endpoint = atprotoPdsEndpoint(document);
  if (!endpoint) return null;

  const url = `${endpoint}/xrpc/com.atproto.repo.getRecord` +
    `?repo=${encodeURIComponent(did)}` +
    `&collection=${encodeURIComponent('app.bsky.actor.profile')}` +
    '&rkey=self';

  try {
    const body = await fetchPublicJsonObject(url);
    if (!body) return null;
    const view = profileViewFromRecord(
      did,
      handleFromDidDoc(document),
      body.value,
      endpoint
    );
    return view ? { profile: view, identityFromCache } : null;
  } catch {
    return null;
  }
}
