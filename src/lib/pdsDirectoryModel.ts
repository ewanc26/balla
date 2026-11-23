/**
 * Framework-free normalisation for the OpenPDS directory API.
 *
 * The directory is a third-party index, not a health check. Every row shown in
 * the app is a structured field published by that index; "open" means the
 * directory currently advertises open registration, not that Balla has
 * verified sign-up. The live check for a host is a separate describeServer
 * read in hostingProbe.ts. No free-form provider message is kept here.
 */

import { normaliseHostUrl } from './hostingModel.ts';

export const PDS_DIRECTORY_API = 'https://openpds.tijs.org/api/servers';

export type PdsDirectoryEntry = {
  url: string;
  host: string;
  did: string | null;
  version: string | null;
  software: string | null;
  userDomains: string[];
  userCount: number | null;
  country: string | null;
  inviteRequired: boolean | null;
  phoneRequired: boolean | null;
  privacyPolicy: string | null;
  termsOfService: string | null;
  contactEmail: string | null;
  lastSeen: string | null;
};

export type PdsDirectory = {
  updatedAt: string | null;
  totalOpen: number | null;
  entries: PdsDirectoryEntry[];
};

export type DirectoryState = 'idle' | 'loading' | 'ok' | 'unavailable' | 'invalid';

const DID_RE = /^did:[a-z]+:[A-Za-z0-9._:%-]+$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function safeHttpsUrl(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function normalisePdsEntry(raw: unknown): PdsDirectoryEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  // Only hosts the directory marks open are useful for a sign-in choice.
  if (value.is_open !== true) return null;
  const url = normaliseHostUrl(text(value.url) ?? '');
  if (!url) return null;
  const domains = Array.isArray(value.user_domains)
    ? value.user_domains.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
  const count = typeof value.user_count === 'number' && Number.isFinite(value.user_count)
    ? Math.max(0, Math.floor(value.user_count))
    : null;
  const did = text(value.did);
  const email = text(value.contact_email);
  return {
    url,
    host: new URL(url).hostname,
    did: did && DID_RE.test(did) ? did : null,
    version: text(value.version),
    software: text(value.pds_software),
    userDomains: domains,
    userCount: count,
    country: text(value.country_name),
    inviteRequired: bool(value.invite_code_required),
    phoneRequired: bool(value.phone_verification),
    privacyPolicy: safeHttpsUrl(value.privacy_policy),
    termsOfService: safeHttpsUrl(value.terms_of_service),
    contactEmail: email && EMAIL_RE.test(email) ? email : null,
    lastSeen: text(value.last_seen),
  };
}

export function normalisePdsDirectory(raw: unknown): PdsDirectory | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.servers)) return null;
  const meta = value.meta && typeof value.meta === 'object' ? (value.meta as Record<string, unknown>) : {};
  const entries = value.servers
    .map(normalisePdsEntry)
    .filter((entry): entry is PdsDirectoryEntry => entry !== null)
    .sort((a, b) => (b.userCount ?? 0) - (a.userCount ?? 0) || a.host.localeCompare(b.host));
  return {
    updatedAt: text(meta.updated_at),
    totalOpen: typeof meta.total_open === 'number' ? meta.total_open : entries.length,
    entries,
  };
}

export function filterPdsEntries(entries: PdsDirectoryEntry[], query: string): PdsDirectoryEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return entries;
  return entries.filter((entry) =>
    [entry.host, entry.country, entry.software, entry.did]
      .some((field) => (field ?? '').toLowerCase().includes(needle))
  );
}

export function directoryCopy(state: DirectoryState): string {
  switch (state) {
    case 'idle':
      return 'Open the directory to see hosts advertising open registration.';
    case 'loading':
      return 'Reading the OpenPDS directory…';
    case 'ok':
      return 'Listed by OpenPDS as open — not a health check or a sign-up promise. Check the host before trusting its details.';
    case 'unavailable':
      return 'The directory could not be reached. The link-out below still works.';
    case 'invalid':
      return 'The directory returned an unexpected response.';
  }
}
