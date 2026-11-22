import { useEffect, useState } from 'react';
import { agent } from './agent';
import { useViewer } from './viewer';
import {
  profileHasSelfLabel,
  profileViewWithSelfLabel,
  withSelfLabel,
} from './accountSettingsModel';

/**
 * One optimistic write path for profile self-labels (automation and the
 * logged-out visibility request). The AppView indexes asynchronously, so the
 * viewer profile is reconciled after a short delay.
 */
export function useProfileSelfLabel(label: string) {
  const { profile, updateProfile, refreshProfile } = useViewer();
  const [value, setValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(profileHasSelfLabel(profile, label));
  }, [profile, label]);

  async function change(enabled: boolean) {
    if (!profile || saving) return;
    const previous = value;
    setValue(enabled);
    setSaving(true);
    setError(null);
    try {
      await agent.upsertProfile((existing) => withSelfLabel(existing, label, enabled));
      updateProfile(profileViewWithSelfLabel(profile, label, enabled));
      setTimeout(() => void refreshProfile(), 1800);
    } catch {
      setValue(previous);
      setError('Could not save that setting. Your previous choice has been restored.');
    } finally {
      setSaving(false);
    }
  }

  return { value, change, saving, error, ready: !!profile };
}
