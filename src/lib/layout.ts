// Facebook hides its side rails on narrow windows and keeps only the feed.
// The same breakpoints decide when Balla swaps its bottom tabs for the rails.
export const DESKTOP_MIN_WIDTH = 1000;
export const RIGHT_RAIL_MIN_WIDTH = 1300;

/** The reading column is capped at every width, not just beside the rails. */
export const READING_COLUMN_MAX_WIDTH = 680;

/** Header search needs room for the pill as well as the centred rails. */
export const HEADER_SEARCH_MIN_WIDTH = 1200;

/** Below this width the Notifications tab label is shortened so it is not clipped. */
export const COMPACT_TAB_LABEL_MAX_WIDTH = 400;

/** The bottom bar's height at the default font scale, excluding the safe-area inset. */
export const TAB_BAR_BASE_HEIGHT = 64;

/**
 * The bottom bar's height at the current system font scale, excluding the
 * device's bottom safe-area inset. The bar's paddings are fixed (6pt above,
 * 10pt below), so the default bar leaves 48pt of content box; the 24pt icon
 * and its 2pt label gap leave a 22pt budget for the label, whose 10pt line
 * height is about 12pt per unit of font scale. Above that budget a
 * fixed-height bar clips the label's lower half instead of wrapping it
 * (#190), so the bar grows by the deficit plus a 2pt cushion for font-metric
 * jitter, and never shrinks below the default look.
 */
export function tabBarHeight(fontScale: number): number {
  const scaledLabelLine = Math.ceil(12 * fontScale);
  const deficit = 26 + scaledLabelLine + 2 - (TAB_BAR_BASE_HEIGHT - 16);
  return TAB_BAR_BASE_HEIGHT + Math.max(0, deficit);
}

export type NavigationLayout = {
  leftRail: boolean;
  rightRail: boolean;
  bottomTabs: boolean;
};

export type ReplyIndent = {
  marginLeft: number;
  paddingLeft: number;
  maxDepth: number;
};

/**
 * Exactly one primary navigation surface is shown. The header carries the brand
 * and search on desktop, plus direct action buttons (feeds, lists, settings) on
 * narrow screens — never a third copy of the tab list.
 */
export function navigationLayout(width: number): NavigationLayout {
  const leftRail = width >= DESKTOP_MIN_WIDTH;
  return {
    leftRail,
    rightRail: width >= RIGHT_RAIL_MIN_WIDTH,
    bottomTabs: !leftRail,
  };
}

/**
 * Reply connectors are a reading cue, not a second card gutter. On a phone the
 * desktop budget would leave deep replies only a few words wide, so use a
 * tighter indent and stop nesting sooner. The role label still states the real
 * depth for screen readers.
 */
export function replyIndent(width: number): ReplyIndent {
  return width < DESKTOP_MIN_WIDTH
    ? { marginLeft: 6, paddingLeft: 4, maxDepth: 2 }
    : { marginLeft: 12, paddingLeft: 8, maxDepth: 3 };
}
