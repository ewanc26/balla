/**
 * Framework-free contract for Balla's network backend seam.
 *
 * The interface describes the verbs a future non-ATProto adapter would have to
 * provide. The routing table records what is genuinely behind the contract
 * today; remaining verbs still call the ATProto Agent directly and are named
 * as such. No alternative backend is registered in this slice.
 */

export const NETWORK_BACKEND_ID = 'atproto' as const;
export type NetworkBackendId = typeof NETWORK_BACKEND_ID;

export type BackendVerb =
  | 'session'
  | 'timeline'
  | 'thread'
  | 'notifications'
  | 'profile'
  | 'compose'
  | 'media'
  | 'moderation'
  | 'search';

export type BackendRouting = 'routed' | 'direct';

export type BackendVerbStatus = {
  verb: BackendVerb;
  label: string;
  routing: BackendRouting;
  detail: string;
};

export const BACKEND_VERB_STATUS: readonly BackendVerbStatus[] = [
  {
    verb: 'session',
    label: 'Session',
    routing: 'direct',
    detail: 'Sign-in, restore and account switching still live in agent.ts.',
  },
  {
    verb: 'timeline',
    label: 'Timeline and feeds',
    routing: 'routed',
    detail: 'Home, saved feeds and list feeds use the timeline methods.',
  },
  {
    verb: 'thread',
    label: 'Threads',
    routing: 'routed',
    detail: 'Thread hydration uses the thread method; replies stay direct.',
  },
  {
    verb: 'notifications',
    label: 'Notifications',
    routing: 'routed',
    detail: 'The notification list and follow filter use the seam; mark-read stays direct.',
  },
  {
    verb: 'profile',
    label: 'Profiles',
    routing: 'routed',
    detail: 'Profile and tab-post reads use the seam; social writes stay direct.',
  },
  {
    verb: 'compose',
    label: 'Compose and reply',
    routing: 'direct',
    detail: 'Post creation still calls the Agent until its own mechanical slice.',
  },
  {
    verb: 'media',
    label: 'Media upload',
    routing: 'direct',
    detail: 'Blob uploads still use the existing video and image paths.',
  },
  {
    verb: 'moderation',
    label: 'Moderation',
    routing: 'direct',
    detail: 'Report and label actions still use the moderation helpers.',
  },
  {
    verb: 'search',
    label: 'Search',
    routing: 'routed',
    detail: 'All four search result tabs use the search methods.',
  },
] as const;

export function backendRoutedVerbs(): readonly BackendVerb[] {
  return BACKEND_VERB_STATUS.filter((entry) => entry.routing === 'routed').map(
    (entry) => entry.verb
  );
}

export function backendDirectVerbs(): readonly BackendVerb[] {
  return BACKEND_VERB_STATUS.filter((entry) => entry.routing === 'direct').map(
    (entry) => entry.verb
  );
}

export const NETWORK_BACKEND_COPY = {
  title: 'Backend',
  selected: 'AT Protocol',
  selectedDetail: 'The only registered backend in this build.',
  routedTitle: 'Behind the seam',
  directTitle: 'Still direct',
  note:
    'This is a mechanical refactor, not a second backend. Balla behaves exactly as before; no bridge, identity mapping or provider switch is implied.',
  scope:
    'The AT Protocol adapter implements every verb, but the direct groups are screen call sites this slice did not migrate. A future adapter would implement the same contract.',
} as const;

export type PageParams = { limit?: number; cursor?: string };
export type CustomFeedParams = PageParams & { feed: string };
export type ListFeedParams = PageParams & { list: string };
export type ThreadParams = { uri: string; depth?: number };
export type NotificationParams = { limit?: number };
export type ActorParams = { actor: string; limit?: number };
export type ProfileParams = { actor: string };
export type AuthorFeedParams = ActorParams & { filter?: string };
export type PostSearchParams = PageParams & {
  q?: string;
  query?: string;
  [key: string]: unknown;
};
export type ActorSearchParams = PageParams & { q: string };
export type FeedSearchParams = PageParams & { query: string };
export type StarterPackSearchParams = PageParams & { q: string };

