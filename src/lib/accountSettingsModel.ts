/**
 * Framework-free rules for the account and privacy editors.
 *
 * Only values the installed OAuth grant can read or write are modelled here.
 * Password, email, 2FA and app-password controls belong to the identity
 * provider or PDS, so those rows are links and explanations, not fake toggles.
 */
import { BLUESKY_WEB, BLUESKY_SOCIAL } from './serviceHosts.ts';

export const BOT_LABEL = 'bot';
export const LOGGED_OUT_PRIVACY_LABEL = '!no-unauthenticated';
export const SELF_LABELS_TYPE = 'com.atproto.label.defs#selfLabels';
export const SELF_LABEL_TYPE = 'com.atproto.label.defs#selfLabel';

export const BLUESKY_ACCOUNT_SETTINGS = BLUESKY_WEB.accountSettings;
export const BLUESKY_PRIVACY_SETTINGS = BLUESKY_WEB.privacySettings;
export const BLUESKY_APP_PASSWORDS = BLUESKY_WEB.appPasswords;

export type SessionSummary = {
  did: string;
  authorizationServer: string;
  resourceServer: string;
  expiresAt: string;
  scopeCount: number;
};

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

/** Read only non-secret token metadata. Access and refresh tokens never appear. */
export function readSessionSummary(info: unknown): SessionSummary | null {
  if (!info || typeof info !== 'object') return null;
  const value = info as Record<string, unknown>;
  const date =
    value.expiresAt instanceof Date && Number.isFinite(value.expiresAt.getTime())
      ? value.expiresAt.toISOString()
      : text(value.expiresAt);
  const scope = text(value.scope);
  return {
    did: text(value.sub, 'Not available'),
    authorizationServer: text(value.iss, 'Not available'),
    resourceServer: text(value.aud, 'Not available'),
    expiresAt: date,
    scopeCount: scope ? scope.split(/\s+/).filter(Boolean).length : 0,
  };
}

/** The AppView attaches source DIDs to labels; self labels come from the account. */
export function profileHasSelfLabel(profile: any, label: string): boolean {
  if (!Array.isArray(profile?.labels)) return false;
  return profile.labels.some(
    (item: any) =>
      item?.val === label &&
      (typeof item?.src !== 'string' || !profile.did || item.src === profile.did)
  );
}

/**
 * Update the raw profile record's self-label values. This preserves other
 * self labels and uses the com.atproto.label.defs#selfLabels shape; it never
 * writes third-party moderation labels back to the PDS.
 */
export function withSelfLabel(record: any, label: string, enabled: boolean): any {
  const previous = Array.isArray(record?.labels?.values)
    ? record.labels.values.filter(
        (item: any) => typeof item?.val === 'string' && item.val !== label
      )
    : [];
  const values = enabled
    ? [...previous, { $type: SELF_LABEL_TYPE, val: label }]
    : previous;
  const next: any = { ...(record || {}) };
  if (values.length) {
    next.labels = { $type: SELF_LABELS_TYPE, values };
  } else {
    delete next.labels;
  }
  return next;
}

/**
 * Keep third-party labels from the profile view when updating the optimistic
 * viewer state. Only labels sourced from the account are replaced.
 */
export function profileViewWithSelfLabel(
  profile: any,
  label: string,
  enabled: boolean
): any {
  const labels = Array.isArray(profile?.labels) ? profile.labels : [];
  const isOwnLabel = (item: any) =>
    !item?.src || !profile?.did || item.src === profile.did;
  const kept = labels.filter(
    (item: any) => !(isOwnLabel(item) && item?.val === label)
  );
  const next = enabled
    ? [...kept, { $type: SELF_LABEL_TYPE, val: label, src: profile?.did }]
    : kept;
  if (!next.length && !labels.length) {
    const { labels: _labels, ...rest } = profile || {};
    return rest;
  }
  return { ...(profile || {}), labels: next };
}

/** A stored birthday is a full ISO calendar date, not a timestamp. */
export function readBirthDate(preferences: any): string {
  const value = preferences?.birthDate;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    const iso = value.toISOString().slice(0, 10);
    return isValidBirthDate(iso) ? iso : '';
  }
  return typeof value === 'string' && isValidBirthDate(value) ? value : '';
}

function isValidBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date.getTime() <= Date.now()
  );
}

export type BirthDateResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

/** An empty value clears the real personal-details preference. */
export function validateBirthDate(input: string): BirthDateResult {
  const value = input.trim();
  if (!value) return { ok: true, value: '' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { ok: false, error: 'Use a date in YYYY-MM-DD format.' };
  }
  if (!isValidBirthDate(value)) {
    return { ok: false, error: 'Enter a real date that is not in the future.' };
  }
  return { ok: true, value };
}

/** The Bluesky control panel is only authoritative for bsky.social accounts. */
export function isBlueskyService(service: string): boolean {
  try {
    const host = new URL(service).hostname.toLowerCase();
    return host === BLUESKY_SOCIAL.host || host.endsWith(`.${BLUESKY_SOCIAL.host}`);
  } catch {
    return false;
  }
}

export function providerLinkDetail(service: string, panel: string): string {
  return isBlueskyService(service)
    ? `This account uses bsky.social, so this opens the correct ${panel} control.`
    : `This account may use another provider. Use that provider’s control panel; the Bluesky link only applies to bsky.social accounts.`;
}

/**
 * A canonical Bluesky panel is only opened for a bsky.social account. Any
 * other session keeps its link closed rather than being sent to the wrong
 * provider's control panel.
 */
export function providerControlPanelUrl(
  service: string,
  canonicalUrl: string
): string | null {
  return isBlueskyService(service) ? canonicalUrl : null;
}

/**
 * A failed link-out may only name the canonical Bluesky address for a
 * bsky.social account. For every other provider Balla does not know the
 * control-panel address and says so instead of echoing a saved host.
 */
export function controlPanelFailureText(
  service: string,
  panel: string,
  canonicalUrl: string
): string {
  if (isBlueskyService(service)) {
    return `Could not open ${panel}. Visit ${canonicalUrl.replace(/^https:\/\//, '')} in a browser.`;
  }
  return `Could not open ${panel}. Use your account provider’s control panel in a browser; Balla cannot infer its address.`;
}

/** A blocked provider-owned link still needs a visible, honest explanation. */
export function providerOwnedPanelText(panel: string): string {
  return `This account may use another provider. Open that provider’s ${panel} control panel; Balla cannot infer its address.`;
}
