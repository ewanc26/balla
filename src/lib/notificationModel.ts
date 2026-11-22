/**
 * Framework-free rules for notification tap targets. Kept free of React Native
 * imports so the mapping can be tested under Node, like the other *Model
 * modules. A target is only ever an id or URI: no notification content is
 * stored by Balla or written to a log.
 *
 * Bluesky notifications deep-link to two honest destinations:
 *   - replies, mentions, quotes, likes and reposts -> the post's thread;
 *   - follows -> the actor's public profile.
 * Anything without a usable target stays inert rather than inventing a link.
 */

export type NotificationTarget =
  | { kind: 'thread'; uri: string }
  | { kind: 'profile'; did: string };

export function notificationTarget(
  item?: any,
  displayedActor?: any
): NotificationTarget | undefined {
  const reason = String(item?.reason || '');

  if (reason === 'reply' || reason === 'mention' || reason === 'quote') {
    return item?.uri ? { kind: 'thread', uri: String(item.uri) } : undefined;
  }
  if (reason.startsWith('like') || reason.startsWith('repost')) {
    return item?.reasonSubject
      ? { kind: 'thread', uri: String(item.reasonSubject) }
      : undefined;
  }
  if (reason === 'follow' || reason === 'follow_via_proxy') {
    // A follow group shows one face; open the actor on display, falling back
    // to the notification's own author when the group has no collected actor.
    const did = displayedActor?.did || item?.author?.did;
    return did ? { kind: 'profile', did: String(did) } : undefined;
  }
  return undefined;
}

/** The action half of a notification row's accessibility label. */
export function notificationTargetAction(target?: NotificationTarget): string {
  if (!target) return '';
  return target.kind === 'profile' ? ' Open profile.' : ' Open thread.';
}
