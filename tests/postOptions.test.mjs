import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LANGUAGE_OPTIONS,
  MAX_POST_LANGUAGES,
  SELF_LABEL_OPTIONS,
  buildSelfLabels,
  isValidLanguage,
  isValidSelfLabel,
  languageSummary,
  normaliseLanguages,
  normaliseSelfLabels,
} from '../src/lib/postOptions.ts';

test('self-label values are the four Bluesky publishes, with no invented ones', () => {
  assert.deepEqual(
    SELF_LABEL_OPTIONS.map((option) => option.value),
    ['sexual', 'nudity', 'porn', 'graphic-media']
  );
  assert.ok(isValidSelfLabel('graphic-media'));
  assert.ok(!isValidSelfLabel('spoiler'));
});

test('languages are real BCP-47 codes and the limit is three', () => {
  assert.equal(MAX_POST_LANGUAGES, 3);
  for (const option of LANGUAGE_OPTIONS) {
    assert.ok(isValidLanguage(option.code), `${option.code} is in the list`);
    assert.match(option.code, /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/);
  }
  assert.ok(!isValidLanguage('klingon'));
});

test('normalising labels and languages drops unknown and repeated values in order', () => {
  assert.deepEqual(
    normaliseSelfLabels(['porn', 'unknown', 'porn', 'nudity']),
    ['porn', 'nudity']
  );
  assert.deepEqual(
    normaliseLanguages(['en-GB', 'gd', 'bogus', 'en-GB', 'fr', 'de']),
    ['en-GB', 'gd', 'fr']
  );
});

test('self labels use the com.atproto label lexicon and omit an empty set', () => {
  assert.equal(buildSelfLabels([]), undefined);
  assert.equal(buildSelfLabels(['not-a-label']), undefined);
  assert.deepEqual(buildSelfLabels(['porn', 'graphic-media']), {
    $type: 'com.atproto.label.defs#selfLabels',
    values: [
      { $type: 'com.atproto.label.defs#selfLabel', val: 'porn' },
      { $type: 'com.atproto.label.defs#selfLabel', val: 'graphic-media' },
    ],
  });
});

test('the language summary is honest and stays within the cap', () => {
  assert.equal(languageSummary([]), 'Language');
  assert.equal(languageSummary(['en-GB']), 'English (UK)');
  assert.equal(languageSummary(['en', 'fr']), 'English + Français');
  assert.equal(languageSummary(['en', 'fr', 'gd', 'de']), 'English + Français + Gàidhlig');
});
