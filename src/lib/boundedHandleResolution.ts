/**
 * One bounded call to the public handle resolver (#96/#97/#100, partial).
 *
 * The AT Protocol handle resolver follows the handle's own well-known file and
 * then a configured XRPC fallback. Both paths already accept an AbortSignal,
 * but the in-app identity fallback called the resolver without a deadline, so
 * a host that accepted a request and never completed it could leave sign-in
 * pre-flight, profile fallbacks, mentions and loading cards waiting forever.
 *
 * The clock and signal come from the same `withDeadline` helper as the other
 * public reads. A timeout is an unavailable source: it returns null so the
 * caller's existing cached-handle fallback still applies. Provider prose is
 * never read, logged or displayed, and a resolver error is rethrown unchanged
 * so the shared retry classifier can still see its structured status or code.
 */

import type { HandleResolver, ResolvedHandle } from '@atproto/oauth-client-expo';
import { withDeadline, type TimeoutDeps } from './requestTimeout.ts';

export type BoundedHandleResolutionDeps = TimeoutDeps;

export async function resolveHandleWithDeadline(
  resolver: HandleResolver,
  handle: string,
  deps: BoundedHandleResolutionDeps = {},
): Promise<ResolvedHandle> {
  if (typeof handle !== 'string' || !handle) return null;

  const outcome = await withDeadline(
    (signal) => resolver.resolve(handle, { signal }),
    deps,
  );

  return outcome.state === 'timeout' ? null : outcome.value;
}
