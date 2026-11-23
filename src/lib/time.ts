/** Shared long-form date formatting for session, moderation and account copy. */
export function formatDate(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

const EVENT_DATE = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const EVENT_TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});
const EVENT_TIME_ZONE = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
});

function usableDate(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * A calendar event's window in the device's local timezone, with an explicit
 * short zone name. The raw record timestamp stays available separately so the
 * event's own stated offset is never replaced by this local rendering.
 */
export function formatEventWindow(start?: string | null, end?: string | null): string {
  const starts = usableDate(start);
  const ends = usableDate(end);
  if (!starts && !ends) return '';
  if (!starts) return `Ends ${EVENT_DATE.format(ends!)}, ${EVENT_TIME_ZONE.format(ends!)}`;
  if (!ends) return `${EVENT_DATE.format(starts)}, ${EVENT_TIME_ZONE.format(starts)}`;
  if (sameLocalDay(starts, ends)) {
    return `${EVENT_DATE.format(starts)}, ${EVENT_TIME.format(starts)}–${EVENT_TIME_ZONE.format(ends)}`;
  }
  return `${EVENT_DATE.format(starts)}, ${EVENT_TIME_ZONE.format(starts)} – ${EVENT_DATE.format(ends)}, ${EVENT_TIME_ZONE.format(ends)}`;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + 'm';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h';
  const days = Math.floor(hours / 24);
  if (days <= 7) return days + 'd';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const d = new Date(iso);
  return months[d.getMonth()] + ' ' + d.getDate();
}
