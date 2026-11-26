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

/** The bar's own padding; the safe-area inset is added below it. */
export const TAB_BAR_PADDING_TOP = 6;
export const TAB_BAR_PADDING_BOTTOM = 4;

// Fixed by React Navigation's bottom tab item: 5pt padding on each side, a
// 28pt icon slot, and Balla's 2pt gap above the label.
const TAB_ITEM_CHROME = 10 + 28 + 2;

/**
 * The bottom bar's height at the current system font scale, excluding the
 * device's bottom safe-area inset. The label gets what the paddings, the item's
 * own padding and the icon slot leave over; its 10pt line is about 12pt per
 * unit of font scale. With less than that the label is clipped instead of
 * wrapping (#190), so the bar grows by the deficit plus a 2pt cushion for
 * font-metric jitter, and never shrinks below the default look.
 */
export function tabBarHeight(fontScale: number): number {
  const needed =
    TAB_BAR_PADDING_TOP +
    TAB_BAR_PADDING_BOTTOM +
    TAB_ITEM_CHROME +
    Math.ceil(12 * fontScale) +
    2;
  return Math.max(TAB_BAR_BASE_HEIGHT, needed);
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
