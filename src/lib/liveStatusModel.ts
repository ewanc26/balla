/**
 * Framework-free rules for the temporary "live" account status. The official
 * client writes an `app.bsky.actor.status` record at rkey `self` in the
 * account's own repo. All record and expiry rules live here so they can be
 * tested without a renderer or an agent.
 */

export const STATUS_COLLECTION = 'app.bsky.actor.status';
export const STATUS_RKEY = 'self';
export const LIVE_STATUS = 'app.bsky.actor.status#live';

/** Five-minute increments, maximum four hours, matching the official client. */
export const DURATION_MINUTES: number[] = Array.from(
  { length: (4 * 60) / 5 },
  (_, i) => (i + 1) * 5
);
export const DEFAULT_DURATION_MINUTES = 60;

/** A hosted live link becomes an `app.bsky.embed.external` on the status. */
export function liveEmbed(link: string): Record<string, unknown> | undefined {
  const uri = normaliseLiveLink(link);
  if (!uri) return undefined;
  return {
    $type: 'app.bsky.embed.external',
    external: {
      $type: 'app.bsky.embed.external#external',
      uri,
      title: '',
      description: '',
    },
  };
}

/** Accept http(s) links only; the AppView resolves the card from the URI. */
export function normaliseLiveLink(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return null;
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
  } catch {
    return null;
  }
  return trimmed;
}

/** Build the published status record. */
export function liveStatusRecord(
  link: string | undefined,
  durationMinutes: number,
  createdAt: string
): Record<string, unknown> | null {
  const duration = DURATION_MINUTES.includes(durationMinutes)
    ? durationMinutes
    : DEFAULT_DURATION_MINUTES;
  const record: Record<string, unknown> = {
    $type: STATUS_COLLECTION,
    status: LIVE_STATUS,
    durationMinutes: duration,
    createdAt,
  };
  const embed = liveEmbed(link || '');
  if (embed) record.embed = embed;
  return record;
}

/**
 * Compute the expiry instant for a newly written status. This mirrors the
 * AppView, which sets `expiresAt` from the record's createdAt + duration.
 */
export function expiresAtFor(createdAt: string, durationMinutes: number): number {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return 0;
  return created + durationMinutes * 60_000;
}

/** Whether a profile's status view is currently active. */
export function statusIsActive(status: any, now = Date.now()): boolean {
  if (!status || status.isDisabled || status.status !== LIVE_STATUS) return false;
  if (typeof status.expiresAt === 'string') {
    return Date.parse(status.expiresAt) > now;
  }
  // Fallback for locally written records before the AppView attaches expiresAt.
  const record = status.record;
  const created = Date.parse(record?.createdAt);
  const duration = Number(record?.durationMinutes);
  if (!Number.isFinite(created) || !Number.isFinite(duration)) return false;
  return created + duration * 60_000 > now;
}

/** Extract the external link from a status view or its raw record. */
export function liveLinkFromStatus(status: any): string | null {
  const embed = status?.embed?.external || status?.record?.embed?.external;
  return normaliseLiveLink(embed?.uri);
}

/** Human-readable duration, e.g. "1 hour 30 minutes". */
export function displayDuration(durationMinutes: number): string {
  const total = Math.max(0, Math.round(durationMinutes));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const minuteText = `${minutes} minute${minutes === 1 ? '' : 's'}`;
  if (!hours) return minuteText;
  const hourText = `${hours} hour${hours === 1 ? '' : 's'}`;
  return minutes ? `${hourText} ${minuteText}` : hourText;
}
