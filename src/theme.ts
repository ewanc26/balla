import { useCallback, useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import {
  buildPalette,
  DEFAULT_THEME_CHOICE,
  normaliseThemeChoice,
  resolveScheme,
  scaleFontSize,
  type ColorScheme,
  type FontScaleId,
  type Palette as ThemePalette,
  type ThemeChoice,
} from './lib/themeModel';

let currentChoice: ThemeChoice = DEFAULT_THEME_CHOICE;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ThemeChoice {
  return currentChoice;
}

export function setThemeChoice(next: ThemeChoice): void {
  const normalised = normaliseThemeChoice(next);
  if (
    normalised.accent === currentChoice.accent &&
    normalised.era === currentChoice.era &&
    normalised.colourMode === currentChoice.colourMode &&
    normalised.darkTheme === currentChoice.darkTheme &&
    normalised.fontScale === currentChoice.fontScale
  ) {
    return;
  }
  currentChoice = normalised;
  for (const listener of listeners) listener();
}

export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export const palettes = {
  light: buildPalette('light', DEFAULT_THEME_CHOICE),
  dark: buildPalette('dark', DEFAULT_THEME_CHOICE),
};

export const CARD_RADIUS = 8;

// Deliberately outside the palettes: the mock preview strip must read as a
// warning in every era and scheme, never as a themed surface.
export const PREVIEW_WARNING = {
  background: '#F7B125',
  text: '#1C1E21',
} as const;

export const cardShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.1,
  shadowRadius: 2,
  elevation: 1,
} as const;

// React Native Web otherwise leaves the browser's blue focus ring on inputs,
// which breaks the flat Facebook field treatment.
export const webInputReset = { outlineStyle: 'none', outlineWidth: 0 } as any;

export type Palette = ThemePalette;

/** The platform scheme after the person's System/Light/Dark choice. */
export function useResolvedScheme(): ColorScheme {
  const system = useColorScheme();
  const { colourMode } = useThemeChoice();
  return resolveScheme(system === 'dark' ? 'dark' : 'light', colourMode);
}

export function usePalette(): Palette {
  const scheme = useResolvedScheme();
  const choice = useThemeChoice();
  return buildPalette(scheme, choice);
}

/** One font scale for post and composer text, set in Appearance. */
export function useFontScale(): (base: number) => number {
  const { fontScale } = useThemeChoice();
  return useCallback(
    (base: number) => scaleFontSize(base, fontScale),
    [fontScale]
  );
}

export type { FontScaleId };
