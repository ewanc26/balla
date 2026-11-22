import { Agent } from '@atproto/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  ExpoOAuthClient,
  type OAuthClientMetadataInput,
  type OAuthSession,
} from '@atproto/oauth-client-expo';
import clientMetadata from '../../oauth-client-metadata.json';
import { CHAT_SERVICE_DID, CHAT_SERVICE_TYPE } from './chatModel';
import {
  ACCOUNTS_KEY,
  handleFromInput,
  nextActiveDid,
  parseAccounts,
  removeAccount as removeAccountEntry,
  serialiseAccounts,
  upsertAccount,
  type AccountEntry,
} from './accountModel';

// OAuth stores its DPoP keys and tokens in MMKV. AsyncStorage only remembers
// which account to restore and the non-secret list of accounts on this device,
// so signing in again does not require re-entering a handle.
const LAST_DID_KEY = 'balla.oauth.did.v1';
const LEGACY_SESSION_KEY = 'balla.session.v1';
const APPVIEW_PROXY = 'did:web:api.bsky.app#bsky_appview';
const WEB_REDIRECT_URI = 'https://balla.croft.click/app';

// The browser build exposes handleCallback(); the native entry does not.
type WebOAuthClient = {
  handleCallback?: () => Promise<OAuthSession | null>;
};
type WebSignIn = (
  input: string,
  options: { redirect_uri: string },
) => Promise<OAuthSession>;

function isPopupHandoff(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 'LOGIN_CONTINUED_IN_PARENT_WINDOW'
  );
}

async function handleWebCallback(): Promise<OAuthSession | null> {
  const webClient = oauthClient as unknown as WebOAuthClient;
  if (typeof webClient.handleCallback !== 'function') return null;

  try {
    return await webClient.handleCallback();
  } catch (err) {
    // This page is the OAuth popup: it has passed the session to the window
    // that opened it and closed itself.
    if (isPopupHandoff(err)) return null;
    throw err;
  }
}

async function signInOnWeb(input: string): Promise<OAuthSession> {
  const webSignIn = oauthClient.signIn as unknown as WebSignIn;
  return webSignIn.call(oauthClient, input, { redirect_uri: WEB_REDIRECT_URI });
}

export const DEFAULT_SERVICE = 'https://bsky.social';

let session: OAuthSession | null = null;
let loggedOutCb: (() => void) | null = null;
let accountChangedCb: ((did: string | null) => void) | null = null;
// A removal revokes first, which makes the OAuth client fire onSessionDeleted.
// This set stops that callback from running the same removal twice.
const removing = new Set<string>();

function createAgent(source: any): Agent {
  return new Agent(source);
}

export let agent: Agent = createAgent(DEFAULT_SERVICE);

/**
 * Chat RPCs are served by the chat service, not the AppView. A cloned agent
 * with the `bsky_chat` proxy sends `atproto-proxy: did:web:api.bsky.chat#bsky_chat`,
 * which is the documented route for chat.bsky.* calls. The mock agent has chat
 * methods patched directly and no withProxy, so it is returned unchanged.
 */
export function getChatAgent(): Agent {
  const candidate = agent as unknown as { withProxy?: (type: string, did: string) => Agent };
  if (typeof candidate.withProxy === 'function') {
    return candidate.withProxy(CHAT_SERVICE_TYPE, CHAT_SERVICE_DID);
  }
  return agent;
}

export function setOnLoggedOut(cb: (() => void) | null) {
  loggedOutCb = cb;
}

/** Tells the app shell which account is active so it can rebuild its UI. */
export function setOnAccountChanged(cb: ((did: string | null) => void) | null) {
  accountChangedCb = cb;
}

function emitActive(did: string | null) {
  accountChangedCb?.(did);
  if (did === null) loggedOutCb?.();
}

/** Non-secret token metadata for the session screen. Never expose tokens. */
export async function getSessionInfo() {
  return session ? await session.getTokenInfo(false) : null;
}

export function getActiveDid(): string | null {
  return session?.did ?? null;
}

export async function getAccounts(): Promise<AccountEntry[]> {
  return parseAccounts(await AsyncStorage.getItem(ACCOUNTS_KEY));
}

async function saveAccounts(entries: AccountEntry[]) {
  await AsyncStorage.setItem(ACCOUNTS_KEY, serialiseAccounts(entries));
}

/** Remember a DID after sign-in. A DID input must not overwrite a known handle. */
async function rememberAccount(did: string, input?: string): Promise<AccountEntry[]> {
  const entries = await getAccounts();
  const existing = entries.find((entry) => entry.did === did);
  const handle = handleFromInput(input || '') || (existing && existing.handle) || null;
  const next = upsertAccount(entries, { did, handle });
  await saveAccounts(next);
  return next;
}

export const oauthClient = new ExpoOAuthClient({
  handleResolver: DEFAULT_SERVICE,
  clientMetadata: clientMetadata as OAuthClientMetadataInput,
  onSessionDeleted: (sub: string) => {
    if (removing.has(sub)) return;
    void (async () => {
      const entries = await getAccounts();
      if (entries.some((entry) => entry.did === sub)) {
        await applyRemoval(removeAccountEntry(entries, sub), sub);
        return;
      }
      if (session?.did === sub) {
        // A legacy session may not be in the registry yet.
        session = null;
        agent = createAgent(DEFAULT_SERVICE);
        await AsyncStorage.removeItem(LAST_DID_KEY).catch(() => {});
        emitActive(null);
      }
    })().catch(() => {});
  },
});

