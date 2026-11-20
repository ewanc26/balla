import { useColorScheme } from 'react-native';

export const palettes = {
  light: {
    bg: '#F0F2F5', // Facebook's warm grey canvas
    card: '#FFFFFF',
    text: '#050505',
    secondary: '#65676B',
    divider: '#E4E6EB',
    accent: '#1877F2', // that blue
    danger: '#E41E3F',
    green: '#31A24C',
  },
  dark: {
    bg: '#18191A',
    card: '#242526',
    text: '#E4E6EB',
    secondary: '#B0B3B8',
    divider: '#3A3B3C',
    accent: '#2D88FF',
    danger: '#E41E3F',
    green: '#3FB65B',
  },
};

export type Palette = typeof palettes.light;

export function usePalette(): Palette {
  const scheme = useColorScheme();
  return scheme === 'dark' ? palettes.dark : palettes.light;
}
