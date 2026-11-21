import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeDraft,
  hasDraftContent,
  parseStoredDraft,
  serialiseDraft,
} from '../src/lib/draftModel.ts';
import { DEFAULT_INTERACTION_GATES } from '../src/lib/interactionGates.ts';

const at = '2026-11-21T12:00:00.000Z';

test('a saved draft round-trips through JSON', () => {
  const draft = {
    text: 'A half-written post',
    selfLabels: ['spoiler'],
    languages: ['en', 'gd'],
    gates: { reply: 'followers', quote: 'nobody' },
    savedAt: at,
  };
  assert.deepEqual(parseStoredDraft(serialiseDraft(draft)), draft);
});

test('empty or invalid input has nothing to recover', () => {
  assert.equal(parseStoredDraft(null), null);
  assert.equal(parseStoredDraft(''), null);
  assert.equal(parseStoredDraft('not json'), null);
  assert.equal(parseStoredDraft('42'), null);
  assert.equal(parseStoredDraft(JSON.stringify({ text: '   ' })), null);
  assert.equal(parseStoredDraft(JSON.stringify({ text: '', gates: DEFAULT_INTERACTION_GATES })), null);
});

test('malformed fields are normalised, not trusted', () => {
  const draft = parseStoredDraft(
    JSON.stringify({
      text: 42,
      selfLabels: [' spoiler ', 'spoiler', 7, ''],
      languages: ['en', 'en', 'zz', 'fr', 'de', 'es'],
      gates: { reply: 'banana', quote: 'maybe' },
      savedAt: 99,
    })
  );
  assert.equal(draft.text, '');
  assert.deepEqual(draft.selfLabels, ['spoiler']);
  assert.deepEqual(draft.languages, ['en', 'zz', 'fr']);
  assert.deepEqual(draft.gates, DEFAULT_INTERACTION_GATES);
  assert.equal(draft.savedAt, '');
});

test('settings alone are worth recovering', () => {
  assert.equal(hasDraftContent({ text: '', selfLabels: [], languages: [], gates: { reply: 'nobody', quote: 'everyone' }, savedAt: at }), true);
  assert.equal(hasDraftContent({ text: '', selfLabels: [], languages: [], gates: DEFAULT_INTERACTION_GATES, savedAt: at }), false);
  assert.equal(hasDraftContent(null), false);
});

test('the prompt description is honest and bounded', () => {
  const long = 'x'.repeat(120);
  assert.equal(describeDraft({ text: long, selfLabels: [], languages: [], gates: DEFAULT_INTERACTION_GATES, savedAt: at }), `${'x'.repeat(80)}…`);
  assert.equal(
    describeDraft({ text: 'hi', selfLabels: ['a', 'b'], languages: ['en'], gates: DEFAULT_INTERACTION_GATES, savedAt: at }),
    'hi · 2 content warnings · 1 language'
  );
  assert.equal(describeDraft({ text: '', selfLabels: [], languages: [], gates: DEFAULT_INTERACTION_GATES, savedAt: at }), '');
});
