import { useSyncExternalStore } from 'react';
import type { RecentActivity } from './recentActivityModel';

/**
 * Device-local, in-memory only. The feed replaces this snapshot after its own
 * Following read; the rail never fetches and nothing is persisted or sent.
 */
let snapshot: RecentActivity[] = [];
const listeners = new Set<() => void>();

export function setRecentActivity(next: RecentActivity[]): void {
  if (next === snapshot) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

export function clearRecentActivity(): void {
  setRecentActivity([]);
}

export function currentRecentActivity(): RecentActivity[] {
  return snapshot;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): RecentActivity[] {
  return snapshot;
}

export function useRecentActivity(): RecentActivity[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
