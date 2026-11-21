/**
 * Framework-free rules for the preference editors and the places they apply.
 *
 * Feed and thread values come from `app.bsky.actor.defs` feedViewPref and
 * threadViewPref. Balla writes only the fields it actually honours, and replies
 * are never ranked: sorting is an explicit person's choice inside a thread,
 * not a change to the chronological Following feed.
 */

export const HOME_FEED = 'home';

export type FeedViewFilters = {
  hideReplies: boolean;
  hideReposts: boolean;
  hideQuotePosts: boolean;
};

export const DEFAULT_FEED_FILTERS: FeedViewFilters = {
  hideReplies: false,
  hideReposts: false,
  hideQuotePosts: false,
};

export type ThreadSort = 'oldest' | 'newest' | 'most-likes';
export const THREAD_SORTS: readonly ThreadSort[] = ['oldest', 'newest', 'most-likes'];

function truthy(value: unknown): boolean {
  return value === true;
}

function isThreadSort(value: unknown): value is ThreadSort {
  return THREAD_SORTS.includes(value as ThreadSort);
}

/** Read a real feedViewPref without trusting its shape or copying hidden fields. */
export function readFeedFilters(prefs: any): FeedViewFilters {
  const pref = (prefs?.feedViewPrefs || {})[HOME_FEED] || {};
  return {
    hideReplies: truthy(pref.hideReplies),
    hideReposts: truthy(pref.hideReposts),
    hideQuotePosts: truthy(pref.hideQuotePosts),
  };
}

/** Only the three thread sorts Balla can render from getPostThread data. */
export function readThreadSort(prefs: any): ThreadSort {
  const sort = prefs?.threadViewPrefs?.sort;
  return isThreadSort(sort) ? sort : 'oldest';
}

function lexiconType(value: any): string {
  return String(value?.$type || '');
}

export function isRepostItem(item: any): boolean {
  return lexiconType(item?.reason).endsWith('reasonRepost');
}

export function isReplyItem(item: any): boolean {
  return !!item?.post?.record?.reply;
}

export function isQuoteItem(item: any): boolean {
  const embed = item?.post?.embed;
  const lexicon = lexiconType(embed).split('#')[0];
  return (
    lexicon === 'app.bsky.embed.record' ||
    lexicon === 'app.bsky.embed.recordWithMedia'
  );
}

/** Visibility only: input order is preserved, so Following stays chronological. */
export function filterFeedItems<T>(items: T[], filters: FeedViewFilters): T[] {
  return items.filter((item: any) => {
    if (filters.hideReplies && isReplyItem(item)) return false;
    if (filters.hideReposts && isRepostItem(item)) return false;
    if (filters.hideQuotePosts && isQuoteItem(item)) return false;
    return true;
  });
}

/** An untagged post is kept: absence of langs is not a foreign language. */
export function postLanguageCodes(item: any): string[] {
  const langs = item?.post?.record?.langs || item?.post?.langs;
  return Array.isArray(langs) ? langs.filter((code: unknown) => typeof code === 'string') : [];
}

/**
 * BCP-47 tags are hierarchical: 'en' and 'en-GB' are the same content language
 * here. Matching on the base subtag keeps this predictable without a locale
 * database.
 */
export function languageMatches(code: string, wanted: string): boolean {
  return code.split('-')[0].toLowerCase() === wanted.split('-')[0].toLowerCase();
}

export function filterByContentLanguages<T>(items: T[], languages: string[]): T[] {
  if (!languages.length) return items;
  const wanted = languages.map((code) => code.split('-')[0].toLowerCase());
  return items.filter((item: any) => {
    const codes = postLanguageCodes(item);
    return (
      !codes.length ||
      codes.some((code: string) => wanted.includes(code.split('-')[0].toLowerCase()))
    );
  });
}

function timestamp(post: any): number {
  const value = post?.record?.createdAt || post?.indexedAt;
  const time = typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isNaN(time) ? 0 : time;
}

function likes(post: any): number {
  const value = post?.likeCount;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Sort one level of replies. Independent of the AppView's order and of any
 * hidden "hotness" formula; an unrecognised mode leaves the order untouched.
 */
export function sortReplies<T>(nodes: T[], sort: ThreadSort): T[] {
  if (!isThreadSort(sort)) return nodes;
  const decorated = nodes.map((node: any, index: number) => ({
    node,
    index,
    time: timestamp(node?.post),
    likes: likes(node?.post),
  }));
  decorated.sort((a, b) => {
    if (sort === 'most-likes' && a.likes !== b.likes) return b.likes - a.likes;
    if (sort === 'newest' && a.time !== b.time) return b.time - a.time;
    if (sort === 'oldest' && a.time !== b.time) return a.time - b.time;
    return a.index - b.index;
  });
  return decorated.map((entry) => entry.node);
}
