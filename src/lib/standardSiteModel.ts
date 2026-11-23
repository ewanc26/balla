/**
 * Framework-free rules for the published Standard.site view and record shapes.
 *
 * The enhanced card is built only from fields the AppView actually publishes
 * on `app.bsky.embed.external#view` (source, associatedRefs, reading time and
 * timestamps). The reader is built only from `site.standard.document` and
 * `site.standard.publication` record fields. Nothing is scraped from HTML,
 * inferred from a URL, or invented to fill a gap: an absent field stays absent.
 *
 * UTF-8 facet offsets reuse the app's single richtext slicer rather than a
 * second implementation, so emoji and non-Latin text survive verbatim.
 */

import { utf8Length, utf8Slice } from './richtext.ts';

export const DOCUMENT_COLLECTION = 'site.standard.document';
export const PUBLICATION_COLLECTION = 'site.standard.publication';
export const VERIFICATION_PATH = '/.well-known/site.standard.publication';

const MAX_BLOCKS = 400;

export type AtUriParts = { did: string; collection: string; rkey: string };

export type PublicationTheme = {
  background: string;
  foreground: string;
  accent: string;
  accentForeground: string;
};

export type StandardSiteCard = {
  documentUri: string;
  documentCid: string | null;
  publicationUri: string | null;
  url: string;
  title: string;
  description: string;
  thumb: string | null;
  publicationName: string;
  publicationUrl: string | null;
  publicationIcon: string | null;
  readingTime: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  authorDid: string | null;
  authorHandle: string | null;
  authorName: string | null;
  theme: PublicationTheme | null;
};

export type TextSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; uri: string };

export type DocumentBlock =
  | { kind: 'heading'; level: number; segments: TextSegment[] }
  | { kind: 'paragraph'; segments: TextSegment[] }
  | { kind: 'bullet'; segments: TextSegment[] }
  | { kind: 'ordered'; segments: TextSegment[] }
  | { kind: 'quote'; segments: TextSegment[] }
  | { kind: 'rule' }
  | { kind: 'image'; cid: string; alt: string }
  | { kind: 'embed'; uri: string; title: string }
  | { kind: 'unsupported'; label: string };

export type BlockResult = { blocks: DocumentBlock[]; truncated: boolean };

export type StandardDocument = {
  uri: string;
  cid: string | null;
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string | null;
  path: string | null;
  site: string;
  canonicalUrl: string | null;
  tags: string[];
  langs: string[];
  textContent: string;
  blocks: DocumentBlock[];
  truncated: boolean;
  coverCid: string | null;
  bskyPostRefUri: string | null;
};

export type StandardPublication = {
  uri: string;
  cid: string | null;
  name: string;
  url: string;
  description: string;
  iconCid: string | null;
  theme: PublicationTheme | null;
  showInDiscover: boolean;
};

function isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function typeOf(value: unknown): string {
  return isObject(value) && typeof value.$type === 'string' ? value.$type : '';
}

// Published lexicon names use both dotted (`com.atproto.repo.strongRef`) and
// hash (`blog.pckt.richtext.facet#link`) suffixes; both are exact type endings.
function endsWith(value: string, suffix: string): boolean {
  return (
    value === suffix ||
    value.endsWith('#' + suffix) ||
    value.endsWith('.' + suffix)
  );
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && !!item.trim());
}

function httpsUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!/^https:\/\/[^\s/]+/i.test(candidate)) return null;
  return candidate.replace(/\/+$/, '') || null;
}

function referenceUri(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  if (candidate.startsWith('at:')) return parseAtUri(candidate) ? candidate : null;
  return httpsUrl(candidate);
}

