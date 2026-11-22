/**
 * Framework-free rules for the device-local "Hide post for me" list. This is
 * the same local, per-device hide the official client keeps outside the PDS:
 * it never writes a server preference or a moderation report. Kept free of
 * storage and React so the URI rules are testable in Node.
 */

export const HIDDEN_POSTS_KEY = 'balla.hiddenPosts.v1';

/** Only real AT-URIs can be hidden; drop junk and de-duplicate. */
export function normaliseHiddenPosts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item === 'string' && item.startsWith('at://') && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

export function isPostHidden(uris: string[], uri: string | undefined): boolean {
  return !!uri && uris.includes(uri);
}

/** Add a hide without duplicating; a missing URI is a no-op. */
export function addHiddenPost(uris: string[], uri: string | undefined): string[] {
  if (!uri || !uri.startsWith('at://') || uris.includes(uri)) return uris;
  return [...uris, uri];
}

/** Remove one hide. Used by the debug restore path, never by the post menu. */
export function removeHiddenPost(uris: string[], uri: string): string[] {
  return uris.filter((item) => item !== uri);
}
