import { useEffect, useState } from 'react';
import { loadMemories } from './memories';
import type { MemoriesDay } from './memoriesModel';

/**
 * `undefined` means the first read is still in flight; `null` means this
 * session could not read the PDS. Neither state renders a card.
 */
export function useMemories(
  did: string | undefined,
  enabled: boolean,
  dateKey: string
): MemoriesDay | null | undefined {
  const [day, setDay] = useState<MemoriesDay | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    if (!did || !enabled) {
      setDay(null);
      return () => {
        active = false;
      };
    }
    setDay(undefined);
    loadMemories(did, dateKey)
      .then((result) => {
        if (active) setDay(result);
      })
      .catch(() => {
        if (active) setDay(null);
      });
    return () => {
      active = false;
    };
  }, [did, enabled, dateKey]);

  return day;
}
