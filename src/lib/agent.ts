import { Agent } from '@atproto/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  ExpoOAuthClient,
  type OAuthClientMetadataInput,
  type OAuthSession,
} from '@atproto/oauth-client-expo';
import clientMetadata from '../../oauth-client-metadata.json';

// OAuth stores its DPoP keys and tokens in MMKV. AsyncStorage only remembers
// which account to restore, so signing in again does not require re-entering a
// handle.
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

function createAgent(source: any): Agent {
  return new Agent(source);
}

export let agent: Agent = createAgent(DEFAULT_SERVICE);

export function setOnLoggedOut(cb: (() => void) | null) {
  loggedOutCb = cb;
}

export const oauthClient = new ExpoOAuthClient({
  handleResolver: DEFAULT_SERVICE,
  clientMetadata: clientMetadata as OAuthClientMetadataInput,
  onSessionDeleted: (sub: string) => {
    void AsyncStorage.removeItem(LAST_DID_KEY).catch(() => {});
    if (session && session.did === sub) {
      session = null;
      agent = createAgent(DEFAULT_SERVICE);
      loggedOutCb?.();
    }
  },
});

function attachSession(next: OAuthSession) {
  session = next;
  agent = new Agent(next);
  // app.bsky.* reads are served by the AppView, reached through the PDS.
  agent.configureProxy(APPVIEW_PROXY);
}

export async function login(input: string): Promise<void> {
  // A stale app-password session is password-equivalent; do not leave it next
  // to the OAuth session.
  await AsyncStorage.removeItem(LEGACY_SESSION_KEY).catch(() => {});
  const next =
    Platform.OS === 'web' ? await signInOnWeb(input) : await oauthClient.signIn(input);
  attachSession(next);
  await AsyncStorage.setItem(LAST_DID_KEY, next.did);
}

export async function restore(): Promise<boolean> {
  await AsyncStorage.removeItem(LEGACY_SESSION_KEY).catch(() => {});

  // On the web the OAuth popup lands on /app; whichever window owns the
  // callback exchanges the code and the new session is attached here.
  if (Platform.OS === 'web') {
    try {
      const callbackSession = await handleWebCallback();
      if (callbackSession) {
        attachSession(callbackSession);
        await AsyncStorage.setItem(LAST_DID_KEY, callbackSession.did);
        return true;
      }
    } catch (err) {
      console.warn('Balla OAuth callback failed', err);
    }
  }

  const did = await AsyncStorage.getItem(LAST_DID_KEY);
  if (!did) return false;

  try {
    const next = await oauthClient.restore(did, false);
    attachSession(next);
    // Refresh now so a revoked grant is noticed at startup instead of on the
    // first API call. An offline start keeps the local session.
    await next.getTokenInfo(true).catch(() => {});
    return session !== null;
  } catch {
    await AsyncStorage.removeItem(LAST_DID_KEY).catch(() => {});
    return false;
  }
}

export async function logout(): Promise<void> {
  const current = session;
  session = null;
  agent = createAgent(DEFAULT_SERVICE);
  await AsyncStorage.removeItem(LAST_DID_KEY).catch(() => {});
  loggedOutCb?.();

  if (current) {
    try {
      await current.signOut();
    } catch {
      // The local session is already gone; a failed revocation must not keep
      // the UI signed in.
    }
  }
}
