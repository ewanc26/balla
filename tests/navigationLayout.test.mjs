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
  tabBarHeight,
  TAB_BAR_PADDING_BOTTOM,
  TAB_BAR_PADDING_TOP,
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

// Read from the installed library, so an upgrade that changes either fact
// fails here instead of clipping labels again.
const tabViews = '../node_modules/@react-navigation/bottom-tabs/src/views/';
const library = (file) => readFileSync(new URL(tabViews + file, import.meta.url), 'utf8');
const itemPadding = Number(
  library('BottomTabItem.tsx').match(/tabVerticalUiKit: \{[^}]*?padding: (\d+),/)[1],
);
const iconSlot = Number(library('TabBarIcon.tsx').match(/const ICON_SIZE_TALL = (\d+);/)[1]);

test('the height model matches the tab item React Navigation draws', () => {
  assert.equal(itemPadding, 5);
  assert.equal(iconSlot, 28);
  assert.match(library('TabBarIcon.tsx'), /wrapperUikit: \{\s*width: ICON_SIZE_WIDE,\s*height: ICON_SIZE_TALL,/);
  // Balla leaves the variant at its default on every platform.
  assert.match(library('BottomTabBar.tsx'), /tabBarVariant = 'uikit',/);
  assert.doesNotMatch(
    readFileSync(new URL('../App.tsx', import.meta.url), 'utf8'),
    /tabBarVariant/,
  );
});

test('the bottom bar keeps its default height at and below normal font scales', () => {
  assert.equal(tabBarHeight(0.85), 64);
  assert.equal(tabBarHeight(1), 64);
});

test('the bottom bar grows with the system font scale so a tab label is never clipped (#190)', () => {
  assert.equal(tabBarHeight(1.5), 70);
  assert.equal(tabBarHeight(2), 76);
  assert.equal(tabBarHeight(3), 88);
  for (let scale = 0.85; scale <= 4; scale += 0.05) {
    const height = tabBarHeight(scale);
    const scaledLabelLine = Math.ceil(12 * scale);
    assert.ok(
      height >= 64,
      `the bar must never shrink below 64pt (got ${height} at font scale ${scale})`
    );
    // What is left for the label once the bar padding, React Navigation's
    // item padding, its icon slot and the 2pt label gap are taken out.
    const labelRoom =
      height - TAB_BAR_PADDING_TOP - TAB_BAR_PADDING_BOTTOM - 2 * itemPadding - iconSlot - 2;
    assert.ok(
      labelRoom >= scaledLabelLine,
      `a ${height}pt bar leaves ${labelRoom}pt for a ${scaledLabelLine}pt label at font scale ${scale}`
    );
    assert.ok(
      height <= 64 + scaledLabelLine,
      `the bar grew by more than the label at font scale ${scale}`
    );
  }
});

test('the tab bar paddings match the ones the height model assumes', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.equal(TAB_BAR_PADDING_TOP, 6);
  assert.equal(TAB_BAR_PADDING_BOTTOM, 4);
  assert.match(app, /paddingTop: TAB_BAR_PADDING_TOP,/);
  assert.match(app, /paddingBottom: insets\.bottom \+ TAB_BAR_PADDING_BOTTOM,/);
});

test('the web header back control is a labelled 44pt button, and Tabs is named by its focused tab', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const back = readFileSync(new URL('../src/components/HeaderBack.tsx', import.meta.url), 'utf8');
  assert.match(app, /canGoBack \? <HeaderBack onPress=\{navigation\.goBack\} \/> : null/);
  assert.match(app, /title: getFocusedRouteNameFromRoute\(route\) \?\? initialTab,/);
  assert.match(back, /\.\.\.touchTargetStyle,/);
  assert.match(back, /accessibilityLabel="Back"/);
});

test('the tab bar consumes the font-scale-aware height', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /const \{ width, fontScale \} = useWindowDimensions\(\);/);
  assert.match(app, /height: tabBarHeight\(fontScale\) \+ insets\.bottom,/);
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
