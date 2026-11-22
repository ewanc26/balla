/**
 * Sends feed feedback to the generator that produced a post. This is a real
 * `app.bsky.feed.sendInteractions` call routed through the generator's
 * `bsky_fg` proxy service; Balla never records a pretend local signal.
 */
import { agent } from './agent';
import {
  eventForKind,
  feedProxy,
  feedbackInteraction,
  type FeedbackKind,
  type FeedbackViewContext,
} from './feedFeedbackModel';

export {
  REQUEST_MORE,
  REQUEST_LESS,
  feedbackEnabled,
} from './feedFeedbackModel';

export async function sendFeedFeedback({
  feedUri,
  serviceDid,
  postUri,
  kind,
  feedContext,
  reqId,
  viewContext = 'feed',
}: {
  feedUri?: string;
  serviceDid: string;
  postUri: string;
  kind: FeedbackKind;
  feedContext?: string;
  reqId?: string;
  viewContext?: FeedbackViewContext;
}) {
  return agent.app.bsky.feed.sendInteractions(
    {
      ...(feedUri ? { feed: feedUri } : {}),
      interactions: [
        feedbackInteraction({
          postUri,
          event: eventForKind(kind),
          feedContext,
          reqId,
          viewContext,
        }),
      ],
    },
    { headers: { 'atproto-proxy': feedProxy(serviceDid) } }
  );
}
