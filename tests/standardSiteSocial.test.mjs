import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseSocialRecord,
  RECOMMEND_COLLECTIONS,
  SOCIAL_FOLLOW_LIMIT,
  SOCIAL_SIGNAL_COPY,
  socialKind,
  socialSignalCounts,
  SUBSCRIPTION_COLLECTIONS,
  uniqueMatches,
} from '../src/lib/standardSiteSocialModel.ts';
import { loadStandardSiteSocialSignals } from '../src/lib/standardSiteSocial.ts';

const DOCUMENT =
  'at://did:plc:author/site.standard.document/3mxmxzzjgbrwq';
const PUBLICATION =
  'at://did:plc:author/site.standard.publication/3lwafzkjqm25s';
const OTHER_DOCUMENT =
  'at://did:plc:author/site.standard.document/other';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 400,
    status,
    json: async () => body,
  };
}

function recordUri(did, collection, rkey = 'record1') {
  return `at://${did}/${collection}/${rkey}`;
}

test('only published social record shapes and exact targets count', () => {
  assert.equal(socialKind(SUBSCRIPTION_COLLECTIONS[0]), 'subscription');
  assert.equal(socialKind(RECOMMEND_COLLECTIONS[0]), 'recommend');
  assert.equal(socialKind('app.bsky.feed.like'), null);

  const subscription = normaliseSocialRecord(
    'site.standard.graph.subscription',
    { $type: 'site.standard.graph.subscription', publication: PUBLICATION, createdAt: 'now' },
    recordUri('did:plc:reader', 'site.standard.graph.subscription'),
    PUBLICATION,
  );
  assert.deepEqual(subscription, {
    kind: 'subscription',
    did: 'did:plc:reader',
    uri: recordUri('did:plc:reader', 'site.standard.graph.subscription'),
  });
  assert.equal(
    normaliseSocialRecord(
      'site.standard.graph.subscription',
      { $type: 'site.standard.graph.subscription', publication: OTHER_DOCUMENT },
      recordUri('did:plc:reader', 'site.standard.graph.subscription'),
      PUBLICATION,
    ),
    null,
  );
  assert.equal(
    normaliseSocialRecord(
      'site.standard.graph.subscription',
      { $type: 'site.standard.graph.subscription', publication: PUBLICATION },
      'not an at uri',
      PUBLICATION,
    ),
    null,
  );
  assert.equal(
    normaliseSocialRecord(
      'site.standard.graph.subscription',
      { $type: 'app.bsky.feed.like', publication: PUBLICATION },
      recordUri('did:plc:reader', 'site.standard.graph.subscription'),
      PUBLICATION,
    ),
    null,
  );

  const leafletRecommend = normaliseSocialRecord(
    'pub.leaflet.interactions.recommend',
    { $type: 'pub.leaflet.interactions.recommend', subject: DOCUMENT },
    recordUri('did:plc:reader2', 'pub.leaflet.interactions.recommend'),
    DOCUMENT,
  );
  assert.equal(leafletRecommend?.did, 'did:plc:reader2');
  assert.equal(
    normaliseSocialRecord(
      'site.standard.graph.recommend',
      { $type: 'site.standard.graph.recommend', document: DOCUMENT },
      recordUri('did:plc:reader3', 'site.standard.graph.recommend'),
      OTHER_DOCUMENT,
    ),
    null,
  );
});

test('repeat records from one account are counted once', () => {
  const matches = [
    {
      kind: 'recommend',
      did: 'did:plc:reader',
      uri: recordUri('did:plc:reader', 'site.standard.graph.recommend', 'one'),
    },
    {
      kind: 'recommend',
      did: 'did:plc:reader',
      uri: recordUri('did:plc:reader', 'site.standard.graph.recommend', 'two'),
    },
    {
      kind: 'recommend',
      did: 'did:plc:other',
      uri: recordUri('did:plc:other', 'site.standard.graph.recommend', 'one'),
    },
  ];
  assert.equal(uniqueMatches(matches).length, 2);
  assert.deepEqual(
    socialSignalCounts({
      state: 'ok',
      checkedFollows: 2,
      unreadableFollows: 0,
      checkedCollections: 8,
      unreadableCollections: 0,
      limited: false,
      firstPageOnly: false,
      subscriptions: [],
      recommends: matches,
    }),
    { subscriptions: 0, recommends: 2 },
  );
});

