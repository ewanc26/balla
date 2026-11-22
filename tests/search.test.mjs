import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addSearchHistory,
  buildPostSearchParams,
  cleanSearchFilters,
  countActiveFilters,
  EMPTY_SEARCH_FILTERS,
  filtersBlockTab,
  normaliseDomains,
  normaliseHandles,
  normaliseHashtags,
  parseSearchEntry,
  serializeSearchEntry,
  tabSupportsFilters,
  validateSearchFilters,
} from '../src/lib/searchModel.ts';

test('filter values are split, de-duplicated and stripped of typing markers', () => {
  assert.equal(normaliseHandles('@alice, @bob  alice'), 'alice bob');
  assert.equal(normaliseHashtags('#Tea #news, tea'), 'Tea news tea');
  assert.equal(
    normaliseDomains('https://Example.com/path, bsky.app'),
    'example.com bsky.app'
  );

  const cleaned = cleanSearchFilters({
    authors: '@alice, bob',
    domains: 'https://bsky.app/about',
    hashtags: '#scotland photography',
    languages: 'en, gd',
    replies: 'none',
    media: 'video',
    from: 'me',
  });
  assert.equal(cleaned.authors, 'alice bob');
  assert.equal(cleaned.domains, 'bsky.app');
  assert.equal(cleaned.hashtags, 'scotland photography');
  assert.equal(cleaned.languages, 'en gd');
  assert.equal(cleaned.replies, 'none');
  assert.equal(cleaned.media, 'video');
  assert.equal(cleaned.from, 'me');
});

test('filter validation rejects impossible dates, reversed ranges, bad languages and relative URLs', () => {
  assert.equal(validateSearchFilters(cleanSearchFilters({})), null);
  assert.match(
    validateSearchFilters(cleanSearchFilters({ since: '2026-02-31' })),
    /date after/
  );
  assert.match(
    validateSearchFilters(
      cleanSearchFilters({ since: '2026-03-01', until: '2026-02-01' })
    ),
    /must be before/
  );
  assert.match(
    validateSearchFilters(cleanSearchFilters({ languages: 'english' })),
    /language codes/
  );
  assert.match(
    validateSearchFilters(cleanSearchFilters({ urls: 'bsky.app/page' })),
    /http/
  );
});

test('active filter count and post-tab gating match the UI', () => {
  const filters = cleanSearchFilters({
    authors: 'alice',
    mentions: 'bob',
    domains: 'bsky.app',
    urls: 'https://bsky.app',
    hashtags: 'tea',
    excludeAuthors: 'eve',
    languages: 'en',
    since: '2026-01-01',
    until: '2026-02-01',
    replies: 'none',
    media: 'video',
    from: 'following',
  });
  assert.equal(countActiveFilters(filters), 12);
  assert.equal(tabSupportsFilters('top'), true);
  assert.equal(tabSupportsFilters('latest'), true);
  assert.equal(tabSupportsFilters('people'), false);
  assert.equal(filtersBlockTab(filters, 'feeds'), true);
  assert.equal(filtersBlockTab(EMPTY_SEARCH_FILTERS, 'feeds'), false);
});

test('v2 parameters preserve include and exclude fields and map Latest to recent', () => {
  const filters = cleanSearchFilters({
    authors: '@alice',
    mentions: 'bob',
    domains: 'https://bsky.app/about',
    urls: 'https://example.com/post',
    hashtags: '#tea #news',
    excludeAuthors: '@eve',
    excludeMentions: 'mallory',
    excludeDomains: 'spam.example',
    excludeUrls: 'https://spam.example/post',
    excludeHashtags: '#spoilers',
    languages: 'en gd',
    since: '2026-01-01',
    until: '2026-02-01',
    replies: 'only',
    media: 'video',
    from: 'following',
  });
  const params = buildPostSearchParams(' tea ', filters, 'did:plc:me', 'latest');

  assert.equal(params.query, 'tea');
  assert.equal(params.sort, 'recent');
  assert.deepEqual(params.authors, ['alice']);
  assert.deepEqual(params.mentions, ['bob']);
  assert.deepEqual(params.domains, ['bsky.app']);
  assert.deepEqual(params.urls, ['https://example.com/post']);
  assert.deepEqual(params.hashtags, ['tea', 'news']);
  assert.deepEqual(params.excludeAuthors, ['eve']);
  assert.deepEqual(params.excludeHashtags, ['spoilers']);
  assert.deepEqual(params.languages, ['en', 'gd']);
  assert.equal(params.since, '2026-01-01');
  assert.equal(params.until, '2026-02-01');
  assert.equal(params.hasVideo, true);
  assert.equal(params.hasMedia, undefined);
  assert.equal(params.repliesOnly, true);
  assert.equal(params.excludeReplies, undefined);
  assert.equal(params.following, true);
});

