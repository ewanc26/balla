export type ColorScheme = 'light' | 'dark';

export type AccentId =
  | 'facebook'
  | 'navy'
  | 'teal'
  | 'green'
  | 'purple'
  | 'magenta'
  | 'red'
  | 'orange'
  | 'slate';

export type FacebookEraId =
  | 'thefacebook'
  | 'newsfeed'
  | 'timeline'
  | 'newfacebook';

export type ThemeChoice = {
  accent: AccentId;
  era: FacebookEraId;
};

export type AccentColour = {
  id: AccentId;
  label: string;
  light: string;
  dark: string;
  softLight: string;
  softDark: string;
};

export type EraBase = {
  bg: string;
  card: string;
  text: string;
  secondary: string;
  divider: string;
  soft: string;
  danger: string;
  green: string;
  overlay: string;
  chrome: string;
  chromeText: string;
  chromeMuted: string;
  chromeBorder: string;
  chromeField: string;
  chromePressed: string;
  chromeIsDark: boolean;
  chromeActionUsesAccent: boolean;
};

export type Palette = EraBase & {
  accent: string;
  accentSoft: string;
  onAccent: string;
  accentId: AccentId;
  era: FacebookEraId;
  chromeAction: string;
};

export type FacebookEra = {
  id: FacebookEraId;
  label: string;
  years: string;
  description: string;
  light: EraBase;
  dark: EraBase;
};

export const ACCENT_COLOURS: readonly AccentColour[] = [
  {
    id: 'facebook',
    label: 'Facebook blue',
    light: '#0866FF',
    dark: '#4599FF',
    softLight: '#F7FAFF',
    softDark: '#142B4A',
  },
  {
    id: 'navy',
    label: 'Classic navy',
    light: '#3B5998',
    dark: '#8FA9E8',
    softLight: '#E8EDF8',
    softDark: '#26344F',
  },
  {
    id: 'teal',
    label: 'Teal',
    light: '#00796B',
    dark: '#4DD0C4',
    softLight: '#E0F2F1',
    softDark: '#1D3A37',
  },
  {
    id: 'green',
    label: 'Green',
    light: '#2E7D32',
    dark: '#66BB6A',
    softLight: '#E8F5E9',
    softDark: '#233A24',
  },
  {
    id: 'purple',
    label: 'Purple',
    light: '#6A1B9A',
    dark: '#CE93D8',
    softLight: '#F3E5F5',
    softDark: '#3B2444',
  },
  {
    id: 'magenta',
    label: 'Magenta',
    light: '#C2185B',
    dark: '#F06292',
    softLight: '#FCE4EC',
    softDark: '#42232F',
  },
  {
    id: 'red',
    label: 'Red',
    light: '#C62828',
    dark: '#FF6B6B',
    softLight: '#FFEBEE',
    softDark: '#4A2525',
  },
  {
    id: 'orange',
    label: 'Orange',
    light: '#B45309',
    dark: '#FFB74D',
    softLight: '#FFF3E0',
    softDark: '#3D2C1A',
  },
  {
    id: 'slate',
    label: 'Slate',
    light: '#37474F',
    dark: '#B0BEC5',
    softLight: '#ECEFF1',
    softDark: '#2C3438',
  },
];

export const DEFAULT_THEME_CHOICE: ThemeChoice = {
  accent: 'facebook',
  era: 'newfacebook',
};

const THefacebook_LIGHT: EraBase = {
  bg: '#D8DFEA',
  card: '#FFFFFF',
  text: '#111827',
  secondary: '#4F5E7A',
  divider: '#B8C4D9',
  soft: '#E9EEF7',
  danger: '#B00020',
  green: '#2E7D32',
  overlay: 'rgba(0, 0, 0, 0.45)',
  chrome: '#3B5998',
  chromeText: '#FFFFFF',
  chromeMuted: '#E1E7F3',
  chromeBorder: '#2E477A',
  chromeField: 'rgba(255, 255, 255, 0.16)',
  chromePressed: 'rgba(255, 255, 255, 0.14)',
  chromeIsDark: true,
  chromeActionUsesAccent: false,
};

