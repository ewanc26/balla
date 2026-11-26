import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  TOGGLE_KNOB,
  TOGGLE_TRACK_HEIGHT,
  TOGGLE_TRACK_INSET,
  TOGGLE_TRACK_WIDTH,
} from '../lib/toggleModel';
import { touchTargetStyle } from '../lib/accessibility';
import { usePalette } from '../theme';

/**
 * The one on/off control. The track is what looks like a switch and the
 * pressable around it supplies the 44pt target, so enlarging the target can
 * never turn the switch into a circle.
 */
export function Toggle({
  label,
  value,
  onChange,
  busy = false,
  disabled = false,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const p = usePalette();
  const inactive = busy || disabled;
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={inactive}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, busy, disabled: inactive }}
      aria-checked={value}
      style={({ pressed }) => [styles.target, { opacity: pressed || inactive ? 0.6 : 1 }]}
    >
      {/* Both knob colours are text-contrast pairs of their track. */}
      <View style={[styles.track, { backgroundColor: value ? p.accent : p.secondary }]}>
        <View
          style={[
            styles.knob,
            {
              backgroundColor: value ? p.onAccent : p.card,
              alignSelf: value ? 'flex-end' : 'flex-start',
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  target: {
    ...touchTargetStyle,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  track: {
    width: TOGGLE_TRACK_WIDTH,
    height: TOGGLE_TRACK_HEIGHT,
    borderRadius: TOGGLE_TRACK_HEIGHT / 2,
    padding: TOGGLE_TRACK_INSET,
    justifyContent: 'center',
  },
  knob: {
    width: TOGGLE_KNOB,
    height: TOGGLE_KNOB,
    borderRadius: TOGGLE_KNOB / 2,
  },
});
