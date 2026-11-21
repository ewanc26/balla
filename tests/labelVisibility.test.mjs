import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accountLabelCauses,
  hiddenByLabel,
  warnedByLabel,
} from '../src/lib/labelVisibility.ts';

test('only a hide preference counts as a hidden account', () => {
  assert.equal(hiddenByLabel({ filter: true }), true);
  assert.equal(hiddenByLabel({ blur: true, alert: false }), false);
  assert.equal(hiddenByLabel({ alert: true }), false);
  assert.equal(hiddenByLabel({ inform: true }), false);
  assert.equal(hiddenByLabel(null), false);
});

test('warn preferences produce a warning, never a hide', () => {
  const blur = { blur: true, alert: false };
  const alert = { blur: false, alert: true };
  assert.equal(warnedByLabel(null, blur, null), true);
  assert.equal(warnedByLabel(null, alert), true);
  assert.equal(warnedByLabel({ inform: true }, { noOverride: true }), false);
});

test('identity warnings use only account or profile label causes', () => {
  const causes = [
    { type: 'label', target: 'account', label: { val: 'porn' } },
    { type: 'label', target: 'profile', label: { val: 'nudity' } },
    { type: 'label', target: 'content', label: { val: 'graphic-media' } },
    { type: 'muted' },
  ];
  assert.deepEqual(
    accountLabelCauses(causes).map((cause) => cause.label.val),
    ['porn', 'nudity']
  );
  assert.deepEqual(accountLabelCauses(undefined), []);
});
