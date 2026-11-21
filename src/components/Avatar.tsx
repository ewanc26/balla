import React from 'react';
import { Image, Text, View } from 'react-native';
import { usePalette } from '../theme';

interface Props {
  avatar?: string | null;
  displayName?: string | null;
  size?: number;
}

export function Avatar({ avatar, displayName, size = 40 }: Props) {
  const p = usePalette();
  if (avatar) {
    return (
      <Image
        source={{ uri: avatar }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.divider }}
      />
    );
  }
  const initial = (displayName || '?').trim().charAt(0).toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: p.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: p.onAccent, fontWeight: '700', fontSize: Math.round(size * 0.45) }}>
        {initial}
      </Text>
    </View>
  );
}