test('from-me resolves to the signed-in DID rather than the literal word me', () => {
  const filters = cleanSearchFilters({
    authors: 'alice',
    from: 'me',
  });
  const params = buildPostSearchParams(
    '',
    filters,
    'did:plc:viewer',
    'top'
  );
  assert.deepEqual(params.authors, ['did:plc:viewer']);
  assert.equal(params.sort, 'top');
  assert.equal(params.query, undefined);
  assert.equal(params.following, undefined);
});

test('history stores plain searches plainly and filtered searches structurally', () => {
  assert.equal(serializeSearchEntry('  tea  ', EMPTY_SEARCH_FILTERS), 'tea');
  assert.deepEqual(parseSearchEntry('tea'), {
    q: 'tea',
    filters: EMPTY_SEARCH_FILTERS,
  });

  const filtered = cleanSearchFilters({
    authors: '@alice',
    hashtags: '#tea',
    media: 'media',
    replies: 'none',
  });
  const stored = serializeSearchEntry(' tea ', filtered);
  assert.ok(stored.startsWith('{'));
  const parsed = parseSearchEntry(stored);
  assert.equal(parsed.q, 'tea');
  assert.equal(parsed.filters.authors, 'alice');
  assert.equal(parsed.filters.hashtags, 'tea');
  assert.equal(parsed.filters.media, 'media');
  assert.equal(parsed.filters.replies, 'none');
});

test('history moves repeats to the front, caps at eight, and survives bad input', () => {
  let history = [];
  history = addSearchHistory(history, 'tea', EMPTY_SEARCH_FILTERS);
  history = addSearchHistory(history, 'coffee', EMPTY_SEARCH_FILTERS);
  history = addSearchHistory(history, 'tea', EMPTY_SEARCH_FILTERS);
  assert.deepEqual(history, ['tea', 'coffee']);

  for (let index = 0; index < 12; index += 1) {
    history = addSearchHistory(history, `query-${index}`, EMPTY_SEARCH_FILTERS);
  }
  assert.equal(history.length, 8);
  assert.equal(history[0], 'query-11');

  assert.equal(parseSearchEntry('{not json').q, '{not json');
  assert.deepEqual(parseSearchEntry('{"q": 4}'), {
    q: '{"q": 4}',
    filters: EMPTY_SEARCH_FILTERS,
  });
  assert.equal(parseSearchEntry('').q, '');
});

test('search scopes are exact, include every destination RPC and omit the v1 search call', () => {
  const metadata = JSON.parse(
    readFileSync(new URL('../oauth-client-metadata.json', import.meta.url), 'utf8')
  );
  const tokens = metadata.scope.split(/\s+/).filter(Boolean);
  const audience = 'aud=did:web:api.bsky.app#bsky_appview';
  assert.equal(tokens.length, 111);
  assert.equal(/repo:\*|rpc:\*|blob:\*/.test(metadata.scope), false);

  for (const method of [
    'app.bsky.feed.searchPostsV2',
    'app.bsky.feed.getFeed',
    'app.bsky.feed.getFeedGenerator',
    'app.bsky.feed.getFeedGenerators',
    'app.bsky.graph.getStarterPack',
    'app.bsky.graph.searchStarterPacksV2',
    'app.bsky.unspecced.getPopularFeedGenerators',
  ]) {
    assert.equal(
      tokens.includes(`rpc:${method}?${audience}`),
      true,
      method
    );
  }
  assert.equal(
    tokens.includes(`rpc:app.bsky.feed.searchPosts?${audience}`),
    false
  );
});
