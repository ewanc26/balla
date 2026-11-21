export type SearchTab = 'top' | 'latest' | 'people' | 'feeds' | 'packs';

export const SEARCH_TABS: ReadonlyArray<{ id: SearchTab; label: string }> = [
  { id: 'top', label: 'Top' },
  { id: 'latest', label: 'Latest' },
  { id: 'people', label: 'People' },
  { id: 'feeds', label: 'Feeds' },
  { id: 'packs', label: 'Starter Packs' },
];

export type RepliesFilter = 'all' | 'none' | 'only';
export type MediaFilter = 'all' | 'media' | 'video';
export type FromFilter = 'anyone' | 'following' | 'me';

export type SearchFilters = {
  authors: string;
  mentions: string;
  domains: string;
  urls: string;
  hashtags: string;
  excludeAuthors: string;
  excludeMentions: string;
  excludeDomains: string;
  excludeUrls: string;
  excludeHashtags: string;
  languages: string;
  since: string;
  until: string;
  replies: RepliesFilter;
  media: MediaFilter;
  from: FromFilter;
};

export const EMPTY_SEARCH_FILTERS: SearchFilters = {
  authors: '',
  mentions: '',
  domains: '',
  urls: '',
  hashtags: '',
  excludeAuthors: '',
  excludeMentions: '',
  excludeDomains: '',
  excludeUrls: '',
  excludeHashtags: '',
  languages: '',
  since: '',
  until: '',
  replies: 'all',
  media: 'all',
  from: 'anyone',
};

export const MAX_SEARCH_HISTORY = 8;

const LIST_FILTER_KEYS = [
  'authors',
  'mentions',
  'domains',
  'urls',
  'hashtags',
  'excludeAuthors',
  'excludeMentions',
  'excludeDomains',
  'excludeUrls',
  'excludeHashtags',
] as const;

