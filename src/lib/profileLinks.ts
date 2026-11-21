import { countGraphemes } from 'unicode-segmenter/grapheme';

// Limits from app.bsky.actor.profile and app.bsky.actor.link (and the official
// client's pill layout). Titles are cut by graphemes, never UTF-16 units.
export const MAX_PROFILE_LINKS = 10;
export const MAX_PROFILE_LINK_TITLE = 30;

export type ProfileLinkDraft = {
  /** Stable local key; not written to the record. */
  key: string;
  url: string;
  title: string;
  uri?: string;
  cid?: string;
  icon?: any;
  createdAt?: string;
  /** Existing link record, preserved so edits do not drop labels or icons. */
  raw?: Record<string, any>;
};

export function normalizeProfileLinkUrl(input: string): string | null {
  let value = input.trim();
  if (!value || value.length > 2048) return null;

  // A bare host is the common way people type a link. Anything with an
  // explicit non-https scheme is rejected rather than silently rewritten.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    value = `https://${value}`;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return null;
    if (!parsed.hostname || parsed.username || parsed.password) return null;
    // Profile links are public destinations, not local addresses.
    if (!parsed.hostname.includes('.')) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function isInsecureProfileLink(input: string): boolean {
  return /^http:\/\//i.test(input.trim());
}

export function profileLinkHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function profileLinkLabel(link: { url: string; title?: string }): string {
  const title = (link.title || '').trim();
  return title || profileLinkHost(link.url);
}

export function validateProfileLinkTitle(title: string): string | null {
  if (countGraphemes(title.trim()) > MAX_PROFILE_LINK_TITLE) {
    return `Titles can be up to ${MAX_PROFILE_LINK_TITLE} characters.`;
  }
  return null;
}

/**
 * A blank URL is only valid for a row that is still being edited; callers
 * decide whether every row must be complete before saving.
 */
export function validateProfileLinkDraft(
  draft: Pick<ProfileLinkDraft, 'url' | 'title'>,
  otherUrls: string[]
): string | null {
  if (!draft.url.trim()) return 'Enter a link.';
  if (isInsecureProfileLink(draft.url)) {
    return 'Only secure links can be added. Use https://.';
  }
  const normalized = normalizeProfileLinkUrl(draft.url);
  if (!normalized) return 'That does not look like a web address.';
  const duplicate = otherUrls.some(
    (url) => normalizeProfileLinkUrl(url) === normalized
  );
  if (duplicate) return 'That link is already on your profile.';
  return validateProfileLinkTitle(draft.title);
}
