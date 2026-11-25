/**
 * The one browser link-out to a result's public ATGeo gazetteer record (#156).
 *
 * eurosky-places serves `GET /xrpc/org.atgeo.getPlace?uri=…` for the same
 * `origin` URN that typed search returns. Balla only builds a URL from the
 * configured host and a validated URN; it makes no request itself, reads no
 * provider prose and sends no device position. A result without a valid URN,
 * or a saved host that is not an https origin, gets no link at all.
 */

import { atgeoUrn, normalisePlacesEndpoint } from './placesModel.ts';

const PLACE_RECORD_PATH = '/xrpc/org.atgeo.getPlace';

export function placeRecordUrl(endpoint: unknown, origin: unknown): string | null {
  const host = normalisePlacesEndpoint(endpoint);
  const urn = atgeoUrn(origin);
  if (!host || !urn) return null;
  return `${host}${PLACE_RECORD_PATH}?uri=${encodeURIComponent(urn)}`;
}
