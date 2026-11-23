import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EDIT_DISCLOSURE,
  EDIT_WINDOW_MS,
  MIN_ACCOUNT_AGE_MS,
  buildEditedRecord,
  buildEditWrites,
  canOfferEdit,
  editHistory,
  editOriginalText,
  editWindowExpiresAt,
  editedAt,
  isEdited,
  postEditState,
  postRkey,
} from '../src/lib/postEditModel.ts';

const CREATED = '2026-11-23T11:57:00.000Z';
const CREATED_MS = Date.parse(CREATED);
const VIEWER = 'did:plc:viewer';
const OLD_ACCOUNT = new Date(CREATED_MS - 30 * 24 * 60 * 60 * 1000).toISOString();

function post(overrides = {}) {
  return {
    $type: 'app.bsky.feed.post',
    text: 'Helo wrld',
    createdAt: CREATED,
    langs: ['en-GB'],
    reply: {
      parent: { uri: 'at://x/app.bsky.feed.post/1', cid: 'cid-parent' },
      root: { uri: 'at://x/app.bsky.feed.post/1', cid: 'cid-parent' },
    },
    ...overrides,
  };
}

function state(overrides = {}) {
  return postEditState({
    record: post(),
    authorDid: VIEWER,
    viewerDid: VIEWER,
    accountCreatedAt: OLD_ACCOUNT,
    now: CREATED_MS + 60_000,
    ...overrides,
  });
}

test('a fresh, old-enough account can edit inside the five-minute window', () => {
  const result = state();
  assert.equal(result.kind, 'editable');
  if (result.kind !== 'editable') return;
  assert.equal(result.text, 'Helo wrld');
  assert.equal(result.createdAt, CREATED);
  assert.equal(
    result.expiresAt,
    new Date(CREATED_MS + EDIT_WINDOW_MS).toISOString()
  );
  assert.equal(
    editWindowExpiresAt(post()),
    new Date(CREATED_MS + EDIT_WINDOW_MS).toISOString()
  );
});

test('the window closes after five minutes, including at the boundary', () => {
  const atBoundary = state({ now: CREATED_MS + EDIT_WINDOW_MS });
  assert.equal(atBoundary.kind, 'editable');
  const after = state({ now: CREATED_MS + EDIT_WINDOW_MS + 1 });
  assert.equal(after.kind, 'blocked');
  if (after.kind === 'blocked') {
    assert.equal(after.reason, 'window-closed');
    assert.match(after.message, /five-minute/i);
  }
});

test('one edit per post: a record with updatedAt can never be edited again', () => {
  const edited = post({
    updatedAt: '2026-11-23T11:58:00.000Z',
    originalText: 'Helo wrld',
    text: 'Hello world',
  });
  assert.equal(isEdited(edited), true);
  assert.equal(editedAt(edited), '2026-11-23T11:58:00.000Z');
  assert.equal(editOriginalText(edited), 'Helo wrld');
  const result = state({ record: edited });
  assert.equal(result.kind, 'blocked');
  if (result.kind === 'blocked') assert.equal(result.reason, 'edited');
  assert.equal(canOfferEdit(edited).ok, false);
});

test('accounts younger than seven days fail closed, as does an unreadable age', () => {
  const now = CREATED_MS + 60_000;
  const younger = new Date(now - MIN_ACCOUNT_AGE_MS + 60_000).toISOString();
  const tooNew = state({ accountCreatedAt: younger });
  assert.equal(tooNew.kind, 'blocked');
  if (tooNew.kind === 'blocked') {
    assert.equal(tooNew.reason, 'account-too-new');
    assert.match(tooNew.message, /seven days/i);
  }

  const unknown = state({ accountCreatedAt: null });
  assert.equal(unknown.kind, 'blocked');
  if (unknown.kind === 'blocked') {
    assert.equal(unknown.reason, 'account-age-unknown');
    assert.match(unknown.message, /account’s age/i);
  }

  const exactlyOldEnough = state({
    accountCreatedAt: new Date(CREATED_MS - MIN_ACCOUNT_AGE_MS).toISOString(),
  });
  assert.equal(exactlyOldEnough.kind, 'editable');
});

test('only the author can edit, and a missing timestamp is refused', () => {
  const other = state({ viewerDid: 'did:plc:someone-else' });
  assert.equal(other.kind, 'blocked');
  if (other.kind === 'blocked') assert.equal(other.reason, 'not-own');

  const anonymous = state({ viewerDid: null });
  assert.equal(anonymous.kind, 'blocked');
  if (anonymous.kind === 'blocked') assert.equal(anonymous.reason, 'not-own');

  const undated = state({ record: post({ createdAt: 'not a date' }) });
  assert.equal(undated.kind, 'blocked');
  if (undated.kind === 'blocked') assert.equal(undated.reason, 'invalid-post');
});

