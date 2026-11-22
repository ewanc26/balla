import { useEffect, useState } from 'react';
import { getSessionInfo } from './agent';
import {
  readSessionSummary,
  type SessionSummary,
} from './accountSettingsModel';

/** Shared session-metadata loading for the account and security screens. */
export function useSessionSummary() {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getSessionInfo()
      .then((info) => {
        if (!active) return;
        setSummary(readSessionSummary(info));
        setError(null);
      })
      .catch(() => {
        if (active) setError('Could not read this sign-in’s details.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { summary, loading, error };
}