const THefacebook_DARK: EraBase = {
  bg: '#0E1420',
  card: '#1A2434',
  text: '#F3F5F9',
  secondary: '#B5C0D4',
  divider: '#32425B',
  soft: '#253249',
  danger: '#FF6B81',
  green: '#58D68D',
  overlay: 'rgba(0, 0, 0, 0.65)',
  chrome: '#1C2D4F',
  chromeText: '#FFFFFF',
  chromeMuted: '#D5DEEE',
  chromeBorder: '#314A75',
  chromeField: 'rgba(255, 255, 255, 0.13)',
  chromePressed: 'rgba(255, 255, 255, 0.11)',
  chromeIsDark: true,
  chromeActionUsesAccent: false,
};

const NEWS_FEED_LIGHT: EraBase = {
  bg: '#E9EBEE',
  card: '#FFFFFF',
  text: '#1D2129',
  secondary: '#616770',
  divider: '#DADDE1',
  soft: '#F0F2F5',
  danger: '#C62828',
  green: '#2E7D32',
  overlay: 'rgba(0, 0, 0, 0.45)',
  chrome: '#3B5998',
  chromeText: '#FFFFFF',
  chromeMuted: '#D8DFEA',
  chromeBorder: '#2F477A',
  chromeField: 'rgba(255, 255, 255, 0.16)',
  chromePressed: 'rgba(255, 255, 255, 0.14)',
  chromeIsDark: true,
  chromeActionUsesAccent: false,
};

const NEWS_FEED_DARK: EraBase = {
  bg: '#18191A',
  card: '#242526',
  text: '#E4E6EB',
  secondary: '#B0B3B8',
  divider: '#3A3B3C',
  soft: '#3A3B3C',
  danger: '#F02849',
  green: '#3FB65B',
  overlay: 'rgba(0, 0, 0, 0.65)',
  chrome: '#2A3E66',
  chromeText: '#FFFFFF',
  chromeMuted: '#C9D5E9',
  chromeBorder: '#1E2D4A',
  chromeField: 'rgba(255, 255, 255, 0.13)',
  chromePressed: 'rgba(255, 255, 255, 0.11)',
  chromeIsDark: true,
  chromeActionUsesAccent: false,
};

const TIMELINE_LIGHT: EraBase = {
  bg: '#F2F3F5',
  card: '#FFFFFF',
  text: '#1D2129',
  secondary: '#606770',
  divider: '#DADDE1',
  soft: '#EBEDF0',
  danger: '#C62828',
  green: '#2E7D32',
  overlay: 'rgba(0, 0, 0, 0.45)',
  chrome: '#29487D',
  chromeText: '#FFFFFF',
  chromeMuted: '#D8DFEA',
  chromeBorder: '#1D355F',
  chromeField: 'rgba(255, 255, 255, 0.15)',
  chromePressed: 'rgba(255, 255, 255, 0.13)',
  chromeIsDark: true,
  chromeActionUsesAccent: false,
};

const TIMELINE_DARK: EraBase = {
  bg: '#18191A',
  card: '#242526',
  text: '#E4E6EB',
  secondary: '#B0B3B8',
  divider: '#3A3B3C',
  soft: '#3A3B3C',
  danger: '#F02849',
  green: '#3FB65B',
  overlay: 'rgba(0, 0, 0, 0.65)',
  chrome: '#1E3358',
  chromeText: '#FFFFFF',
  chromeMuted: '#CFD9EA',
  chromeBorder: '#152543',
  chromeField: 'rgba(255, 255, 255, 0.12)',
  chromePressed: 'rgba(255, 255, 255, 0.10)',
  chromeIsDark: true,
  chromeActionUsesAccent: false,
};

const NEW_FACEBOOK_LIGHT: EraBase = {
  bg: '#F0F2F5',
  card: '#FFFFFF',
  text: '#050505',
  secondary: '#65676B',
  divider: '#E4E6EB',
  soft: '#E4E6EB',
  danger: '#E41E3F',
  green: '#31A24C',
  overlay: 'rgba(0, 0, 0, 0.45)',
  chrome: '#FFFFFF',
  chromeText: '#050505',
  chromeMuted: '#65676B',
  chromeBorder: '#E4E6EB',
  chromeField: '#F0F2F5',
  chromePressed: '#F0F2F5',
  chromeIsDark: false,
  chromeActionUsesAccent: true,
};

