import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { loadCalendarEvent } from '../lib/events';
import type { CalendarEvent, EventRef } from '../lib/eventsModel';
import { usePalette } from '../theme';
import { EventCard } from './EventCard';
import { EventSheet } from './EventSheet';

/**
 * The raw post record carries an event strongRef that the AppView has no view
 * type for. Read that record from its repository and show a real card, or an
 * honest failure, inside the post that already passed its own moderation gates.
 */
export function EventEmbed({ reference }: { reference: EventRef }) {
  const p = usePalette();
  const [event, setEvent] = useState<CalendarEvent | null | undefined>(undefined);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setEvent(undefined);
    loadCalendarEvent(reference.uri).then((next) => {
      if (active) setEvent(next);
    });
    return () => {
      active = false;
    };
  }, [reference.uri]);

  if (event === undefined) {
    return (
      <View style={[styles.loading, { backgroundColor: p.bg, borderColor: p.divider }]}>
        <ActivityIndicator size="small" color={p.secondary} />
        <Text style={{ color: p.secondary, fontSize: 12 }}>Reading event…</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.loading, { backgroundColor: p.bg, borderColor: p.divider }]}>
        <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17 }}>
          This event could not be read from its repository.
        </Text>
      </View>
    );
  }

  return (
    <>
      <EventCard event={event} variant="embed" onPress={() => setOpen(true)} />
      <EventSheet event={open ? event : null} onClose={() => setOpen(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
});
