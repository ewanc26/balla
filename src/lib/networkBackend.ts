/**
 * Default NetworkBackend implementation: the current ATProtocol path.
 *
 * Every method resolves the exported `agent` binding when called, not when this
 * module loads. That preserves session rebinding, the AppView proxy and the
 * mock agent patches used by the preview build. Direct groups delegate to the
 * existing session and moderation helpers; no call site changes here and no
 * retry, cache, scope or dependency is added. Screens only consume the groups
 * marked routed in BACKEND_VERB_STATUS, so this is a mechanical seam with no
 * behaviour change, not a completed migration.
 */

import {
  agent,
  getActiveDid,
  getAccounts,
  getSessionInfo,
  login,
  logout,
  removeAccount,
  restore,
  switchAccount,
} from './agent';
import {
  blockActor,
  deletePost,
  muteActor,
  muteRepostsActor,
  reportPost,
  reportProfile,
  unblockActor,
  unmuteActor,
} from './moderation';
import {
  NETWORK_BACKEND_ID,
  type ActorParams,
  type ActorSearchParams,
  type AuthorFeedParams,
  type CustomFeedParams,
  type FeedSearchParams,
  type ListFeedParams,
  type NetworkBackend,
  type NotificationParams,
  type PageParams,
  type PostSearchParams,
  type ProfileParams,
  type StarterPackSearchParams,
  type ThreadParams,
} from './networkBackendModel';

export const atprotoBackend: NetworkBackend = {
  id: NETWORK_BACKEND_ID,
  get did() {
    return agent.did || null;
  },
  session: {
    login,
    restore,
    switchAccount,
    removeAccount,
    logout,
    getSessionInfo,
    getAccounts,
    getActiveDid,
  },
  timeline: {
    getTimeline: (params: PageParams = {}) => agent.getTimeline(params),
    getFeed: (params: CustomFeedParams) => agent.app.bsky.feed.getFeed(params as any),
    getListFeed: (params: ListFeedParams) => agent.app.bsky.feed.getListFeed(params as any),
  },
  thread: {
    getPostThread: (params: ThreadParams) => agent.getPostThread(params),
  },
  notifications: {
    listNotifications: (params: NotificationParams = {}) => agent.listNotifications(params),
    getFollows: (params: ActorParams) => agent.getFollows(params),
  },
  profile: {
    getProfile: (params: ProfileParams) => agent.getProfile(params),
    getAuthorFeed: (params: AuthorFeedParams) => agent.getAuthorFeed(params as any),
    getActorLikes: (params: ActorParams) => agent.getActorLikes(params),
  },
  compose: {
    post: (params: any) => agent.post(params),
    reply: (params: any) => agent.post(params),
  },
  media: {
    uploadBlob: (bytes: any, options?: any) => agent.uploadBlob(bytes, options),
  },
  moderation: {
    reportPost,
    reportProfile,
    muteActor,
    muteRepostsActor,
    unmuteActor,
    blockActor,
    unblockActor,
    deletePost,
  },
  search: {
    searchPosts: (params: PostSearchParams) =>
      agent.app.bsky.feed.searchPostsV2(params as any),
    searchActors: (params: ActorSearchParams) => agent.searchActors(params),
    searchFeeds: (params: FeedSearchParams) =>
      agent.app.bsky.unspecced.getPopularFeedGenerators(params as any),
    searchStarterPacks: (params: StarterPackSearchParams) =>
      agent.app.bsky.graph.searchStarterPacksV2(params as any),
  },
};

export const networkBackend: NetworkBackend = atprotoBackend;
