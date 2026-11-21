import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import {
  buildPalette,
  DEFAULT_THEME_CHOICE,
  normaliseThemeChoice,
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
    normalised.era === currentChoice.era
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

export function usePalette(): Palette {
  const scheme = useColorScheme();
  const choice = useThemeChoice();
  return buildPalette(scheme === 'dark' ? 'dark' : 'light', choice);
}
