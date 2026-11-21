import React from 'react';
import { View } from 'react-native';

/**
 * Balla's wall mark, drawn with views so the app needs no SVG dependency.
 * The geometry is the 32x32 grid from `site/mark.svg` and
 * `scripts/gen-icons.py`: two full bars and a split third bar, with the last
 * segment faded to suggest the lighter brick in the source artwork.
 */
export function BrandMark({
  size = 36,
  background,
  foreground,
  square = false,
}: {
  size?: number;
  background: string;
  foreground: string;
  square?: boolean;
}) {
  const unit = size / 32;
  const bar = (x: number, y: number, width: number, opacity = 1) => (
    <View
      key={`${x}-${y}-${opacity}`}
      style={{
        position: 'absolute',
        left: x * unit,
        top: y * unit,
        width: width * unit,
        height: 4 * unit,
        backgroundColor: foreground,
        opacity,
      }}
    />
  );

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: square ? 0 : 8 * unit,
        backgroundColor: background,
        overflow: 'hidden',
      }}
    >
      {bar(7, 9, 18)}
      {bar(7, 15, 18)}
      {bar(7, 21, 11)}
      {bar(17, 21, 8, 0.55)}
    </View>
  );
}
