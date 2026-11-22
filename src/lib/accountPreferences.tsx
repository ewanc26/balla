import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { agent } from './agent';
import {
  DEFAULT_ACCOUNT_PREFERENCES,
  gatesToInteractionPref,
  normaliseInterests,
  readAccountPreferences,
  type AccountPreferences,
} from './accountPreferencesModel';
import type { InteractionGates } from './interactionGates';

/**
 * Account-level Bluesky preferences Balla writes and honours. Reads use the
 * one agent and the SDK helpers preserve unrelated preferences, so a change
 * here never overwrites label filters, saved feeds or muted words.
 */
type AccountPreferencesValue = {
  settings: AccountPreferences;
  loading: boolean;
  error: string | null;
  saveVerificationBadges: (hide: boolean) => Promise<void>;
  saveDefaultGates: (gates: InteractionGates) => Promise<void>;
  saveInterests: (tags: string[]) => Promise<void>;
  reload: () => Promise<void>;
};

const AccountPreferencesContext = createContext<AccountPreferencesValue>({
  settings: DEFAULT_ACCOUNT_PREFERENCES,
  loading: false,
  error: null,
  saveVerificationBadges: async () => {},
  saveDefaultGates: async () => {},
  saveInterests: async () => {},
  reload: async () => {},
});

export function AccountPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccountPreferences>(DEFAULT_ACCOUNT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    try {
      const preferences = await agent.getPreferences();
      if (mounted.current) {
        setSettings(readAccountPreferences(preferences));
        setError(null);
      }
    } catch {
      if (mounted.current) setError('Could not load your account preferences.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void reload();
    return () => {
      mounted.current = false;
    };
  }, [reload]);

  const update = useCallback(
    async (
      patch: Partial<AccountPreferences>,
      write: () => Promise<void>,
      failureMessage: string
    ) => {
      const before = settings;
      setSettings({ ...before, ...patch });
      try {
        await write();
        await reload();
      } catch (err) {
        if (mounted.current) {
          setSettings(before);
          setError(failureMessage);
        }
        throw err;
      }
    },
    [settings, reload]
  );

  const saveVerificationBadges = useCallback(
    (hide: boolean) =>
      update(
        { hideVerificationBadges: hide },
        () => agent.setVerificationPrefs({ hideBadges: hide }),
        'Could not save that choice. Your previous setting is kept.'
      ),
    [update]
  );

  const saveDefaultGates = useCallback(
    (gates: InteractionGates) =>
      update(
        { defaultGates: gates },
        () => agent.setPostInteractionSettings(gatesToInteractionPref(gates) as any),
        'Could not save those defaults. Your previous settings are kept.'
      ),
    [update]
  );

  const saveInterests = useCallback(
    (tags: string[]) => {
      const clean = normaliseInterests(tags);
      return update(
        { interests: clean },
        () => agent.setInterestsPref({ tags: clean }),
        'Could not save your interests. Your previous choices are kept.'
      );
    },
    [update]
  );

  const value = useMemo(
    () => ({
      settings,
      loading,
      error,
      saveVerificationBadges,
      saveDefaultGates,
      saveInterests,
      reload,
    }),
    [
      settings,
      loading,
      error,
      saveVerificationBadges,
      saveDefaultGates,
      saveInterests,
      reload,
    ]
  );

  return (
    <AccountPreferencesContext.Provider value={value}>
      {children}
    </AccountPreferencesContext.Provider>
  );
}

export function useAccountPreferences(): AccountPreferencesValue {
  return useContext(AccountPreferencesContext);
}
