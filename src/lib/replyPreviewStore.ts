import { useEffect, useSyncExternalStore } from 'react';
import { networkBackend } from './networkBackend';
import { readWithRetry } from './reliability';
import {
  REPLY_PREVIEW_CACHE_LIMIT,
  REPLY_PREVIEW_MAX_ACTIVE,
  directRepliesFromThread,
} from './replyPreviewModel';

/**
 * A session cache for one direct-reply preview per feed card.
 *
 * Only viewable cards request an entry. The queue is intentionally short-lived:
 * leaving the viewport cancels a queued request, and at most two reads run at
 * once. Nothing is persisted, logged or written.
 */
export type ReplyPreviewEntry =
  | { status: 'ready'; replies: any[] }
  | { status: 'failed' };

const cache = new Map<string, ReplyPreviewEntry>();
const wanted = new Set<string>();
const queue: string[] = [];
const listeners = new Set<() => void>();
let active = 0;
let generation = 0;

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function trimCache(): void {
  while (cache.size > REPLY_PREVIEW_CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (typeof oldest !== 'string') return;
    cache.delete(oldest);
  }
}

function remember(uri: string, entry: ReplyPreviewEntry): void {
  // Reinserting makes the Map's first key the least recently stored entry.
  cache.delete(uri);
  cache.set(uri, entry);
  trimCache();
  emit();
}

function pump(): void {
  while (active < REPLY_PREVIEW_MAX_ACTIVE) {
    const uri = queue.shift();
    if (!uri) return;
    if (!wanted.has(uri)) continue;

    active += 1;
    const runGeneration = generation;
    void readWithRetry(() =>
      networkBackend.thread.getPostThread({ uri, depth: 1 })
    )
      .then((response) => {
        if (runGeneration !== generation) return;
        remember(uri, {
          status: 'ready',
          replies: directRepliesFromThread(response.data.thread),
        });
      })
      .catch(() => {
        if (runGeneration !== generation) return;
        // No preview is the fallback. The failure is cached so revisiting a
        // failed card cannot start an unbounded retry loop.
        remember(uri, { status: 'failed' });
      })
      .finally(() => {
        active = Math.max(0, active - 1);
        if (runGeneration === generation) wanted.delete(uri);
        pump();
      });
  }
}

export function requestReplyPreview(uri: string): void {
  if (!uri || cache.has(uri) || wanted.has(uri)) return;
  wanted.add(uri);
  queue.push(uri);
  pump();
}

export function cancelReplyPreview(uri: string): void {
  wanted.delete(uri);
  const index = queue.indexOf(uri);
  if (index >= 0) queue.splice(index, 1);
}

export function clearReplyPreviewCache(): void {
  // In-flight reads finish but cannot write into the next account or session.
  generation += 1;
  cache.clear();
  wanted.clear();
  queue.length = 0;
  emit();
}

export function useReplyPreview(
  uri: string | undefined,
  enabled: boolean
): ReplyPreviewEntry | undefined {
  const entry = useSyncExternalStore(
    subscribe,
    () => (uri ? cache.get(uri) : undefined),
    () => (uri ? cache.get(uri) : undefined)
  );

  useEffect(() => {
    if (!enabled || !uri || cache.has(uri)) return;
    requestReplyPreview(uri);
    return () => cancelReplyPreview(uri);
  }, [enabled, entry, uri]);

  return entry;
}
