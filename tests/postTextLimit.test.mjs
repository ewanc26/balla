import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  measurePostText,
  utf8ByteLength,
  POST_TEXT_MAX_BYTES,
  POST_TEXT_MAX_GRAPHEMES,
} from '../src/lib/postTextLimit.ts';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const FAMILY = '👨‍👩‍👧‍👦';

test('counts graphemes and UTF-8 bytes independently', () => {
  assert.equal(POST_TEXT_MAX_GRAPHEMES, 300);
  assert.equal(POST_TEXT_MAX_BYTES, 3000);
  assert.equal(utf8ByteLength('abc'), 3);
  assert.equal(utf8ByteLength('é'), 2);
  assert.equal(utf8ByteLength(FAMILY), 25);
});

test('exactly 300 ASCII graphemes fit both caps', () => {
  const measured = measurePostText('a'.repeat(300));
  assert.equal(measured.graphemes, 300);
  assert.equal(measured.bytes, 300);
  assert.equal(measured.over, false);
  assert.equal(measured.message, null);
});

test('301 graphemes are rejected before publishing', () => {
  const measured = measurePostText('a'.repeat(301));
  assert.equal(measured.graphemeOver, 1);
  assert.equal(measured.over, true);
  assert.match(measured.message, /1 grapheme over the 300-grapheme limit/);
});

test('emoji can fit the grapheme cap but exceed the byte cap', () => {
  const measured = measurePostText(FAMILY.repeat(200));
  assert.equal(measured.graphemes, 200);
  assert.equal(measured.bytes, 5000);
  assert.equal(measured.graphemeOver, 0);
  assert.equal(measured.byteOver, 2000);
  assert.equal(measured.over, true);
  assert.match(measured.message, /2000 UTF-8 bytes over the 3,000-byte text cap/);
});

test('the byte boundary is exact', () => {
  assert.equal(measurePostText(FAMILY.repeat(120)).bytes, 3000);
  assert.equal(measurePostText(FAMILY.repeat(120)).over, false);
  assert.equal(measurePostText(FAMILY.repeat(121)).over, true);
  assert.equal(measurePostText(FAMILY.repeat(121)).byteOver, 25);
});

test('only the published, trimmed text is measured', () => {
  const measured = measurePostText('  hello  ');
  assert.equal(measured.text, 'hello');
  assert.equal(measured.graphemes, 5);
  assert.equal(measured.bytes, 5);
});

test('both composers use the shared caps and visible counters', () => {
  const compose = read('../src/screens/ComposeScreen.tsx');
  assert.match(compose, /measurePostText\(text\)/);
  assert.match(compose, /POST_TEXT_MAX_GRAPHEMES/);
  assert.match(compose, /textLimit\.message/);

  const thread = read('../src/screens/ThreadScreen.tsx');
  assert.match(thread, /measurePostText\(replyText\)/);
  assert.match(
    thread,
    /const canSendReply = replyLimit\.text\.length > 0 && !replyLimit\.over/
  );
  assert.match(thread, /disabled=\{sending \|\| !canSendReply\}/);
  assert.match(thread, /replyLimit\.message/);
  assert.match(thread, /POST_TEXT_MAX_GRAPHEMES/);
});

test('release copy records the text caps', () => {
  assert.equal(
    JSON.parse(read('../package.json')).version,
    JSON.parse(read('../app.json')).expo.version,
  );

  const changelog = read('../CHANGELOG.md');
  assert.match(changelog, /## 0\.22\.1/);
  assert.match(changelog, /3,000 UTF-8 bytes/);
  assert.match(read('../README.md'), /3,000-byte/);
  assert.match(read('../AGENTS.md'), /3,000-byte/);

  const site = read('../site/features.html');
  assert.match(site, /issues\/83/);
  assert.match(site, /3,000-byte/);
  assert.match(read('../docs/bluesky-compliance.md'), /3,000-byte/);
  assert.match(read('../docs/social-app-reference.md'), /3,000-byte/);
});
