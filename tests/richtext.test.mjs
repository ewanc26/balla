import test from 'node:test';
import assert from 'node:assert/strict';
import {
  richTextSegments,
  utf8Length,
  utf8Slice,
} from '../src/lib/richtext.ts';

const LINK = 'app.bsky.richtext.facet#link';
const MENTION = 'app.bsky.richtext.facet#mention';
const TAG = 'app.bsky.richtext.facet#tag';

test('UTF-8 slices use byte offsets rather than JavaScript string indices', () => {
  const text = 'Hi 😀 #tea';
  assert.equal(utf8Length(text), 12);
  assert.equal(utf8Length('Hé'), 3);
  assert.equal(utf8Slice(text, 8, 12), '#tea');
  assert.equal(utf8Slice(text, 0, 8), 'Hi 😀 ');
});

test('posts without usable facets stay as one plain segment', () => {
  assert.deepEqual(richTextSegments('Just text', undefined), [
    { kind: 'text', text: 'Just text' },
  ]);
  assert.deepEqual(
    richTextSegments('Just text', [
      { index: { byteStart: 3, byteEnd: 99 }, features: [{ $type: TAG, tag: 'x' }] },
    ]),
    [{ kind: 'text', text: 'Just text' }]
  );
});

test('links, mentions and hashtags become actionable segments', () => {
  const linked = richTextSegments('Check https://bsky.app now', [
    {
      index: { byteStart: 6, byteEnd: 22 },
      features: [{ $type: LINK, uri: 'https://bsky.app' }],
    },
  ]);
  assert.equal(linked.length, 3);
  assert.equal(linked[1].kind, 'link');
  assert.equal(linked[1].text, 'https://bsky.app');
  assert.equal(linked[1].uri, 'https://bsky.app');

  const mentioned = richTextSegments('@alice hello', [
    {
      index: { byteStart: 0, byteEnd: 6 },
      features: [{ $type: MENTION, did: 'did:plc:alice' }],
    },
  ]);
  assert.equal(mentioned[0].kind, 'mention');
  assert.equal(mentioned[0].actor, 'did:plc:alice');

  const tagged = richTextSegments('Hi 😀 #tea', [
    {
      index: { byteStart: 8, byteEnd: 12 },
      features: [{ $type: TAG, tag: '#tea' }],
    },
  ]);
  const tag = tagged.find((segment) => segment.kind === 'tag');
  assert.equal(tag.text, '#tea');
  assert.equal(tag.tag, 'tea');
  assert.equal(tagged[0].text, 'Hi 😀 ');
});

test('unsafe link schemes are not turned into tappable links', () => {
  const segments = richTextSegments('javascript:alert(1)', [
    {
      index: { byteStart: 0, byteEnd: 19 },
      features: [{ $type: LINK, uri: 'javascript:alert(1)' }],
    },
  ]);
  assert.deepEqual(segments, [
    { kind: 'text', text: 'javascript:alert(1)' },
  ]);
});

test('mention and tag falls back to visible text when the feature is incomplete', () => {
  const mention = richTextSegments('@bob hi', [
    {
      index: { byteStart: 0, byteEnd: 4 },
      features: [{ $type: MENTION }],
    },
  ]);
  assert.equal(mention[0].kind, 'mention');
  assert.equal(mention[0].actor, 'bob');

  const tag = richTextSegments('#cats', [
    {
      index: { byteStart: 0, byteEnd: 5 },
      features: [{ $type: TAG }],
    },
  ]);
  assert.deepEqual(tag, [{ kind: 'text', text: '#cats' }]);
});
