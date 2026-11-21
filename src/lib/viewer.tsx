import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { agent } from './agent';

// The chrome, composer and profile screens all need the signed-in account.
// Load it once so the avatar does not flicker or get fetched repeatedly.
type ViewerContextValue = {
  profile: any | null;
  refreshProfile: () => Promise<any | null>;
  updateProfile: (profile: any | null) => void;
};

const ViewerContext = createContext<ViewerContextValue>({
  profile: null,
  refreshProfile: async () => null,
  updateProfile: () => {},
});

export function ViewerProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<any>(null);

  const refreshProfile = useCallback(async () => {
    const did = agent.did;
    if (!did) return null;
    try {
      const res = await agent.getProfile({ actor: did });
      setProfile(res.data);
      return res.data;
    } catch {
      // Keep the last known profile; the chrome falls back to the initial.
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  return (
    <ViewerContext.Provider
      value={{ profile, refreshProfile, updateProfile: setProfile }}
    >
      {children}
    </ViewerContext.Provider>
  );
}

export function useViewer(): ViewerContextValue {
  return useContext(ViewerContext);
}
