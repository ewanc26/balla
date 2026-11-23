import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENT_COLLECTION,
  RSVP_COLLECTION,
  buildRsvpRecord,
  eventModeLabel,
  eventRefFromRecordEmbed,
  eventStatusLabel,
  normaliseCalendarEvent,
  normaliseRsvpRecord,
  parseAtUri,
  newRsvpRkey,
  profileEventStrip,
  rsvpLabel,
  rsvpsForEvent,
  sortProfileEvents,
} from '../src/lib/eventsModel.ts';

const uri = 'at://did:plc:alice/community.lexicon.calendar.event/3event';
const cid = 'bafy-event';

function event(overrides = {}) {
  return {
    $type: EVENT_COLLECTION,
    name: 'Bookbinding evening',
    description: 'Bring a damaged book and leave with a plan.',
    createdAt: '2026-11-01T10:00:00.000Z',
    startsAt: '2026-12-05T18:00:00+01:00',
    endsAt: '2026-12-05T21:00:00+01:00',
    mode: `${EVENT_COLLECTION}#hybrid`,
    status: `${EVENT_COLLECTION}#scheduled`,
    rsvpExpected: true,
    locations: [
      {
        $type: 'community.lexicon.location.address',
        name: 'Leith Library',
        street: '28 Ferry Road',
        locality: 'Edinburgh',
        region: 'Scotland',
        postalCode: 'EH6 4AE',
        country: 'GB',
      },
      {
        $type: 'community.lexicon.location.geo',
        name: 'The workshop',
        latitude: '55.9736',
        longitude: '-3.1764',
      },
      {
        $type: 'community.lexicon.calendar.event#uri',
        name: 'Join online',
        uri: 'https://example.test/live',
      },
      {
        $type: 'community.lexicon.location.hthree',
        name: 'H3 cell',
        value: '8a2a1072b59ffff',
      },
    ],
    uris: [{ uri: 'https://example.test/event', name: 'Event page' }],
    ...overrides,
  };
}

test('an event record is normalised from its published fields', () => {
  const result = normaliseCalendarEvent(event(), uri, cid);
  assert.ok(result);
  assert.equal(result.name, 'Bookbinding evening');
  assert.equal(result.uri, uri);
  assert.equal(result.cid, cid);
  assert.equal(result.description, 'Bring a damaged book and leave with a plan.');
  assert.equal(result.startsAt, '2026-12-05T18:00:00+01:00');
  assert.equal(result.endsAt, '2026-12-05T21:00:00+01:00');
  assert.equal(result.status, `${EVENT_COLLECTION}#scheduled`);
  assert.equal(result.rsvpExpected, true);
  assert.equal(result.locations.length, 4);
  assert.equal(result.locations[0].kind, 'address');
  assert.match(result.locations[0].text, /Leith Library/);
  assert.match(result.locations[0].link, /openstreetmap\.org\/search/);
  assert.equal(result.locations[1].kind, 'geo');
  assert.match(result.locations[1].link, /mlat=55\.9736/);
  assert.equal(result.locations[2].kind, 'uri');
  assert.equal(result.locations[2].link, 'https://example.test/live');
  assert.equal(result.locations[3].kind, 'hthree');
  assert.equal(result.locations[3].link, null);
  assert.deepEqual(result.links, [
    {
      uri: 'https://example.test/event',
      text: 'Event page',
      link: 'https://example.test/event',
    },
  ]);
});

test('missing mode and status use the lexicon defaults; malformed records are skipped', () => {
  const result = normaliseCalendarEvent(
    event({ mode: undefined, status: undefined, startsAt: 'not a date' }),
    uri,
    cid
  );
  assert.ok(result);
  assert.equal(result.mode, `${EVENT_COLLECTION}#inperson`);
  assert.equal(result.status, `${EVENT_COLLECTION}#scheduled`);
  assert.equal(result.startsAt, null);
  assert.equal(normaliseCalendarEvent({ name: '' }, uri, cid), null);
  assert.equal(normaliseCalendarEvent(event({ $type: 'app.bsky.feed.post' }), uri, cid), null);
  assert.equal(eventModeLabel(result.mode), 'In person');
  assert.equal(eventStatusLabel(result.status), 'Scheduled');
});