test('the replacement keeps everything except the text, facets and history', () => {
  const original = post({
    $type: 'app.bsky.feed.post',
    facets: [{ index: { byteStart: 0, byteEnd: 4 }, features: [] }],
    embed: { $type: 'app.bsky.embed.images', images: [] },
    labels: { $type: 'com.atproto.label.defs#selfLabels', values: [] },
    tags: ['typo'],
  });
  const next = buildEditedRecord(
    original,
    'Hello world',
    [{ index: { byteStart: 0, byteEnd: 11 }, features: [] }],
    '2026-11-23T11:59:00.000Z'
  );
  assert.equal(next.text, 'Hello world');
  assert.equal(next.originalText, 'Helo wrld');
  assert.equal(next.updatedAt, '2026-11-23T11:59:00.000Z');
  assert.equal(next.createdAt, CREATED);
  assert.deepEqual(next.reply, original.reply);
  assert.deepEqual(next.embed, original.embed);
  assert.deepEqual(next.labels, original.labels);
  assert.deepEqual(next.tags, ['typo']);
  assert.deepEqual(next.facets, [
    { index: { byteStart: 0, byteEnd: 11 }, features: [] },
  ]);

  const withoutFacets = buildEditedRecord(
    original,
    'Hello again',
    undefined,
    '2026-11-23T12:00:00.000Z'
  );
  assert.equal('facets' in withoutFacets, false);
  assert.throws(
    () =>
      buildEditedRecord(
        { ...original, updatedAt: '2026-11-23T11:58:00.000Z' },
        'No',
        undefined,
        '2026-11-23T12:00:00.000Z'
      ),
    /already been edited/
  );
});

test('the write is one atomic delete and create at the same rkey', () => {
  const uri = 'at://did:plc:viewer/app.bsky.feed.post/3labcdef';
  const result = buildEditWrites(
    uri,
    post(),
    'Hello world',
    undefined,
    '2026-11-23T11:59:00.000Z'
  );
  assert.equal(result.rkey, '3labcdef');
  assert.equal(result.writes.length, 2);
  assert.equal(result.writes[0].$type, 'com.atproto.repo.applyWrites#delete');
  assert.equal(result.writes[1].$type, 'com.atproto.repo.applyWrites#create');
  assert.equal(result.writes[0].rkey, result.writes[1].rkey);
  assert.equal(result.writes[0].collection, 'app.bsky.feed.post');
  assert.equal(result.writes[1].collection, 'app.bsky.feed.post');
  assert.equal(result.writes[1].value.text, 'Hello world');
  assert.equal(result.writes[1].value.originalText, 'Helo wrld');
  assert.equal('value' in result.writes[0], false);
  assert.equal(postRkey(uri), '3labcdef');
  assert.equal(postRkey('at://did:plc:viewer/app.bsky.feed.post/'), null);
  assert.equal(postRkey('https://bsky.app/profile/x/post/3labcdef'), null);
  assert.throws(
    () => buildEditWrites('bad-uri', post(), 'x', undefined, new Date().toISOString()),
    /not a single post/
  );
});

test('the history is exactly the original and current versions', () => {
  assert.equal(editHistory(post()), null);
  const history = editHistory(
    post({
      text: 'Hello world',
      originalText: 'Helo wrld',
      updatedAt: '2026-11-23T11:59:00.000Z',
    })
  );
  assert.equal(history.length, 2);
  assert.deepEqual(history[0], {
    label: 'Original',
    at: CREATED,
    text: 'Helo wrld',
  });
  assert.deepEqual(history[1], {
    label: 'Current',
    at: '2026-11-23T11:59:00.000Z',
    text: 'Hello world',
  });

  const missing = editHistory(
    post({ text: 'Hello world', updatedAt: '2026-11-23T11:59:00.000Z' })
  );
  assert.equal(missing[0].text, null);
});

test('the disclosure states the reset before the write', () => {
  assert.match(EDIT_DISCLOSURE, /recreates this post at the same address/i);
  assert.match(EDIT_DISCLOSURE, /reset to zero/i);
  assert.match(EDIT_DISCLOSURE, /edit once, within five minutes/i);
  assert.match(EDIT_DISCLOSURE, /full history/i);
});

test('the edit menu offer is separate from the account-age guard', () => {
  const offer = canOfferEdit(post(), CREATED_MS + 1000);
  assert.equal(offer.ok, true);
  if (offer.ok) {
    assert.equal(offer.expiresAt, new Date(CREATED_MS + EDIT_WINDOW_MS).toISOString());
  }
  const closed = canOfferEdit(post(), CREATED_MS + EDIT_WINDOW_MS + 1);
  assert.equal(closed.ok, false);
  if (!closed.ok) assert.equal(closed.reason, 'window-closed');
  assert.equal(canOfferEdit({}, CREATED_MS + 1000).ok, false);
});
