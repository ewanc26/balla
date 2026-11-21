/**
 * Framework-free rules for reading the view shapes Balla renders. Kept free of
 * React Native imports so the honest fallbacks can be tested under Node.
 * Shapes follow app.bsky.embed.record and app.bsky.embed.external.
 */

export type QuoteView =
  | {
      kind: 'record';
      uri: string;
      cid: string;
      authorDid: string;
      authorHandle: string;
      authorName: string;
      authorAvatar?: string;
      text: string;
      indexedAt: string;
      /** Labels on the quoted record, so its own warnings still apply. */
      labels: unknown[];
    }
  | {
      kind: 'unavailable';
      uri: string;
      reason: 'not-found' | 'blocked' | 'detached' | 'not-a-post';
    };

export type ExternalView = {
  uri: string;
  title: string;
  description: string;
  thumb?: string;
  host: string;
};

function typeOf(value: any): string {
  return typeof value?.$type === 'string' ? value.$type : '';
}

function endsWith(value: string, suffix: string): boolean {
  return value === suffix || value.endsWith('#' + suffix);
}

/** The record half of an embed, including recordWithMedia. */
function recordView(embed: any): any {
  if (!embed) return null;
  if (endsWith(typeOf(embed), 'app.bsky.embed.recordWithMedia#view')) {
    return recordView(embed.record);
  }
  if (endsWith(typeOf(embed), 'app.bsky.embed.record#view')) {
    return embed.record || null;
  }
  return null;
}

/**
 * Return the quoted record or an honest reason it cannot be shown. A missing
 * quote must never render as an empty card or as the outer post's own text.
 */
export function quoteFromEmbed(embed: any): QuoteView | null {
  const view = recordView(embed);
  if (!view) return null;
  const uri = typeof view.uri === 'string' ? view.uri : '';
  const type = typeOf(view);
  if (endsWith(type, 'viewNotFound') || view.notFound === true) {
    return { kind: 'unavailable', uri, reason: 'not-found' };
  }
  if (endsWith(type, 'viewBlocked') || view.blocked === true) {
    return { kind: 'unavailable', uri, reason: 'blocked' };
  }
  if (endsWith(type, 'viewDetached') || view.detached === true) {
    return { kind: 'unavailable', uri, reason: 'detached' };
  }
  const value = view.value;
  if (!endsWith(type, 'viewRecord') || !value || typeof value !== 'object') {
    return { kind: 'unavailable', uri, reason: 'not-a-post' };
  }
  const author = view.author || {};
  return {
    kind: 'record',
    uri,
    cid: typeof view.cid === 'string' ? view.cid : '',
    authorDid: typeof author.did === 'string' ? author.did : '',
    authorHandle: typeof author.handle === 'string' ? author.handle : 'unknown',
    authorName:
      typeof author.displayName === 'string' && author.displayName.trim()
        ? author.displayName
        : typeof author.handle === 'string'
          ? author.handle
          : 'Unknown account',
    ...(typeof author.avatar === 'string' ? { authorAvatar: author.avatar } : {}),
    text: typeof value.text === 'string' ? value.text : '',
    indexedAt: typeof view.indexedAt === 'string' ? view.indexedAt : '',
    labels: Array.isArray(view.labels) ? view.labels : [],
  };
}

/** The external half of an embed, including recordWithMedia. */
export function externalFromEmbed(embed: any): ExternalView | null {
  if (!embed) return null;
  let candidate = embed;
  if (endsWith(typeOf(embed), 'app.bsky.embed.recordWithMedia#view')) {
    candidate = embed.media;
  }
  if (!endsWith(typeOf(candidate), 'app.bsky.embed.external#view')) return null;
  const external = candidate.external;
  if (!external || typeof external.uri !== 'string') return null;
  return {
    uri: external.uri,
    title:
      typeof external.title === 'string' && external.title.trim()
        ? external.title.trim()
        : externalHost(external.uri),
    description:
      typeof external.description === 'string' ? external.description.trim() : '',
    ...(typeof external.thumb === 'string' && external.thumb
      ? { thumb: external.thumb }
      : {}),
    host: externalHost(external.uri),
  };
}

/** A readable host for the link card; never invent a title from the URL. */
export function externalHost(uri: string): string {
  try {
    return new URL(uri).hostname.replace(/^www\./, '');
  } catch {
    return 'Link';
  }
}

/** Only absolute http(s) URLs can become link cards; never guess from bare text. */
export function normaliseWebUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    if (!url.hostname) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** The first usable URL in a draft, used as the composer's link-card candidate. */
export function firstWebUrl(text: string): string | null {
  for (const match of text.match(/https?:\/\/[^\s<>"']+/gi) || []) {
    const url = normaliseWebUrl(match);
    if (url) return url;
  }
  return null;
}

export const QUOTE_UNAVAILABLE_COPY: Record<
  Extract<QuoteView, { kind: 'unavailable' }>['reason'],
  string
> = {
  'not-found': 'This quoted post is no longer available.',
  blocked: 'This quoted post is hidden by a block or moderation setting.',
  detached: 'This quote is no longer attached to its original post.',
  'not-a-post': 'This embedded record is not a post.',
};