test('profile ordering is upcoming, undated, then recent past', () => {
  const now = Date.parse('2026-11-23T12:00:00.000Z');
  const at = (name, startsAt) => ({ ...event(), name, startsAt });
  const sorted = sortProfileEvents(
    [
      at('old', '2025-01-01T10:00:00.000Z'),
      at('soon', '2026-12-01T10:00:00.000Z'),
      at('undated', null),
      at('later', '2027-01-01T10:00:00.000Z'),
      at('recent past', '2026-11-01T10:00:00.000Z'),
    ],
    now
  );
  assert.deepEqual(
    sorted.map((item) => item.name),
    ['soon', 'later', 'undated', 'recent past', 'old']
  );
  assert.equal(profileEventStrip(sorted, now, 2).length, 2);
  assert.deepEqual(profileEventStrip(sorted, now, 2).map((item) => item.name), [
    'soon',
    'later',
  ]);
});

test('raw record embeds reveal only event strong refs', () => {
  const raw = {
    $type: 'app.bsky.embed.record',
    record: { uri, cid },
  };
  assert.deepEqual(eventRefFromRecordEmbed(raw), { uri, cid });
  assert.deepEqual(
    eventRefFromRecordEmbed({
      $type: 'app.bsky.embed.recordWithMedia',
      record: { uri, cid },
      media: { $type: 'app.bsky.embed.images' },
    }),
    { uri, cid }
  );
  assert.equal(
    eventRefFromRecordEmbed({
      $type: 'app.bsky.embed.record',
      record: { uri: 'at://did:plc:alice/app.bsky.feed.post/1', cid: 'bafy-post' },
    }),
    null
  );
  assert.equal(
    eventRefFromRecordEmbed({
      $type: 'app.bsky.embed.record#view',
      record: {
        $type: 'app.bsky.embed.record#viewRecord',
        uri,
        cid,
      },
    }),
    null
  );
});

test('new RSVP rkeys are valid, increasing TIDs', () => {
  const first = newRsvpRkey();
  const second = newRsvpRkey();
  assert.match(first, /^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/);
  assert.equal(first.length, 13);
  assert.ok(first < second);
});

test('RSVP records filter by event, keep the newest key and build one strongRef', () => {
  const first = normaliseRsvpRecord(
    {
      $type: RSVP_COLLECTION,
      subject: { uri, cid },
      status: `${RSVP_COLLECTION}#going`,
    },
    `at://did:plc:viewer/${RSVP_COLLECTION}/3a`
  );
  const second = normaliseRsvpRecord(
    {
      $type: RSVP_COLLECTION,
      subject: { uri, cid },
      status: `${RSVP_COLLECTION}#interested`,
    },
    `at://did:plc:viewer/${RSVP_COLLECTION}/3b`
  );
  const other = normaliseRsvpRecord(
    {
      $type: RSVP_COLLECTION,
      subject: { uri: `${uri}-other`, cid },
      status: `${RSVP_COLLECTION}#going`,
    },
    `at://did:plc:viewer/${RSVP_COLLECTION}/3c`
  );
  assert.ok(first);
  assert.ok(second);
  assert.ok(other);
  assert.deepEqual(rsvpsForEvent([first, other, second], uri), [second, first]);
  assert.equal(rsvpLabel(second.status), 'Interested');
  assert.equal(
    normaliseRsvpRecord(
      { subject: { uri, cid }, status: 'unknown' },
      `at://did:plc:viewer/${RSVP_COLLECTION}/3d`
    ),
    null
  );

  const details = normaliseCalendarEvent(event(), uri, cid);
  assert.ok(details);
  assert.deepEqual(buildRsvpRecord(details, 'notgoing'), {
    $type: RSVP_COLLECTION,
    subject: { uri, cid },
    status: `${RSVP_COLLECTION}#notgoing`,
  });
  assert.equal(buildRsvpRecord({ ...details, cid: '' }, 'going'), null);
});

test('AT URIs are parsed only when they carry repo, collection and rkey', () => {
  assert.deepEqual(parseAtUri(uri), {
    did: 'did:plc:alice',
    collection: EVENT_COLLECTION,
    rkey: '3event',
  });
  assert.equal(parseAtUri('https://example.test'), null);
  assert.equal(parseAtUri('at://did:plc:alice'), null);
  assert.equal(parseAtUri('at://did:plc:alice/app.bsky.feed.post/one/two'), null);
});
