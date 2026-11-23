import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { profileEventStrip, type CalendarEvent } from '../lib/eventsModel';
import { useProfileEvents } from '../lib/useProfileEvents';
import { usePalette } from '../theme';
import { EventCard } from './EventCard';
import { EventSheet } from './EventSheet';

/**
 * A quiet profile strip, following the music activity pattern. It appears only
 * when the profile's public repository has readable event records; the section
 * disappears without an error when it does not.
 */
export function ProfileEventsStrip({ did }: { did: string }) {
  const p = usePalette();
  const events = useProfileEvents(did);
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  if (!events || events.length === 0) return null;
  const shown = profileEventStrip(events);

  return (
    <View style={[styles.block, { borderTopColor: p.divider }]}>
      <View style={styles.heading}>
        <Ionicons name="calendar-outline" size={16} color={p.accent} />
        <Text
          accessibilityRole="header"
          style={{ color: p.text, fontSize: 15, fontWeight: '700', marginLeft: 7 }}
        >
          Events
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.cards}
      >
        {shown.map((event) => (
          <EventCard
            key={event.uri}
            event={event}
            onPress={() => setSelected(event)}
          />
        ))}
      </ScrollView>
      <EventSheet event={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 12,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 2,
    marginBottom: 9,
  },
  cards: {
    paddingHorizontal: 2,
    paddingBottom: 2,
    gap: 8,
  },
});
