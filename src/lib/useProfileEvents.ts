import { useEffect, useState } from 'react';
import { loadProfileEvents } from './events';
import type { CalendarEvent } from './eventsModel';

/**
 * `undefined` means the optional read is still in flight; an empty array means
 * this profile has no readable calendar records and the section stays hidden.
 */
export function useProfileEvents(did: string | undefined): CalendarEvent[] | undefined {
  const [events, setEvents] = useState<CalendarEvent[] | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setEvents(undefined);
    if (!did) {
      setEvents([]);
      return () => {
        active = false;
      };
    }
    loadProfileEvents(did)
      .then((next) => {
        if (active) setEvents(next);
      })
      .catch(() => {
        if (active) setEvents([]);
      });
    return () => {
      active = false;
    };
  }, [did]);

  return events;
}
