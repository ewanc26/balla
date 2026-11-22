import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DURATION_MINUTES,
  DURATION_MINUTES,
  LIVE_STATUS,
  STATUS_COLLECTION,
  STATUS_RKEY,
  displayDuration,
  expiresAtFor,
  liveEmbed,
  liveLinkFromStatus,
  liveStatusRecord,
  normaliseLiveLink,
  statusIsActive,
} from '../src/lib/liveStatusModel.ts';

const CREATED = '2026-01-01T00:00:00.000Z';

test('status uses the published collection, rkey and live type', () => {
  assert.equal(STATUS_COLLECTION, 'app.bsky.actor.status');
  assert.equal(STATUS_RKEY, 'self');
  assert.equal(LIVE_STATUS, 'app.bsky.actor.status#live');
});

test('durations are five-minute increments up to four hours', () => {
  assert.equal(DURATION_MINUTES[0], 5);
  assert.equal(DURATION_MINUTES.at(-1), 240);
  assert.equal(DURATION_MINUTES.length, 48);
  assert.ok(DURATION_MINUTES.includes(DEFAULT_DURATION_MINUTES));
});

test('only http(s) links are accepted', () => {
  assert.equal(normaliseLiveLink('  https://twitch.tv/stream  '), 'https://twitch.tv/stream');
  assert.equal(normaliseLiveLink('http://example.com'), 'http://example.com');
  assert.equal(normaliseLiveLink('javascript:alert(1)'), null);
  assert.equal(normaliseLiveLink('not a url'), null);
  assert.equal(normaliseLiveLink(undefined), null);
});

test('a status record carries the live type, duration and external embed', () => {
  const record = liveStatusRecord('https://twitch.tv/stream', 30, CREATED);
  assert.equal(record.$type, STATUS_COLLECTION);
  assert.equal(record.status, LIVE_STATUS);
  assert.equal(record.durationMinutes, 30);
  assert.equal(record.createdAt, CREATED);
  assert.equal(record.embed.external.uri, 'https://twitch.tv/stream');
});

test('an invalid duration falls back to the default and a blank link has no embed', () => {
  const record = liveStatusRecord('', 9999, CREATED);
  assert.equal(record.durationMinutes, DEFAULT_DURATION_MINUTES);
  assert.equal(record.embed, undefined);
});

test('expiry is createdAt plus the duration', () => {
  assert.equal(expiresAtFor(CREATED, 60), Date.parse(CREATED) + 60 * 60_000);
  assert.equal(expiresAtFor('bad', 60), 0);
});

test('active status honours expiresAt, disabled and expiry', () => {
  const now = Date.parse(CREATED);
  assert.equal(statusIsActive({ status: LIVE_STATUS, expiresAt: '2026-01-01T01:00:00.000Z' }, now), true);
  assert.equal(statusIsActive({ status: LIVE_STATUS, expiresAt: '2025-12-31T23:00:00.000Z' }, now), false);
  assert.equal(statusIsActive({ status: LIVE_STATUS, expiresAt: '2026-01-01T01:00:00.000Z', isDisabled: true }, now), false);
  assert.equal(statusIsActive({ status: 'something.else', expiresAt: '2026-01-01T01:00:00.000Z' }, now), false);
});

test('a locally written status is active until createdAt plus duration', () => {
  const now = Date.parse(CREATED);
  const status = { status: LIVE_STATUS, record: { createdAt: CREATED, durationMinutes: 30 } };
  assert.equal(statusIsActive(status, now), true);
  assert.equal(statusIsActive(status, now + 31 * 60_000), false);
});

test('link extraction works from a status view and a raw record', () => {
  const uri = 'https://www.twitch.tv/stream';
  assert.equal(liveEmbed(uri).external.uri, uri);
  assert.equal(liveLinkFromStatus({ embed: { external: { uri } } }), uri);
  assert.equal(liveLinkFromStatus({ record: { embed: { external: { uri } } } }), uri);
  assert.equal(liveLinkFromStatus({}), null);
});

test('duration is rendered for people', () => {
  assert.equal(displayDuration(5), '5 minutes');
  assert.equal(displayDuration(1), '1 minute');
  assert.equal(displayDuration(60), '1 hour');
  assert.equal(displayDuration(90), '1 hour 30 minutes');
  assert.equal(displayDuration(120), '2 hours');
});
