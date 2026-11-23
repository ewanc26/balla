import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CREATOR } from '../src/lib/serviceHosts.ts';

const root = new URL('..', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const SUPPORT_LINK = 'https://ewancroft.uk/support';

function sourceFiles(dir) {
  return readdirSync(join(root.pathname, dir), { recursive: true })
    .map((entry) => String(entry).replaceAll('\\', '/'))
    .filter((entry) => /\.(ts|tsx)$/.test(entry));
}

test('the support URL lives in exactly one app constant', () => {
  assert.equal(CREATOR.supportUrl, SUPPORT_LINK);
  const hosts = read('src/lib/serviceHosts.ts');
  assert.match(
    hosts,
    /export const SUPPORT_URL = 'https:\/\/ewancroft\.uk\/support';/,
    'the one support URL is beside the service hosts'
  );
  assert.match(hosts, /supportUrl: SUPPORT_URL,/, 'creator links derive from it');

  for (const file of sourceFiles('src')) {
    const text = read(`src/${file}`);
    const count = (text.match(/https:\/\/ewancroft\.uk\/support/g) || []).length;
    if (file === 'lib/serviceHosts.ts') {
      assert.equal(count, 1, 'the constant is defined once');
    } else {
      assert.equal(count, 0, `${file} repeats the support URL literal`);
    }
  }
});

test('the Supporters card is the only app surface that asks for support', () => {
  const card = read('src/components/SupportersCard.tsx');
  assert.match(card, /import \{ CREATOR \} from '\.\.\/lib\/serviceHosts'/);
  assert.match(card, /CREATOR\.supportUrl/);
  assert.match(card, /<CreatorByline \/>/, 'the creator comes from the shared byline');
  assert.match(card, /minHeight: 44/, 'the support button meets the touch minimum');
  assert.match(card, /accessibilityLabel="Support Balla"/);
  assert.doesNotMatch(card, /fetch\(|analytics|track(?:ing)?\b/i);

  const info = read('src/screens/InfoScreen.tsx');
  assert.match(info, /topicKey === 'about' \? <SupportersCard \/> : null/);
  assert.doesNotMatch(info, /ewancroft\.uk\/support/);

  const settings = read('src/screens/SettingsScreen.tsx');
  assert.doesNotMatch(settings, /Support Balla|ewancroft\.uk\/support/);
});

test('no feed, thread, post, notification or chat surface links the support page', () => {
  for (const file of [
    'src/components/PostCard.tsx',
    'src/components/PostMenu.tsx',
    'src/screens/FeedScreen.tsx',
    'src/screens/ThreadScreen.tsx',
    'src/screens/NotificationsScreen.tsx',
    'src/screens/ChatScreen.tsx',
    'src/screens/ConversationScreen.tsx',
  ]) {
    assert.doesNotMatch(read(file), /ewancroft\.uk\/support|CREATOR\.supportUrl/, file);
  }
});

test('every site footer carries the static supporters block beside the licence line', () => {
  const pages = readdirSync(join(root.pathname, 'site')).filter((name) =>
    name.endsWith('.html')
  );

  for (const page of pages) {
    const html = read(`site/${page}`);
    assert.match(
      html,
      /class="footer-byline">Balla by <a href="https:\/\/ewancroft\.uk">Ewan Croft<\/a> · <a href="https:\/\/bsky\.app\/profile\/ewancroft\.uk">@ewancroft\.uk<\/a><\/p>/,
      `${page} carries the creator byline`
    );
    assert.match(
      html,
      /class="footer-support">Balla is reader-supported\. <a href="https:\/\/ewancroft\.uk\/support">Support Balla<\/a><\/p>/,
      `${page} shows the supporters block`
    );
    assert.match(
      html,
      /class="footer-licence">AGPL-3\.0 · Copyright © 2026 Ewan Croft<\/p>/,
      `${page} shows the licence line beside it`
    );
    assert.equal(
      (html.match(/https:\/\/ewancroft\.uk\/support/g) || []).length,
      1,
      `${page} has exactly one support link`
    );
  }
});
