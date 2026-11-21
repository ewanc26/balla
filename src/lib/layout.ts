// Facebook hides its side rails on narrow windows and keeps only the feed.
// The same breakpoints decide when Balla swaps its bottom tabs for the rails.
export const DESKTOP_MIN_WIDTH = 1000;
export const RIGHT_RAIL_MIN_WIDTH = 1300;

export type NavigationLayout = {
  leftRail: boolean;
  rightRail: boolean;
  bottomTabs: boolean;
};

/**
 * Exactly one primary navigation surface is shown. The header carries only
 * the brand, search and (on narrow screens) settings — never a third copy of
 * the tab list.
 */
export function navigationLayout(width: number): NavigationLayout {
  const leftRail = width >= DESKTOP_MIN_WIDTH;
  return {
    leftRail,
    rightRail: width >= RIGHT_RAIL_MIN_WIDTH,
    bottomTabs: !leftRail,
  };
}
