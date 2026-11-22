/**
 * Framework-free rules for post-menu writes that are not reports: pinning a
 * post to the profile, detaching a quote, and reading the viewer's state from
 * an embed. Kept free of React Native and agent imports so the record shapes
 * can be exercised under Node.
 */

export const POSTGATE_COLLECTION = 'app.bsky.feed.postgate';

function objectOrEmpty(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

/** Write a strong ref into the profile record, or remove it to unpin. */
export function profilePinUpdate(
  existing: unknown,
  postUri: string,
  postCid: string,
  pin: boolean
): Record<string, unknown> | null {
  if (!postUri || !postCid) return null;
  const record = objectOrEmpty(existing);
  if (pin) record.pinnedPost = { uri: postUri, cid: postCid };
  else delete record.pinnedPost;
  return record;
}

function recordView(embed: unknown): unknown {
  if (!embed || typeof embed !== 'object') return null;
  const value = embed as Record<string, unknown>;
  const type = typeof value.$type === 'string' ? value.$type : '';
  if (type.endsWith('app.bsky.embed.recordWithMedia#view')) {
    return recordView(value.record);
  }
  if (type.endsWith('app.bsky.embed.record#view')) return value.record;
  return null;
}

/** The URI of the quoted post, or null when the embed is not a quote. */
export function quotedUriFromEmbed(embed: unknown): string | null {
  const view = recordView(embed);
  if (!view || typeof view !== 'object') return null;
  const uri = (view as Record<string, unknown>).uri;
  return typeof uri === 'string' && uri.startsWith('at://') ? uri : null;
}

/** True when the AppView already shows the quote as detached. */
export function isQuoteDetached(embed: unknown): boolean {
  const view = recordView(embed);
  if (!view || typeof view !== 'object') return false;
  const value = view as Record<string, unknown>;
  const type = typeof value.$type === 'string' ? value.$type : '';
  return type.endsWith('viewDetached') || value.detached === true;
}

/** An AT-URI's host is the DID of the repo that owns the record. */
export function uriOwnedBy(uri: string, did: string): boolean {
  if (!uri.startsWith('at://') || !did) return false;
  const host = uri.slice('at://'.length).split('/')[0];
  return host === did;
}

/**
 * Update the `detachedEmbeddingUris` field of a postgate. `null` means the
 * record has nothing left to express and should be deleted. Any existing
 * embedding rules are preserved, so quote-off gates are never clobbered.
 */
export function detachedEmbeddingRecord(
  existing: unknown,
  postUri: string,
  embeddingUri: string,
  detach: boolean,
  createdAt: string
): Record<string, unknown> | null {
  if (!postUri || !embeddingUri) return null;
  const record = objectOrEmpty(existing);
  const previous = Array.isArray(record.detachedEmbeddingUris)
    ? record.detachedEmbeddingUris.filter(
        (uri): uri is string => typeof uri === 'string' && uri.length > 0
      )
    : [];
  const uris = new Set(previous);
  if (detach) uris.add(embeddingUri);
  else uris.delete(embeddingUri);
  const detached = [...uris];
  const rules = Array.isArray(record.embeddingRules) ? record.embeddingRules : [];
  if (detached.length === 0 && rules.length === 0) return null;
  record.$type = POSTGATE_COLLECTION;
  record.post = postUri;
  record.createdAt = typeof record.createdAt === 'string' ? record.createdAt : createdAt;
  record.detachedEmbeddingUris = detached;
  return record;
}