/** Strict AT-URI parse: exactly one DID, collection and record key, no query. */
export function parseAtUri(value: unknown): AtUriParts | null {
  if (typeof value !== 'string') return null;
  const match = /^at:\/\/([^/]+)\/([^/]+)\/([^/?#]+)$/.exec(value);
  if (!match) return null;
  const did = match[1];
  const collection = match[2];
  const rkey = match[3];
  if (!/^did:[a-z]+:[A-Za-z0-9._:%-]+$/i.test(did)) return null;
  if (!/^[a-z][a-zA-Z0-9.-]*$/i.test(collection) || !rkey) return null;
  return { did, collection, rkey };
}

function rgbHex(value: unknown): string | null {
  if (!isObject(value)) return null;
  const { r, g, b } = value;
  if (![r, g, b].every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    return null;
  }
  return '#' + [r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('');
}

/** Both the view (`*RGB`) and record (`basicTheme`) shapes are published. */
function themeFrom(value: unknown): PublicationTheme | null {
  if (!isObject(value)) return null;
  const background = rgbHex(value.backgroundRGB ?? value.background);
  const foreground = rgbHex(value.foregroundRGB ?? value.foreground);
  const accent = rgbHex(value.accentRGB ?? value.accent);
  const accentForeground = rgbHex(value.accentForegroundRGB ?? value.accentForeground);
  if (!background || !foreground || !accent || !accentForeground) return null;
  return { background, foreground, accent, accentForeground };
}

function blobCid(value: unknown): string | null {
  if (!isObject(value)) return null;
  const link = isObject(value.ref) ? value.ref.$link : value.$link;
  return typeof link === 'string' && link ? link : null;
}

function strongRef(value: unknown): { uri: string; cid: string | null } | null {
  if (!isObject(value) || !endsWith(typeOf(value), 'strongRef')) return null;
  if (!parseAtUri(value.uri)) return null;
  return {
    uri: value.uri,
    cid: typeof value.cid === 'string' && value.cid ? value.cid : null,
  };
}

/**
 * Read the AppView's published enhanced-link fields. Returns null when the
 * embed is a plain external link, so the existing plain LinkCard stays the
 * fallback for every URL Bluesky has not decorated.
 */
export function standardSiteFromEmbed(embed: unknown): StandardSiteCard | null {
  let candidate = embed;
  if (isObject(candidate) && endsWith(typeOf(candidate), 'app.bsky.embed.recordWithMedia#view')) {
    candidate = candidate.media;
  }
  if (!isObject(candidate) || !endsWith(typeOf(candidate), 'app.bsky.embed.external#view')) {
    return null;
  }
  const external = candidate.external;
  if (!isObject(external)) return null;
  const url = httpsUrl(external.uri);
  if (!url) return null;

  const source = external.source;
  if (!isObject(source) || !endsWith(typeOf(source), 'app.bsky.embed.external#viewExternalSource')) {
    return null;
  }
  const refs: Array<{ uri: string; cid: string | null }> = [];
  if (Array.isArray(external.associatedRefs)) {
    for (const item of external.associatedRefs) {
      const ref = strongRef(item);
      if (ref) refs.push(ref);
    }
  }
  const document = refs.find((ref) => parseAtUri(ref.uri)?.collection === DOCUMENT_COLLECTION);
  if (!document) return null;
  const publication = refs.find((ref) => parseAtUri(ref.uri)?.collection === PUBLICATION_COLLECTION);
  const documentDid = parseAtUri(document.uri)?.did ?? null;

  let authorDid: string | null = null;
  let authorHandle: string | null = null;
  let authorName: string | null = null;
  if (Array.isArray(external.associatedProfiles)) {
    for (const profile of external.associatedProfiles) {
      if (!isObject(profile) || profile.did !== documentDid) continue;
      authorDid = documentDid;
      authorHandle = text(profile.handle) || null;
      authorName = text(profile.displayName) || null;
      break;
    }
  }

  const readingTime = Number(external.readingTime);
  return {
    documentUri: document.uri,
    documentCid: document.cid,
    publicationUri: publication?.uri ?? null,
    url,
    title: text(external.title) || url,
    description: text(external.description),
    thumb: typeof external.thumb === 'string' && external.thumb ? external.thumb : null,
    publicationName: text(source.title) || 'Standard.site publication',
    publicationUrl: httpsUrl(source.uri),
    publicationIcon: typeof source.icon === 'string' && source.icon ? source.icon : null,
    readingTime: Number.isFinite(readingTime) && readingTime > 0 ? Math.floor(readingTime) : null,
    createdAt: text(external.createdAt) || null,
    updatedAt: text(external.updatedAt) || null,
    authorDid,
    authorHandle,
    authorName,
    theme: themeFrom(source.theme),
  };
}

function segments(textValue: string, facets: unknown): TextSegment[] {
  const body = typeof textValue === 'string' ? textValue : '';
  if (!body) return [];
  const total = utf8Length(body);
  const links: Array<{ start: number; end: number; uri: string }> = [];
  if (Array.isArray(facets)) {
    for (const facet of facets) {
      if (!isObject(facet) || !isObject(facet.index)) continue;
      const start = Math.max(0, Math.min(total, Number(facet.index.byteStart) || 0));
      const end = Math.max(start, Math.min(total, Number(facet.index.byteEnd) || 0));
      if (end <= start) continue;
      if (!Array.isArray(facet.features)) continue;
      for (const feature of facet.features) {
        if (!endsWith(typeOf(feature), 'link')) continue;
        const uri = httpsUrl(feature.uri);
        if (uri) links.push({ start, end, uri });
        break;
      }
    }
  }
  links.sort((a, b) => a.start - b.start || b.end - a.end);
  const result: TextSegment[] = [];
  let cursor = 0;
  for (const link of links) {
    if (link.start < cursor) continue;
    if (link.start > cursor) result.push({ kind: 'text', text: utf8Slice(body, cursor, link.start) });
    result.push({ kind: 'link', text: utf8Slice(body, link.start, link.end), uri: link.uri });
    cursor = link.end;
  }
  if (cursor < total) result.push({ kind: 'text', text: utf8Slice(body, cursor, total) });
  return result.length ? result : [{ kind: 'text', text: body }];
}

function blockWith(kind: DocumentBlock['kind'], item: Record<string, any>): DocumentBlock | null {
  if (kind === 'rule') return { kind: 'rule' };
  if (kind === 'unsupported') {
    return { kind: 'unsupported', label: unsupportedLabel(typeOf(item)) };
  }
  if (kind === 'image') {
    const attrs = isObject(item.attrs) ? item.attrs : item;
    const cid = blobCid(attrs.blob ?? attrs.image ?? item.image ?? item.blob ?? item);
    if (!cid) return null;
    return { kind: 'image', cid, alt: text(attrs.alt ?? item.alt) };
  }
  if (kind === 'embed') {
    const attrs = isObject(item.attrs) ? item.attrs : item;
    const uri =
      referenceUri(attrs.uri ?? attrs.url ?? item.uri ?? item.url) ??
      referenceUri(item.postRef?.uri);
    if (!uri) return null;
    const isPost = uri.startsWith('at:');
    return {
      kind: 'embed',
      uri,
      title: text(item.title) || (isPost ? 'Linked Bluesky post' : 'Linked website'),
    };
  }
  const segmentsForBlock = segments(item.plaintext ?? item.text ?? '', item.facets);
  if (!segmentsForBlock.length) return null;
  if (kind === 'heading') {
    const level = Number(item.level);
    return {
      kind: 'heading',
      level: Number.isInteger(level) && level >= 1 && level <= 6 ? level : 2,
      segments: segmentsForBlock,
    };
  }
  return { kind, segments: segmentsForBlock } as DocumentBlock;
}

function listBlocks(kind: 'bullet' | 'ordered', item: Record<string, any>): DocumentBlock[] {
  const children = item.content ?? item.items;
  if (!Array.isArray(children)) return [];
  const result: DocumentBlock[] = [];
  for (const child of children) {
    if (result.length >= MAX_BLOCKS) break;
    if (!isObject(child)) continue;
    const nested = child.content ?? child.items;
    const parts: TextSegment[] = [];
    if (Array.isArray(nested)) {
      for (const part of nested) {
        if (!isObject(part)) continue;
        parts.push(...segments(part.plaintext ?? part.text ?? '', part.facets));
      }
    } else {
      parts.push(...segments(child.plaintext ?? child.text ?? '', child.facets));
    }
    if (parts.length) result.push({ kind, segments: parts });
  }
  return result;
}

function kindOfBlock(type: string): DocumentBlock['kind'] | null {
  if (/heading|header/i.test(type)) return 'heading';
  if (/bullet|unordered/i.test(type)) return 'bullet';
  if (/ordered|numbered/i.test(type)) return 'ordered';
  if (/blockquote|quote/i.test(type)) return 'quote';
  if (/horizontalrule|divider|rule/i.test(type)) return 'rule';
  if (/image/i.test(type)) return 'image';
  if (/blueskyembed|website|embed|link/i.test(type)) return 'embed';
  if (/text|paragraph/i.test(type)) return 'paragraph';
  if (/gallery/i.test(type)) return 'unsupported';
  if (/table/i.test(type)) return 'unsupported';
  if (/video/i.test(type)) return 'unsupported';
  if (/questions|poll|noteembed/i.test(type)) return 'unsupported';
  return null;
}

function unsupportedLabel(type: string): string {
  if (/gallery/i.test(type)) return 'Gallery';
  if (/table/i.test(type)) return 'Table';
  if (/video/i.test(type)) return 'Video';
  if (/questions/i.test(type)) return 'Questions';
  if (/poll/i.test(type)) return 'Poll';
  if (/noteembed/i.test(type)) return 'Embedded note';
  return 'Content block';
}

/** Both published content encodings flatten to the same small block union. */
export function documentBlocks(value: unknown, textContent: string): BlockResult {
  const blocks: DocumentBlock[] = [];
  if (isObject(value)) {
    const type = typeOf(value);
    if (endsWith(type, 'pub.leaflet.content')) {
      for (const page of Array.isArray(value.pages) ? value.pages : []) {
        if (!isObject(page)) continue;
        for (const wrapper of Array.isArray(page.blocks) ? page.blocks : []) {
          if (blocks.length >= MAX_BLOCKS) {
            return { blocks, truncated: true };
          }
          const item = isObject(wrapper) ? (wrapper.block ?? wrapper) : null;
          if (!isObject(item)) continue;
          const itemType = typeOf(item);
          const kind = kindOfBlock(itemType);
          if (kind === 'bullet' || kind === 'ordered') {
            blocks.push(...listBlocks(kind, item));
            continue;
          }
          const block = blockWith(kind ?? 'paragraph', item);
          if (block) blocks.push(block);
          else if (itemType) {
            blocks.push({ kind: 'unsupported', label: unsupportedLabel(itemType) });
          }
        }
      }
    } else if (endsWith(type, 'blog.pckt.content')) {
      for (const item of Array.isArray(value.items) ? value.items : []) {
        if (blocks.length >= MAX_BLOCKS) return { blocks, truncated: true };
        if (!isObject(item)) continue;
        const itemType = typeOf(item);
        const kind = kindOfBlock(itemType);
        if (kind === 'bullet' || kind === 'ordered') {
          blocks.push(...listBlocks(kind, item));
          continue;
        }
        const block = blockWith(kind ?? 'paragraph', item);
        if (block) blocks.push(block);
        else if (itemType) {
          blocks.push({ kind: 'unsupported', label: unsupportedLabel(itemType) });
        }
      }
    }
  }
  if (blocks.length) return { blocks, truncated: false };
  // `textContent` is the record's published plaintext representation. When no
  // structured encoding exists, show it as paragraphs without inventing markup.
  const lines = textContent
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    blocks: lines.slice(0, MAX_BLOCKS).map((part) => ({
      kind: 'paragraph' as const,
      segments: [{ kind: 'text' as const, text: part }],
    })),
    truncated: lines.length > MAX_BLOCKS,
  };
}

/** Publication `url` plus document `path`, with https and root-relative checks. */
export function canonicalUrl(publicationUrl: unknown, path: unknown): string | null {
  const base = httpsUrl(publicationUrl);
  if (!base) return null;
  const suffix = text(path);
  if (!suffix) return base;
  if (!suffix.startsWith('/') || /[?#]/.test(suffix)) return null;
  return base + suffix.replace(/\/+$/, '');
}

export function normaliseDocument(value: unknown, uri: string, cid: string | null): StandardDocument | null {
  if (!isObject(value)) return null;
  const title = text(value.title);
  const publishedAt = text(value.publishedAt);
  const site = text(value.site);
  if (!title || !publishedAt || !site) return null;
  const path = text(value.path) || null;
  const textContent = typeof value.textContent === 'string' ? value.textContent.trim() : '';
  const ref = value.bskyPostRef;
  const content = documentBlocks(value.content, textContent);
  return {
    uri,
    cid,
    title,
    description: text(value.description),
    publishedAt,
    updatedAt: text(value.updatedAt) || null,
    path,
    site,
    canonicalUrl: null, // set by the loader once the publication URL is known
    tags: strings(value.tags).slice(0, 40),
    langs: strings(value.langs).slice(0, 10),
    textContent,
    blocks: content.blocks,
    truncated: content.truncated,
    coverCid: blobCid(value.coverImage),
    bskyPostRefUri: strongRef(ref)?.uri ?? (typeof ref?.uri === 'string' ? ref.uri : null),
  };
}

export function normalisePublication(value: unknown, uri: string, cid: string | null): StandardPublication | null {
  if (!isObject(value)) return null;
  const name = text(value.name);
  const url = httpsUrl(value.url);
  if (!name || !url) return null;
  return {
    uri,
    cid,
    name,
    url,
    description: text(value.description),
    iconCid: blobCid(value.icon),
    theme: themeFrom(value.basicTheme),
    showInDiscover: value?.preferences?.showInDiscover === true,
  };
}

export type VerificationState = 'verified' | 'mismatch' | 'unavailable';

/** Publication verification compares the well-known AT-URI to the record's own URI. */
export function verificationState(body: unknown, expectedUri: string): VerificationState {
  if (typeof body !== 'string' || !body.trim()) return 'unavailable';
  return body.trim() === expectedUri ? 'verified' : 'mismatch';
}

export const STANDARD_SITE_COPY = {
  source: 'From the post’s published link metadata and the record on the author’s PDS.',
  theme: 'Publication colours are shown as swatches only. Balla keeps your text size and contrast settings.',
  readLimit: 'Subscribe and recommend write Standard.site records that need new permissions. Balla does not request them here.',
  discussion: 'Comments federate as replies to the linked Bluesky post.',
  notRendered: 'This block is not rendered in Balla. Open the original to see it.',
  shortened: 'Long articles are shortened here. Open the original for the full text.',
  verification: {
    verified: 'Domain verification matches this publication record.',
    mismatch: 'The domain points to a different publication record.',
    unavailable: 'Domain verification could not be checked.',
  },
} as const;
