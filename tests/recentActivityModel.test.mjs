import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECENT_ACTIVITY_LIMIT,
  RECENT_ACTIVITY_SNIPPET_MAX,
  buildRecentActivity,
} from '../src/lib/recentActivityModel.ts';

const now = Date.parse('2026-11-23T12:00:00.000Z');
const alice = 'did:plc:alice';
const bob = 'did:plc:bob';
const carol = 'did:plc:carol';
const viewer = 'did:plc:viewer';
const visibleA = 'did:plc:visiblea';
const visibleB = 'did:plc:visibleb';

function profile(did, extra = {}) {
  return {
    did,
    handle: `${did.split(':').pop()}.test`,
    displayName: did.split(':').pop(),
    avatar: `https://cdn.example/${did}.jpg`,
    viewer: {},
    ...extra,
  };
}

function reply(uri, author, indexedAt, text) {
  return {
    post: {
      uri,
      author,
      indexedAt,
      record: { text, reply: { parent: { uri: 'at://did:plc:root/post/1' } } },
    },
  };
}

function repost(uri, originalAuthor, by, indexedAt, text = '') {
  return {
    post: {
      uri,
      author: originalAuthor,
      indexedAt,
      record: { text },
    },
    reason: {
      $type: 'app.bsky.feed.defs#reasonRepost',
      by,
      indexedAt,
    },
  };
}

test('recent activity shows replies and reposts, newest first, with one-line snippets', () => {
  const items = [
    {
      post: {
        uri: 'at://did:plc:plain/post/1',
        author: profile(alice),
        indexedAt: '2026-11-23T12:00:06.000Z',
        record: { text: 'Just a normal post' },
      },
    },
    reply(
      'at://did:plc:alice/post/reply',
      profile(alice),
      '2026-11-23T12:00:03.000Z',
      'Hello\n   world'
    ),
    repost(
      'at://did:plc:carol/post/1',
      profile(carol),
      profile(bob),
      '2026-11-23T12:00:05.000Z'
    ),
  ];
  // A like must never become a row, even if it is attached to a reply-shaped
  // item by a malformed response.
  items.push({
    ...reply(
      'at://did:plc:alice/post/liked',
      profile(alice),
      '2026-11-23T12:00:08.000Z',
      'Liked reply'
    ),
    reason: { $type: 'app.bsky.feed.defs#reasonLike', by: profile(bob) },
  });

  const activity = buildRecentActivity(items, { viewerDid: viewer, now });
  assert.equal(activity.length, 2);
  assert.deepEqual(
    activity.map((item) => item.verb),
    ['reposted', 'replied']
  );
  assert.equal(activity[0].actorDid, bob);
  assert.equal(activity[0].snippet, 'A post without text');
  assert.equal(activity[1].actorDid, alice);
  assert.equal(activity[1].snippet, 'Hello world');
  assert.ok(activity[0].at > activity[1].at);
});

test('recent activity excludes self, muted, blocked, blocked-by and snoozed accounts', () => {
  const items = [
    reply('at://self/1', profile(viewer), '2026-11-23T12:00:20.000Z', 'self'),
    reply(
      'at://muted/1',
      profile(alice, { viewer: { muted: true } }),
      '2026-11-23T12:00:19.000Z',
      'muted'
    ),
    reply(
      'at://blocking/1',
      profile(alice, { viewer: { blocking: 'at://block' } }),
      '2026-11-23T12:00:18.000Z',
      'blocking'
    ),
    reply(
      'at://blocked-by/1',
      profile(alice, { viewer: { blockedBy: true } }),
      '2026-11-23T12:00:17.000Z',
      'blocked by'
    ),
    reply('at://snoozed/1', profile(carol), '2026-11-23T12:00:16.000Z', 'snoozed'),
    {
      ...repost(
        'at://did:plc:carol/post/snoozed-reposter',
        profile(alice),
        profile(bob),
        '2026-11-23T12:00:15.000Z',
        'snoozed reposter'
      ),
    },
  ];

  for (let index = 0; index < 14; index += 1) {
    items.push(
      reply(
        `at://visible/${index}`,
        profile(index % 2 ? visibleA : visibleB),
        `2026-11-23T12:00:${String(index).padStart(2, '0')}.000Z`,
        `visible ${index}`
      )
    );
  }

  const activity = buildRecentActivity(items, {
    viewerDid: viewer,
    now,
    snoozes: {
      [carol]: { until: now + 60_000 },
      [bob]: { until: now + 60_000 },
    },
  });

  assert.equal(activity.length, RECENT_ACTIVITY_LIMIT);
  assert.equal(
    activity.some(
      (item) =>
        item.actorDid === viewer ||
        item.actorDid === carol ||
        item.actorDid === bob
    ),
    false
  );
  assert.equal(activity.some((item) => item.snippet === 'muted'), false);
  assert.equal(activity.some((item) => item.snippet === 'blocking'), false);
  assert.equal(activity.some((item) => item.snippet === 'blocked by'), false);
  assert.equal(activity.some((item) => item.snippet === 'snoozed reposter'), false);
  assert.ok(activity.every((item) => item.at > 0));
});

test('recent activity de-duplicates hydration and truncates long snippets', () => {
  const item = reply(
    'at://duplicate/1',
    profile(alice),
    '2026-11-23T12:00:00.000Z',
    'x'.repeat(200)
  );
  const activity = buildRecentActivity([item, item], { now });

  assert.equal(activity.length, 1);
  assert.equal(activity[0].snippet.length, RECENT_ACTIVITY_SNIPPET_MAX);
  assert.match(activity[0].snippet, /…$/);
  assert.equal(buildRecentActivity([{ post: {} }], { now }).length, 0);
  assert.equal(buildRecentActivity([], { now }).length, 0);
  assert.equal(buildRecentActivity([item], { now, limit: 0 }).length, 0);
});