export type BackendPage<T> = { data: T };
export type FeedPage = BackendPage<{ feed: any[]; cursor?: string; reqId?: string }>;
export type ThreadPage = BackendPage<{ thread: any }>;
export type NotificationsPage = BackendPage<{ notifications: any[]; cursor?: string }>;
export type FollowsPage = BackendPage<{ follows: any[]; cursor?: string }>;
export type ProfilePage = BackendPage<any>;
export type AuthorFeedPage = BackendPage<{ feed: any[]; cursor?: string }>;
export type ActorLikesPage = AuthorFeedPage;
export type SearchPostsPage = BackendPage<{
  posts: any[];
  cursor?: string;
  hitsTotal?: number;
}>;
export type SearchActorsPage = BackendPage<{ actors: any[]; cursor?: string }>;
export type SearchFeedsPage = BackendPage<{ feeds: any[]; cursor?: string }>;
export type SearchStarterPacksPage = BackendPage<{
  starterPacks: any[];
  cursor?: string;
  hitsTotal?: number;
}>;

export type BackendAccount = { did: string; handle: string | null };

/**
 * The complete verb contract named by #98. This slice implements it for AT
 * Protocol, but only the groups marked `routed` in BACKEND_VERB_STATUS are
 * consumed by screens today. The others remain direct call sites; exposing a
 * method here is not a claim that a screen uses it.
 */
export interface NetworkBackend {
  readonly id: NetworkBackendId;
  readonly did: string | null;
  readonly session: {
    login(input: string): Promise<void>;
    restore(): Promise<boolean>;
    switchAccount(did: string): Promise<boolean>;
    removeAccount(did: string): Promise<void>;
    logout(): Promise<void>;
    getSessionInfo(): Promise<unknown>;
    getAccounts(): Promise<readonly BackendAccount[]>;
    getActiveDid(): string | null;
  };
  readonly timeline: {
    getTimeline(params?: PageParams): Promise<FeedPage>;
    getFeed(params: CustomFeedParams): Promise<FeedPage>;
    getListFeed(params: ListFeedParams): Promise<FeedPage>;
  };
  readonly thread: {
    getPostThread(params: ThreadParams): Promise<ThreadPage>;
  };
  readonly notifications: {
    listNotifications(params?: NotificationParams): Promise<NotificationsPage>;
    getFollows(params: ActorParams): Promise<FollowsPage>;
  };
  readonly profile: {
    getProfile(params: ProfileParams): Promise<ProfilePage>;
    getAuthorFeed(params: AuthorFeedParams): Promise<AuthorFeedPage>;
    getActorLikes(params: ActorParams): Promise<ActorLikesPage>;
  };
  readonly compose: {
    post(params: any): Promise<any>;
    reply(params: any): Promise<any>;
  };
  readonly media: {
    uploadBlob(bytes: any, options?: any): Promise<any>;
  };
  readonly moderation: {
    reportPost(post: any, reasonType: any, details: string): Promise<any>;
    reportProfile(profile: any, reasonType: any, details: string): Promise<any>;
    muteActor(did: string): Promise<any>;
    muteRepostsActor(did: string): Promise<any>;
    unmuteActor(did: string): Promise<any>;
    blockActor(did: string): Promise<string>;
    unblockActor(uri: string): Promise<any>;
    deletePost(uri: string): Promise<any>;
  };
  readonly search: {
    searchPosts(params: PostSearchParams): Promise<SearchPostsPage>;
    searchActors(params: ActorSearchParams): Promise<SearchActorsPage>;
    searchFeeds(params: FeedSearchParams): Promise<SearchFeedsPage>;
    searchStarterPacks(params: StarterPackSearchParams): Promise<SearchStarterPacksPage>;
  };
}
