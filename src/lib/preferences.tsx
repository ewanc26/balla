import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setThemeChoice } from '../theme';
import { normaliseLanguages } from './postOptions';
import {
  normaliseThemeChoice,
  type AccentId,
  type ColourMode,
  type FacebookEraId,
  type FontScaleId,
} from './themeModel';

const STORAGE_KEY = 'balla.preferences.v1';

/**
 * Local, device-only choices. None of these are invented server preferences:
 * Bluesky has no app-language or font-size record, so pretending otherwise
 * would make a setting look synced when it is not.
 */
export type AppPreferences = {
  requireAltText: boolean;
  largerAltBadges: boolean;
  accent: AccentId;
  era: FacebookEraId;
  colourMode: ColourMode;
  fontScale: FontScaleId;
  primaryLanguage: string;
  contentLanguages: string[];
};

export const DEFAULT_PREFERENCES: AppPreferences = {
  requireAltText: false,
  largerAltBadges: false,
  accent: 'facebook',
  era: 'newfacebook',
  colourMode: 'system',
  fontScale: 'default',
  primaryLanguage: 'en',
  contentLanguages: [],
};

type PreferencesContextValue = {
  preferences: AppPreferences;
  setRequireAltText: (value: boolean) => void;
  setLargerAltBadges: (value: boolean) => void;
  setAccent: (value: AccentId) => void;
  setEra: (value: FacebookEraId) => void;
  setColourMode: (value: ColourMode) => void;
  setFontScale: (value: FontScaleId) => void;
  setPrimaryLanguage: (value: string) => void;
  setContentLanguages: (value: string[]) => void;
};

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  setRequireAltText: () => {},
  setLargerAltBadges: () => {},
  setAccent: () => {},
  setEra: () => {},
  setColourMode: () => {},
  setFontScale: () => {},
  setPrimaryLanguage: () => {},
  setContentLanguages: () => {},
});

function parseStored(value: string | null): AppPreferences {
  if (!value) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(value);
    const theme = normaliseThemeChoice(parsed);
    return {
      requireAltText:
        typeof parsed?.requireAltText === 'boolean'
          ? parsed.requireAltText
          : DEFAULT_PREFERENCES.requireAltText,
      largerAltBadges:
        typeof parsed?.largerAltBadges === 'boolean'
          ? parsed.largerAltBadges
          : DEFAULT_PREFERENCES.largerAltBadges,
      accent: theme.accent,
      era: theme.era,
      colourMode: theme.colourMode,
      fontScale: theme.fontScale,
      primaryLanguage: normaliseLanguages([parsed?.primaryLanguage])[0] || 'en',
      contentLanguages: normaliseLanguages(parsed?.contentLanguages || []),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function applyTheme(next: AppPreferences): void {
  setThemeChoice({
    accent: next.accent,
    era: next.era,
    colourMode: next.colourMode,
    fontScale: next.fontScale,
  });
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const prefsRef = useRef(DEFAULT_PREFERENCES);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        const next = parseStored(stored);
        prefsRef.current = next;
        setPreferences(next);
        applyTheme(next);
      })
      .catch(() => {
        // The defaults still work; a storage failure must not block posting.
      });
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback((patch: Partial<AppPreferences>) => {
    const next = { ...prefsRef.current, ...patch };
    prefsRef.current = next;
    setPreferences(next);
    applyTheme(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {
      // Keep the in-memory choice for this session if persistence fails.
    });
  }, []);

  const setRequireAltText = useCallback(
    (value: boolean) => update({ requireAltText: value }),
    [update]
  );
  const setLargerAltBadges = useCallback(
    (value: boolean) => update({ largerAltBadges: value }),
    [update]
  );
  const setAccent = useCallback(
    (value: AccentId) => update({ accent: value }),
    [update]
  );
  const setEra = useCallback(
    (value: FacebookEraId) => update({ era: value }),
    [update]
  );
  const setColourMode = useCallback(
    (value: ColourMode) => update({ colourMode: value }),
    [update]
  );
  const setFontScale = useCallback(
    (value: FontScaleId) => update({ fontScale: value }),
    [update]
  );
  const setPrimaryLanguage = useCallback(
    (value: string) => update({ primaryLanguage: normaliseLanguages([value])[0] || 'en' }),
    [update]
  );
  const setContentLanguages = useCallback(
    (value: string[]) => update({ contentLanguages: normaliseLanguages(value) }),
    [update]
  );

  const value = useMemo(
    () => ({
      preferences,
      setRequireAltText,
      setLargerAltBadges,
      setAccent,
      setEra,
      setColourMode,
      setFontScale,
      setPrimaryLanguage,
      setContentLanguages,
    }),
    [
      preferences,
      setRequireAltText,
      setLargerAltBadges,
      setAccent,
      setEra,
      setColourMode,
      setFontScale,
      setPrimaryLanguage,
      setContentLanguages,
    ]
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  return useContext(PreferencesContext);
}
