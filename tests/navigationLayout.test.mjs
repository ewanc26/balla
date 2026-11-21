import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DESKTOP_MIN_WIDTH,
  RIGHT_RAIL_MIN_WIDTH,
  navigationLayout,
} from '../src/lib/layout.ts';

test('exactly one primary navigation surface is visible at any width', () => {
  for (const width of [320, 600, 999, DESKTOP_MIN_WIDTH, 1200, RIGHT_RAIL_MIN_WIDTH, 2000]) {
    const layout = navigationLayout(width);
    assert.equal(
      layout.leftRail || layout.bottomTabs,
      true,
      `no primary navigation at ${width}px`
    );
    assert.equal(
      layout.leftRail && layout.bottomTabs,
      false,
      `duplicated navigation at ${width}px`
    );
  }
});

test('rails appear at their documented breakpoints', () => {
  assert.deepEqual(navigationLayout(500), {
    leftRail: false,
    rightRail: false,
    bottomTabs: true,
  });
  assert.deepEqual(navigationLayout(DESKTOP_MIN_WIDTH), {
    leftRail: true,
    rightRail: false,
    bottomTabs: false,
  });
  assert.deepEqual(navigationLayout(RIGHT_RAIL_MIN_WIDTH), {
    leftRail: true,
    rightRail: true,
    bottomTabs: false,
  });
});
