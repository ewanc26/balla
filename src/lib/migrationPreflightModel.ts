/**
 * Framework-free facts for a read-only account migration pre-flight.
 *
 * A real PDS migration needs account creation, repository import, blob copy,
 * PLC identity operations and account activation. None of those are in this
 * client's 112-scope OAuth grant, so Balla must not show a move button. It can
 * still read public host facts and export the private preferences this grant
 * is allowed to read, then hand off to tooling that can do the move.
 *
 * Only structured fields are used here. Provider response text and preference
 * values are never logged or rendered as status copy.
 */

export const ATPROTO_MIGRATION_GUIDE = 'https://atproto.com/guides/account-migration';
export const PDS_MIGRATION_GUIDE =
  'https://github.com/bluesky-social/pds/blob/main/ACCOUNT_MIGRATION.md';
export const GOAT_MIGRATION_TOOL = 'https://github.com/bluesky-social/goat';
export const PDS_MOOVER_TOOL = 'https://pdsmoover.com/';
export const MIGRATION_WALKTHROUGH =
  'https://whtwnd.com/bnewbold.net/3l5ii332pf32u';

export const MIGRATION_OUTSIDE_GRANT: readonly { method: string; purpose: string }[] = [
  { method: 'com.atproto.server.createAccount', purpose: 'Open the account on the destination PDS' },
  { method: 'com.atproto.sync.getRepo', purpose: 'Read the repository CAR from the current PDS' },
  { method: 'com.atproto.repo.importRepo', purpose: 'Import that repository into the destination' },
  { method: 'com.atproto.sync.listBlobs', purpose: 'Inventory public blobs on the current PDS' },
  { method: 'com.atproto.repo.listMissingBlobs', purpose: 'Find blobs the destination still needs' },
  { method: 'com.atproto.server.checkAccountStatus', purpose: 'Verify imported records and blobs' },
  { method: 'PLC identity operations', purpose: 'Point the DID document at the new PDS' },
  { method: 'com.atproto.server.activateAccount', purpose: 'Make the destination account active' },
];

export type PreferenceInventory = {
  count: number;
  kinds: string[];
};

function preferenceKind(value: unknown): string {
  if (!value || typeof value !== 'object') return 'unknown';
  const type = (value as Record<string, unknown>).$type;
  if (typeof type !== 'string' || !type) return 'unknown';
  const short = type.split('#').pop() || type;
  return short.length <= 48 ? short : `${short.slice(0, 45)}…`;
}

/**
 * Count preference entries and name their types without reading any value.
 * A malformed response is reported as unreadable, never as an empty success.
 */
export function readPreferenceInventory(preferences: unknown): PreferenceInventory | null {
  if (!Array.isArray(preferences)) return null;
  const kinds: string[] = [];
  for (const entry of preferences) {
    const kind = preferenceKind(entry);
    if (!kinds.includes(kind)) kinds.push(kind);
  }
  return { count: preferences.length, kinds };
}

export function preferenceInventoryText(value: PreferenceInventory | null): string {
  if (!value) return 'Preferences: not read yet.';
  const types = value.kinds.length ? ` across ${value.kinds.length} types` : '';
  return `Preferences: ${value.count} entries${types}.`;
}

/** The export is local and user-initiated; it is never uploaded by Balla. */
export function buildPreferenceExport(
  preferences: unknown,
  did: string,
  exportedAt: string
): string | null {
  if (!Array.isArray(preferences)) return null;
  return JSON.stringify(
    {
      format: 'balla.preferences.v1',
      did: did || 'not available',
      exportedAt,
      preferences,
    },
    null,
    2
  );
}

export function preferenceExportName(did: string): string {
  const safe = did.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80) || 'account';
  return `balla-preferences-${safe}.json`;
}
