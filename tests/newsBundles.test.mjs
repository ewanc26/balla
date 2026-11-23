import test from 'node:test';
import assert from 'node:assert/strict';
import { countGraphemes } from 'unicode-segmenter/grapheme';
import {
  NEWS_CURATION,
  NEWS_REGIONS,
  bundleDescription,
  bundleName,
  findNewsTopic,
  loadNewsCuration,
  newsRegionLabel,
  parseNewsCuration,
  publishersForBundle,
  validateNewsBundleSelection,
} from '../src/lib/newsBundles.ts';
import {
  LIST_DESCRIPTION_MAX,
  LIST_NAME_MAX,
} from '../src/lib/listModel.ts';

test('the published news pack parses and keeps all five topics', () => {
  const state = loadNewsCuration();
  assert.equal(state.ok, true);
  assert.deepEqual(
    state.curation.topics.map((topic) => topic.id),
    ['politics', 'climate', 'culture', 'technology', 'sport']
  );
});

test('every topic has a global and regional roster of real accounts', () => {
  for (const topic of NEWS_CURATION.topics) {
    assert.ok(topic.publishers.length >= 8, `${topic.id} is too thin`);
    for (const region of NEWS_REGIONS) {
      const publishers = publishersForBundle(NEWS_CURATION, topic.id, region.id);
      assert.ok(
        publishers.length >= 2,
        `${topic.id} has fewer than two publishers for ${region.id}`
      );
      for (const publisher of publishers) {
        assert.match(publisher.did, /^did:(plc|web):[a-zA-Z0-9._:%-]+$/);
        assert.match(publisher.handle, /^[a-z0-9.-]+\.[a-z]{2,}$/);
        assert.ok(publisher.name.trim());
      }
    }
  }
});

test('global includes everyone while a region only claims local newsrooms', () => {
  const global = publishersForBundle(NEWS_CURATION, 'politics', 'global');
  const uk = publishersForBundle(NEWS_CURATION, 'politics', 'uk');
  const us = publishersForBundle(NEWS_CURATION, 'politics', 'us');
  const europe = publishersForBundle(NEWS_CURATION, 'politics', 'europe');

  assert.equal(global.length, uk.length + us.length + europe.length + 1);
  assert.ok(uk.every((publisher) => publisher.region === 'uk'));
  assert.ok(us.every((publisher) => publisher.region === 'us'));
  assert.ok(europe.every((publisher) => publisher.region === 'europe'));
  assert.equal(
    publishersForBundle(NEWS_CURATION, 'politics', 'unknown').length,
    0
  );
});

test('roster data names verified publishers rather than placeholders', () => {
  const politics = findNewsTopic(NEWS_CURATION, 'politics');
  assert.ok(politics);
  const nyt = politics.publishers.find(
    (publisher) => publisher.handle === 'nytimes.com'
  );
  assert.equal(nyt.did, 'did:plc:eclio37ymobqex2ncko63h4r');
  assert.equal(nyt.name, 'The New York Times');
  const guardian = politics.publishers.find(
    (publisher) => publisher.handle === 'theguardian.com'
  );
  assert.equal(guardian.did, 'did:plc:vovinwhtulbsx4mwfw26r5ni');
});

test('a topic never lists the same account twice', () => {
  for (const topic of NEWS_CURATION.topics) {
    const dids = topic.publishers.map((publisher) => publisher.did);
    const handles = topic.publishers.map((publisher) => publisher.handle);
    assert.equal(new Set(dids).size, dids.length, `${topic.id} repeats a DID`);
    assert.equal(
      new Set(handles).size,
      handles.length,
      `${topic.id} repeats a handle`
    );
  }
});

test('bundle names and descriptions stay inside the list limits', () => {
  for (const topic of NEWS_CURATION.topics) {
    for (const region of NEWS_REGIONS) {
      const name = bundleName(topic.name, region.id);
      assert.ok(countGraphemes(name) <= LIST_NAME_MAX, name);
      assert.match(name, /^News: /);
      assert.ok(name.includes(newsRegionLabel(region.id)));
    }
    const description = bundleDescription(topic);
    assert.ok(
      countGraphemes(description) <= LIST_DESCRIPTION_MAX,
      `${topic.id} description is too long`
    );
    assert.match(description, /newest-first/);
  }
});

test('bundle selection rejects routes outside the published pack', () => {
  assert.equal(validateNewsBundleSelection('politics', 'uk'), null);
  assert.match(
    validateNewsBundleSelection('opinion', 'uk'),
    /not part of the published news pack/
  );
  assert.match(
    validateNewsBundleSelection('politics', 'mars'),
    /not part of the published news pack/
  );
  assert.match(validateNewsBundleSelection(undefined, null), /not part/);
});

test('a missing or malformed pack fails closed with honest copy', () => {
  for (const input of [null, undefined, {}, { topics: [] }, { topics: 'x' }]) {
    const state = parseNewsCuration(input);
    assert.equal(state.ok, false);
    assert.match(state.error, /could not be read/);
  }
});

test('malformed entries never reach the picker or a write', () => {
  const copy = () => JSON.parse(JSON.stringify(NEWS_CURATION));

  const duplicateTopic = copy();
  duplicateTopic.topics.push(JSON.parse(JSON.stringify(duplicateTopic.topics[0])));
  assert.equal(parseNewsCuration(duplicateTopic).ok, false);

  const badDid = copy();
  badDid.topics[0].publishers[0].did = 'not-a-did';
  assert.equal(parseNewsCuration(badDid).ok, false);

  const unknownRegion = copy();
  unknownRegion.topics[0].publishers[0].region = 'mars';
  assert.equal(parseNewsCuration(unknownRegion).ok, false);

  const duplicatePublisher = copy();
  duplicatePublisher.topics[0].publishers.push(
    JSON.parse(JSON.stringify(duplicatePublisher.topics[0].publishers[0]))
  );
  assert.equal(parseNewsCuration(duplicatePublisher).ok, false);

  const emptyName = copy();
  emptyName.topics[0].name = '   ';
  assert.equal(parseNewsCuration(emptyName).ok, false);
});

test('the curation data carries no ranking or engagement input', () => {
  const serialised = JSON.stringify(NEWS_CURATION);
  assert.doesNotMatch(serialised, /"(score|rank|ranking|engagement|likeCount|repostCount)"/i);
  assert.doesNotMatch(serialised, /algorithm/i);
});
