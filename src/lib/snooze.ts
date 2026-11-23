/**
 * Device-local snooze storage (#151). The record lives in AsyncStorage and is
 * never written to the PDS, a preference record or any XRPC endpoint. It is
 * shared by the post menu, the profile menu and the Following preferences
 * list through one cache and one subscription.
 */
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addSnooze,
  normaliseSnoozes,
  removeSnooze,
  SNOOZED_ACCOUNTS_KEY,
  type SnoozeMap,
} from './snoozeModel';

let cache: SnoozeMap | null = null;
type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener();
}

function publish(next: SnoozeMap) {
  cache = next;
  emit();
}

async function persist(next: SnoozeMap): Promise<void> {
  try {
    await AsyncStorage.setItem(SNOOZED_ACCOUNTS_KEY, JSON.stringify(next));
  } catch {
    // The in-memory snooze still applies for this session.
  }
}

export async function loadSnoozes(): Promise<SnoozeMap> {
  if (cache) return cache;
  let next: SnoozeMap = {};
  try {
    const stored = await AsyncStorage.getItem(SNOOZED_ACCOUNTS_KEY);
    next = normaliseSnoozes(stored ? JSON.parse(stored) : {});
  } catch {
    next = {};
  }
  cache = next;
  emit();
  return cache;
}

export function currentSnoozes(): SnoozeMap {
  return cache || {};
}

/** Hide one account from Home for 30 days on this device only. */
export async function snoozeAccount(did: string, handle?: string): Promise<void> {
  const next = addSnooze(await loadSnoozes(), did, handle, Date.now());
  publish(next);
  await persist(next);
}

/** End a snooze immediately; the next Home render shows the account again. */
export async function endSnooze(did: string): Promise<void> {
  const next = removeSnooze(await loadSnoozes(), did);
  publish(next);
  await persist(next);
}

export function subscribeSnoozes(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Re-render when the stored records change, including the first load. */
export function useSnoozedAccounts(): SnoozeMap {
  const [records, setRecords] = useState<SnoozeMap>(() => currentSnoozes());

  useEffect(() => {
    let active = true;
    void loadSnoozes().then((next) => {
      if (active) setRecords(next);
    });
    const unsubscribe = subscribeSnoozes(() => setRecords(currentSnoozes()));
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return records;
}