const WHITESPACE_OR_COMMA = /[\s,]+/;

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function splitValues(value: unknown): string[] {
  return stringValue(value)
    .split(WHITESPACE_OR_COMMA)
    .map((part) => part.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

export function normaliseHandles(value: unknown): string {
  return unique(
    splitValues(value)
      .map((part) => part.replace(/^@+/, ''))
      .filter(Boolean)
  ).join(' ');
}

export function normaliseHashtags(value: unknown): string {
  return unique(
    splitValues(value)
      .map((part) => part.replace(/^#+/, ''))
      .filter(Boolean)
  ).join(' ');
}

export function normaliseDomains(value: unknown): string {
  return unique(
    splitValues(value)
      .map((part) =>
        part
          .replace(/^https?:\/\//i, '')
          .split('/')[0]
          .replace(/^\.+/, '')
          .toLowerCase()
      )
      .filter(Boolean)
  ).join(' ');
}

export function normaliseUrls(value: unknown): string {
  return unique(
    stringValue(value)
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
  ).join(' ');
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function cleanSearchFilters(
  input: Partial<SearchFilters> | Record<string, unknown> | null | undefined
): SearchFilters {
  if (!input) return { ...EMPTY_SEARCH_FILTERS };
  return {
    authors: normaliseHandles(input.authors),
    mentions: normaliseHandles(input.mentions),
    domains: normaliseDomains(input.domains),
    urls: normaliseUrls(input.urls),
    hashtags: normaliseHashtags(input.hashtags),
    excludeAuthors: normaliseHandles(input.excludeAuthors),
    excludeMentions: normaliseHandles(input.excludeMentions),
    excludeDomains: normaliseDomains(input.excludeDomains),
    excludeUrls: normaliseUrls(input.excludeUrls),
    excludeHashtags: normaliseHashtags(input.excludeHashtags),
    languages: unique(splitValues(input.languages)).join(' '),
    since: stringValue(input.since),
    until: stringValue(input.until),
    replies: enumValue(input.replies, ['all', 'none', 'only'] as const, 'all'),
    media: enumValue(input.media, ['all', 'media', 'video'] as const, 'all'),
    from: enumValue(input.from, ['anyone', 'following', 'me'] as const, 'anyone'),
  };
}

export function countActiveFilters(filters: SearchFilters): number {
  const clean = cleanSearchFilters(filters);
  let count = LIST_FILTER_KEYS.filter((key) => !!clean[key]).length;
  if (clean.languages) count += 1;
  if (clean.since) count += 1;
  if (clean.until) count += 1;
  if (clean.replies !== 'all') count += 1;
  if (clean.media !== 'all') count += 1;
  if (clean.from !== 'anyone') count += 1;
  return count;
}

export function hasPostOnlyFilters(filters: SearchFilters): boolean {
  return countActiveFilters(filters) > 0;
}

export function tabSupportsFilters(tab: SearchTab): boolean {
  return tab === 'top' || tab === 'latest';
}

export function filtersBlockTab(filters: SearchFilters, tab: SearchTab): boolean {
  return hasPostOnlyFilters(filters) && !tabSupportsFilters(tab);
}

export function isValidSearchDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateSearchFilters(filters: SearchFilters): string | null {
  const clean = cleanSearchFilters(filters);

  if (clean.since && !isValidSearchDate(clean.since)) {
    return 'Use a real date after (YYYY-MM-DD).';
  }
  if (clean.until && !isValidSearchDate(clean.until)) {
    return 'Use a real date before (YYYY-MM-DD).';
  }
  if (clean.since && clean.until && clean.since > clean.until) {
    return 'The “after” date must be before the “before” date.';
  }

  const languageCodes = splitValues(clean.languages);
  const languagePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
  if (languageCodes.some((code) => !languagePattern.test(code))) {
    return 'Use language codes such as en, gd or pt-BR.';
  }

  const urls = [
    ...splitValues(clean.urls),
    ...splitValues(clean.excludeUrls),
  ];
  if (urls.some((url) => !isHttpUrl(url))) {
    return 'Use a full http:// or https:// address for URL filters.';
  }

  return null;
}

export type PostSearchParams = {
  query?: string;
  sort: 'top' | 'recent';
  authors?: string[];
  mentions?: string[];
  domains?: string[];
  urls?: string[];
  hashtags?: string[];
  excludeAuthors?: string[];
  excludeMentions?: string[];
  excludeDomains?: string[];
  excludeUrls?: string[];
  excludeHashtags?: string[];
  languages?: string[];
  since?: string;
  until?: string;
  hasMedia?: boolean;
  hasVideo?: boolean;
  following?: boolean;
  excludeReplies?: boolean;
  repliesOnly?: boolean;
};

export function buildPostSearchParams(
  query: string,
  rawFilters: SearchFilters,
  viewerDid: string,
  tab: 'top' | 'latest'
): PostSearchParams {
  const filters = cleanSearchFilters(rawFilters);
  const params: PostSearchParams = {
    sort: tab === 'latest' ? 'recent' : 'top',
  };

  if (query.trim()) params.query = query.trim();
  if (filters.authors) params.authors = filters.authors.split(' ');
  if (filters.mentions) params.mentions = filters.mentions.split(' ');
  if (filters.domains) params.domains = filters.domains.split(' ');
  if (filters.urls) params.urls = filters.urls.split(' ');
  if (filters.hashtags) params.hashtags = filters.hashtags.split(' ');
  if (filters.excludeAuthors) {
    params.excludeAuthors = filters.excludeAuthors.split(' ');
  }
  if (filters.excludeMentions) {
    params.excludeMentions = filters.excludeMentions.split(' ');
  }
  if (filters.excludeDomains) {
    params.excludeDomains = filters.excludeDomains.split(' ');
  }
  if (filters.excludeUrls) params.excludeUrls = filters.excludeUrls.split(' ');
  if (filters.excludeHashtags) {
    params.excludeHashtags = filters.excludeHashtags.split(' ');
  }
  if (filters.languages) params.languages = filters.languages.split(' ');
  if (filters.since) params.since = filters.since;
  if (filters.until) params.until = filters.until;
  if (filters.media === 'media') params.hasMedia = true;
  if (filters.media === 'video') params.hasVideo = true;
  if (filters.replies === 'none') params.excludeReplies = true;
  if (filters.replies === 'only') params.repliesOnly = true;

  if (filters.from === 'me' && viewerDid) {
    params.authors = [viewerDid];
  } else if (filters.from === 'following') {
    params.following = true;
  } else if (filters.from === 'me' && !viewerDid) {
    // Never silently send a malformed `me` operator as a free-text author.
    delete params.authors;
  }

  return params;
}

function compactFiltersForHistory(filters: SearchFilters): Record<string, string> {
  const compact: Record<string, string> = {};
  for (const key of LIST_FILTER_KEYS) {
    if (filters[key]) compact[key] = filters[key];
  }
  if (filters.languages) compact.languages = filters.languages;
  if (filters.since) compact.since = filters.since;
  if (filters.until) compact.until = filters.until;
  if (filters.replies !== 'all') compact.replies = filters.replies;
  if (filters.media !== 'all') compact.media = filters.media;
  if (filters.from !== 'anyone') compact.from = filters.from;
  return compact;
}

export function serializeSearchEntry(
  rawQuery: string,
  rawFilters: SearchFilters
): string {
  const query = rawQuery.trim();
  const filters = cleanSearchFilters(rawFilters);
  if (countActiveFilters(filters) === 0) return query;
  return JSON.stringify({ q: query, filters: compactFiltersForHistory(filters) });
}

export function parseSearchEntry(stored: unknown): {
  q: string;
  filters: SearchFilters;
} {
  if (typeof stored !== 'string') {
    return { q: '', filters: { ...EMPTY_SEARCH_FILTERS } };
  }
  const value = stored.trim();
  if (!value) return { q: '', filters: { ...EMPTY_SEARCH_FILTERS } };

  if (value.startsWith('{')) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && typeof parsed.q === 'string') {
        return {
          q: parsed.q.trim(),
          filters: cleanSearchFilters(parsed.filters),
        };
      }
    } catch {
      // Not our JSON. Treat the whole value as a literal query below.
    }
  }

  return { q: value, filters: { ...EMPTY_SEARCH_FILTERS } };
}

export function addSearchHistory(
  history: string[],
  rawQuery: string,
  rawFilters: SearchFilters
): string[] {
  const entry = serializeSearchEntry(rawQuery, rawFilters);
  if (!entry) return history;
  return [entry, ...history.filter((item) => item !== entry)].slice(
    0,
    MAX_SEARCH_HISTORY
  );
}
