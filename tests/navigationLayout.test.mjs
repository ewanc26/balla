import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  COMPACT_TAB_LABEL_MAX_WIDTH,
  DESKTOP_MIN_WIDTH,
  HEADER_SEARCH_MIN_WIDTH,
  READING_COLUMN_MAX_WIDTH,
  RIGHT_RAIL_MIN_WIDTH,
  navigationLayout,
  replyIndent,
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

test('the reading column and header breakpoints stay in one place', () => {
  assert.equal(READING_COLUMN_MAX_WIDTH, 680);
  assert.equal(DESKTOP_MIN_WIDTH, 1000);
  assert.equal(HEADER_SEARCH_MIN_WIDTH, 1200);
  assert.ok(
    HEADER_SEARCH_MIN_WIDTH > DESKTOP_MIN_WIDTH &&
      HEADER_SEARCH_MIN_WIDTH < RIGHT_RAIL_MIN_WIDTH,
    'header search should appear only when both the rail and the pill fit'
  );
  assert.ok(COMPACT_TAB_LABEL_MAX_WIDTH < DESKTOP_MIN_WIDTH);
});

test('the desktop right rail keeps its fixed width instead of stretching', () => {
  const rail = readFileSync(
    new URL('../src/components/AppRail.tsx', import.meta.url),
    'utf8'
  );
  assert.match(
    rail,
    /right: \{\s*width: 300,\s*flexGrow: 0,\s*flexShrink: 0,\s*flexBasis: 300,/
  );
});

test('reply indentation keeps a readable text column on phones', () => {
  const phone = replyIndent(320);
  const desktop = replyIndent(DESKTOP_MIN_WIDTH);
  const phoneWidth = phone.maxDepth * (phone.marginLeft + phone.paddingLeft);
  const desktopWidth = desktop.maxDepth * (desktop.marginLeft + desktop.paddingLeft);
  assert.ok(
    phoneWidth <= desktopWidth / 2,
    `phone reply gutter (${phoneWidth}px) should be far narrower than desktop's ${desktopWidth}px`
  );
  assert.equal(replyIndent(999).maxDepth, replyIndent(320).maxDepth);
  assert.equal(replyIndent(DESKTOP_MIN_WIDTH).maxDepth, desktop.maxDepth);
});
