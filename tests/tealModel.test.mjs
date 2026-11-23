import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  TEAL_COLLECTIONS,
  TEAL_PROFILE_BASE,
  TEAL_STRIP_LIMIT,
  atprotoPdsEndpoint,
  normaliseTealPlay,
  recentTealPlays,
  sortTealPlays,
  tealArtistNames,
  tealDuration,
  tealProfileUrl,
} from '../src/lib/tealModel.ts';

const CURRENT = 'fm.teal.feed.play';
const LEGACY = 'fm.teal.alpha.feed.play';
const PLAYED = '2026-11-23T02:10:52Z';

const currentRecord = {
  $type: CURRENT,
  trackName: 'Ragnars Kvæði',
  artists: [{ artistName: 'Týr', artistMbId: 'mbid:50fc4742-1389-45a0-8c6f-6a5159ae20c2' }],
  releaseName: 'Hel',
  duration: 248,
  playedTime: PLAYED,
  originUri: 'https://music.apple.com/gb/album/ragnars-kv%C3%A6%C3%B0i/1445616415?i=1445616418',
};

const legacyRecord = {
  $type: LEGACY,
  trackName: 'Ragnars Kvæði',
  artistNames: ['Týr'],
  releaseName: 'Hel',
  duration: 248,
  playedTime: PLAYED,
  originUrl: 'https://music.apple.com/gb/album/ragnars-kv%C3%A6%C3%B0i/1445616415?i=1445616418',
};

test('both current and legacy collections are read', () => {
  assert.deepEqual([...TEAL_COLLECTIONS], [CURRENT, LEGACY]);
  assert.equal(TEAL_STRIP_LIMIT, 5);
  assert.equal(TEAL_PROFILE_BASE, 'https://teal.fm/profile/');
});

test('teal links encode DIDs and handles', () => {
  assert.equal(
    tealProfileUrl('did:plc:ofrbh253gwicbkc5nktqepol'),
    'https://teal.fm/profile/did%3Aplc%3Aofrbh253gwicbkc5nktqepol'
  );
  assert.equal(
    tealProfileUrl('someone.bsky.social'),
    'https://teal.fm/profile/someone.bsky.social'
  );
});

test('artist names read modern objects first, then the older list', () => {
  assert.deepEqual(tealArtistNames(currentRecord), ['Týr']);
  assert.deepEqual(tealArtistNames(legacyRecord), ['Týr']);
  assert.deepEqual(
    tealArtistNames({ artists: [{ artistName: 'A' }, {}, { artistName: 'B' }], artistNames: ['C'] }),
    ['A', 'B']
  );
  assert.deepEqual(tealArtistNames({}), []);
});

test('a current play is normalised into the strip shape', () => {
  const play = normaliseTealPlay(currentRecord, `at://did:plc:example/${CURRENT}/rkey`, CURRENT);
  assert.deepEqual(play, {
    uri: `at://did:plc:example/${CURRENT}/rkey`,
    collection: CURRENT,
    title: 'Ragnars Kvæði',
    artists: 'Týr',
    release: 'Hel',
    durationSeconds: 248,
    playedAt: PLAYED,
    originUri: currentRecord.originUri,
  });
});

test('legacy and current records render identically', () => {
  const current = normaliseTealPlay(currentRecord, 'at://a', CURRENT);
  const legacy = normaliseTealPlay(legacyRecord, 'at://b', LEGACY);
  assert.equal(legacy.title, current.title);
  assert.equal(legacy.artists, current.artists);
  assert.equal(legacy.release, current.release);
  assert.equal(legacy.durationSeconds, current.durationSeconds);
  assert.equal(legacy.playedAt, current.playedAt);
  assert.equal(legacy.originUri, current.originUri);
});

test('malformed and unnamed records are skipped', () => {
  assert.equal(normaliseTealPlay(null, 'at://a', CURRENT), null);
  assert.equal(normaliseTealPlay('nope', 'at://a', CURRENT), null);
  assert.equal(normaliseTealPlay({}, 'at://a', CURRENT), null);
  assert.equal(normaliseTealPlay({ trackName: '   ' }, 'at://a', CURRENT), null);
});

