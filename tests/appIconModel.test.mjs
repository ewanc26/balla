import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APP_ICON_CHOICES,
  choiceForNativeName,
  isAppIconChoice,
  nativeNameForChoice,
} from '../src/lib/appIconModel.ts';

test('only the default and dark device-local icons are offered', () => {
  assert.deepEqual(
    APP_ICON_CHOICES.map((choice) => choice.value),
    ['default', 'dark'],
  );
  assert.ok(APP_ICON_CHOICES.every((choice) => choice.label && choice.detail));
});

test('the default choice resets the OS icon and dark uses the baked alias', () => {
  assert.equal(nativeNameForChoice('default'), null);
  assert.equal(nativeNameForChoice('dark'), 'Dark');
});

test('OS icon names map back to choices without trusting internal variants', () => {
  assert.equal(choiceForNativeName(null), 'default');
  assert.equal(choiceForNativeName('DEFAULT'), 'default');
  assert.equal(choiceForNativeName('Dark'), 'dark');
  assert.equal(choiceForNativeName('dark'), 'dark');
  assert.equal(choiceForNativeName('core_aurora'), 'default');
  assert.equal(choiceForNativeName(undefined), 'default');
});

test('invalid persisted or route values are rejected', () => {
  assert.equal(isAppIconChoice('default'), true);
  assert.equal(isAppIconChoice('dark'), true);
  assert.equal(isAppIconChoice('core_aurora'), false);
  assert.equal(isAppIconChoice(null), false);
  assert.equal(isAppIconChoice(undefined), false);
});
