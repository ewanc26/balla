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
  normaliseMemoriesPreferences,
  withMemoriesDismissed,
  withMemoriesEnabled,
  type MemoriesPreferences,
} from './memoriesModel';
import {
  normaliseBlobOriginStrategy,
  type BlobOriginStrategy,
} from './blobOriginModel';
import {
  normaliseThemeChoice,
  type AccentId,
  type ColourMode,
  type DarkThemeId,
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
  /**
   * undefined means "ask on the first link", matching the official client.
   * true uses the in-app browser (expo-web-browser); false uses the system
   * browser through Linking.
   */
  useInAppBrowser: boolean | undefined;
  /** Stored inverted: true means autoplay is off, as in the official client. */
  disableAutoplay: boolean;
  accent: AccentId;
  era: FacebookEraId;
  colourMode: ColourMode;
  darkTheme: DarkThemeId;
  fontScale: FontScaleId;
  primaryLanguage: string;
  contentLanguages: string[];
  /** Whether the subtle teal.fm recent-plays strip appears on profiles. */
  showMusicActivity: boolean;
  /** Whether the desktop right-rail Recent activity card is shown. */
  showRecentActivity: boolean;
  /** Device-local media origin choice; "pds-first" reads blobs from the PDS. */
  blobOriginStrategy: BlobOriginStrategy;
  /** Per-account, device-local On this day settings. Default is off. */
  memories: MemoriesPreferences;
};

export const DEFAULT_PREFERENCES: AppPreferences = {
  requireAltText: false,
  largerAltBadges: false,
  useInAppBrowser: undefined,
  disableAutoplay: false,
  accent: 'facebook',
  era: 'newfacebook',
  colourMode: 'system',
  darkTheme: 'dim',
  fontScale: 'default',
  primaryLanguage: 'en-GB',
  contentLanguages: [],
  showMusicActivity: true,
  showRecentActivity: true,
  blobOriginStrategy: 'follow-url',
  memories: {},
};

type PreferencesContextValue = {
  preferences: AppPreferences;
  setRequireAltText: (value: boolean) => void;
  setLargerAltBadges: (value: boolean) => void;
  setUseInAppBrowser: (value: boolean | undefined) => void;
  setDisableAutoplay: (value: boolean) => void;
  setAccent: (value: AccentId) => void;
  setEra: (value: FacebookEraId) => void;
  setColourMode: (value: ColourMode) => void;
  setDarkTheme: (value: DarkThemeId) => void;
  setFontScale: (value: FontScaleId) => void;
  setPrimaryLanguage: (value: string) => void;
  setContentLanguages: (value: string[]) => void;
  setShowMusicActivity: (value: boolean) => void;
  setShowRecentActivity: (value: boolean) => void;
  setBlobOriginStrategy: (value: BlobOriginStrategy) => void;
  setMemoriesEnabled: (did: string, value: boolean) => void;
  dismissMemories: (did: string, dateKey: string) => void;
};

const PreferencesContext = createContext<PreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  setRequireAltText: () => {},
  setLargerAltBadges: () => {},
  setUseInAppBrowser: () => {},
  setDisableAutoplay: () => {},
  setAccent: () => {},
  setEra: () => {},
  setColourMode: () => {},
  setDarkTheme: () => {},
  setFontScale: () => {},
  setPrimaryLanguage: () => {},
  setContentLanguages: () => {},
  setShowMusicActivity: () => {},
  setShowRecentActivity: () => {},
  setBlobOriginStrategy: () => {},
  setMemoriesEnabled: () => {},
  dismissMemories: () => {},
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
      useInAppBrowser:
        typeof parsed?.useInAppBrowser === 'boolean'
          ? parsed.useInAppBrowser
          : undefined,
      disableAutoplay:
        typeof parsed?.disableAutoplay === 'boolean'
          ? parsed.disableAutoplay
          : DEFAULT_PREFERENCES.disableAutoplay,
      accent: theme.accent,
      era: theme.era,
      colourMode: theme.colourMode,
      darkTheme: theme.darkTheme,
      fontScale: theme.fontScale,
      primaryLanguage: normaliseLanguages([parsed?.primaryLanguage])[0] || 'en-GB',
      contentLanguages: normaliseLanguages(parsed?.contentLanguages || []),
      showMusicActivity:
        typeof parsed?.showMusicActivity === 'boolean'
          ? parsed.showMusicActivity
          : DEFAULT_PREFERENCES.showMusicActivity,
      showRecentActivity:
        typeof parsed?.showRecentActivity === 'boolean'
          ? parsed.showRecentActivity
          : DEFAULT_PREFERENCES.showRecentActivity,
      blobOriginStrategy: normaliseBlobOriginStrategy(parsed?.blobOriginStrategy),
      memories: normaliseMemoriesPreferences(parsed?.memories),
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
    darkTheme: next.darkTheme,
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
  const setUseInAppBrowser = useCallback(
    (value: boolean | undefined) => update({ useInAppBrowser: value }),
    [update]
  );
  const setDisableAutoplay = useCallback(
    (value: boolean) => update({ disableAutoplay: value }),
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
  const setDarkTheme = useCallback(
    (value: DarkThemeId) => update({ darkTheme: value }),
    [update]
  );
  const setFontScale = useCallback(
    (value: FontScaleId) => update({ fontScale: value }),
    [update]
  );
  const setPrimaryLanguage = useCallback(
    (value: string) => update({ primaryLanguage: normaliseLanguages([value])[0] || 'en-GB' }),
    [update]
  );
  const setContentLanguages = useCallback(
    (value: string[]) => update({ contentLanguages: normaliseLanguages(value) }),
    [update]
  );
  const setShowMusicActivity = useCallback(
    (value: boolean) => update({ showMusicActivity: value }),
    [update]
  );
  const setShowRecentActivity = useCallback(
    (value: boolean) => update({ showRecentActivity: value }),
    [update]
  );
  const setBlobOriginStrategy = useCallback(
    (value: BlobOriginStrategy) => update({ blobOriginStrategy: value }),
    [update]
  );
  const setMemoriesEnabled = useCallback(
    (did: string, value: boolean) =>
      update({ memories: withMemoriesEnabled(prefsRef.current.memories, did, value) }),
    [update]
  );
  const dismissMemories = useCallback(
    (did: string, dateKey: string) =>
      update({
        memories: withMemoriesDismissed(prefsRef.current.memories, did, dateKey),
      }),
    [update]
  );

  const value = useMemo(
    () => ({
      preferences,
      setRequireAltText,
      setLargerAltBadges,
      setUseInAppBrowser,
      setDisableAutoplay,
      setAccent,
      setEra,
      setColourMode,
      setDarkTheme,
      setFontScale,
      setPrimaryLanguage,
      setContentLanguages,
      setShowMusicActivity,
      setShowRecentActivity,
      setBlobOriginStrategy,
      setMemoriesEnabled,
      dismissMemories,
    }),
    [
      preferences,
      setRequireAltText,
      setLargerAltBadges,
      setUseInAppBrowser,
      setDisableAutoplay,
      setAccent,
      setEra,
      setColourMode,
      setDarkTheme,
      setFontScale,
      setPrimaryLanguage,
      setContentLanguages,
      setShowMusicActivity,
      setShowRecentActivity,
      setBlobOriginStrategy,
      setMemoriesEnabled,
      dismissMemories,
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
