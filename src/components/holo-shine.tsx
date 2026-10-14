import { useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@/constants/theme';

/**
 * A rainbow sheen that sweeps across its children every few seconds, like
 * the shine on a holographic trading card. For the Founding vendor badge.
 * With Reduce Motion the badge just sits still, without the sheen.
 */
export function HoloShine({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const Colors = useColors();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || width === 0) return;
    sweep.set(
      withRepeat(
        withSequence(
          withDelay(600, withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.cubic) })),
          withDelay(2600, withTiming(0, { duration: 0 })),
        ),
        -1,
      ),
    );
  }, [reduceMotion, sweep, width]);

  const moving = useAnimatedStyle(() => ({
    transform: [{ translateX: -width * 1.2 + sweep.value * width * 2.4 }],
  }));

  return (
    <View style={[styles.clip, style]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {children}
      {!reduceMotion && width > 0 && (
        <Animated.View style={[styles.sheen, { width: width * 1.2 }, image(Colors.holo), moving]} />
      )}
    </View>
  );
}

const image = (css: string) =>
  (Platform.OS === 'web'
    ? { backgroundImage: css }
    : { experimental_backgroundImage: css }) as unknown as ViewStyle;

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    pointerEvents: 'none',
  },
});