test('optional fields tolerate missing, empty and invalid values', () => {
  const play = normaliseTealPlay({ trackName: 'Untitled' }, 'at://a', CURRENT);
  assert.equal(play.artists, '');
  assert.equal(play.release, '');
  assert.equal(play.durationSeconds, null);
  assert.equal(play.playedAt, null);
  assert.equal(play.originUri, null);
  const bad = normaliseTealPlay(
    { trackName: 'X', duration: -5, playedTime: 'noon' },
    'at://b',
    LEGACY
  );
  assert.equal(bad.durationSeconds, null);
  assert.equal(bad.playedAt, 'noon');
});

test('plays are sorted newest first with deterministic ties', () => {
  const make = (uri, playedAt, collection = CURRENT) =>
    normaliseTealPlay({ trackName: uri, playedTime: playedAt }, uri, collection);
  const plays = [
    make('at://a', '2026-01-01T00:00:00Z'),
    make('at://b', '2026-03-01T00:00:00Z', LEGACY),
    make('at://c', 'not-a-date'),
    make('at://d', '2026-02-01T00:00:00Z'),
  ];
  assert.deepEqual(sortTealPlays(plays).map((p) => p.uri), [
    'at://b',
    'at://d',
    'at://a',
    'at://c',
  ]);
  // Sorting never mutates the caller's array.
  assert.equal(plays[0].uri, 'at://a');
});

test('the strip keeps only the newest plays', () => {
  const plays = Array.from({ length: 8 }, (_, i) =>
    normaliseTealPlay(
      { trackName: `Track ${i}`, playedTime: `2026-01-0${i + 1}T00:00:00Z` },
      `at://${i}`,
      CURRENT
    )
  );
  const recent = recentTealPlays(plays);
  assert.equal(recent.length, TEAL_STRIP_LIMIT);
  assert.deepEqual(recent.map((p) => p.playedAt?.slice(5, 10)), ['01-08', '01-07', '01-06', '01-05', '01-04']);
  assert.deepEqual(recentTealPlays(plays, 2).map((p) => p.uri), ['at://7', 'at://6']);
});

test('durations are rendered as m:ss', () => {
  assert.equal(tealDuration(248), '4:08');
  assert.equal(tealDuration(60), '1:00');
  assert.equal(tealDuration(5), '0:05');
  assert.equal(tealDuration(null), '');
  assert.equal(tealDuration(0), '');
});

test('the PDS endpoint is read from a real DID document shape', () => {
  const document = {
    id: 'did:plc:ofrbh253gwicbkc5nktqepol',
    service: [
      {
        id: '#atproto_pds',
        type: 'AtprotoPersonalDataServer',
        serviceEndpoint: 'https://eurosky.social',
      },
    ],
  };
  assert.equal(atprotoPdsEndpoint(document), 'https://eurosky.social');
  assert.equal(atprotoPdsEndpoint({ service: [{ id: '#other', type: 'X', serviceEndpoint: 'https://x' }] }), null);
  assert.equal(atprotoPdsEndpoint({ service: [{ id: '#atproto_pds', serviceEndpoint: 'javascript:alert(1)' }] }), null);
  assert.equal(atprotoPdsEndpoint(undefined), null);
});

test('teal helpers never write records, log or persist data', () => {
  const model = readFileSync(new URL('../src/lib/tealModel.ts', import.meta.url), 'utf8');
  const reader = readFileSync(new URL('../src/lib/teal.ts', import.meta.url), 'utf8');
  const source = model + reader;
  for (const forbidden of [
    'putRecord',
    'createRecord',
    'deleteRecord',
    'uploadBlob',
    'console.',
    'AsyncStorage',
  ]) {
    assert.equal(source.includes(forbidden), false, `${forbidden} must not appear in teal sources`);
  }
});
