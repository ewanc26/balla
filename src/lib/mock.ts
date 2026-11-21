import { Platform } from 'react-native';
import { agent } from './agent';
import { externalHost } from './embedModel';

declare const process: { env: Record<string, string | undefined> };

// Off by default. The preview build turns this on with
// EXPO_PUBLIC_BALLA_MOCK=1 and never touches a real account.
export const MOCK_MODE = process.env.EXPO_PUBLIC_BALLA_MOCK === '1';

const minutesAgo = (minutes: number) =>
  new Date(Date.now() - minutes * 60_000).toISOString();

const viewer = {
  did: 'did:plc:mockviewer',
  handle: 'ewan.balla.test',
  displayName: 'Ewan Croft',
  description:
    'Building Balla: a chronological, Facebook-inspired Bluesky client. Gàidhlig for wall.',
  postsCount: 42,
  followsCount: 128,
  followersCount: 96,
};

const mum = {
  did: 'did:plc:mockmum',
  handle: 'mum.balla.test',
  displayName: 'Mum',
  description: 'Tea, the garden, and keeping up with the family.',
};

const ailsa = {
  did: 'did:plc:mockailsa',
  handle: 'ailsa.balla.test',
  displayName: 'Ailsa MacLeod',
  description: 'Bookbinder in Leith. Mostly here for the quiet bits.',
};

const balla = {
  did: 'did:plc:mockballa',
  handle: 'balla.balla.test',
  displayName: 'Balla',
  description: 'Product notes from the Balla project.',
};

const viewerProfile = {
  ...viewer,
  viewer: {},
};

const profiles = [
  viewerProfile,
  {
    ...mum,
    postsCount: 18,
    followsCount: 64,
    followersCount: 132,
    viewer: {},
    // Mock verification from a trusted verifier and a pinned post: both are
    // real lexicon fields, so the profile can be checked without a live account.
    verification: {
      $type: 'app.bsky.actor.defs#verificationState',
      verifiedStatus: 'valid',
      trustedVerifierStatus: 'none',
      verifications: [
        {
          $type: 'app.bsky.actor.defs#verificationView',
          issuer: balla.did,
          issuerDisplayName: balla.displayName,
          issuerHandle: balla.handle,
          uri: `at://${balla.did}/app.bsky.graph.verification/1`,
          isValid: true,
          createdAt: minutesAgo(2880),
        },
      ],
    },
    pinnedPost: {
      uri: 'at://did:plc:mockmum/app.bsky.feed.post/1',
      cid: 'bafy-mock-pinned',
    },
  },
  { ...ailsa, postsCount: 27, followsCount: 91, followersCount: 74, viewer: {} },
  {
    ...balla,
    postsCount: 12,
    followsCount: 8,
    followersCount: 204,
    viewer: {},
    associated: { lists: 1, feedgens: 1, starterPacks: 1, labeler: true },
    verification: {
      $type: 'app.bsky.actor.defs#verificationState',
      verifiedStatus: 'valid',
      trustedVerifierStatus: 'valid',
      verifications: [
        {
          $type: 'app.bsky.actor.defs#verificationView',
          issuer: ailsa.did,
          issuerDisplayName: ailsa.displayName,
          issuerHandle: ailsa.handle,
          uri: `at://${ailsa.did}/app.bsky.graph.verification/2`,
          isValid: true,
          createdAt: minutesAgo(4320),
        },
      ],
    },
  },
];

function makePost({
  uri,
  author,
  text,
  minutes,
  likeCount,
  repostCount,
  replyCount,
  viewerState = {},
  embed,
}: {
  uri: string;
  author: any;
  text: string;
  minutes: number;
  likeCount: number;
  repostCount: number;
  replyCount: number;
  viewerState?: Record<string, any>;
  embed?: any;
}) {
  const indexedAt = minutesAgo(minutes);
  return {
    uri,
    cid: `bafy-${uri.split('/').pop()}`,
    author,
    record: {
      $type: 'app.bsky.feed.post',
      text,
      createdAt: indexedAt,
    },
    indexedAt,
    ...(embed ? { embed } : {}),
    likeCount,
    repostCount,
    replyCount,
    viewer: viewerState,
  };
}

