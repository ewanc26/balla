import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWallToWall,
  wallToWallName,
} from '../src/lib/wallToWallModel.ts';

const viewer = 'did:plc:viewer';
const other = 'did:plc:other';
const third = 'did:plc:third';

function post(uri, did, at, text = uri) {
  return {
    uri,
    cid: `cid-${uri}`,
    author: {
      did,
      handle: `${did.split(':').pop()}.test`,
      displayName: did.split(':').pop(),
    },
    indexedAt: at,
    record: { text, createdAt: at },
  };
}

function thread() {
  return {
    ancestors: [
      {
        post: post('at://anc-third/1', third, '2026-11-23T12:00:01.000Z'),
      },
      {
        post: post('at://anc-viewer/1', viewer, '2026-11-23T12:00:02.000Z'),
      },
    ],
    post: post('at://focus-other/1', other, '2026-11-23T12:00:03.000Z'),
    replies: [
      {
        post: post('at://r-third/1', third, '2026-11-23T12:00:04.000Z'),
        replies: [
          {
            post: post('at://r-viewer/1', viewer, '2026-11-23T12:00:05.000Z'),
            replies: [],
          },
        ],
      },
      {
        post: post('at://r-other/1', other, '2026-11-23T12:00:06.000Z'),
        replies: [],
      },
    ],
  };
}

test('wall-to-wall includes only the viewer and one partner in thread order', () => {
  const input = thread();
  const before = JSON.stringify(input);
  const model = buildWallToWall(input, { viewerDid: viewer, sort: 'oldest' });

  assert.deepEqual(model.speakerDids, [third, viewer, other]);
  assert.equal(model.partners.length, 2);

  const partner = model.partners.find((item) => item.did === other);
  assert.ok(partner);
  assert.deepEqual(
    partner.items.map((item) => item.uri),
    ['at://anc-viewer/1', 'at://focus-other/1', 'at://r-viewer/1', 'at://r-other/1']
  );
  assert.deepEqual(
    partner.items.map((item) => item.role),
    ['ancestor', 'focus', 'reply', 'reply']
  );
  assert.deepEqual(
    partner.items.map((item) => item.depth),
    [0, 0, 1, 0]
  );
  assert.equal(
    partner.items.some((item) => item.post.author.did === third),
    false
  );
  // The lens is a read-only view of the fetched thread.
  assert.equal(JSON.stringify(input), before);
});

test('wall-to-wall follows the explicit thread sort without changing authors', () => {
  const model = buildWallToWall(thread(), {
    viewerDid: viewer,
    sort: 'newest',
  });
  const partner = model.partners.find((item) => item.did === other);

  assert.deepEqual(
    partner.items.map((item) => item.uri),
    ['at://anc-viewer/1', 'at://focus-other/1', 'at://r-other/1', 'at://r-viewer/1']
  );
  assert.deepEqual(
    [...new Set(partner.items.map((item) => item.post.author.did))].sort(),
    [other, viewer].sort()
  );
});

test('the action only exists when both the viewer and another author appear', () => {
  assert.deepEqual(
    buildWallToWall(thread(), { viewerDid: 'did:plc:absent' }).partners,
    []
  );

  const onlyViewer = {
    ancestors: [],
    post: post('at://viewer-only/1', viewer, '2026-11-23T12:00:00.000Z'),
    replies: [],
  };
  assert.equal(
    buildWallToWall(onlyViewer, { viewerDid: viewer }).partners.length,
    0
  );

  const noViewer = {
    ancestors: [],
    post: post('at://other-only/1', other, '2026-11-23T12:00:00.000Z'),
    replies: [],
  };
  assert.equal(
    buildWallToWall(noViewer, { viewerDid: viewer }).partners.length,
    0
  );
});

test('malformed nodes are skipped and handles are normalised', () => {
  const input = {
    ancestors: [{ post: { author: { did: viewer } } }],
    post: {
      uri: 'at://focus/1',
      author: {
        did: other,
        handle: '@other.test',
        displayName: '  Other Person  ',
        avatar: 'https://cdn.example/other.jpg',
      },
      record: { createdAt: '2026-11-23T12:00:00.000Z' },
      indexedAt: '2026-11-23T12:00:00.000Z',
    },
    replies: [
      null,
      { post: null },
      {
        post: post('at://r-viewer/1', viewer, '2026-11-23T12:00:01.000Z'),
        replies: [{ post: { uri: 'at://bad/1', author: {} } }],
      },
    ],
  };

  const model = buildWallToWall(input, { viewerDid: viewer });
  assert.equal(model.partners.length, 1);
  assert.equal(model.partners[0].handle, 'other.test');
  assert.equal(model.partners[0].displayName, 'Other Person');
  assert.equal(wallToWallName(model.partners[0]), '@other.test');
  assert.equal(model.partners[0].items.length, 2);
});
