import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform } from 'react-native';
import {
  FOCUSABLE_SELECTOR,
  accessibilityStyleId,
  focusStep,
  webAccessibilityCss,
} from './accessibilityModel';

export {
  dialogAccessibilityProps,
  dialogAnimation,
  FOCUSABLE_SELECTOR,
  focusStep,
  MIN_TOUCH_TARGET,
  scalableTextStyle,
  sheetAnimation,
  touchTargetStyle,
  webAccessibilityCss,
} from './accessibilityModel';

/**
 * One place for the web/browser behaviour that React Native does not provide
 * as a cross-platform prop: a keyboard-only focus ring, a reduced-motion
 * override, dialog focus order and Escape handling. Native screen-reader
 * semantics stay with `accessibilityRole`, `accessibilityLabel` and
 * `accessibilityState` at each call site; these hooks only supply behaviour
 * those props cannot describe.
 */

/**
 * RN Web forwards `aria-*` attributes but does not translate the cross-platform
 * `accessibilityState.checked` into `aria-checked`. Spread this alongside that
 * state so a checkbox announces whether it is selected in a browser as well as
 * through its native accessibility state.
 */
export function webCheckedProps(checked: boolean): any {
  return { 'aria-checked': checked };
}

/** Idempotent: safe to call on every palette change. */
export function installWebAccessibility(accent: string): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  let style = document.getElementById(accessibilityStyleId);
  if (!style) {
    style = document.createElement('style');
    style.id = accessibilityStyleId;
    document.head.appendChild(style);
  }
  const css = webAccessibilityCss(accent);
  if (style.textContent !== css) style.textContent = css;
}

/**
 * Tracks the platform reduced-motion setting, including changes made while the
 * app is open. RN Web implements the same API over `prefers-reduced-motion`.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduced(enabled);
      })
      .catch(() => setReduced(false));
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled) => setReduced(enabled)
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

type DialogFocusOptions = {
  visible: boolean;
  onClose: () => void;
  // RN Web forwards a DOM node, native a host component; both are opaque here.
  containerRef: RefObject<any>;
  initialFocusRef?: RefObject<any>;
};

/**
 * Give a modal a predictable focus order: focus its first labelled control on
 * open, keep Tab inside it, close on Escape, and return focus to the control
 * that opened it. On native, move screen-reader focus to the dialog container.
 */
export function useDialogFocus({
  visible,
  onClose,
  containerRef,
  initialFocusRef,
}: DialogFocusOptions): void {
  // Keep the latest close handler without refocusing the dialog on every
  // render: callers often pass an inline `close` function.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!visible) return;

    if (Platform.OS !== 'web') {
      const tag = findNodeHandle(containerRef.current);
      if (tag != null) AccessibilityInfo.setAccessibilityFocus(tag);
      return;
    }
    if (typeof document === 'undefined') return;

    const container = containerRef.current as unknown as HTMLElement | null;
    if (!container) return;
    const opener = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((node) => node.getClientRects().length > 0);

    const initial = (initialFocusRef?.current as unknown as
      | { focus?: () => void }
      | null) || focusable()[0] || container;
    initial.focus?.();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const nodes = focusable();
      const index = nodes.indexOf(document.activeElement as HTMLElement);
      const target = focusStep(nodes.length, index, event.shiftKey);
      if (!nodes.length) {
        event.preventDefault();
        container.focus?.();
      } else if (!nodes[target]?.contains(document.activeElement as Node)) {
        // Always keep Tab inside the dialog, including from the container.
        event.preventDefault();
        nodes[target].focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (opener && document.contains(opener)) opener.focus?.();
    };
  }, [visible, containerRef, initialFocusRef]);
}
