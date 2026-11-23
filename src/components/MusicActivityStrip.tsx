import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  dialogAccessibilityProps,
  sheetAnimation,
  useDialogFocus,
  useReducedMotion,
} from '../lib/accessibility';
import { openExternalUrl } from '../lib/openLink';
import { formatDateTime, timeAgo } from '../lib/time';
import {
  loadTealPlays,
  tealDuration,
  tealProfileUrl,
  type TealPlay,
} from '../lib/teal';
import { CARD_RADIUS, cardShadow, usePalette } from '../theme';

/**
 * A compact, read-only "recently played" strip. Plays come from public teal
 * records in the profile's own repository; Balla writes nothing and offers no
 * player. The whole strip disappears when the preference is off or the account
 * has no plays, so an ordinary profile looks exactly as it did before.
 */
export function MusicActivityStrip({ did, enabled }: { did: string; enabled: boolean }) {
  const [plays, setPlays] = useState<TealPlay[]>([]);
  const [selected, setSelected] = useState<TealPlay | null>(null);

  useEffect(() => {
    let active = true;
    setPlays([]);
    setSelected(null);
    if (enabled && did) {
      void loadTealPlays(did)
        .then((next) => {
          if (active) setPlays(next);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [did, enabled]);

  if (!enabled || plays.length === 0) return null;
  return (
    <RecentlyPlayedCard
      plays={plays}
      profileUrl={tealProfileUrl(did)}
      onSelect={setSelected}
      selected={selected}
      onClose={() => setSelected(null)}
    />
  );
}

function RecentlyPlayedCard({
  plays,
  profileUrl,
  onSelect,
  selected,
  onClose,
}: {
  plays: TealPlay[];
  profileUrl: string;
  onSelect: (play: TealPlay) => void;
  selected: TealPlay | null;
  onClose: () => void;
}) {
  const p = usePalette();
  return (
    <View style={[styles.block, { borderTopColor: p.divider }]}>
      <View style={styles.heading}>
        <Ionicons name="musical-notes-outline" size={16} color={p.accent} />
        <Text style={{ color: p.text, fontSize: 15, fontWeight: '700', marginLeft: 7 }}>
          Recently played
        </Text>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => void openExternalUrl(profileUrl).catch(() => {})}
          accessibilityRole="link"
          accessibilityLabel="View this profile on teal.fm"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ color: p.accent, fontSize: 12, fontWeight: '600' }}>teal.fm</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {plays.map((play) => {
          const detail = play.artists || play.release || 'Unknown artist';
          const when = play.playedAt ? timeAgo(play.playedAt) : '';
          return (
            <Pressable
              key={play.uri}
              onPress={() => onSelect(play)}
              accessibilityRole="button"
              accessibilityLabel={`${play.title} by ${detail}${when ? `, ${when}` : ''}`}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: p.accentSoft,
                  borderColor: p.divider,
                  opacity: pressed ? 0.7 : 1,
                },
                cardShadow,
              ]}
            >
              <Text numberOfLines={1} style={{ color: p.text, fontSize: 13, fontWeight: '700' }}>
                {play.title}
              </Text>
              <Text numberOfLines={1} style={{ color: p.secondary, fontSize: 11, marginTop: 2 }}>
                {when ? `${detail} · ${when}` : detail}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <TrackSheet play={selected} profileUrl={profileUrl} onClose={onClose} />
    </View>
  );
}

/** Light detail sheet: real metadata and a link out, never a player. */
function TrackSheet({
  play,
  profileUrl,
  onClose,
}: {
  play: TealPlay | null;
  profileUrl: string;
  onClose: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const containerRef = useRef<any>(null);
  const closeRef = useRef<any>(null);
  const reducedMotion = useReducedMotion();
  const visible = Boolean(play);

  useDialogFocus({
    visible,
    onClose,
    containerRef,
    initialFocusRef: closeRef,
  });

  if (!play) return null;
  const duration = tealDuration(play.durationSeconds);

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
          style={styles.backdrop}
        />
        <View
          ref={containerRef}
          {...dialogAccessibilityProps('Recently played track')}
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
            <Text style={{ color: p.text, fontSize: 18, fontWeight: '700' }}>Track</Text>
            <Pressable
              ref={closeRef}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.close}
            >
              <Ionicons name="close" size={22} color={p.secondary} />
            </Pressable>
          </View>
          <Text style={{ color: p.text, fontSize: 17, fontWeight: '700' }}>{play.title}</Text>
          <Text style={{ color: p.secondary, fontSize: 14, lineHeight: 20, marginTop: 3 }}>
            {play.artists || 'Artist not listed'}
          </Text>
          {play.release ? (
            <Text style={{ color: p.secondary, fontSize: 13, marginTop: 8 }}>
              {play.release}
            </Text>
          ) : null}
          {duration || play.playedAt ? (
            <Text style={{ color: p.secondary, fontSize: 13, marginTop: 6 }}>
              {[duration, play.playedAt ? formatDateTime(play.playedAt) : '']
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}
          <Text style={{ color: p.secondary, fontSize: 12, lineHeight: 17, marginTop: 12 }}>
            Played from public teal.fm records in this profile’s repository. Balla does not
            store music history or play anything here.
          </Text>
          <Pressable
            onPress={() => void openExternalUrl(profileUrl).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel="View this profile on teal.fm"
            style={({ pressed }) => [
              styles.linkButton,
              { backgroundColor: p.accent, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            <Text style={{ color: p.onAccent, fontSize: 15, fontWeight: '700' }}>
              View on teal.fm
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
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
  chips: {
    paddingHorizontal: 2,
    gap: 8,
  },
  chip: {
    minHeight: 52,
    minWidth: 150,
    maxWidth: 210,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 11,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  close: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  linkButton: {
    minHeight: 44,
    borderRadius: CARD_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
});
