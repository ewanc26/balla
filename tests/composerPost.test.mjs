import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_ALT_TEXT,
  MAX_COMPOSER_IMAGES,
  altTextTooLongCount,
  buildImageEmbed,
  buildPostEmbed,
  canPublishPost,
  missingAltTextCount,
  threadReply,
} from '../src/lib/composerPost.ts';

function image(alt = 'A description', index = 1) {
  return {
    alt,
    blob: { ref: `blob-${index}` },
    width: 1200,
    height: 800,
  };
}

test('does not build an image embed without images', () => {
  assert.equal(buildImageEmbed([]), undefined);
});

test('one to four images use the legacy images embed', () => {
  const embed = buildImageEmbed([
    image('One', 1),
    image('Two', 2),
    image('Three', 3),
    image('Four', 4),
  ]);
  assert.equal(embed.$type, 'app.bsky.embed.images');
  assert.equal(embed.images.length, 4);
  assert.deepEqual(embed.images[0].aspectRatio, { width: 1200, height: 800 });
});

test('five to ten images use the gallery embed', () => {
  const images = Array.from({ length: 5 }, (_, index) =>
    image(`Image ${index + 1}`, index + 1)
  );
  const embed = buildImageEmbed(images);
  assert.equal(embed.$type, 'app.bsky.embed.gallery');
  assert.equal(embed.items.length, 5);
  assert.equal(embed.items[0].$type, 'app.bsky.embed.gallery#image');
  assert.deepEqual(embed.items[0].aspectRatio, { width: 1200, height: 800 });
});

test('gallery construction caps at ten images', () => {
  const images = Array.from({ length: 12 }, (_, index) =>
    image(`Image ${index + 1}`, index + 1)
  );
  assert.equal(buildImageEmbed(images).items.length, MAX_COMPOSER_IMAGES);
});

test('a quote with images becomes record-with-media', () => {
  const embed = buildPostEmbed([image()], {
    uri: 'at://did:plc:test/app.bsky.feed.post/1',
    cid: 'bafy-test',
  });
  assert.equal(embed.$type, 'app.bsky.embed.recordWithMedia');
  assert.equal(embed.record.$type, 'app.bsky.embed.record');
  assert.equal(embed.media.$type, 'app.bsky.embed.images');
});

test('a quote with more than four images keeps the gallery as media', () => {
  const images = Array.from({ length: 6 }, (_, index) =>
    image(`Image ${index + 1}`, index + 1)
  );
  const embed = buildPostEmbed(images, {
    uri: 'at://did:plc:test/app.bsky.feed.post/1',
    cid: 'bafy-test',
  });
  assert.equal(embed.$type, 'app.bsky.embed.recordWithMedia');
  assert.equal(embed.media.$type, 'app.bsky.embed.gallery');
});

test('a quote without media stays a plain record embed', () => {
  const embed = buildPostEmbed([], {
    uri: 'at://did:plc:test/app.bsky.feed.post/1',
    cid: 'bafy-test',
  });
  assert.equal(embed.$type, 'app.bsky.embed.record');
});

test('a resolved link card becomes a lexicon external embed', () => {
  const card = {
    uri: 'https://www.example.com/story',
    title: 'A real headline',
    description: 'Real description',
    host: 'example.com',
  };
  const embed = buildPostEmbed([], null, card);
  assert.equal(embed.$type, 'app.bsky.embed.external');
  assert.equal(embed.external.uri, card.uri);
  assert.equal(embed.external.title, card.title);
  assert.equal(embed.external.description, card.description);
});

test('a quote with a link card uses external as record-with-media', () => {
  const embed = buildPostEmbed(
    [],
    { uri: 'at://did:plc:test/app.bsky.feed.post/1', cid: 'bafy-test' },
    { uri: 'https://example.com', title: 'Example', description: '', host: 'example.com' }
  );
  assert.equal(embed.$type, 'app.bsky.embed.recordWithMedia');
  assert.equal(embed.media.$type, 'app.bsky.embed.external');
});

test('photos take precedence over a link card so the post stays valid', () => {
  const embed = buildPostEmbed(
    [image()],
    null,
    { uri: 'https://example.com', title: 'Example', description: '', host: 'example.com' }
  );
  assert.equal(embed.$type, 'app.bsky.embed.images');
});

test('thread replies keep the first post as root and the previous as parent', () => {
  const first = { uri: 'at://post/1', cid: 'cid-1' };
  const second = { uri: 'at://post/2', cid: 'cid-2' };
  const third = { uri: 'at://post/3', cid: 'cid-3' };
  assert.equal(threadReply(null, null), null);
  assert.deepEqual(threadReply(null, first), { reply: { root: first, parent: first } });
  assert.deepEqual(threadReply(first, second), { reply: { root: first, parent: second } });
  assert.deepEqual(threadReply(first, third), { reply: { root: first, parent: third } });
});

test('alt text is trimmed but descriptions are not invented', () => {
  const embed = buildImageEmbed([image('  A cat  '), image('   ')]);
  assert.equal(embed.images[0].alt, 'A cat');
  assert.equal(embed.images[1].alt, '');
  assert.equal(missingAltTextCount(embed.images), 1);
});

test('alt text is measured in graphemes for the 2000 limit', () => {
  const family = '👨‍👩‍👧‍👦';
  assert.equal(altTextTooLongCount([image(family.repeat(MAX_ALT_TEXT))]), 0);
  assert.equal(altTextTooLongCount([image(family.repeat(MAX_ALT_TEXT + 1))]), 1);
});

test('empty text is allowed only with an image or quote', () => {
  assert.equal(
    canPublishPost({ text: '', imageCount: 1, hasQuote: false }),
    true
  );
  assert.equal(
    canPublishPost({ text: '', imageCount: 0, hasQuote: true }),
    true
  );
  assert.equal(
    canPublishPost({ text: '   ', imageCount: 0, hasQuote: false }),
    false
  );
  assert.equal(
    canPublishPost({ text: '', imageCount: 0, hasQuote: false, hasLink: true }),
    true
  );
});
