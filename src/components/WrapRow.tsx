import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * A row of controls that wraps. A sideways-scrolling strip hides choices behind
 * a swipe, which Balla's visible-buttons rule does not allow.
 */
export function WrapRow({
  style,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 6 },
});
