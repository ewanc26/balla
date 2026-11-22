/**
 * Reads and writes per-account activity subscriptions through the AppView's
 * published endpoints. Unlike the declaration (a repo record), these live on
 * the AppView keyed by the viewer, so they use the narrow `rpc:` scopes.
 */
import { agent } from './agent';
import {
  NOT_SUBSCRIBED,
  isSubscribed,
  parseActivitySubscription,
  subscriptionPayload,
  subscriptionSummary,
  toggleActivitySubscription,
  type ActivitySubscription,
} from './activitySubscriptionsModel';

export {
  NOT_SUBSCRIBED,
  isSubscribed,
  parseActivitySubscription,
  subscriptionSummary,
  toggleActivitySubscription,
  type ActivitySubscription,
} from './activitySubscriptionsModel';

/** List the profiles whose activity the viewer opted in to, paginated. */
export async function listActivitySubscriptions(): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | undefined;
  do {
    const res = await agent.app.bsky.notification.listActivitySubscriptions({
      limit: 100,
      ...(cursor ? { cursor } : {}),
    });
    all.push(...(res.data.subscriptions || []));
    cursor = res.data.cursor;
  } while (cursor);
  return all;
}

/** Subscribe to, adjust, or clear a subject's activity subscription. */
export async function putActivitySubscription(
  subject: string,
  value: ActivitySubscription
): Promise<void> {
  await agent.app.bsky.notification.putActivitySubscription(
    subscriptionPayload(subject, value) as any
  );
}
