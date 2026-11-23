/**
 * The feed's "hydration source" label (#99, partial).
 *
 * Every hydrated read in this build goes through the AppView whose DID and
 * audience are written into the sign-in's OAuth grant. The label therefore
 * names a stable fact of the grant, not a live measurement of one response, a
 * failover indicator or a provider choice. It reads the same audited service
 * model as the AppView health screen, so it cannot drift to another host.
 */

import { DEFAULT_SERVICES } from './servicesModel.ts';

export const HYDRATION_SOURCE_DID = DEFAULT_SERVICES.appviewDid;
export const HYDRATION_SOURCE_AUDIENCE = DEFAULT_SERVICES.appviewAudience;

export const HYDRATION_SOURCE_COPY = {
  label: 'Hydration source',
  detail: 'Fixed by your sign-in’s OAuth grant; no alternative AppView is used.',
  note: 'Names the AppView that hydrates this timeline. It is a grant fact, not a live check, a failover status or a freshness claim.',
  buttonLabel: 'AppView source details',
  buttonHint: 'Open the AppView facts and public health check',
} as const;

/** The DID alone, in full, with no invented short name or status. */
export function hydrationSourceText(did: string = HYDRATION_SOURCE_DID): string {
  return did;
}