function attachSession(next: OAuthSession) {
  session = next;
  agent = new Agent(next);
  // app.bsky.* reads are served by the AppView, reached through the PDS.
  agent.configureProxy(APPVIEW_PROXY);
}

async function setActive(next: OAuthSession) {
  attachSession(next);
  await AsyncStorage.setItem(LAST_DID_KEY, next.did);
  emitActive(next.did);
}

/**
 * Drop a DID from the registry. If it was active, restore a neighbour so a
 * revoked grant cannot leave Balla showing another account's cached UI.
 */
async function applyRemoval(entries: AccountEntry[], removedDid: string): Promise<AccountEntry[]> {
  await saveAccounts(entries);
  if (session?.did !== removedDid) return entries;

  session = null;
  agent = createAgent(DEFAULT_SERVICE);
  await AsyncStorage.removeItem(LAST_DID_KEY).catch(() => {});
  const fallback = nextActiveDid(entries, removedDid);
  if (!fallback) {
    emitActive(null);
    return entries;
  }
  try {
    const restored = await oauthClient.restore(fallback, false);
    await setActive(restored);
  } catch {
    // The fallback grant is gone too; remove it honestly and try the next.
    await applyRemoval(removeAccountEntry(entries, fallback), fallback);
  }
  return entries;
}

export async function login(input: string): Promise<void> {
  // A stale app-password session is password-equivalent; do not leave it next
  // to the OAuth session.
  await AsyncStorage.removeItem(LEGACY_SESSION_KEY).catch(() => {});
  const next =
    Platform.OS === 'web' ? await signInOnWeb(input) : await oauthClient.signIn(input);
  await rememberAccount(next.did, input);
  await setActive(next);
}

export async function restore(): Promise<boolean> {
  await AsyncStorage.removeItem(LEGACY_SESSION_KEY).catch(() => {});

  // On the web the OAuth popup lands on /app; whichever window owns the
  // callback exchanges the code and the new session is attached here.
  if (Platform.OS === 'web') {
    try {
      const callbackSession = await handleWebCallback();
      if (callbackSession) {
        await rememberAccount(callbackSession.did);
        await setActive(callbackSession);
        return true;
      }
    } catch (err) {
      console.warn('Balla OAuth callback failed', err);
    }
  }

  const did = await AsyncStorage.getItem(LAST_DID_KEY);
  if (!did) return false;

  const entries = await getAccounts();
  if (!entries.some((entry) => entry.did === did)) {
    // Upgrade path: 0.13.0 remembered only the active DID.
    await rememberAccount(did);
  }

  try {
    const next = await oauthClient.restore(did, false);
    await setActive(next);
    // Refresh now so a revoked grant is noticed at startup instead of on the
    // first API call. An offline start keeps the local session.
    await next.getTokenInfo(true).catch(() => {});
    return session !== null;
  } catch {
    const current = await getAccounts();
    await applyRemoval(removeAccountEntry(current, did), did);
    return false;
  }
}

/** Restore a different known DID into a fresh Agent and rebuild the app UI. */
export async function switchAccount(did: string): Promise<boolean> {
  if (session?.did === did) return true;
  const entries = await getAccounts();
  if (!entries.some((entry) => entry.did === did)) return false;
  try {
    const next = await oauthClient.restore(did, false);
    await setActive(next);
    return true;
  } catch {
    // A grant that cannot be restored is not usable; take it out honestly.
    await applyRemoval(removeAccountEntry(await getAccounts(), did), did);
    return false;
  }
}

/** Revoke one account's grant and remove it, leaving the others signed in. */
export async function removeAccount(did: string): Promise<void> {
  const entries = await getAccounts();
  if (!entries.some((entry) => entry.did === did)) return;
  removing.add(did);
  try {
    const current = session?.did === did ? session : null;
    try {
      if (current) await current.signOut();
      else await oauthClient.revoke(did);
    } catch {
      // The local session is removed even if the server cannot be reached.
    }
    await applyRemoval(removeAccountEntry(await getAccounts(), did), did);
  } finally {
    removing.delete(did);
  }
}

/** Sign out of every account on this device and clear the local registry. */
export async function logout(): Promise<void> {
  const entries = await getAccounts();
  const current = session;
  session = null;
  agent = createAgent(DEFAULT_SERVICE);
  await AsyncStorage.removeItem(LAST_DID_KEY).catch(() => {});
  await AsyncStorage.removeItem(ACCOUNTS_KEY).catch(() => {});
  emitActive(null);

  const dids = new Set<string>([...entries.map((entry) => entry.did)]);
  if (current) dids.add(current.did);
  for (const did of dids) {
    removing.add(did);
    try {
      if (current?.did === did) await current.signOut();
      else await oauthClient.revoke(did);
    } catch {
      // Revocation is best-effort; the local registry is already cleared.
    } finally {
      removing.delete(did);
    }
  }
}
