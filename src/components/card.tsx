import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Spacing } from '@/constants/theme';

export type CardProps = Omit<ViewProps, 'style'> & {
  /** Makes the whole card one tap target. Give it an `accessibilityLabel` that
   * says what opening it does, e.g. "Jaago, 9 vendor types". */
  onPress?: () => void;
  /** Buttons drawn over a tappable card, e.g. the heart on a vendor photo. */
  overlay?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * White rounded surface with iOS's continuous corners and a warm hairline
 * edge (the page is white too, in the Journey look). Tappable cards shrink a
 * little under the finger. Grows with its content (never a fixed height) so
 * Punjabi and large text don't clip. Pass `style={{ padding: 0 }}` for
 * edge-to-edge photos; the corners clip the photo.
 */
export function Card({ onPress, overlay, style, children, ...rest }: CardProps) {
  const styles = useStyles();
  if (!onPress) {
    return (
      <View {...rest} style={[styles.card, style]}>
        {children}
        {overlay}
      </View>
    );
  }

  return (
    <PressableScale
      accessibilityRole="button"
      {...rest}
      onPress={onPress}
      overlay={overlay}
      style={[styles.card, style]}
    >
      {children}
    </PressableScale>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    backgroundColor: Colors.surface,
    boxShadow: `inset 0 0 0 1px ${Colors.border}`,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    padding: Spacing.lg,
    overflow: 'hidden',
  },
}));
