/**
 * Framework-free rules for feed feedback. `requestMore` and `requestLess` are
 * published `app.bsky.feed.defs` interaction events sent to the feed generator
 * that produced the post, through the `bsky_fg` atproto-proxy service. Kept
 * free of React Native and agent imports so the payloads are testable in Node.
 */

export const REQUEST_MORE = 'app.bsky.feed.defs#requestMore';
export const REQUEST_LESS = 'app.bsky.feed.defs#requestLess';

export type FeedbackEvent = typeof REQUEST_MORE | typeof REQUEST_LESS;
export type FeedbackKind = 'more' | 'less';
export type FeedbackViewContext = 'feed' | 'thread';

export type FeedbackInteraction = {
  $type: 'app.bsky.feed.defs#interaction';
  item: string;
  event: FeedbackEvent;
  feedContext?: string;
  reqId?: string;
  viewContext: FeedbackViewContext;
};

export function eventForKind(kind: FeedbackKind): FeedbackEvent {
  return kind === 'more' ? REQUEST_MORE : REQUEST_LESS;
}

/** Build one valid interaction. Empty context fields are never sent. */
export function feedbackInteraction({
  postUri,
  event,
  feedContext,
  reqId,
  viewContext = 'feed',
}: {
  postUri: string;
  event: FeedbackEvent;
  feedContext?: string;
  reqId?: string;
  viewContext?: FeedbackViewContext;
}): FeedbackInteraction {
  if (!postUri || !postUri.startsWith('at://')) {
    throw new Error('Feedback needs a real post address.');
  }
  return {
    $type: 'app.bsky.feed.defs#interaction',
    item: postUri,
    event,
    ...(feedContext ? { feedContext } : {}),
    ...(reqId ? { reqId } : {}),
    viewContext,
  };
}

/**
 * Feedback is only offered for a signed-in custom feed that declares it can
 * receive interactions. The chronological Following timeline has no generator
 * and deliberately gets no ranking feedback.
 */
export function feedbackEnabled(
  generator: any,
  signedIn: boolean
): boolean {
  return (
    signedIn &&
    !!generator &&
    generator.acceptsInteractions === true &&
    typeof generator.did === 'string' &&
    generator.did.length > 0
  );
}

/** The proxy target for a feed generator service. */
export function feedProxy(serviceDid: string): string {
  if (!serviceDid.startsWith('did:')) {
    throw new Error('A feed service DID is required for feedback.');
  }
  return `${serviceDid}#bsky_fg`;
}
