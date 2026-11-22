/**
 * Device-local hidden posts, mirroring the official client's persisted
 * `hiddenPosts`. Stored outside the account so a hide survives reloads and
 * applies across every feed, thread and profile. Failures are non-fatal: a
 * hide still affects this session even if storage is unavailable.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addHiddenPost,
  HIDDEN_POSTS_KEY,
  normaliseHiddenPosts,
  removeHiddenPost,
} from './hiddenPostsModel';

let cache: string[] | null = null;
type HiddenPostsListener = (uris: string[]) => void;
const listeners = new Set<HiddenPostsListener>();

function publish(next: string[]) {
  cache = next;
  for (const listener of listeners) listener(next);
}

export async function loadHiddenPosts(): Promise<string[]> {
  if (cache) return cache;
  try {
    const stored = await AsyncStorage.getItem(HIDDEN_POSTS_KEY);
    cache = normaliseHiddenPosts(stored ? JSON.parse(stored) : []);
  } catch {
    cache = [];
  }
  return cache;
}

export function currentHiddenPosts(): string[] {
  return cache || [];
}

/** Hide a post for this device only; never sends a report or server write. */
export async function hidePostForMe(uri: string): Promise<void> {
  const next = addHiddenPost(await loadHiddenPosts(), uri);
  if (next === cache && cache !== null) return;
  publish(next);
  try {
    await AsyncStorage.setItem(HIDDEN_POSTS_KEY, JSON.stringify(next));
  } catch {
    // The in-memory list still hides the post for this session.
  }
}

export async function unhidePostForMe(uri: string): Promise<void> {
  publish(removeHiddenPost(await loadHiddenPosts(), uri));
  try {
    await AsyncStorage.setItem(HIDDEN_POSTS_KEY, JSON.stringify(cache || []));
  } catch {
    // Best-effort persistence; the in-memory restore still applies.
  }
}

export function subscribeHiddenPosts(listener: HiddenPostsListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
