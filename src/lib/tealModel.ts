/**
 * Framework-free rules for the subtle teal.fm music activity strip. Teal plays
 * are community-lexicon records in a person's own AT Protocol repository.
 * Balla only ever reads them: teal.fm and the ecosystem's scrobblers own the
 * writes, so there are deliberately no record-building helpers here.
 */

/** Both spellings must be read; the alpha namespace was removed in Jul 2026. */
export const TEAL_COLLECTIONS = [
  'fm.teal.feed.play',
  'fm.teal.alpha.feed.play',
] as const;

export type TealCollection = (typeof TEAL_COLLECTIONS)[number];

/** How many plays the compact profile strip shows. */
export const TEAL_STRIP_LIMIT = 5;

/** teal.fm deep link; the DID is encoded by `tealProfileUrl`. */
export const TEAL_PROFILE_BASE = 'https://teal.fm/profile/';

export type TealPlay = {
  uri: string;
  collection: TealCollection;
  title: string;
  artists: string;
  release: string;
  durationSeconds: number | null;
  playedAt: string | null;
  originUri: string | null;
};

/** Build a teal.fm profile link from a DID (or handle). */
export function tealProfileUrl(did: string): string {
  return TEAL_PROFILE_BASE + encodeURIComponent(did);
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(cleanText).filter(Boolean);
}

/** Artist names from the modern `artists` objects or the older `artistNames`. */
export function tealArtistNames(value: Record<string, unknown>): string[] {
  const objects = Array.isArray(value.artists)
    ? value.artists
        .map((entry) =>
          entry && typeof entry === 'object'
            ? cleanText((entry as Record<string, unknown>).artistName)
            : ''
        )
        .filter(Boolean)
    : [];
  if (objects.length) return objects;
  return cleanList(value.artistNames);
}

/**
 * Normalise one current or legacy play record into the shape the strip renders.
 * Returns null for records without a track name so malformed data is skipped.
 * The two lexicon spellings render identically: `originUri`/`originUrl` and
 * `artists`/`artistNames` are folded into the same fields.
 */
export function normaliseTealPlay(
  value: unknown,
  uri: string,
  collection: TealCollection
): TealPlay | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const title = cleanText(record.trackName);
  if (!title) return null;

  const duration =
    typeof record.duration === 'number' && Number.isFinite(record.duration) && record.duration > 0
      ? Math.floor(record.duration)
      : null;

  return {
    uri,
    collection,
    title,
    artists: tealArtistNames(record).join(', '),
    release: cleanText(record.releaseName),
    durationSeconds: duration,
    playedAt: cleanText(record.playedTime) || null,
    originUri: cleanText(record.originUri) || cleanText(record.originUrl) || null,
  };
}

function playTimestamp(play: TealPlay): number {
  const time = play.playedAt ? Date.parse(play.playedAt) : Number.NaN;
  return Number.isFinite(time) ? time : 0;
}

/** Newest first; plays without a usable time go last, ties break by URI. */
export function sortTealPlays(plays: TealPlay[]): TealPlay[] {
  return [...plays].sort((a, b) => {
    const difference = playTimestamp(b) - playTimestamp(a);
    if (difference !== 0) return difference;
    return a.uri.localeCompare(b.uri);
  });
}

/** Keep only the compact strip's worth of newest plays. */
export function recentTealPlays(plays: TealPlay[], limit = TEAL_STRIP_LIMIT): TealPlay[] {
  return sortTealPlays(plays).slice(0, Math.max(0, limit));
}

/** Short "3:20" style duration; blank when the record has no duration. */
export function tealDuration(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '';
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

/**
 * Pull the `atproto_pds` endpoint out of a resolved DID document. Reads are
 * made against the repository host so a viewer on one PDS can see plays by
 * someone on any other. Invalid endpoints are ignored; no trailing slash.
 */
export function atprotoPdsEndpoint(didDocument: unknown): string | null {
  if (!didDocument || typeof didDocument !== 'object') return null;
  const services = (didDocument as Record<string, unknown>).service;
  if (!Array.isArray(services)) return null;
  for (const entry of services) {
    if (!entry || typeof entry !== 'object') continue;
    const service = entry as Record<string, unknown>;
    const endpoint =
      typeof service.serviceEndpoint === 'string' ? service.serviceEndpoint.trim() : '';
    if (!/^https?:\/\/\S+$/i.test(endpoint)) continue;
    if (service.id === '#atproto_pds' || service.type === 'AtprotoPersonalDataServer') {
      return endpoint.replace(/\/+$/, '');
    }
  }
  return null;
}
