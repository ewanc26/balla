import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setThemeChoice } from '../theme';
import {
  normaliseThemeChoice,
  type AccentId,
  type FacebookEraId,
} from './themeModel';

const STORAGE_KEY = 'balla.preferences.v1';

export type AppPreferences = {
  requireAltText: boolean;
  accent: AccentId;
  era: FacebookEraId;
};

export const DEFAULT_PREFERENCES: AppPreferences = {
  requireAltText: false,
  accent: 'facebook',
  era: 'newfacebook',
};

type PreferencesContextValue = {
  preferences: AppPreferences;
  setRequireAltText: (value: boolean) => void;
  setAccent: (value: AccentId) => void;
  setEra: (value: FacebookEraId) => void;
};

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  setRequireAltText: () => {},
  setAccent: () => {},
  setEra: () => {},
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
      accent: theme.accent,
      era: theme.era,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active) return;
        const next = parseStored(stored);
        setPreferences(next);
        setThemeChoice({ accent: next.accent, era: next.era });
      })
      .catch(() => {
        // The defaults still work; a storage failure must not block posting.
      });
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback((next: AppPreferences) => {
    setPreferences(next);
    setThemeChoice({ accent: next.accent, era: next.era });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {
      // Keep the in-memory choice for this session even if persistence fails.
    });
  }, []);

  const setRequireAltText = useCallback(
    (value: boolean) => {
      update({ ...preferences, requireAltText: value });
    },
    [preferences, update]
  );

  const setAccent = useCallback(
    (value: AccentId) => {
      update({ ...preferences, accent: value });
    },
    [preferences, update]
  );

  const setEra = useCallback(
    (value: FacebookEraId) => {
      update({ ...preferences, era: value });
    },
    [preferences, update]
  );

  const value = useMemo(
    () => ({ preferences, setRequireAltText, setAccent, setEra }),
    [preferences, setRequireAltText, setAccent, setEra]
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
