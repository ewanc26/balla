/**
 * A ranked feed offered by the For you shelf (#158). The entry is curation
 * data, not a Balla algorithm: every field describes the third party that
 * selected the posts and what its published source says it reads.
 */
export type RankedFeed = {
  uri: string;
  name: string;
  creator: string;
  /** The feed generator service DID from app.bsky.feed.defs#generatorView. */
  serviceDid: string;
  /** One line describing the published algorithm, not a claim by Balla. */
  algorithm: string;
  /** What selecting this feed does and what the operator reads. */
  disclosure: string;
  sourceUrl: string;
};

/**
 * Curated by hand, newest evidence first. fu is first because it is Eurosky's
 * reference implementation and its source is public. Adding another feed here
 * means adding its real AT-URI and its published algorithm, never a guess.
 */
export const RANKED_FEEDS: RankedFeed[] = [
  {
    uri: 'at://did:plc:ooensn4mr5mhznzypvxelfa3/app.bsky.feed.generator/fu',
    name: 'fu',
    creator: '@eurosky.social',
    serviceDid: 'did:web:feed1.eurosky.network',
    algorithm:
      'Collaborative filtering over likes, with time decay, a popularity penalty and per-author diversification; accounts with no likes get a most-liked cold start.',
    disclosure:
      'Eurosky selects and ranks these posts. The operator reads the likes in your repository and the likes of people who liked the same posts. Saving this feed never changes Following or Home.',
    sourceUrl: 'https://github.com/eurosky-social/fu-feed',
  },
];

export const RANKED_FEED_SHELF_TITLE = 'For you shelf';

export const RANKED_FEED_SHELF_INTRO =
  'Optional feeds selected by someone else. Balla ranks nothing here and Home stays chronological; a shelf feed is only ever a saved feed you open yourself.';

export const RANKED_FEED_SHELF_FOOTNOTE =
  'Ranked feeds are never inserted into Following, never become Home and are never suggested by Balla. Removing one is one tap in this shelf or in Saved feeds.';

export function rankedFeedLabel(saved: boolean): string {
  return saved ? 'Unsubscribe' : 'Subscribe';
}
