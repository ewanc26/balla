/**
 * Framework-free rules for "On this day". The only input is the viewer's own
 * `app.bsky.feed.post` records: no AppView, engagement counts or ranking.
 *
 * TIDs are timestamped, so a PDS walk can be bounded. The model still filters
 * every record by its `createdAt` calendar date in the device's local timezone;
 * it never infers a date from an untrusted URI.
 */

export const MEMORIES_PAGE_SIZE = 100;
export const MEMORIES_MAX_PAGES = 20;
export const MEMORIES_HOME_LIMIT = 3;

export type MemoryItem = {
  uri: string;
  cid: string;
  record: Record<string, unknown>;
  createdAt: string;
  year: number;
};

export type MemoriesDay = {
  dateKey: string;
  items: MemoryItem[];
  /** True when the walk stopped at MEMORIES_MAX_PAGES before the repository ended. */
  truncated: boolean;
  /** Number of records the PDS walk actually read. */
  scanned: number;
};

export type MemoriesPreference = {
  enabled: boolean;
  /** Local day on which the viewer dismissed the card. */
  dismissedOn?: string;
};

export type MemoriesPreferences = Record<string, MemoriesPreference>;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

function localDateParts(date: Date): { year: number; month: number; day: number } | null {
  if (Number.isNaN(date.getTime())) return null;
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
  };
}

/** A calendar key in the same local timezone the app displays posts in. */
export function memoriesDateKey(date: Date): string {
  const parts = localDateParts(date);
  if (!parts) return '';
  return `${parts.year}-${String(parts.month + 1).padStart(2, '0')}-${String(
    parts.day
  ).padStart(2, '0')}`;
}

/** Validate a stored date key without accepting a rolled-over date like 2025-02-31. */
export function normaliseMemoriesDateKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = DATE_KEY.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return value;
}

function dateKeyParts(dateKey: string): { year: number; month: number; day: number } | null {
  const clean = normaliseMemoriesDateKey(dateKey);
  if (!clean) return null;
  const [year, month, day] = clean.split('-').map(Number);
  return { year, month: month - 1, day };
}

/** The month and day only, because the year is listed separately per post. */
export function formatMemoryDay(dateKey: string): string {
  const parts = dateKeyParts(dateKey);
  if (!parts) return '';
  return `${parts.day} ${MONTHS[parts.month]}`;
}

/**
 * Copy that names exactly what is shown. A single year gets its full date; when
 * several years match, every year is named without pretending they are one day.
 */
export function memoriesSubtitle(dateKey: string, items: MemoryItem[]): string {
  const day = formatMemoryDay(dateKey);
  if (!day || !items.length) return '';
  const years = [...new Set(items.map((item) => item.year))].sort((a, b) => b - a);
  if (years.length === 1) return `Your posts from ${day} ${years[0]}`;
  const list =
    years.length === 2
      ? `${years[0]} and ${years[1]}`
      : `${years.slice(0, -1).join(', ')} and ${years[years.length - 1]}`;
  return `Your posts from ${day} ${list}`;
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function shortText(value: string): string {
  const clean = oneLine(value);
  return clean.length > 180 ? `${clean.slice(0, 179).trimEnd()}…` : clean;
}

/**
 * A compact row cannot render images or quote cards. It says what kind of post
 * is there instead of inventing text or pulling another service's rendering.
 */
export function memorySnippet(record: Record<string, unknown>): string {
  const text = typeof record.text === 'string' ? shortText(record.text) : '';
  if (text) return text;

  const embedType =
    record.embed && typeof record.embed === 'object'
      ? String((record.embed as Record<string, unknown>).$type || '')
      : '';
  if (embedType.includes('embed.images') || embedType.includes('embed.gallery')) {
    return 'A photo post';
  }
  if (embedType.includes('embed.video')) return 'A video post';
  if (embedType.includes('embed.recordWithMedia')) return 'A post with media and a quote';
  if (embedType.includes('embed.record')) return 'A quoted post';
  if (embedType.includes('embed.external')) return 'A link post';
  return 'A post with no text';
}

/**
 * Keep only current records in the viewer's own post collection that fall on
 * this local month and day in an earlier year. Input order is irrelevant; the
 * result is newest year first, then newest post first.
 */
export function collectMemories(
  records: unknown[],
  dateKey: string,
  did: string
): { items: MemoryItem[]; scanned: number } {
  const parts = dateKeyParts(dateKey);
  const prefix = `at://${did}/app.bsky.feed.post/`;
  if (!parts || !did.startsWith('did:')) return { items: [], scanned: 0 };

  const seen = new Set<string>();
  const items: MemoryItem[] = [];
  for (const value of Array.isArray(records) ? records : []) {
    if (!value || typeof value !== 'object') continue;
    const item = value as Record<string, any>;
    const uri = typeof item.uri === 'string' ? item.uri : '';
    const cid = typeof item.cid === 'string' ? item.cid : '';
    const record = item.value;
    if (!uri || !cid || !uri.startsWith(prefix) || seen.has(uri)) continue;
    if (!record || typeof record !== 'object' || Array.isArray(record)) continue;

    const type = record.$type;
    if (typeof type === 'string' && type !== 'app.bsky.feed.post') continue;

    const createdAt = typeof record.createdAt === 'string' ? record.createdAt : '';
    const created = createdAt ? new Date(createdAt) : null;
    const createdParts = created ? localDateParts(created) : null;
    if (!createdParts) continue;
    if (createdParts.year >= parts.year) continue;
    if (createdParts.month !== parts.month || createdParts.day !== parts.day) continue;

    seen.add(uri);
    items.push({
      uri,
      cid,
      record: record as Record<string, unknown>,
      createdAt,
      year: createdParts.year,
    });
  }

  items.sort((a, b) => {
    const difference = Date.parse(b.createdAt) - Date.parse(a.createdAt);
    if (difference !== 0) return difference;
    return b.uri.localeCompare(a.uri);
  });
  return { items, scanned: Array.isArray(records) ? records.length : 0 };
}

/** Only a real DID key is retained; switching accounts cannot leak another key. */
export function normaliseMemoriesPreferences(value: unknown): MemoriesPreferences {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: MemoriesPreferences = {};
  for (const [did, candidate] of Object.entries(value as Record<string, unknown>)) {
    if (!did.startsWith('did:') || !candidate || typeof candidate !== 'object') continue;
    const entry = candidate as Record<string, unknown>;
    if (typeof entry.enabled !== 'boolean') continue;
    const dismissedOn = normaliseMemoriesDateKey(entry.dismissedOn);
    result[did] = {
      enabled: entry.enabled,
      ...(dismissedOn ? { dismissedOn } : {}),
    };
  }
  return result;
}

export function withMemoriesEnabled(
  preferences: MemoriesPreferences,
  did: string,
  enabled: boolean
): MemoriesPreferences {
  if (!did.startsWith('did:')) return preferences;
  const current = preferences[did] || { enabled: false };
  return { ...preferences, [did]: { ...current, enabled } };
}

export function withMemoriesDismissed(
  preferences: MemoriesPreferences,
  did: string,
  dateKey: string
): MemoriesPreferences {
  const clean = normaliseMemoriesDateKey(dateKey);
  if (!did.startsWith('did:') || !clean) return preferences;
  const current = preferences[did] || { enabled: false };
  return { ...preferences, [did]: { ...current, dismissedOn: clean } };
}

export function isMemoriesDismissed(
  preference: MemoriesPreference | undefined,
  dateKey: string
): boolean {
  return !!preference?.dismissedOn && preference.dismissedOn === dateKey;
}
