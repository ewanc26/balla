import test from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  FOCUSABLE_SELECTOR,
  MIN_TOUCH_TARGET,
  dialogAccessibilityProps,
  dialogAnimation,
  focusStep,
  scalableTextStyle,
  sheetAnimation,
  touchTargetStyle,
  webAccessibilityCss,
} from '../src/lib/accessibilityModel.ts';

test('the web focus ring is keyboard-only and uses the supplied palette colour', () => {
  const css = webAccessibilityCss('#123456');
  assert.match(css, /:focus-visible\s*\{/);
  assert.match(css, /outline:\s*3px solid #123456 !important/);
  assert.match(css, /outline-offset:\s*2px !important/);
  assert.match(css, /:focus:not\(:focus-visible\)/);
});

test('the web stylesheet honours prefers-reduced-motion', () => {
  const css = webAccessibilityCss('#123456');
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /transition-duration:\s*0\.01ms !important/);
  assert.match(css, /animation-duration:\s*0\.01ms !important/);
});

test('dialogs and sheets skip animation when reduced motion is requested', () => {
  assert.equal(dialogAnimation(false), 'fade');
  assert.equal(dialogAnimation(true), 'none');
  assert.equal(sheetAnimation(false), 'slide');
  assert.equal(sheetAnimation(true), 'none');
});

test('dialog focus stays inside an open sheet in both directions', () => {
  assert.equal(focusStep(0, -1, false), -1);
  assert.equal(focusStep(3, -1, false), 0);
  assert.equal(focusStep(3, 2, false), 0);
  assert.equal(focusStep(3, 1, false), 2);
  assert.equal(focusStep(3, 0, true), 2);
  assert.equal(focusStep(3, -1, true), 2);
  assert.equal(focusStep(3, 2, true), 1);
});

test('dialog semantics include a dialog role, modal flag and focusable container', () => {
  const props = dialogAccessibilityProps('Choose a reason');
  assert.equal(props.accessibilityRole, 'dialog');
  assert.equal(props.accessibilityLabel, 'Choose a reason');
  assert.equal(props.accessibilityModal, true);
  assert.equal(props.tabIndex, -1);
});

test('the focus trap covers labelled custom controls as well as native inputs', () => {
  for (const selector of [
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    '[role="button"]:not([aria-disabled="true"])',
    '[role="checkbox"]:not([aria-disabled="true"])',
    '[role="radio"]:not([aria-disabled="true"])',
    '[role="switch"]:not([aria-disabled="true"])',
    '[role="tab"]:not([aria-disabled="true"])',
    '[role="menuitem"]:not([aria-disabled="true"])',
    '[tabindex]:not([tabindex="-1"])',
  ]) {
    assert.ok(FOCUSABLE_SELECTOR.includes(selector));
  }
});

test('every tap target shares the one 44pt minimum', () => {
  assert.equal(MIN_TOUCH_TARGET, 44);
  assert.equal(touchTargetStyle.minWidth, 44);
  assert.equal(touchTargetStyle.minHeight, 44);
});

test('labels are allowed to shrink and wrap rather than clip', () => {
  assert.equal(scalableTextStyle.flexShrink, 1);
});

test('every dialog manages focus and names itself', () => {
  const root = new URL('../src/', import.meta.url);
  const dialogs = readdirSync(root, { recursive: true })
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => [file, readFileSync(new URL(file, root), 'utf8')])
    .filter(([, source]) => /<Modal\b/.test(source));
  assert.ok(dialogs.length >= 20, `found ${dialogs.length}`);
  for (const [file, source] of dialogs) {
    const count = source.match(/<Modal\b/g).length;
    assert.equal(source.match(/useDialogFocus\(/g)?.length, count, `${file} focus`);
    assert.equal(source.match(/dialogAccessibilityProps\(/g)?.length, count, `${file} name`);
    assert.equal(source.match(/onRequestClose/g)?.length, count, `${file} dismissal`);
  }
});
