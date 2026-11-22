/**
 * Pure helpers for the local account registry. The OAuth client keeps each
 * session's tokens and DPoP keys in its own store, keyed by the account DID.
 * Balla only remembers which DIDs have signed in and any handle it was given,
 * so it can offer a switch list. Nothing here touches a token or an agent.
 */

export type AccountEntry = {
  did: string;
  handle: string | null;
};

export const ACCOUNTS_KEY = 'balla.oauth.accounts.v1';

const DID_RE = /^did:[a-z]+:[A-Za-z0-9._:%-]+$/i;

/** Opt-in preview accounts, used only by the mock screen fixtures. */
export const MOCK_ACCOUNTS: AccountEntry[] = [
  { did: 'did:plc:mockviewer', handle: 'ewan.balla.test' },
  { did: 'did:plc:mockmum', handle: 'mum.balla.test' },
];

export function normaliseAccountHandle(input: string): string {
  return input.trim().replace(/\s+/g, '').replace(/^@/, '');
}

export function isDid(value: string): boolean {
  return DID_RE.test(value);
}

/** A handle, not a DID, a server URL or an empty string. */
export function isHandle(value: string): boolean {
  const cleaned = normaliseAccountHandle(value);
  return !isDid(cleaned) && cleaned.includes('.') && !cleaned.includes(':') && !cleaned.includes('/');
}

/** A DID is honest but long; keep the method and enough of the identifier. */
export function shortenDid(did: string): string {
  const parts = did.split(':');
  if (parts.length < 3) return did;
  const id = parts.slice(2).join(':');
  if (id.length <= 14) return did;
  return `${parts[0]}:${parts[1]}:${id.slice(0, 6)}…${id.slice(-4)}`;
}

export function accountLabel(entry: AccountEntry): string {
  return entry.handle ? `@${entry.handle}` : shortenDid(entry.did);
}

export function accountSubtitle(entry: AccountEntry): string {
  return entry.handle ? shortenDid(entry.did) : 'AT Protocol account';
}

/** Recover the handle a person typed, without treating a DID or URL as one. */
export function handleFromInput(input: string): string | null {
  const cleaned = normaliseAccountHandle(input);
  return isHandle(cleaned) ? cleaned : null;
}

export function parseAccounts(raw: string | null | undefined): AccountEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const entries: AccountEntry[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const candidate = item as { did?: unknown; handle?: unknown };
      const did = typeof candidate.did === 'string' ? candidate.did.trim() : '';
      if (!isDid(did) || seen.has(did)) continue;
      const handle = typeof candidate.handle === 'string' ? candidate.handle : '';
      seen.add(did);
      entries.push({ did, handle: handle ? handleFromInput(handle) : null });
    }
    return entries;
  } catch {
    return [];
  }
}

export function serialiseAccounts(entries: AccountEntry[]): string {
  return JSON.stringify(entries.map((entry) => ({ did: entry.did, handle: entry.handle })));
}

/** Keep one entry per DID, with the newest last so the list reads naturally. */
export function upsertAccount(entries: AccountEntry[], entry: AccountEntry): AccountEntry[] {
  return [...entries.filter((existing) => existing.did !== entry.did), { ...entry }];
}

export function removeAccount(entries: AccountEntry[], did: string): AccountEntry[] {
  return entries.filter((entry) => entry.did !== did);
}

/** After removing the active DID, prefer its neighbour, then the previous one. */
export function nextActiveDid(entries: AccountEntry[], removedDid: string): string | null {
  const index = entries.findIndex((entry) => entry.did === removedDid);
  const remaining = removeAccount(entries, removedDid);
  if (index === -1) return remaining[0]?.did ?? null;
  return remaining[Math.min(index, remaining.length - 1)]?.did ?? null;
}
