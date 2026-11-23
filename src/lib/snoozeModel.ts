/**
 * Framework-free rules for Balla's 30-day Home snooze (#151).
 *
 * A snooze is a device-local record keyed by the snoozed account's DID. It is
 * not a protocol write, it is never sent anywhere, and it does not follow the
 * account to another device. Expiry is evaluated against an injected clock so
 * the feed checks it when it refreshes, with no background job.
 */

export const SNOOZE_DAYS = 30;
export const SNOOZE_MS = SNOOZE_DAYS * 24 * 60 * 60 * 1000;
export const SNOOZED_ACCOUNTS_KEY = 'balla.snoozedAccounts.v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const DID = /^did:[a-z0-9]+:[a-zA-Z0-9._:%-]+$/;

export type SnoozeRecord = {
  until: number;
  handle?: string;
};

export type SnoozeMap = Record<string, SnoozeRecord>;

function validDid(value: unknown): value is string {
  return typeof value === 'string' && DID.test(value);
}

function cleanHandle(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const handle = value.trim().replace(/^@/, '');
  return handle || undefined;
}

/** Storage is untrusted: keep only well-formed DIDs and positive timestamps. */
export function normaliseSnoozes(value: unknown): SnoozeMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: SnoozeMap = {};
  for (const [did, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!validDid(did)) continue;
    const record = raw as any;
    const until = typeof record?.until === 'number' ? record.until : NaN;
    if (!Number.isFinite(until) || until <= 0) continue;
    const handle = cleanHandle(record?.handle);
    out[did] = { until, ...(handle ? { handle } : {}) };
  }
  return out;
}

export function isSnoozed(
  records: SnoozeMap,
  did: string | undefined,
  now: number
): boolean {
  if (!did) return false;
  const record = records[did];
  return !!record && record.until > now;
}

export function snoozeRemainingDays(until: number, now: number): number {
  if (!Number.isFinite(until) || until <= now) return 0;
  return Math.ceil((until - now) / DAY_MS);
}

/** The countdown the menus and the preferences list state plainly. */
export function snoozeRemainingLabel(until: number, now: number): string {
  const days = snoozeRemainingDays(until, now);
  if (days <= 0) return 'ending now';
  return `${days} day${days === 1 ? '' : 's'} left`;
}

/** A snooze always lasts 30 days from the moment it is set. */
export function addSnooze(
  records: SnoozeMap,
  did: string,
  handle: string | undefined,
  now: number
): SnoozeMap {
  if (!validDid(did)) return records;
  const clean = cleanHandle(handle);
  return {
    ...records,
    [did]: { until: now + SNOOZE_MS, ...(clean ? { handle: clean } : {}) },
  };
}

export function removeSnooze(records: SnoozeMap, did: string): SnoozeMap {
  if (!records[did]) return records;
  const next = { ...records };
  delete next[did];
  return next;
}

export type ActiveSnooze = SnoozeRecord & {
  did: string;
  daysLeft: number;
};

/** Active records only, soonest expiry first so the list is inspectable. */
export function activeSnoozes(records: SnoozeMap, now: number): ActiveSnooze[] {
  return Object.entries(records)
    .filter(([, record]) => record.until > now)
    .map(([did, record]) => ({
      did,
      ...record,
      daysLeft: snoozeRemainingDays(record.until, now),
    }))
    .sort((a, b) => a.until - b.until || a.did.localeCompare(b.did));
}

/**
 * Filter Home items only. A snoozed author's own posts are skipped, and so are
 * reposts performed by a snoozed account. A pin's `reason.by` is not a repost
 * and must not hide the pinned post. Input order is preserved.
 */
export function itemIsSnoozed(
  item: any,
  records: SnoozeMap,
  now: number
): boolean {
  if (isSnoozed(records, item?.post?.author?.did, now)) return true;
  const reason = item?.reason;
  const isRepost = String(reason?.$type || '').endsWith('reasonRepost');
  return isRepost && isSnoozed(records, reason?.by?.did, now);
}

export function filterSnoozedItems<T>(
  items: T[],
  records: SnoozeMap,
  now: number
): T[] {
  return items.filter((item) => !itemIsSnoozed(item, records, now));
}
