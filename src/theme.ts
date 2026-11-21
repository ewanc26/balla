import { useColorScheme } from 'react-native';

// Facebook's current chrome is a light grey canvas with white, lightly raised
// cards and a blue reserved for actions. Dark mode keeps the same hierarchy.
export const palettes = {
  light: {
    bg: '#F0F2F5', // Facebook's warm grey canvas
    card: '#FFFFFF',
    text: '#050505',
    secondary: '#65676B',
    divider: '#E4E6EB',
    soft: '#E4E6EB',
    accent: '#1877F2', // that blue
    accentSoft: '#E7F3FF',
    danger: '#E41E3F',
    green: '#31A24C',
    overlay: 'rgba(0, 0, 0, 0.45)',
  },
  dark: {
    bg: '#18191A',
    card: '#242526',
    text: '#E4E6EB',
    secondary: '#B0B3B8',
    divider: '#3A3B3C',
    soft: '#3A3B3C',
    accent: '#2D88FF',
    accentSoft: '#263951',
    danger: '#F02849',
    green: '#3FB65B',
    overlay: 'rgba(0, 0, 0, 0.65)',
  },
};

export const CARD_RADIUS = 8;

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

export type Palette = typeof palettes.light;

export function usePalette(): Palette {
  const scheme = useColorScheme();
  return scheme === 'dark' ? palettes.dark : palettes.light;
}