const posts = [
  makePost({
    uri: 'at://did:plc:mockmum/app.bsky.feed.post/1',
    author: mum,
    minutes: 12,
    likeCount: 24,
    repostCount: 3,
    replyCount: 6,
    viewerState: {
      like: 'at://did:plc:mockviewer/app.bsky.feed.like/1',
      bookmarked: true,
    },
    text:
      "Morning, all. The kettle's on and the back garden is finally dry enough to sit in. If you're passing, there's plenty of tea.",
  }),
  makePost({
    uri: 'at://did:plc:mockailsa/app.bsky.feed.post/2',
    author: ailsa,
    minutes: 48,
    likeCount: 11,
    repostCount: 1,
    replyCount: 12,
    text:
      "A long one about the book fair, because several people asked. The hall was colder than it had any right to be in November, but the turnout was lovely: neighbours, a few familiar faces from the shop, and somebody's very patient dog by the door.\n\nI came home with three books I did not need and a commission for a damaged family bible, which is the sort of thing that makes the whole week worthwhile. Thank you to everyone who stopped to say hello. The next one is in March, and I promise to bring a warmer scarf.",
  }),
  makePost({
    uri: 'at://did:plc:mockballa/app.bsky.feed.post/3',
    author: balla,
    minutes: 180,
    likeCount: 8,
    repostCount: 2,
    replyCount: 2,
    viewerState: {
      repost: 'at://did:plc:mockviewer/app.bsky.feed.repost/1',
    },
    text:
      'Balla now has a web client at balla.croft.click/app. Same chronological Following feed, same private bookmarks, just a browser to read it in.',
    embed: {
      $type: 'app.bsky.embed.external#view',
      external: {
        uri: 'https://balla.croft.click/app',
        title: 'Balla for the web',
        description: 'The same chronological Following feed in a browser.',
      },
    },
  }),
  makePost({
    uri: 'at://did:plc:mockmum/app.bsky.feed.post/4',
    author: mum,
    minutes: 300,
    likeCount: 5,
    repostCount: 0,
    replyCount: 1,
    text: 'This is the sort of find that makes the book fair worth the cold walk.',
    embed: {
      $type: 'app.bsky.embed.record#view',
      record: {
        $type: 'app.bsky.embed.record#viewRecord',
        uri: 'at://did:plc:mockailsa/app.bsky.feed.post/quoted',
        cid: 'bafy-quoted',
        author: ailsa,
        value: {
          $type: 'app.bsky.feed.post',
          text: 'A damaged family bible from the 1890s, and the loveliest handwritten inscription on the inside cover.',
        },
        indexedAt: minutesAgo(320),
      },
    },
  }),
  makePost({
    uri: 'at://did:plc:mockviewer/app.bsky.feed.post/own-1',
    author: viewerProfile,
    minutes: 90,
    likeCount: 2,
    repostCount: 0,
    replyCount: 1,
    text: 'A small post from your own account, so reply and quote settings can be checked in the preview.',
  }),
];

export const MOCK_OWN_POST_URI = posts[posts.length - 1].uri;

const replyPost = makePost({
  uri: 'at://did:plc:mockailsa/app.bsky.feed.post/reply-1',
  author: ailsa,
  minutes: 6,
  likeCount: 2,
  repostCount: 0,
  replyCount: 0,
  text: 'Save me a seat by the window and I will bring the shortbread.',
});

const notifications = [
  {
    uri: 'at://did:plc:mockmum/app.bsky.feed.like/notice-1',
    cid: 'notice-1',
    author: mum,
    reason: 'like',
    reasonSubject: posts[0].uri,
    indexedAt: minutesAgo(3),
    isRead: false,
  },
  {
    uri: 'at://did:plc:mockailsa/app.bsky.feed.post/notice-2',
    cid: 'notice-2',
    author: ailsa,
    reason: 'reply',
    indexedAt: minutesAgo(18),
    isRead: false,
  },
  {
    uri: 'at://did:plc:mocka/notice-3',
    cid: 'notice-3',
    author: balla,
    reason: 'follow',
    indexedAt: minutesAgo(75),
    isRead: false,
  },
  {
    uri: 'at://did:plc:mockailsa/app.bsky.feed.repost/notice-4',
    cid: 'notice-4',
    author: ailsa,
    reason: 'repost',
    reasonSubject: posts[0].uri,
    indexedAt: minutesAgo(140),
    isRead: false,
  },
  {
    uri: 'at://did:plc:mockmum/app.bsky.feed.post/notice-5',
    cid: 'notice-5',
    author: mum,
    reason: 'mention',
    indexedAt: minutesAgo(220),
    isRead: false,
  },
];

const feed = posts.map((post) => ({ post }));
const thread = {
  $type: 'app.bsky.feed.defs#threadViewPost',
  post: posts[1],
  replies: [
    {
      $type: 'app.bsky.feed.defs#threadViewPost',
      post: replyPost,
      replies: [],
    },
  ],
};

export const MOCK_THREAD_URI = posts[1].uri;
export const MOCK_OTHER_ACTOR = mum.did;