test('public record reads count exact matches and skip other records', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const parsed = new URL(url);
    const repo = parsed.searchParams.get('repo');
    const collection = parsed.searchParams.get('collection');
    const body =
      repo === 'did:plc:one' && collection === 'site.standard.graph.subscription'
        ? {
            records: [
              {
                uri: recordUri(repo, collection, 'one'),
                value: {
                  $type: collection,
                  publication: PUBLICATION,
                  message: 'provider text must not be read',
                },
              },
              {
                uri: recordUri(repo, collection, 'two'),
                value: { $type: collection, publication: OTHER_DOCUMENT },
              },
            ],
          }
        : repo === 'did:plc:two' && collection === 'site.standard.graph.recommend'
          ? {
              records: [
                {
                  uri: recordUri(repo, collection, 'one'),
                  value: { $type: collection, document: DOCUMENT },
                },
                {
                  uri: recordUri(repo, collection, 'two'),
                  value: { $type: 'app.bsky.feed.like', subject: DOCUMENT },
                },
              ],
            }
          : { records: [] };
    return jsonResponse(body);
  };
  const result = await loadStandardSiteSocialSignals(DOCUMENT, PUBLICATION, {
    listFollows: async () => [
      { did: 'did:plc:one', handle: 'one.example' },
      { did: 'did:plc:two', handle: 'two.example' },
    ],
    resolveEndpoint: async () => 'https://pds.example',
    fetchImpl,
  });
  assert.deepEqual(socialSignalCounts(result), { subscriptions: 1, recommends: 1 });
  assert.equal(result.checkedFollows, 2);
  assert.equal(result.unreadableFollows, 0);
  assert.equal(result.checkedCollections, 8);
  assert.equal(result.state, 'ok');
  assert.equal(JSON.stringify(result).includes('provider text must not be read'), false);
  assert.equal(calls.every((url) => url.startsWith('https://pds.example/xrpc/com.atproto.repo.listRecords?')), true);
});

test('unreadable accounts are excluded and never shown as zero', async () => {
  const fetchImpl = async (url) => {
    const collection = new URL(url).searchParams.get('collection');
    if (collection === 'site.standard.graph.subscription') {
      return jsonResponse({ error: 'CollectionNotFound' }, 500);
    }
    return jsonResponse({ records: [] });
  };
  const result = await loadStandardSiteSocialSignals(DOCUMENT, PUBLICATION, {
    listFollows: async () => [
      { did: 'did:plc:blocked' },
      { did: 'did:plc:missing-pds' },
    ],
    resolveEndpoint: async (did) =>
      did === 'did:plc:blocked' ? 'https://pds.example' : null,
    fetchImpl,
  });
  assert.equal(result.checkedFollows, 0);
  assert.equal(result.unreadableFollows, 2);
  // The blocked account has one failed collection read; the account with no
  // PDS contributes no collection requests at all.
  assert.equal(result.unreadableCollections, 1);
  assert.deepEqual(socialSignalCounts(result), { subscriptions: 0, recommends: 0 });
  assert.match(JSON.stringify(result), /unreadable/);
});

test('bounds, pagination reporting and follow failures are honest', async () => {
  const follows = Array.from({ length: SOCIAL_FOLLOW_LIMIT + 1 }, (_, index) => ({
    did: `did:plc:follow${index}`,
  }));
  const base = {
    listFollows: async () => follows,
    resolveEndpoint: async () => 'https://pds.example',
    fetchImpl: async (url) => {
      const collection = new URL(url).searchParams.get('collection');
      if (collection === 'site.standard.graph.subscription') {
        return jsonResponse({ records: [], cursor: 'page2' });
      }
      return jsonResponse({ records: [] });
    },
  };
  const result = await loadStandardSiteSocialSignals(DOCUMENT, PUBLICATION, base);
  assert.equal(result.limited, true);
  assert.equal(result.firstPageOnly, true);
  assert.equal(result.checkedFollows, SOCIAL_FOLLOW_LIMIT);

  const failed = await loadStandardSiteSocialSignals(DOCUMENT, PUBLICATION, {
    ...base,
    listFollows: async () => {
      throw new Error('follows failed');
    },
  });
  assert.equal(failed.state, 'unavailable');

  const withoutPublication = await loadStandardSiteSocialSignals(DOCUMENT, null, {
    ...base,
    listFollows: async () => [],
  });
  assert.equal(withoutPublication.state, 'ok');
  assert.deepEqual(socialSignalCounts(withoutPublication), { subscriptions: 0, recommends: 0 });
});

test('copy names the bounded scope and does not claim a network total', () => {
  assert.match(SOCIAL_SIGNAL_COPY.scope, new RegExp(`Up to ${SOCIAL_FOLLOW_LIMIT}`));
  assert.match(SOCIAL_SIGNAL_COPY.readLimit, /not a network-wide total/);
  assert.match(SOCIAL_SIGNAL_COPY.action, /Check followed accounts/);
});
