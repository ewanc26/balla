import { Agent } from '@atproto/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The session is stored with AsyncStorage for now so it works in Expo Go.
// TODO for real builds: move to expo-secure-store, and move auth to ATProto
// OAuth via @atproto/oauth-client-expo (client metadata on balla.croft.click).

const KEY = 'balla.session.v1';
export const DEFAULT_SERVICE = 'https://bsky.social';

// new Agent() has accepted a service URL as a plain string in every era of
// @atproto/api, but the constructor signature has drifted; keep it behind
// one cast so versions can move without touching every call site.
function createAgent(service: string): Agent {
  return new (Agent as any)(service) as Agent;
}

export let agent: Agent = createAgent(DEFAULT_SERVICE);

export interface StoredSession {
  service: string;
  session: any;
}

let loggedOutCb: (() => void) | null = null;
export function setOnLoggedOut(cb: (() => void) | null) {
  loggedOutCb = cb;
}

export async function login(
  identifier: string,
  password: string,
  service: string = DEFAULT_SERVICE
): Promise<void> {
  const a = createAgent(service);
  await a.login({ identifier, password });
  agent = a;
  const stored: StoredSession = { service, session: (a as any).session };
  await AsyncStorage.setItem(KEY, JSON.stringify(stored));
}

export async function restore(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return false;
  try {
    const stored: StoredSession = JSON.parse(raw);
    const a = createAgent(stored.service);
    await a.resumeSession(stored.session);
    agent = a;
    return true;
  } catch {
    await AsyncStorage.removeItem(KEY);
    return false;
  }
}

export async function logout(): Promise<void> {
  try {
    await agent.logout();
  } catch {
    // A failed logout on the server should not block a local sign-out.
  }
  await AsyncStorage.removeItem(KEY);
  if (loggedOutCb) loggedOutCb();
}