function profileFor(actor: string | undefined) {
  if (!actor) return viewerProfile;
  return (
    profiles.find((profile) => profile.did === actor || profile.handle === actor) ||
    viewerProfile
  );
}

function postsFor(actor: string | undefined) {
  if (!actor || actor === viewer.did || actor === viewer.handle) return posts;
  return posts.filter((post) => post.author.did === actor);
}

export function installMockAgent() {
  const mock = agent as any;

  // Agent.did is a prototype getter; shadow it for the mock session.
  Object.defineProperty(mock, 'did', {
    configurable: true,
    get: () => viewer.did,
  });

  mock.getTimeline = async () => ({ data: { feed, cursor: undefined } });
  mock.getProfile = async ({ actor }: { actor?: string }) => ({
    data: profileFor(actor),
  });
  mock.getAuthorFeed = async ({ actor }: { actor?: string }) => ({
    data: { feed: postsFor(actor).map((post) => ({ post })), cursor: undefined },
  });
  mock.listNotifications = async () => ({
    data: { notifications, cursor: undefined },
  });
  mock.getFollows = async () => ({
    data: { follows: [mum, ailsa], cursor: undefined },
  });
  mock.updateSeenNotifications = async () => ({ data: {} });
  let mockSavedFeedItems: any[] = [];
  let mockFeedViewPref: any = {};
  let mockThreadSort = 'oldest';
  mock.setFeedViewPrefs = async (feed: string, pref: any) => {
    if (feed === 'home') mockFeedViewPref = { ...mockFeedViewPref, ...pref };
  };
  mock.setThreadViewPrefs = async (pref: any) => {
    if (typeof pref?.sort === 'string') mockThreadSort = pref.sort;
  };
  mock.getPreferences = async () => ({
    feeds: { saved: undefined, pinned: undefined },
    savedFeeds: mockSavedFeedItems,
    feedViewPrefs: { home: mockFeedViewPref },
    threadViewPrefs: { sort: mockThreadSort },
    moderationPrefs: {
      adultContentEnabled: false,
      labels: {},
      labelers: [
        { did: 'did:plc:ar7c4by46qjdydhdevvrndac', labels: {} },
      ],
      mutedWords: [],
      hiddenPosts: [],
    },
    birthDate: undefined,
    interests: { tags: [] },
    bskyAppState: { queuedNudges: [], activeProgressGuide: undefined, nuxs: [] },
    postInteractionSettings: {},
    verificationPrefs: { hideBadges: false },
    liveEventPreferences: { hiddenFeedIds: [], hideAllFeeds: false },
  });
  mock.getLabelDefinitions = async () => ({});
  const mockGateRecords = new Map<string, any>();
  const gateKey = (collection: string, rkey: string) => `${collection}:${rkey}`;
  mock.getPostThread = async ({ uri }: { uri?: string } = {}) => {
    const requested = (uri || '').split('/').pop() || '1';
    const post = posts.find((item) => item.uri === uri) || thread.post;
    return {
      data: {
        thread: {
          ...thread,
          post,
          threadgate: mockGateRecords.get(
            gateKey('app.bsky.feed.threadgate', requested)
          ),
        },
      },
    };
  };
  mock.com.atproto.repo.getRecord = async ({
    collection,
    rkey,
  }: {
    collection?: string;
    rkey?: string;
  } = {}) => {
    const value = mockGateRecords.get(gateKey(collection || '', rkey || ''));
    if (!value) throw new Error('Record not found');
    return { data: { uri: '', cid: '', value } };
  };
  mock.com.atproto.repo.putRecord = async ({
    collection,
    rkey,
    record,
  }: {
    collection?: string;
    rkey?: string;
    record?: any;
  } = {}) => {
    mockGateRecords.set(gateKey(collection || '', rkey || ''), record);
    return { data: { uri: '', cid: '' } };
  };
  mock.getPosts = async ({ uris }: { uris?: string[] }) => ({
    data: {
      posts: (uris || [])
        .map((uri) => posts.find((post) => post.uri === uri))
        .filter(Boolean),
    },
  });
  mock.searchActors = async () => ({
    data: {
      actors: [profiles[1], profiles[2], profiles[3]],
      cursor: undefined,
    },
  });
  mock.app.bsky.feed.searchPosts = async () => ({
    data: { posts, cursor: undefined },
  });
  mock.app.bsky.feed.searchPostsV2 = async () => ({
    data: { posts, cursor: undefined, hitsTotal: posts.length },
  });
  const mockFeed = {
    uri: 'at://did:plc:mockballa/app.bsky.feed.generator/quiet',
    cid: 'bafy-mock-feed',
    did: balla.did,
    creator: { ...balla, viewer: {} },
    displayName: 'The Quiet Corner',
    description: 'Longer reads and gentle posts from around the neighbourhood.',
    likeCount: 12,
    indexedAt: minutesAgo(1440),
  };
  const mockPack = {
    uri: 'at://did:plc:mockballa/app.bsky.graph.starterpack/neighbours',
    cid: 'bafy-mock-pack',
    record: {
      $type: 'app.bsky.graph.starterpack',
      name: 'Balla neighbours',
      description: 'The people and feeds in this little corner of Bluesky.',
      createdAt: minutesAgo(2880),
    },
    creator: balla,
    list: { listItemCount: 3 },
    listItemsSample: profiles.slice(1).map((subject) => ({ subject })),
    feeds: [mockFeed],
    joinedWeekCount: 4,
    indexedAt: minutesAgo(2880),
  };
  mockSavedFeedItems = [
    {
      id: 'mock-following',
      type: 'timeline',
      value: 'following',
      pinned: true,
    },
    {
      id: 'mock-saved-quiet',
      type: 'feed',
      value: mockFeed.uri,
      pinned: true,
    },
  ];
  mock.app.bsky.unspecced.getPopularFeedGenerators = async () => ({
    data: { feeds: [mockFeed], cursor: undefined },
  });
  mock.app.bsky.feed.getFeedGenerators = async ({
    feeds,
  }: {
    feeds: string[];
  }) => ({
    data: {
      feeds: feeds
        .filter((uri) => uri === mockFeed.uri)
        .map(() => mockFeed),
    },
  });
  mock.overwriteSavedFeeds = async (next: any[]) => {
    const seen = new Set<string>();
    mockSavedFeedItems = next
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
    return mockSavedFeedItems;
  };
  mock.updateSavedFeeds = async (updates: any[]) => {
    mockSavedFeedItems = mockSavedFeedItems
      .map((item) => {
        const changed = updates.find((update) => update.id === item.id);
        return changed ? { ...item, pinned: changed.pinned } : item;
      })
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
    return mockSavedFeedItems;
  };
  mock.addSavedFeeds = async (feeds: any[]) => {
    const added = feeds.map((item, index) => ({
      ...item,
      id: `mock-saved-${Date.now()}-${index}`,
    }));
    mockSavedFeedItems = [...mockSavedFeedItems, ...added].sort(
      (a, b) => Number(b.pinned) - Number(a.pinned)
    );
    return mockSavedFeedItems;
  };
  mock.removeSavedFeeds = async (ids: string[]) => {
    mockSavedFeedItems = mockSavedFeedItems.filter(
      (item) => !ids.includes(item.id)
    );
    return mockSavedFeedItems;
  };
  mock.app.bsky.graph.searchStarterPacksV2 = async () => ({
    data: { starterPacks: [mockPack], cursor: undefined, hitsTotal: 1 },
  });
  mock.app.bsky.feed.getFeedGenerator = async () => ({
    data: { view: mockFeed, isOnline: true, isValid: true },
  });
  mock.app.bsky.feed.getFeed = async () => ({
    data: {
      feed: posts.map((post) => ({ post })),
      cursor: undefined,
    },
  });
  mock.app.bsky.graph.getStarterPack = async () => ({
    data: { starterPack: mockPack },
  });
  const authoredByBalla = (actor?: string) =>
    actor === balla.did || actor === balla.handle;
  mock.app.bsky.feed.getActorFeeds = async ({ actor }: { actor?: string }) => ({
    data: { feeds: authoredByBalla(actor) ? [mockFeed] : [], cursor: undefined },
  });
  mock.app.bsky.graph.getActorStarterPacks = async ({
    actor,
  }: {
    actor?: string;
  }) => ({
    data: {
      starterPacks: authoredByBalla(actor) ? [mockPack] : [],
      cursor: undefined,
    },
  });
  const mockList = {
    uri: 'at://did:plc:mockballa/app.bsky.graph.list/neighbours',
    cid: 'bafy-mock-list',
    creator: balla,
    name: 'Balla neighbours',
    description: 'The people and feeds in this little corner of Bluesky.',
    purpose: 'app.bsky.graph.defs#curatelist',
    listItemCount: 3,
    viewer: {},
    indexedAt: minutesAgo(2880),
  };
  const mockModList = {
    uri: 'at://did:plc:mockviewer/app.bsky.graph.list/quiet',
    cid: 'bafy-mock-mod-list',
    creator: viewerProfile,
    name: 'Quiet list',
    description: 'Accounts to mute together when a thread gets loud.',
    purpose: 'app.bsky.graph.defs#modlist',
    listItemCount: 2,
    viewer: { muted: true },
    indexedAt: minutesAgo(4320),
  };
  const mockListItems = profiles.slice(1).map((subject, index) => ({
    uri: `at://did:plc:mockballa/app.bsky.graph.listitem/${index + 1}`,
    subject,
  }));
  mock.app.bsky.graph.getLists = async ({ actor }: { actor?: string }) => ({
    data: {
      lists:
        actor === viewer.did || actor === viewer.handle
          ? [mockModList]
          : [mockList],
      cursor: undefined,
    },
  });
  mock.app.bsky.graph.getList = async ({ list }: { list: string }) => ({
    data: {
      list: list === mockModList.uri ? mockModList : mockList,
      items: list === mockModList.uri ? mockListItems.slice(0, 2) : mockListItems,
      cursor: undefined,
    },
  });
  mock.app.bsky.graph.getListMutes = async () => ({
    data: { lists: [mockModList], cursor: undefined },
  });
  mock.app.bsky.graph.getListBlocks = async () => ({
    data: { lists: [], cursor: undefined },
  });
  mock.app.bsky.feed.getListFeed = async () => ({
    data: {
      feed: posts.map((post) => ({ post })),
      cursor: undefined,
    },
  });
  mock.app.bsky.graph.muteActorList = async () => ({ data: {} });
  mock.app.bsky.graph.unmuteActorList = async () => ({ data: {} });
  mock.app.bsky.bookmark.getBookmarks = async () => ({
    data: {
      bookmarks: posts.slice(0, 2).map((item) => ({ item })),
      cursor: undefined,
    },
  });
  mock.app.bsky.bookmark.createBookmark = async () => ({});
  mock.app.bsky.bookmark.deleteBookmark = async () => ({});

  mock.com.atproto.repo.createRecord = async () => ({
    data: {
      uri: 'at://did:plc:mockviewer/app.bsky.graph.block/new',
      cid: 'bafy-block',
    },
  });
  mock.com.atproto.repo.deleteRecord = async () => ({ data: {} });
  mock.com.atproto.moderation.createReport = async () => ({
    data: {
      id: 1,
      reasonType: 'com.atproto.moderation.defs#reasonOther',
      subject: {},
      createdAt: new Date().toISOString(),
    },
  });
  mock.app.bsky.embed.getEmbedExternalView = async ({ url }: { url?: string }) => {
    const uri = typeof url === 'string' ? url : '';
    return {
      data: {
        view: {
          $type: 'app.bsky.embed.external#view',
          external: {
            uri,
            title: externalHost(uri),
            description: 'Preview metadata for this link in the offline preview.',
          },
        },
      },
    };
  };
  mock.app.bsky.graph.muteActor = async () => ({ data: {} });
  mock.app.bsky.graph.unmuteActor = async () => ({ data: {} });

  mock.like = async () => ({
    uri: 'at://did:plc:mockviewer/app.bsky.feed.like/new',
  });
  mock.deleteLike = async () => ({});
  mock.repost = async () => ({
    uri: 'at://did:plc:mockviewer/app.bsky.feed.repost/new',
  });
  mock.deleteRepost = async () => ({});
  mock.follow = async () => ({
    uri: 'at://did:plc:mockviewer/app.bsky.graph.follow/new',
  });
  mock.deleteFollow = async () => ({});
  mock.post = async () => ({
    uri: 'at://did:plc:mockviewer/app.bsky.feed.post/new',
    cid: 'bafy-new',
  });
}

export function mockInitialTab(): string {
  const requested =
    queryParam('tab') || process.env.EXPO_PUBLIC_BALLA_MOCK_TAB || 'Home';
  return ['Home', 'Search', 'Notifications', 'Saved', 'Profile'].includes(requested)
    ? requested
    : 'Home';
}

export function mockInitialScreen(): string {
  const requested =
    queryParam('screen') || process.env.EXPO_PUBLIC_BALLA_MOCK_SCREEN || 'Tabs';
  return [
    'Tabs',
    'Thread',
    'Compose',
    'UserProfile',
    'Settings',
    'Appearance',
    'AccessibilitySettings',
    'LanguageSettings',
    'FeedPreferences',
    'ThreadPreferences',
  ].includes(requested)
    ? requested
    : 'Tabs';
}

function queryParam(name: string): string | null {
  if (Platform.OS !== 'web') return null;
  const search = (globalThis as any).location?.search as string | undefined;
  if (!search) return null;
  const match = new RegExp('[?&]' + name + '=([^&]*)').exec(search);
  return match ? decodeURIComponent(match[1]) : null;
}
