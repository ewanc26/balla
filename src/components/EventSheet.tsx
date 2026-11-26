import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { agent } from '../lib/agent';
import { openExternalUrl } from '../lib/openLink';
import { describeFailure } from '../lib/reliability';
import {
  eventModeLabel,
  eventStatusLabel,
  rsvpLabel,
  type CalendarEvent,
  type RsvpStatus,
} from '../lib/eventsModel';
import {
  loadEventRsvps,
  removeEventRsvp,
  setEventRsvp,
} from '../lib/events';
import { formatEventWindow } from '../lib/time';
import {
  dialogAccessibilityProps,
  sheetAnimation,
  useDialogFocus,
  useReducedMotion,
} from '../lib/accessibility';
import { CARD_RADIUS, usePalette } from '../theme';

const RSVP_OPTIONS: RsvpStatus[] = ['going', 'interested', 'notgoing'];

/**
 * Event detail sheet. RSVP buttons are always visible when signed in; reading,
 * changing and removing all act on one public repository record. No reminder,
 * notification, ticket or follower action is offered here.
 */
export function EventSheet({
  event,
  onClose,
}: {
  event: CalendarEvent | null;
  onClose: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const containerRef = useRef<any>(null);
  const closeRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  const visible = Boolean(event);
  const viewerDid = agent.did;

  const [current, setCurrent] = useState<RsvpStatus | null>(null);
  const [loadingRsvp, setLoadingRsvp] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<RsvpStatus | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useDialogFocus({
    visible,
    onClose,
    containerRef,
    initialFocusRef: closeRef,
  });

  useEffect(() => {
    let active = true;
    setCurrent(null);
    setLoadError(null);
    setError(null);
    setNotice(null);
    setBusy(null);
    if (!event || !viewerDid) {
      setLoadingRsvp(false);
      return () => {
        active = false;
      };
    }
    setLoadingRsvp(true);
    loadEventRsvps(viewerDid, event.uri)
      .then((records) => {
        if (active) setCurrent(records[0]?.status || null);
      })
      .catch(() => {
        if (active) {
          setLoadError('Could not check your current RSVP. You can still choose one.');
        }
      })
      .finally(() => {
        if (active) setLoadingRsvp(false);
      });
    return () => {
      active = false;
    };
  }, [event?.uri, viewerDid]);

  async function choose(status: RsvpStatus) {
    if (!event || !viewerDid || busy || current === status) return;
    setBusy(status);
    setError(null);
    setNotice(null);
    try {
      const result = await setEventRsvp(event, status);
      setCurrent(status);
      setNotice(
        result.duplicateCleanupFailed
          ? 'RSVP saved, but an older duplicate record could not be removed.'
          : `RSVP saved. ${rsvpLabel(status)} is one public record.`
      );
    } catch (err) {
      setError(describeFailure(err, 'Could not update your RSVP.'));
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!event || !viewerDid || busy || !current) return;
    setBusy('remove');
    setError(null);
    setNotice(null);
    try {
      const removed = await removeEventRsvp(event);
      setCurrent(null);
      setNotice(
        removed > 0
          ? 'RSVP removed. No RSVP record remains in your repository.'
          : 'No RSVP record was found to remove.'
      );
    } catch (err) {
      setError(describeFailure(err, 'Could not remove your RSVP.'));
    } finally {
      setBusy(null);
    }
  }

  if (!event) return null;

  const when = formatEventWindow(event.startsAt, event.endsAt);
  const mode = eventModeLabel(event.mode);
  const status = eventStatusLabel(event.status);

  return (
    <Modal
      transparent
      visible
      animationType={sheetAnimation(reducedMotion)}
      accessibilityViewIsModal
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          onPress={onClose}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.backdrop, { backgroundColor: p.overlay }]}
        />
        <View
          ref={containerRef}
          {...dialogAccessibilityProps('Event details')}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: p.card,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>
              Event
            </Text>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close event details"
              style={({ pressed }) => [
                styles.close,
                { backgroundColor: pressed ? p.bg : 'transparent' },
              ]}
            >
              <Ionicons name="close" size={22} color={p.secondary} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flexGrow: 0, flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: 4 }}
            showsVerticalScrollIndicator
          >
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: p.accentSoft }]}>
                <Ionicons name="people-outline" size={13} color={p.accent} />
                <Text style={{ color: p.accent, fontSize: 11, fontWeight: '700' }}>
                  {mode}
                </Text>
              </View>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: status === 'Cancelled' ? p.danger : p.bg,
                    borderColor: p.divider,
                  },
                ]}
              >
                <Text
                  style={{
                    color: status === 'Cancelled' ? p.onDanger : p.secondary,
                    fontSize: 11,
                    fontWeight: '700',
                  }}
                >
                  {status}
                </Text>
              </View>
            </View>

            <Text
              accessibilityRole="header"
              style={{ color: p.text, fontSize: 22, lineHeight: 28, fontWeight: '700' }}
            >
              {event.name}
            </Text>
            <Text style={{ color: p.text, fontSize: 14, lineHeight: 20, marginTop: 8 }}>
              {when || 'No start or end time is published in this record.'}
            </Text>
            {when ? (
              <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 16, marginTop: 3 }}>
                Shown in this device’s timezone.
              </Text>
            ) : null}

            {event.startsAt || event.endsAt ? (
              <View style={[styles.recordTimes, { borderColor: p.divider }]}>
                {event.startsAt ? (
                  <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 16 }}>
                    Published start: {event.startsAt}
                  </Text>
                ) : null}
                {event.endsAt ? (
                  <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 16 }}>
                    Published end: {event.endsAt}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {event.description ? (
              <Text
                style={{
                  color: p.text,
                  fontSize: 14,
                  lineHeight: 21,
                  marginTop: 14,
                }}
              >
                {event.description}
              </Text>
            ) : null}

            {event.locations.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: p.secondary }]}>
                  Locations
                </Text>
                {event.locations.map((location, index) =>
                  location.link ? (
                    <Pressable
                      key={`${location.kind}-${index}`}
                      onPress={() => void openExternalUrl(location.link!).catch(() => {})}
                      accessibilityRole="link"
                      accessibilityLabel={`${location.linkLabel} for ${location.text}`}
                      style={({ pressed }) => [
                        styles.locationRow,
                        {
                          backgroundColor: p.bg,
                          borderColor: p.divider,
                          opacity: pressed ? 0.65 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="location-outline" size={18} color={p.accent} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={{ color: p.text, fontSize: 13, lineHeight: 18 }}>
                          {location.text}
                        </Text>
                        <Text style={{ color: p.accent, fontSize: 11, fontWeight: '700' }}>
                          {location.linkLabel}
                        </Text>
                      </View>
                      <Ionicons name="open-outline" size={16} color={p.accent} />
                    </Pressable>
                  ) : (
                    <View
                      key={`${location.kind}-${index}`}
                      style={[
                        styles.locationRow,
                        { backgroundColor: p.bg, borderColor: p.divider },
                      ]}
                    >
                      <Ionicons name="location-outline" size={18} color={p.secondary} />
                      <Text style={{ color: p.text, flex: 1, fontSize: 13, lineHeight: 18 }}>
                        {location.text}
                      </Text>
                    </View>
                  )
                )}
              </View>
            ) : null}

            {event.links.length > 0 ? (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: p.secondary }]}>Links</Text>
                {event.links.map((link, index) =>
                  link.link ? (
                    <Pressable
                      key={`${link.uri}-${index}`}
                      onPress={() => void openExternalUrl(link.link!).catch(() => {})}
                      accessibilityRole="link"
                      accessibilityLabel={`Open ${link.text}`}
                      style={({ pressed }) => [
                        styles.locationRow,
                        {
                          backgroundColor: p.bg,
                          borderColor: p.divider,
                          opacity: pressed ? 0.65 : 1,
                        },
                      ]}
                    >
                      <Ionicons name="link-outline" size={18} color={p.accent} />
                      <Text
                        numberOfLines={2}
                        style={{ color: p.accent, flex: 1, fontSize: 13, lineHeight: 18 }}
                      >
                        {link.text}
                      </Text>
                      <Ionicons name="open-outline" size={16} color={p.accent} />
                    </Pressable>
                  ) : (
                    <View
                      key={`${link.uri}-${index}`}
                      style={[
                        styles.locationRow,
                        { backgroundColor: p.bg, borderColor: p.divider },
                      ]}
                    >
                      <Ionicons name="link-outline" size={18} color={p.secondary} />
                      <Text
                        numberOfLines={2}
                        style={{ color: p.text, flex: 1, fontSize: 13, lineHeight: 18 }}
                      >
                        {link.text}
                      </Text>
                    </View>
                  )
                )}
              </View>
            ) : null}

            <View style={[styles.rsvp, { borderTopColor: p.divider }]}>
              <View style={styles.rsvpHeading}>
                <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>
                  Your RSVP
                </Text>
                {loadingRsvp ? (
                  <ActivityIndicator size="small" color={p.secondary} />
                ) : null}
              </View>
              {!viewerDid ? (
                <Text style={{ color: p.secondary, fontSize: 13, lineHeight: 19 }}>
                  Sign in to RSVP. An RSVP is a public record in your repository.
                </Text>
              ) : (
                <>
                  <View style={styles.rsvpButtons}>
                    {RSVP_OPTIONS.map((option) => {
                      const selected = current === option;
                      const optionBusy = busy === option;
                      return (
                        <Pressable
                          key={option}
                          onPress={() => void choose(option)}
                          disabled={!!busy}
                          accessibilityRole="button"
                          accessibilityLabel={`RSVP ${rsvpLabel(option)}`}
                          accessibilityState={{ selected, busy: optionBusy, disabled: !!busy }}
                          aria-pressed={selected}
                          style={({ pressed }) => [
                            styles.rsvpButton,
                            {
                              backgroundColor: selected ? p.accent : p.bg,
                              borderColor: selected ? p.accent : p.divider,
                              opacity: pressed || busy ? 0.7 : 1,
                            },
                          ]}
                        >
                          {optionBusy ? (
                            <ActivityIndicator
                              size="small"
                              color={selected ? p.onAccent : p.accent}
                            />
                          ) : null}
                          <Text
                            numberOfLines={1}
                            style={{
                              color: selected ? p.onAccent : p.text,
                              fontSize: 13,
                              fontWeight: '700',
                            }}
                          >
                            {rsvpLabel(option)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {current ? (
                    <Pressable
                      onPress={() => void remove()}
                      disabled={!!busy}
                      accessibilityRole="button"
                      accessibilityLabel="Remove RSVP"
                      accessibilityState={{ busy: busy === 'remove', disabled: !!busy }}
                      style={({ pressed }) => [
                        styles.removeButton,
                        {
                          borderColor: p.danger,
                          opacity: pressed || busy ? 0.65 : 1,
                        },
                      ]}
                    >
                      {busy === 'remove' ? (
                        <ActivityIndicator size="small" color={p.danger} />
                      ) : null}
                      <Text style={{ color: p.danger, fontSize: 13, fontWeight: '700' }}>
                        Remove RSVP
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              )}

              {loadError ? (
                <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 18, marginTop: 8 }}>
                  {loadError}
                </Text>
              ) : null}
              {error ? (
                <Text
                  accessibilityRole="alert"
                  style={{ color: p.danger, fontSize: 12, lineHeight: 18, marginTop: 8 }}
                >
                  {error}
                </Text>
              ) : null}
              {notice ? (
                <Text
                  accessibilityRole="alert"
                  style={{ color: p.green, fontSize: 12, lineHeight: 18, marginTop: 8 }}
                >
                  {notice}
                </Text>
              ) : null}
              <Text style={{ color: p.secondary, fontSize: 11, lineHeight: 17, marginTop: 9 }}>
                An RSVP is a public `community.lexicon.calendar.rsvp` record in your
                repository, like a like. Changing it replaces the same record; removing
                it deletes that record. Balla sends no reminder or notification. If this
                session predates Events, sign out and back in once to grant the RSVP
                permission.
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', inset: 0 },
  sheet: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '90%',
    alignSelf: 'center',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  header: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  badge: {
    minHeight: 26,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  recordTimes: {
    borderLeftWidth: 2,
    paddingLeft: 8,
    marginTop: 9,
    gap: 1,
  },
  section: { marginTop: 16, gap: 6 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  locationRow: {
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  rsvp: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 18,
    paddingTop: 14,
  },
  rsvpHeading: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rsvpButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  rsvpButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
  removeButton: {
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
  },
});
