import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MEMORIES_HOME_LIMIT,
  collectMemories,
  formatMemoryDay,
  isMemoriesDismissed,
  memoriesDateKey,
  memoriesSubtitle,
  memorySnippet,
  normaliseMemoriesDateKey,
  normaliseMemoriesPreferences,
  withMemoriesDismissed,
  withMemoriesEnabled,
} from '../src/lib/memoriesModel.ts';

const DID = 'did:plc:mockviewer';
const DATE_KEY = '2026-11-23';
const at = (year, month, day, hour = 12) =>
  new Date(year, month - 1, day, hour).toISOString();

function record(uri, createdAt, extra = {}) {
  return {
    uri,
    cid: `cid-${uri.split('/').pop()}`,
    value: {
      $type: 'app.bsky.feed.post',
      text: `Post ${uri.split('/').pop()}`,
      createdAt,
      ...extra,
    },
  };
}

test('local date keys and labels use the device calendar, not UTC', () => {
  const local = new Date(2026, 10, 23, 23, 30);
  assert.equal(memoriesDateKey(local), '2026-11-23');
  assert.equal(formatMemoryDay('2026-11-23'), '23 November');
  assert.equal(normaliseMemoriesDateKey('2026-11-23'), '2026-11-23');
  assert.equal(normaliseMemoriesDateKey('2026-02-31'), null);
  assert.equal(normaliseMemoriesDateKey('23-11-2026'), null);
});

test('collects only the viewer’s earlier posts from this month and day', () => {
  const records = [
    record(`at://${DID}/app.bsky.feed.post/old`, at(2025, 11, 23, 8)),
    record(`at://${DID}/app.bsky.feed.post/newer`, at(2024, 11, 23, 18)),
    record(`at://${DID}/app.bsky.feed.post/current-year`, at(2026, 11, 23, 8)),
    record(`at://${DID}/app.bsky.feed.post/other-day`, at(2025, 11, 22, 8)),
    record(`at://did:plc:someoneelse/app.bsky.feed.post/foreign`, at(2025, 11, 23, 8)),
    {
      ...record(`at://${DID}/app.bsky.feed.post/repost`, at(2025, 11, 23, 8)),
      value: {
        $type: 'app.bsky.feed.repost',
        subject: { uri: 'at://did:plc:someoneelse/app.bsky.feed.post/1' },
        createdAt: at(2025, 11, 23, 8),
      },
    },
  ];

  const result = collectMemories(records, DATE_KEY, DID);
  assert.deepEqual(
    result.items.map((item) => item.uri.split('/').pop()),
    ['old', 'newer']
  );
  assert.equal(result.scanned, records.length);
  assert.equal(result.items[0].year, 2025);
  assert.equal(result.items[1].year, 2024);
});

test('copy names every year and the exact day shown', () => {
  const one = collectMemories(
    [record(`at://${DID}/app.bsky.feed.post/one`, at(2025, 11, 23))],
    DATE_KEY,
    DID
  ).items;
  assert.equal(memoriesSubtitle(DATE_KEY, one), 'Your posts from 23 November 2025');

  const two = collectMemories(
    [
      record(`at://${DID}/app.bsky.feed.post/one`, at(2025, 11, 23)),
      record(`at://${DID}/app.bsky.feed.post/two`, at(2024, 11, 23)),
    ],
    DATE_KEY,
    DID
  ).items;
  assert.equal(memoriesSubtitle(DATE_KEY, two), 'Your posts from 23 November 2025 and 2024');
  assert.equal(memoriesSubtitle(DATE_KEY, []), '');
});

test('compact rows never invent a text post and keep a bounded Home preview', () => {
  assert.equal(memorySnippet({ text: '  First\n\nsecond   line  ' }), 'First second line');
  assert.equal(memorySnippet({ embed: { $type: 'app.bsky.embed.images' } }), 'A photo post');
  assert.equal(memorySnippet({ embed: { $type: 'app.bsky.embed.video' } }), 'A video post');
  assert.equal(memorySnippet({ embed: { $type: 'app.bsky.embed.record' } }), 'A quoted post');
  assert.equal(memorySnippet({}), 'A post with no text');
  assert.equal(MEMORIES_HOME_LIMIT, 3);
});

test('malformed or foreign preferences are dropped without an enabled default', () => {
  const cleaned = normaliseMemoriesPreferences({
    [DID]: { enabled: true, dismissedOn: '2026-11-23' },
    'not-a-did': { enabled: true },
    'did:plc:bad': { enabled: 'yes' },
    'did:plc:dismissed': { enabled: false, dismissedOn: '2026-02-31' },
  });
  assert.deepEqual(cleaned, {
    [DID]: { enabled: true, dismissedOn: '2026-11-23' },
    'did:plc:dismissed': { enabled: false },
  });

  const enabled = withMemoriesEnabled(cleaned, DID, false);
  assert.equal(enabled[DID].enabled, false);
  assert.equal(enabled[DID].dismissedOn, '2026-11-23');
  assert.equal(cleaned[DID].enabled, true, 'updates are immutable');

  const dismissed = withMemoriesDismissed(enabled, DID, '2026-11-24');
  assert.equal(isMemoriesDismissed(dismissed[DID], '2026-11-24'), true);
  assert.equal(isMemoriesDismissed(dismissed[DID], '2026-11-23'), false);
});
