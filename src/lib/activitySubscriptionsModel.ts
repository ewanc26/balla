/**
 * Framework-free rules for per-account activity subscriptions. The official
 * client stores one `app.bsky.notification.defs#activitySubscription` per
 * subject through `putActivitySubscription`, with two booleans: `post` and
 * `reply`. A reply subscription requires a post subscription, so turning off
 * posts always turns off replies too. Absence means not subscribed.
 */

export type ActivitySubscription = { post: boolean; reply: boolean };

export const NOT_SUBSCRIBED: ActivitySubscription = { post: false, reply: false };

/** Normalise any stored viewer shape into the two published booleans. */
export function parseActivitySubscription(value: unknown): ActivitySubscription {
  if (!value || typeof value !== 'object') return { ...NOT_SUBSCRIBED };
  const sub = value as any;
  const post = sub.post === true;
  const reply = sub.reply === true && post;
  return { post, reply };
}

/** True when the viewer asked for either kind of activity notification. */
export function isSubscribed(value: unknown): boolean {
  const sub = parseActivitySubscription(value);
  return sub.post || sub.reply;
}

/**
 * Apply a toggle to a subscription, enforcing that replies never exist
 * without posts. `kind` is one of the two published booleans.
 */
export function toggleActivitySubscription(
  current: unknown,
  kind: 'post' | 'reply',
  enabled: boolean
): ActivitySubscription {
  const sub = parseActivitySubscription(current);
  if (kind === 'post') {
    if (!enabled) return { ...NOT_SUBSCRIBED };
    return { post: true, reply: sub.reply };
  }
  // A reply subscription always carries a post subscription with it.
  return { post: enabled ? true : sub.post, reply: enabled };
}

/** The payload passed to `putActivitySubscription` for a subject DID. */
export function subscriptionPayload(subject: string, value: ActivitySubscription) {
  const sub = parseActivitySubscription(value);
  return {
    subject,
    activitySubscription: {
      $type: 'app.bsky.notification.defs#activitySubscription',
      post: sub.post,
      reply: sub.reply,
    },
  };
}

/** A short human summary of a subscription, for accessible labels. */
export function subscriptionSummary(value: unknown): string {
  const sub = parseActivitySubscription(value);
  if (!sub.post) return 'Not subscribed';
  return sub.reply ? 'Posts and replies' : 'Posts only';
}