const NEW_FACEBOOK_DARK: EraBase = {
  bg: '#18191A',
  card: '#242526',
  text: '#E4E6EB',
  secondary: '#B0B3B8',
  divider: '#3A3B3C',
  soft: '#3A3B3C',
  danger: '#F02849',
  green: '#3FB65B',
  overlay: 'rgba(0, 0, 0, 0.65)',
  chrome: '#242526',
  chromeText: '#E4E6EB',
  chromeMuted: '#B0B3B8',
  chromeBorder: '#3A3B3C',
  chromeField: '#3A3B3C',
  chromePressed: '#3A3B3C',
  chromeIsDark: true,
  chromeActionUsesAccent: true,
};

export const FACEBOOK_ERAS: readonly FacebookEra[] = [
  {
    id: 'thefacebook',
    label: 'Thefacebook',
    years: '2004–2005',
    description: 'Pale blue canvas, navy chrome and flat white columns.',
    light: THefacebook_LIGHT,
    dark: THefacebook_DARK,
  },
  {
    id: 'newsfeed',
    label: 'News Feed',
    years: '2006–2010',
    description: 'A grey canvas under the classic blue bar that introduced the feed.',
    light: NEWS_FEED_LIGHT,
    dark: NEWS_FEED_DARK,
  },
  {
    id: 'timeline',
    label: 'Timeline',
    years: '2011–2019',
    description: 'Deeper blue chrome, white cards and a quiet grey canvas.',
    light: TIMELINE_LIGHT,
    dark: TIMELINE_DARK,
  },
  {
    id: 'newfacebook',
    label: 'New Facebook',
    years: '2020–present',
    description: 'White chrome, a soft grey canvas and the current card layout.',
    light: NEW_FACEBOOK_LIGHT,
    dark: NEW_FACEBOOK_DARK,
  },
];

export function isAccentId(value: unknown): value is AccentId {
  return ACCENT_COLOURS.some((colour) => colour.id === value);
}

export function isFacebookEraId(value: unknown): value is FacebookEraId {
  return FACEBOOK_ERAS.some((era) => era.id === value);
}

export function normaliseThemeChoice(value: unknown): ThemeChoice {
  const candidate =
    value && typeof value === 'object'
      ? (value as Partial<ThemeChoice>)
      : {};
  return {
    accent: isAccentId(candidate.accent)
      ? candidate.accent
      : DEFAULT_THEME_CHOICE.accent,
    era: isFacebookEraId(candidate.era)
      ? candidate.era
      : DEFAULT_THEME_CHOICE.era,
  };
}

export function accentFor(id: AccentId): AccentColour {
  return (
    ACCENT_COLOURS.find((colour) => colour.id === id) ||
    ACCENT_COLOURS[0]
  );
}

export function eraFor(id: FacebookEraId): FacebookEra {
  return (
    FACEBOOK_ERAS.find((era) => era.id === id) ||
    FACEBOOK_ERAS[FACEBOOK_ERAS.length - 1]
  );
}

export function buildPalette(
  scheme: ColorScheme,
  choice: ThemeChoice
): Palette {
  const accent = accentFor(choice.accent);
  const era = eraFor(choice.era);
  const base = era[scheme];
  const accentColor = scheme === 'dark' ? accent.dark : accent.light;
  const darkInk = '#111827';
  const onAccent =
    contrastRatio('#FFFFFF', accentColor) >=
    contrastRatio(darkInk, accentColor)
      ? '#FFFFFF'
      : darkInk;
  return {
    ...base,
    accent: accentColor,
    accentSoft: scheme === 'dark' ? accent.softDark : accent.softLight,
    onAccent,
    accentId: accent.id,
    era: era.id,
    chromeAction: base.chromeActionUsesAccent
      ? accentColor
      : base.chromeText,
  };
}

function channel(value: number): number {
  const normal = value / 255;
  return normal <= 0.03928
    ? normal / 12.92
    : Math.pow((normal + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(hex: string): number {
  const value = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}
