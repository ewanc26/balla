/**
 * Framework-free accessibility rules. Kept free of React Native imports so the
 * regression tests can check them under Node's TypeScript loader.
 */

const STYLE_ID = 'balla-accessibility-styles';

/** The one minimum hit area for every tappable control, in density-independent points. */
export const MIN_TOUCH_TARGET = 44;

/** Reusable style fragment for controls that must keep a 44pt hit area. */
export const touchTargetStyle = {
  minWidth: MIN_TOUCH_TARGET,
  minHeight: MIN_TOUCH_TARGET,
};

/**
 * Let a label wrap and grow with the person's text-size setting instead of
 * being clipped by a fixed-width row. Text already scales by default in RN;
 * this removes the layout constraints that would otherwise cut it off.
 */
export const scalableTextStyle = {
  flexShrink: 1,
};

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]:not([aria-disabled="true"])',
  '[role="checkbox"]:not([aria-disabled="true"])',
  '[role="radio"]:not([aria-disabled="true"])',
  '[role="switch"]:not([aria-disabled="true"])',
  '[role="tab"]:not([aria-disabled="true"])',
  '[role="menuitem"]:not([aria-disabled="true"])',
].join(',');

export { STYLE_ID as accessibilityStyleId };

/** Pure copy for the injected web stylesheet. */
export function webAccessibilityCss(accent: string): string {
  return `
:focus:not(:focus-visible) {
  outline: none !important;
}
:focus-visible {
  outline: 3px solid ${accent} !important;
  outline-offset: 2px !important;
  border-radius: 4px;
}
/* Let interface text grow with the browser's font setting instead of being
   cut off by fixed-height chrome. Cards use minHeight so they expand too. */
.balla-scalable-text {
  flex-shrink: 1;
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`.trim();
}

/** Modals animate only when the person has not asked for reduced motion. */
export function dialogAnimation(reducedMotion: boolean): 'none' | 'fade' {
  return reducedMotion ? 'none' : 'fade';
}

/** Bottom sheets use the same rule but keep their native slide entrance. */
export function sheetAnimation(reducedMotion: boolean): 'none' | 'slide' {
  return reducedMotion ? 'none' : 'slide';
}

/** The next tab stop inside a dialog; -1 means there are no stops. */
export function focusStep(
  count: number,
  currentIndex: number,
  backwards: boolean
): number {
  if (count <= 0) return -1;
  if (backwards) return currentIndex <= 0 ? count - 1 : currentIndex - 1;
  return currentIndex < 0 || currentIndex >= count - 1 ? 0 : currentIndex + 1;
}

/** Common dialog semantics for the sheet/dialog container. */
export function dialogAccessibilityProps(label: string) {
  return {
    accessible: true,
    accessibilityRole: 'dialog' as const,
    accessibilityLabel: label,
    accessibilityModal: true,
    ...({ tabIndex: -1 } as Record<string, unknown>),
  };
}
