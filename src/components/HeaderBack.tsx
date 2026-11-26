import React from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { touchTargetStyle } from '../lib/accessibility';
import { usePalette } from '../theme';

/**
 * The web header's back control. The library's own is 30px square in a browser
 * and announces the route underneath; native keeps its platform back button.
 */
export function HeaderBack({ onPress }: { onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={({ pressed }) => ({
        ...touchTargetStyle,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name="arrow-back" size={24} color={p.chromeAction} />
    </Pressable>
  );
}
