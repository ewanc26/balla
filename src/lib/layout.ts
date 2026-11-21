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
