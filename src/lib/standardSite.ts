/**
 * Public record reads for the Standard.site reader.
 *
 * These records are public repo data, so no OAuth scope is needed. The AppView
 * does not serve `site.standard.*` records; the author's PDS does. DID documents
 * remain the source of truth for where a record lives, and the PDS resolver is
 * injected so this module stays free of React Native and agent imports.
 *
 * Only HTTP status, structured `error` codes and record fields are classified.
 * A provider's free-form message text is never read, stored or displayed.
 */

import {
  canonicalUrl,
  DOCUMENT_COLLECTION,
  normaliseDocument,
  normalisePublication,
  parseAtUri,
  PUBLICATION_COLLECTION,
  VERIFICATION_PATH,
  verificationState,
  type StandardDocument,
  type StandardPublication,
  type VerificationState,
} from './standardSiteModel.ts';

export type StandardSiteLoad =
  | {
      state: 'ok';
      document: StandardDocument;
      publication: StandardPublication | null;
      pds: string | null;
      publicationPds: string | null;
      verification: VerificationState;
    }
  | { state: 'invalid' | 'not-found' | 'unavailable' };

export type StandardSiteDeps = {
  /** Resolve a DID to its advertised PDS endpoint, or null when unreachable. */
  resolveEndpoint: (did: string) => Promise<string | null>;
  fetchImpl?: typeof fetch;
};

/** Classify an XRPC failure from its status and error code, never its message. */
function recordFailure(response: Response, body: unknown): 'not-found' | 'unavailable' {
  const code =
    body && typeof body === 'object' && typeof (body as Record<string, unknown>).error === 'string'
      ? (body as Record<string, unknown>).error
      : '';
  if (response.status === 404 || code === 'RecordNotFound') return 'not-found';
  return 'unavailable';
}

async function readRecord(
  endpoint: string,
  did: string,
  collection: string,
  rkey: string,
  fetchImpl: typeof fetch,
): Promise<{ state: 'ok'; value: unknown; cid: string | null } | { state: 'not-found' | 'unavailable' }> {
  const url =
    `${endpoint.replace(/\/+$/, '')}/xrpc/com.atproto.repo.getRecord` +
    `?repo=${encodeURIComponent(did)}` +
    `&collection=${encodeURIComponent(collection)}` +
    `&rkey=${encodeURIComponent(rkey)}`;
  try {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) return { state: recordFailure(response, body) };
    if (!body || typeof body !== 'object') return { state: 'unavailable' };
    const record = body as Record<string, unknown>;
    if (!('value' in record)) return { state: 'unavailable' };
    return {
      state: 'ok',
      value: record.value,
      cid: typeof record.cid === 'string' && record.cid ? record.cid : null,
    };
  } catch {
    return { state: 'unavailable' };
  }
}

/** Read the well-known endpoint and compare its AT-URI with the record's own. */
export async function checkStandardSiteVerification(
  publicationUrl: string,
  expectedUri: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VerificationState> {
  try {
    const response = await fetchImpl(`${publicationUrl.replace(/\/+$/, '')}${VERIFICATION_PATH}`, {
      headers: { Accept: 'text/plain, application/json' },
    });
    if (!response.ok) return 'unavailable';
    return verificationState(await response.text(), expectedUri);
  } catch {
    return 'unavailable';
  }
}

/**
 * Load a document record and, when it points at a publication record, that
 * publication too. A missing publication leaves the document readable rather
 * than failing the whole screen; verification is a separate, best-effort read.
 */
export async function loadStandardSiteDocument(
  documentUri: string,
  deps: StandardSiteDeps,
): Promise<StandardSiteLoad> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const parts = parseAtUri(documentUri);
  if (!parts || parts.collection !== DOCUMENT_COLLECTION) return { state: 'invalid' };

  const pds = await deps.resolveEndpoint(parts.did);
  if (!pds) return { state: 'unavailable' };
  const documentRead = await readRecord(pds, parts.did, DOCUMENT_COLLECTION, parts.rkey, fetchImpl);
  if (documentRead.state !== 'ok') return { state: documentRead.state };
  const document = normaliseDocument(documentRead.value, documentUri, documentRead.cid);
  if (!document) return { state: 'invalid' };

  let publication: StandardPublication | null = null;
  let publicationPds: string | null = null;
  const siteParts = parseAtUri(document.site);
  if (siteParts && siteParts.collection === PUBLICATION_COLLECTION) {
    publicationPds = await deps.resolveEndpoint(siteParts.did);
    if (publicationPds) {
      const publicationRead = await readRecord(
        publicationPds,
        siteParts.did,
        PUBLICATION_COLLECTION,
        siteParts.rkey,
        fetchImpl,
      );
      if (publicationRead.state === 'ok') {
        publication = normalisePublication(publicationRead.value, document.site, publicationRead.cid);
      }
    }
  }

  document.canonicalUrl =
    (publication ? canonicalUrl(publication.url, document.path) : null) ??
    canonicalUrl(document.site, document.path);

  const verification = publication
    ? await checkStandardSiteVerification(publication.url, publication.uri, fetchImpl)
    : 'unavailable';
  return { state: 'ok', document, publication, pds, publicationPds, verification };
}
