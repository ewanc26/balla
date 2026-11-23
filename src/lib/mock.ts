import { Platform } from 'react-native';
import { agent } from './agent';
import { externalHost } from './embedModel';
import {
  LIVE_STATUS,
  STATUS_COLLECTION,
  STATUS_RKEY,
  expiresAtFor,
} from './liveStatusModel';

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
  // Old enough for the edit guard; the preview needs a real profile fact.
  createdAt: minutesAgo(60 * 24 * 400),
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

export const MOCK_EVENT_URI =
  'at://did:plc:mockmum/community.lexicon.calendar.event/3event';
export const MOCK_EVENT_CID = 'bafy-mock-event';

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
  recordEmbed,
  recordExtras,
  replyTo,
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
  recordEmbed?: any;
  recordExtras?: Record<string, any>;
  replyTo?: any;
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
      ...(recordEmbed ? { embed: recordEmbed } : {}),
      ...(replyTo
        ? {
            reply: {
              root: { uri: replyTo.uri, cid: replyTo.cid },
              parent: { uri: replyTo.uri, cid: replyTo.cid },
            },
          }
        : {}),
      ...(recordExtras || {}),
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
    uri: 'at://did:plc:mockmum/app.bsky.feed.post/event-1',
    author: mum,
    minutes: 210,
    likeCount: 6,
    repostCount: 1,
    replyCount: 0,
    text: 'A date for the bookbinding evening, if anyone local wants to come along.',
    recordEmbed: {
      $type: 'app.bsky.embed.record',
      record: { uri: MOCK_EVENT_URI, cid: MOCK_EVENT_CID },
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

const feedReply = makePost({
  uri: 'at://did:plc:mockailsa/app.bsky.feed.post/feed-reply',
  author: ailsa,
  minutes: 8,
  likeCount: 1,
  repostCount: 0,
  replyCount: 0,
  text: "The garden chair is already out. I'll bring the shortbread.",
  replyTo: posts[0],
});

const feed = [
  { post: feedReply, reply: { root: posts[0], parent: posts[0] } },
  ...posts.map((post) => ({ post })),
];

// Preview-only posts. They are not added to the timeline, so the feed fixture
// and its counts stay exactly as the other screens expect.
const editablePost = makePost({
  uri: 'at://did:plc:mockviewer/app.bsky.feed.post/edit-preview',
  author: viewer,
  minutes: 1,
  likeCount: 0,
  repostCount: 0,
  replyCount: 0,
  text: 'A post with a small typo, ready for the edit preview.',
});

const editedReply = makePost({
  uri: 'at://did:plc:mockviewer/app.bsky.feed.post/edited-preview',
  author: viewer,
  minutes: 25,
  likeCount: 2,
  repostCount: 0,
  replyCount: 0,
  text: 'Updated wording: the book fair is in March.',
  recordExtras: {
    originalText: 'Original wording: the book fair is in March.',
    updatedAt: minutesAgo(24),
  },
});

const thread = {
  $type: 'app.bsky.feed.defs#threadViewPost',
  post: posts[1],
  replies: [
    {
      $type: 'app.bsky.feed.defs#threadViewPost',
      post: replyPost,
      replies: [],
    },
    {
      $type: 'app.bsky.feed.defs#threadViewPost',
      post: editedReply,
      replies: [],
    },
  ],
};

export const MOCK_THREAD_URI = posts[1].uri;
export const MOCK_EDIT_URI = editablePost.uri;
export const MOCK_OTHER_ACTOR = mum.did;
export const MOCK_CONVO_ID = '3lmockconvo0000000000000000';
export const MOCK_GROUP_CONVO_ID = '3lmockgroupconvo0000000000000';

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
  mock.getAuthorFeed = async ({
    actor,
    filter,
  }: {
    actor?: string;
    filter?: string;
  } = {}) => {
    let feed = postsFor(actor);
    if (filter === 'posts_no_replies') {
      feed = feed.filter((post: any) => !post.reply);
    } else if (filter === 'posts_and_author_threads') {
      feed = feed.filter((post: any) => !post.reply || post.author.did === actor);
    } else if (filter === 'posts_with_media') {
      feed = feed.filter(
        (post: any) => post.embed?.images || post.embed?.video || post.embed?.media
      );
    } else if (filter === 'posts_with_video') {
      feed = feed.filter((post: any) => post.embed?.video);
    }
    return { data: { feed: feed.map((post: any) => ({ post })), cursor: undefined } };
  };
  mock.getActorLikes = async () => ({
    data: { feed: posts.slice(0, 2).map((post) => ({ post })), cursor: undefined },
  });
  // Labeler service view for the profile like control. Mirrors the official
  // client's getServices lookup used to build the like strong ref.
  const mockLabelerLikes = new Map<string, string>();
  mock.app.bsky.labeler.getServices = async ({
    dids,
  }: {
    dids?: string[];
  } = {}) => {
    const views = (dids || [])
      .map((did) => {
        const profile: any = profileFor(did);
        if (!profile || !profile.associated?.labeler) return null;
        const likeUri = mockLabelerLikes.get(did);
        return {
          uri: `at://${did}/app.bsky.labeler.service/self`,
          cid: `mock-labeler-${did}`,
          creator: profile,
          did,
          likeCount: 2 + (likeUri ? 1 : 0),
          viewer: likeUri ? { like: likeUri } : undefined,
          indexedAt: new Date().toISOString(),
        };
      })
      .filter(Boolean);
    return { data: { views } };
  };
  mock.listNotifications = async () => ({
    data: { notifications, cursor: undefined },
  });
  const mockActivitySubscriptions = new Map<string, any>();
  mock.app.bsky.notification.listActivitySubscriptions = async () => ({
    data: {
      subscriptions: [...mockActivitySubscriptions.entries()]
        .map(([did, activitySubscription]) => {
          const profile = profileFor(did);
          if (!profile) return profile;
          return {
            ...profile,
            viewer: { ...(profile.viewer || {}), activitySubscription },
          };
        })
        .filter(Boolean),
      cursor: undefined,
    },
  });
  mock.app.bsky.notification.putActivitySubscription = async ({
    subject,
    activitySubscription,
  }: {
    subject?: string;
    activitySubscription?: any;
  } = {}) => {
    const did = subject || '';
    if (activitySubscription?.post || activitySubscription?.reply) {
      mockActivitySubscriptions.set(did, activitySubscription);
    } else {
      mockActivitySubscriptions.delete(did);
    }
    return { data: { subject: did, activitySubscription } };
  };

  // Server-side drafts behave like the AppView stash: a TID id, the draft body
  // and created/updated timestamps, with full create/update/list/delete support.
  const mockServerDrafts = new Map<string, any>();
  let mockDraftSequence = 0;
  mock.app.bsky.draft.getDrafts = async () => ({
    data: {
      drafts: [...mockServerDrafts.values()].sort(
        (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
      ),
      cursor: undefined,
    },
  });
  mock.app.bsky.draft.createDraft = async ({ draft }: { draft?: any } = {}) => {
    mockDraftSequence += 1;
    const id = `draft-${mockDraftSequence}`;
    const now = new Date().toISOString();
    mockServerDrafts.set(id, { id, draft, createdAt: now, updatedAt: now });
    return { data: { id } };
  };
  mock.app.bsky.draft.updateDraft = async ({ draft }: { draft?: any } = {}) => {
    const id = draft?.id;
    const existing = mockServerDrafts.get(id) || { createdAt: new Date().toISOString() };
    mockServerDrafts.set(id, {
      id,
      draft: draft?.draft,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });
    return { data: {} };
  };
  mock.app.bsky.draft.deleteDraft = async ({ id }: { id?: string } = {}) => {
    mockServerDrafts.delete(id || '');
    return { data: {} };
  };
  mock.getFollows = async () => ({
    data: { follows: [mum, ailsa], cursor: undefined },
  });
  mock.updateSeenNotifications = async () => ({ data: {} });
  let mockSavedFeedItems: any[] = [];
  let mockFeedViewPref: any = {};
  let mockThreadSort = 'oldest';
  let mockBirthDate: Date | undefined;
  let mockVerificationPrefs: any = { hideBadges: false };
  let mockInterests: string[] = [];
  let mockPostInteractionSettings: any = {};
  mock.setFeedViewPrefs = async (feed: string, pref: any) => {
    if (feed === 'home') mockFeedViewPref = { ...mockFeedViewPref, ...pref };
  };
  mock.setThreadViewPrefs = async (pref: any) => {
    if (typeof pref?.sort === 'string') mockThreadSort = pref.sort;
  };
  mock.setVerificationPrefs = async (pref: any) => {
    mockVerificationPrefs = { ...mockVerificationPrefs, ...pref };
  };
  mock.setInterestsPref = async (pref: any) => {
    if (Array.isArray(pref?.tags)) mockInterests = [...pref.tags];
  };
  mock.setPostInteractionSettings = async (settings: any) => {
    mockPostInteractionSettings = { ...settings };
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
    birthDate: mockBirthDate,
    interests: { tags: [...mockInterests] },
    bskyAppState: { queuedNudges: [], activeProgressGuide: undefined, nuxs: [] },
    postInteractionSettings: { ...mockPostInteractionSettings },
    verificationPrefs: { ...mockVerificationPrefs },
    liveEventPreferences: { hiddenFeedIds: [], hideAllFeeds: false },
  });
  mock.setPersonalDetails = async ({ birthDate }: { birthDate?: string | Date }) => {
    mockBirthDate = birthDate ? new Date(birthDate) : undefined;
  };
  mock.upsertProfile = async (update: (existing: any) => any) => {
    const record = {
      $type: 'app.bsky.actor.profile',
      displayName: viewerProfile.displayName,
      description: viewerProfile.description,
    };
    const next = update(record);
    const values = Array.isArray(next?.labels?.values) ? next.labels.values : [];
    (viewerProfile as any).labels = values.map((item: any) => ({
      ...item,
      src: viewer.did,
    }));
    const index = profiles.indexOf(viewerProfile);
    if (index >= 0) profiles[index] = viewerProfile;
    return { data: { uri: '', cid: '' } };
  };
  mock.getLabelDefinitions = async () => ({});
  const mockGateRecords = new Map<string, any>();
  const gateKey = (collection: string, rkey: string) => `${collection}:${rkey}`;
  mock.getPostThread = async ({ uri }: { uri?: string } = {}) => {
    const requested = (uri || '').split('/').pop() || '1';
    const post =
      posts.find((item) => item.uri === uri) ||
      (uri === editablePost.uri ? editablePost : thread.post);
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
  // The edit preview can complete its one atomic write without leaving the
  // browser; the editor still rebuilds the real replacement record locally.
  mock.com.atproto.repo.applyWrites = async () => ({ data: {} });
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
  mock.com.atproto.repo.listRecords = async ({
    collection,
    cursor,
    limit,
  }: {
    collection?: string;
    cursor?: string;
    limit?: number;
  } = {}) => {
    const prefix = `${collection || ''}:`;
    const entries = [...mockGateRecords.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .sort(([a], [b]) => a.localeCompare(b));
    const start = Math.max(0, Number(cursor) || 0);
    const size = Math.max(1, Math.min(limit || 50, 100));
    const page = entries.slice(start, start + size);
    const next = start + size < entries.length ? String(start + size) : undefined;
    return {
      data: {
        records: page.map(([key, value]) => ({
          uri: `at://${viewer.did}/${collection}/${key.slice(prefix.length)}`,
          cid: `bafy-${key.slice(prefix.length)}`,
          value,
        })),
        cursor: next,
      },
    };
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
    // Keep the mock profile's live badge in step with a published status so
    // preview mode behaves like the AppView-attached statusView.
    if (collection === STATUS_COLLECTION && rkey === STATUS_RKEY && record) {
      (viewerProfile as any).status = {
        $type: 'app.bsky.actor.defs#statusView',
        status: record.status || LIVE_STATUS,
        createdAt: record.createdAt,
        expiresAt: new Date(
          expiresAtFor(record.createdAt, record.durationMinutes)
        ).toISOString(),
        record,
        embed: record.embed,
        isDisabled: false,
      };
    }
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
  const mockStarterPackListUri =
    'at://did:plc:mockviewer/app.bsky.graph.list/starter-neighbours';
  let mockStarterPackRecord: any = {
    $type: 'app.bsky.graph.starterpack',
    name: 'Balla neighbours',
    description: 'The people and feeds in this little corner of Bluesky.',
    feeds: [{ $type: 'app.bsky.graph.starterpack#feedItem', uri: mockFeed.uri }],
    createdAt: minutesAgo(2880),
  };
  let mockStarterPackListRecord: any = {
    $type: 'app.bsky.graph.list',
    purpose: 'app.bsky.graph.defs#referencelist',
    name: 'Balla neighbours',
    description: 'The people and feeds in this little corner of Bluesky.',
    createdAt: minutesAgo(2880),
  };
  let mockStarterPackItems: any[] = profiles.slice(1).map((subject, index) => ({
    uri: `at://did:plc:mockviewer/app.bsky.graph.listitem/starter-${index + 1}`,
    subject,
  }));
  const mockPack = {
    uri: 'at://did:plc:mockviewer/app.bsky.graph.starterpack/neighbours',
    cid: 'bafy-mock-pack',
    record: mockStarterPackRecord,
    creator: viewerProfile,
    list: {
      uri: mockStarterPackListUri,
      listItemCount: mockStarterPackItems.length,
    },
    listItemsSample: mockStarterPackItems,
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
  mock.app.bsky.feed.sendInteractions = async () => ({ data: {} });
  mock.app.bsky.graph.getStarterPack = async ({
    starterPack,
  }: {
    starterPack?: string;
  } = {}) => ({
    data: {
      starterPack: {
        ...mockPack,
        uri: starterPack || mockPack.uri,
        record: mockStarterPackRecord,
        list: {
          uri: mockStarterPackListUri,
          listItemCount: mockStarterPackItems.length,
        },
        listItemsSample: mockStarterPackItems,
        feeds: [mockFeed],
      },
    },
  });
  const authoredByBalla = (actor?: string) =>
    actor === viewer.did || actor === viewer.handle;
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
  mock.app.bsky.graph.getList = async ({ list }: { list: string }) => {
    if (list === mockStarterPackListUri) {
      return {
        data: {
          list: { ...mockStarterPackListRecord, uri: list },
          items: mockStarterPackItems,
          cursor: undefined,
        },
      };
    }
    return {
      data: {
        list: list === mockModList.uri ? mockModList : mockList,
        items:
          list === mockModList.uri ? mockListItems.slice(0, 2) : mockListItems,
        cursor: undefined,
      },
    };
  };
  mock.app.bsky.graph.getFollows = async () => ({
    data: { follows: [mum, ailsa, balla], cursor: undefined },
  });
  mock.app.bsky.graph.list.get = async ({
    rkey,
  }: {
    rkey?: string;
  } = {}) => {
    if (rkey === 'starter-neighbours') {
      return {
        uri: mockStarterPackListUri,
        cid: 'bafy-mock-starter-list',
        value: mockStarterPackListRecord,
      };
    }
    throw new Error('Record not found');
  };
  mock.app.bsky.graph.list.create = async (
    _params: unknown,
    record: any
  ) => {
    mockStarterPackListRecord = record;
    return { uri: mockStarterPackListUri, cid: 'bafy-mock-starter-list' };
  };
  mock.app.bsky.graph.list.put = async (
    _params: unknown,
    record: any
  ) => {
    mockStarterPackListRecord = record;
    return { uri: mockStarterPackListUri, cid: 'bafy-mock-starter-list' };
  };
  mock.app.bsky.graph.listitem.create = async (
    _params: unknown,
    record: any
  ) => {
    const uri = `at://did:plc:mockviewer/app.bsky.graph.listitem/starter-${
      mockStarterPackItems.length + 1
    }`;
    mockStarterPackItems.push({
      uri,
      subject: profileFor(record.subject),
    });
    return { uri, cid: 'bafy-mock-listitem' };
  };
  mock.app.bsky.graph.listitem.delete = async ({
    rkey,
  }: {
    rkey?: string;
  } = {}) => {
    mockStarterPackItems = mockStarterPackItems.filter(
      (item) => item.uri.split('/').pop() !== rkey
    );
  };
  mock.app.bsky.graph.starterpack.get = async ({
    rkey,
  }: {
    rkey?: string;
  } = {}) => {
    if (!rkey || rkey === 'neighbours') {
      return {
        uri: mockPack.uri,
        cid: mockPack.cid,
        value: mockStarterPackRecord,
      };
    }
    throw new Error('Record not found');
  };
  mock.app.bsky.graph.starterpack.create = async (
    _params: unknown,
    record: any
  ) => {
    mockStarterPackRecord = record;
    return { uri: mockPack.uri, cid: mockPack.cid };
  };
  mock.app.bsky.graph.starterpack.put = async (
    _params: unknown,
    record: any
  ) => {
    mockStarterPackRecord = record;
    return { uri: mockPack.uri, cid: mockPack.cid };
  };
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
  mock.com.atproto.repo.deleteRecord = async ({
    collection,
    rkey,
  }: {
    collection?: string;
    rkey?: string;
  } = {}) => {
    mockGateRecords.delete(gateKey(collection || '', rkey || ''));
    if (collection === STATUS_COLLECTION && rkey === STATUS_RKEY) {
      delete (viewerProfile as any).status;
    }
    return { data: {} };
  };
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
  mock.app.bsky.graph.getBlocks = async () => ({
    data: { blocks: [], cursor: undefined },
  });
  mock.app.bsky.graph.getMutes = async () => ({
    data: { mutes: [], cursor: undefined },
  });
  mock.app.bsky.graph.muteActor = async () => ({ data: {} });
  mock.app.bsky.graph.unmuteActor = async () => ({ data: {} });

  mock.like = async (uri?: string) => {
    // A labeler service like is keyed by the service did so the profile header
    // like control reflects the toggle in preview mode.
    const labelerMatch = uri?.match(/^at:\/\/([^/]+)\/app\.bsky\.labeler\.service\//);
    if (labelerMatch) {
      const likeUri = `at://did:plc:mockviewer/app.bsky.feed.like/labeler-${Date.now()}`;
      mockLabelerLikes.set(labelerMatch[1], likeUri);
      return { uri: likeUri };
    }
    return { uri: 'at://did:plc:mockviewer/app.bsky.feed.like/new' };
  };
  mock.deleteLike = async (likeUri?: string) => {
    for (const [did, uri] of mockLabelerLikes.entries()) {
      if (uri === likeUri) mockLabelerLikes.delete(did);
    }
    return {};
  };
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

  // Chat fixtures. These live only in the opt-in preview build and never touch
  // a real account. The shapes follow chat.bsky.convo / chat.bsky.group.
  const chatConvo = {
    $type: 'chat.bsky.convo.defs#convoView',
    id: MOCK_CONVO_ID,
    rev: 'r1',
    members: [mum, viewer],
    muted: false,
    status: 'accepted',
    unreadCount: 2,
    kind: { $type: 'chat.bsky.convo.defs#directConvo' },
    lastMessage: {
      $type: 'chat.bsky.convo.defs#messageView',
      id: 'm2',
      rev: 'r2',
      text: 'See you at the book fair!',
      sender: { did: mum.did },
      sentAt: minutesAgo(6),
    },
  };
  const groupOwner = viewer;
  const mockGroupMembers = [
    { ...groupOwner, kind: { $type: 'chat.bsky.convo.defs#groupConvoMember', role: 'owner' } },
    { ...mum, kind: { $type: 'chat.bsky.convo.defs#groupConvoMember', role: 'standard' } },
    { ...ailsa, kind: { $type: 'chat.bsky.convo.defs#groupConvoMember', role: 'standard' } },
  ];
  let mockJoinLink = {
    $type: 'chat.bsky.group.defs#joinLinkView',
    code: 'mock-join-code',
    enabledStatus: 'enabled',
    requireApproval: true,
    joinRule: 'anyone',
    createdAt: minutesAgo(1440),
  };
  let mockJoinRequests: any[] = [
    {
      $type: 'chat.bsky.group.defs#joinRequestView',
      requestedBy: balla,
      requestedAt: minutesAgo(30),
    },
  ];
  const chatGroup = {
    $type: 'chat.bsky.convo.defs#convoView',
    id: MOCK_GROUP_CONVO_ID,
    rev: 'r1',
    members: mockGroupMembers,
    muted: false,
    status: 'accepted',
    unreadCount: 0,
    kind: {
      $type: 'chat.bsky.convo.defs#groupConvo',
      name: 'Book fair neighbours',
      memberCount: 3,
      memberLimit: 100,
      lockStatus: 'unlocked',
      lockStatusModerationOverride: false,
      joinRequestCount: 1,
      unreadJoinRequestCount: 1,
      joinLink: mockJoinLink,
    },
    lastMessage: {
      $type: 'chat.bsky.convo.defs#messageView',
      id: 'g1',
      rev: 'r1',
      text: 'See you all on Saturday.',
      sender: { did: mum.did },
      sentAt: minutesAgo(90),
    },
  };
  const chatRequest = {
    $type: 'chat.bsky.convo.defs#convoView',
    id: '3lmockrequest000000000000000',
    rev: 'r1',
    members: [ailsa, viewer],
    muted: false,
    status: 'request',
    unreadCount: 1,
    kind: { $type: 'chat.bsky.convo.defs#directConvo' },
    lastMessage: {
      $type: 'chat.bsky.convo.defs#messageView',
      id: 'r1',
      rev: 'r1',
      text: 'Hello from the preview',
      sender: { did: ailsa.did },
      sentAt: minutesAgo(45),
    },
  };
  const chatMessages: any[] = [
    {
      $type: 'chat.bsky.convo.defs#messageView',
      id: 'm1',
      rev: 'r1',
      text: 'Are you going to the book fair?',
      sender: { did: mum.did },
      sentAt: minutesAgo(20),
    },
    chatConvo.lastMessage,
  ];
  const chatGroupMessages: any[] = [
    {
      $type: 'chat.bsky.convo.defs#messageView',
      id: 'g0',
      rev: 'r0',
      text: 'Who is bringing the raffle prizes?',
      sender: { did: ailsa.did },
      sentAt: minutesAgo(120),
      reactions: [
        {
          $type: 'chat.bsky.convo.defs#reactionView',
          value: '👍',
          sender: { did: viewer.did },
        },
      ],
    },
    chatGroup.lastMessage,
  ];
  // getChatAgent() normally clones via withProxy(); in the preview the mock
  // methods live on this agent, so return it unchanged instead of cloning away
  // the patched chat namespace.
  mock.withProxy = () => mock;
  mock.chat = { bsky: { convo: {}, group: {}, notification: {} } };
  const convo = mock.chat.bsky.convo;
  const group = mock.chat.bsky.group;
  const chatNotification = mock.chat.bsky.notification;
  convo.listConvos = async () => ({ data: { convos: [chatConvo, chatGroup] } });
  convo.listConvoRequests = async () => ({ data: { requests: [chatRequest] } });
  convo.getUnreadCounts = async () => ({
    data: { unreadAcceptedConvos: 1, unreadRequestConvos: 1 },
  });
  convo.getConvo = async ({ convoId }: { convoId?: string } = {}) => ({
    data: {
      convo:
        convoId === chatRequest.id
          ? chatRequest
          : convoId === MOCK_GROUP_CONVO_ID
            ? chatGroup
            : chatConvo,
    },
  });
  convo.getConvoForMembers = async () => ({ data: { convo: chatConvo } });
  convo.getMessages = async ({ convoId }: { convoId?: string } = {}) => ({
    data: {
      messages: convoId === MOCK_GROUP_CONVO_ID ? chatGroupMessages : chatMessages,
      relatedProfiles: [],
    },
  });
  convo.sendMessage = async ({ message }: { message?: any } = {}) => {
    const sent = {
      $type: 'chat.bsky.convo.defs#messageView',
      id: `m${chatMessages.length + 1}`,
      rev: `r${chatMessages.length + 1}`,
      text: String(message?.text || ''),
      embed: message?.embed,
      sender: { did: viewer.did },
      sentAt: new Date().toISOString(),
    };
    chatMessages.push(sent);
    return { data: sent };
  };
  convo.updateRead = async () => ({ data: { convo: chatConvo } });
  convo.acceptConvo = async () => ({ data: { rev: 'r2' } });
  convo.muteConvo = async () => {
    chatConvo.muted = true;
    return { data: { convo: chatConvo } };
  };
  convo.unmuteConvo = async () => {
    chatConvo.muted = false;
    return { data: { convo: chatConvo } };
  };
  convo.leaveConvo = async ({ convoId }: { convoId?: string } = {}) => ({
    data: { convoId: convoId || MOCK_CONVO_ID, rev: 'r2' },
  });
  convo.getConvoMembers = async ({ convoId }: { convoId?: string } = {}) => ({
    data: {
      members:
        convoId === chatGroup.id ? mockGroupMembers : [mum, viewer],
      cursor: undefined,
    },
  });
  convo.lockConvo = async () => ({ data: { convo: chatGroup } });
  convo.unlockConvo = async () => ({ data: { convo: chatGroup } });
  convo.addReaction = async ({ messageId, value }: any = {}) => {
    const target = chatMessages.find((item) => item.id === messageId) || chatConvo.lastMessage;
    target.reactions = [
      ...(target.reactions || []),
      { $type: 'chat.bsky.convo.defs#reactionView', value, sender: { did: viewer.did } },
    ];
    return { data: target };
  };
  convo.removeReaction = async ({ messageId, value }: any = {}) => {
    const target = chatMessages.find((item) => item.id === messageId) || chatConvo.lastMessage;
    target.reactions = (target.reactions || []).filter(
      (item: any) => !(item.value === value && item.sender?.did === viewer.did)
    );
    return { data: target };
  };
  convo.deleteMessageForSelf = async ({ messageId }: { messageId?: string } = {}) => {
    const index = chatMessages.findIndex((item) => item.id === messageId);
    if (index >= 0) chatMessages.splice(index, 1);
    return { data: { $type: 'chat.bsky.convo.defs#deletedMessageView', id: messageId } };
  };
  convo.updateAllRead = async () => ({ data: { updatedCount: 2 } });

  group.createGroup = async ({ name, members }: any = {}) => {
    const created = {
      ...chatGroup,
      id: `3lmockgroup${Date.now()}`,
      kind: { ...chatGroup.kind, name: String(name || 'New group'), memberCount: (members || []).length + 1 },
    };
    return { data: { convo: created } };
  };
  group.addMembers = async ({ members }: any = {}) => ({
    data: {
      convo: chatGroup,
      addedMembers: (members || []).map((did: string) => profileFor(did)),
    },
  });
  group.removeMembers = async () => ({ data: { convo: chatGroup } });
  group.editGroup = async ({ name }: any = {}) => ({
    data: { convo: { ...chatGroup, kind: { ...chatGroup.kind, name: String(name || '') } } },
  });
  group.createJoinLink = async () => ({ data: { joinLink: mockJoinLink } });
  group.editJoinLink = async ({ joinRule, requireApproval }: any = {}) => {
    mockJoinLink = {
      ...mockJoinLink,
      ...(joinRule ? { joinRule } : {}),
      ...(typeof requireApproval === 'boolean' ? { requireApproval } : {}),
    };
    return { data: { joinLink: mockJoinLink } };
  };
  group.enableJoinLink = async () => {
    mockJoinLink = { ...mockJoinLink, enabledStatus: 'enabled' };
    return { data: { joinLink: mockJoinLink } };
  };
  group.disableJoinLink = async () => {
    mockJoinLink = { ...mockJoinLink, enabledStatus: 'disabled' };
    return { data: { joinLink: mockJoinLink } };
  };
  group.listJoinRequests = async () => ({ data: { requests: mockJoinRequests, cursor: undefined } });
  group.approveJoinRequest = async ({ member }: any = {}) => {
    mockJoinRequests = mockJoinRequests.filter((item) => item?.requestedBy?.did !== member);
    return { data: { convo: chatGroup } };
  };
  group.rejectJoinRequest = async ({ member }: any = {}) => {
    mockJoinRequests = mockJoinRequests.filter((item) => item?.requestedBy?.did !== member);
    return { data: {} };
  };
  group.updateJoinRequestsRead = async () => ({ data: {} });
  group.requestJoin = async () => ({ data: { status: 'pending' } });
  group.withdrawJoinRequest = async () => ({ data: {} });
  group.getJoinLinkPreviews = async ({ codes }: any = {}) => ({
    data: {
      joinLinkPreviews: (codes || []).map(() => ({
        $type: 'chat.bsky.group.defs#joinLinkPreviewView',
        convoId: chatGroup.id,
        code: mockJoinLink.code,
        name: chatGroup.kind.name,
        owner: balla,
        memberCount: 3,
        memberLimit: 100,
      })),
    },
  });
  let mockChatPrefs = {
    $type: 'chat.bsky.notification.defs#preferences',
    chat: { $type: 'chat.bsky.notification.defs#chatPreference', include: 'all', push: true },
    chatRequest: { $type: 'chat.bsky.notification.defs#chatPreference', include: 'follows', push: false },
  };
  chatNotification.getPreferences = async () => ({ data: { preferences: mockChatPrefs } });
  chatNotification.putPreferences = async (input: any = {}) => {
    mockChatPrefs = {
      ...mockChatPrefs,
      ...(input.chat ? { chat: input.chat } : {}),
      ...(input.chatRequest ? { chatRequest: input.chatRequest } : {}),
    };
    return { data: { preferences: mockChatPrefs } };
  };
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
    'Chat',
    'Conversation',
    'ChatSettings',
    'ChatNotificationSettings',
    'CreateGroup',
    'JoinGroup',
    'JoinRequests',
    'ConversationSettings',
    'UserProfile',
    'Settings',
    'Advanced',
    'AppView',
    'Accounts',
    'Appearance',
    'AccessibilitySettings',
    'LanguageSettings',
    'FeedPreferences',
    'ThreadPreferences',
    'AccountLifecycle',
    'AccountSettings',
    'PrivacySecurity',
    'SessionSecurity',
    'StarterPack',
    'StarterPackEdit',
    'Hashtag',
    'Topic',
    'VideoFeed',
    'Discover',
    'News',
    'NewsBundle',
    'Feeds',
    'EditPost',
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
