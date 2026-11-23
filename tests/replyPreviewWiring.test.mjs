import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('feed cards request previews only from FlashList viewability', () => {
  const feed = read('../src/screens/FeedScreen.tsx');
  const card = read('../src/components/PostCard.tsx');

  assert.match(feed, /onViewableItemsChanged=\{onViewableItemsChanged\}/);
  assert.match(feed, /viewabilityConfig=\{viewabilityConfig\}/);
  assert.match(feed, /minimumViewTime: 150/);
  assert.match(feed, /extraData=\{previewVisibleUris\}/);
  assert.match(feed, /replyPreviewEnabled=\{previewVisibleUris\.has\(item\.post\.uri\)\}/);
  assert.match(feed, /clearReplyPreviewCache\(\)/);
  assert.match(card, /replyPreviewEnabled\?: boolean/);
  assert.match(card, /<ReplyPreview/);
  assert.match(card, /enabled=\{!!replyPreviewEnabled\}/);
});

test('the preview is a single direct depth-1 read with a bounded cache', () => {
  const store = read('../src/lib/replyPreviewStore.ts');
  const model = read('../src/lib/replyPreviewModel.ts');

  assert.match(store, /getPostThread\(\{ uri, depth: 1 \}\)/);
  assert.match(store, /REPLY_PREVIEW_MAX_ACTIVE/);
  assert.match(store, /cache\.size > REPLY_PREVIEW_CACHE_LIMIT/);
  assert.match(store, /queue\.splice/);
  assert.match(store, /wanted\.delete\(uri\)/);
  assert.match(store, /status: 'failed'/);
  assert.match(model, /sortReplies\(replies, sort\)\[0\]/);
  assert.match(model, /REPLY_PREVIEW_CACHE_LIMIT = 40/);
  assert.doesNotMatch(
    store + model,
    /AsyncStorage|putRecord|createRecord|deleteRecord|agent\.|fetch\(/
  );
});

test('the preview uses thread order, moderation and both existing destinations', () => {
  const preview = read('../src/components/ReplyPreview.tsx');
  const card = read('../src/components/PostCard.tsx');

  assert.match(preview, /const \{ threadSort \} = useViewPreferences\(\)/);
  assert.match(preview, /firstReplyInOrder\(entry\.replies, threadSort\)/);
  assert.match(preview, /hiddenByLabel\(/);
  assert.match(preview, /warnedByLabel\(/);
  assert.match(preview, /onOpenProfile\(author\.did\)/);
  assert.match(preview, /onOpenThread\(post\.uri\)/);
  assert.match(preview, /View all replies/);
  assert.match(preview, /numberOfLines=\{2\}/);
  assert.match(preview, /replyCount \|\| 0\) > 0/);
  // The card's count is still the post view's total, not the preview subset.
  assert.match(
    card,
    /const replyLabel = replies > 0 \? formatCount\(replies\) : 'Comment'/
  );
});
