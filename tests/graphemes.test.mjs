import test from 'node:test';
import assert from 'node:assert/strict';
import { countGraphemes } from 'unicode-segmenter/grapheme';

test('counts ASCII text by character', () => {
  assert.equal(countGraphemes('hello'), 5);
});

test('counts a combining accent as part of one grapheme', () => {
  assert.equal(countGraphemes('cafe\u0301'), 4);
});

test('counts a flag as one grapheme', () => {
  assert.equal(countGraphemes('🇬🇧'), 1);
});

test('counts a multi-codepoint family emoji as one grapheme', () => {
  assert.equal(countGraphemes('👨‍👩‍👧‍👦'), 1);
});

test('counts a skin-tone emoji as one grapheme', () => {
  assert.equal(countGraphemes('👍🏽'), 1);
});

test('counts 300 family emoji as 300 graphemes', () => {
  const text = '👨‍👩‍👧‍👦'.repeat(300);
  assert.equal(countGraphemes(text), 300);
  assert.equal(text.length, 3300);
});
