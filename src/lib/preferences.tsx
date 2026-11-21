import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'balla.preferences.v1';

export type AppPreferences = {
  requireAltText: boolean;
};

export const DEFAULT_PREFERENCES: AppPreferences = {
  requireAltText: false,
};

type PreferencesContextValue = {
  preferences: AppPreferences;
  setRequireAltText: (value: boolean) => void;
};

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  setRequireAltText: () => {},
});

function parseStored(value: string | null): AppPreferences {
  if (!value) return DEFAULT_PREFERENCES;
  try {
    const parsed = JSON.parse(value);
    return {
      requireAltText:
        typeof parsed?.requireAltText === 'boolean'
          ? parsed.requireAltText
          : DEFAULT_PREFERENCES.requireAltText,
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
        if (active) setPreferences(parseStored(stored));
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

  const value = useMemo(
    () => ({ preferences, setRequireAltText }),
    [preferences, setRequireAltText]
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
