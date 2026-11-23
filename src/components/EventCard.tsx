import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  eventModeLabel,
  eventPrimaryLocation,
  eventStatusLabel,
  type CalendarEvent,
} from '../lib/eventsModel';
import { formatEventWindow } from '../lib/time';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

function dateBadge(event: CalendarEvent): { month: string; day: string } | null {
  if (!event.startsAt) return null;
  const date = new Date(event.startsAt);
  if (!Number.isFinite(date.getTime())) return null;
  return {
    month: new Intl.DateTimeFormat('en-GB', { month: 'short' }).format(date),
    day: String(date.getDate()),
  };
}

/**
 * A compact event card used by the profile strip and by event embeds. The
 * detail sheet owns RSVP; this card is a visible, 44pt target into it.
 */
export function EventCard({
  event,
  onPress,
  variant = 'strip',
}: {
  event: CalendarEvent;
  onPress: () => void;
  variant?: 'strip' | 'embed';
}) {
  const p = usePalette();
  const badge = dateBadge(event);
  const when = formatEventWindow(event.startsAt, event.endsAt) || 'Date not listed';
  const where = eventPrimaryLocation(event);
  const mode = eventModeLabel(event.mode);
  const status = eventStatusLabel(event.status);
  const statusNeedsAttention = status !== 'Scheduled' && status !== 'Planned';
  const meta = [mode, where].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open event ${event.name}. ${when}. ${status}.`}
      accessibilityHint="Opens the event details and RSVP controls."
      style={({ pressed }) => [
        styles.card,
        variant === 'embed' ? styles.embed : styles.strip,
        {
          backgroundColor: variant === 'embed' ? p.bg : p.card,
          borderColor: p.divider,
          opacity: pressed ? 0.7 : 1,
        },
        cardShadow,
      ]}
    >
      {badge ? (
        <View style={[styles.dateBadge, { backgroundColor: p.accentSoft }]}>
          <Text style={{ color: p.accent, fontSize: 11, fontWeight: '800' }}>
            {badge.month.toUpperCase()}
          </Text>
          <Text style={{ color: p.accent, fontSize: 20, fontWeight: '800', lineHeight: 23 }}>
            {badge.day}
          </Text>
        </View>
      ) : (
        <View style={[styles.dateBadge, { backgroundColor: p.accentSoft }]}>
          <Ionicons name="calendar-outline" size={22} color={p.accent} />
        </View>
      )}

      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.topline}>
          <Text
            style={{
              color: p.secondary,
              fontSize: 10,
              fontWeight: '800',
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            Event
          </Text>
          {statusNeedsAttention ? (
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: status === 'Cancelled' ? p.danger : p.accentSoft,
                  borderColor: p.divider,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={{
                  color: status === 'Cancelled' ? '#FFFFFF' : p.accent,
                  fontSize: 10,
                  fontWeight: '700',
                }}
              >
                {status}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={2}
          style={{ color: p.text, fontSize: 15, fontWeight: '700', marginTop: 3 }}
        >
          {event.name}
        </Text>
        <Text
          numberOfLines={2}
          style={{ color: p.text, fontSize: 12, lineHeight: 16, marginTop: 4 }}
        >
          {when}
        </Text>
        {meta ? (
          <Text
            numberOfLines={2}
            style={{ color: p.secondary, fontSize: 11, lineHeight: 15, marginTop: 2 }}
          >
            {meta}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 94,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    padding: 10,
  },
  strip: {
    width: 246,
  },
  embed: {
    width: '100%',
    marginTop: 12,
  },
  dateBadge: {
    width: 48,
    minHeight: 54,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  topline: {
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusPill: {
    maxWidth: 120,
    minHeight: 20,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 7,
    justifyContent: 'center',
  },
});
