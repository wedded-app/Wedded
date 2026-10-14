import { useEffect, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@/constants/theme';

/**
 * A thin edge of moving light around its child, like the glow Apple
 * Intelligence draws: maroon, rose, gold and blush turning slowly around a
 * rounded box, with a soft halo outside. The child sits on the page colour
 * inside it. With Reduce Motion the colours hold still.
 */
export function GlowRim({
  radius,
  width = 1.5,
  children,
  style,
}: {
  radius: number;
  width?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const Colors = useColors();
  const reduceMotion = useReducedMotion();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    turn.set(withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1));
  }, [reduceMotion, turn]);

  const spinning = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 360}deg` }],
  }));

  // A square big enough to cover the box at any angle
  const side = Math.hypot(box.width, box.height);
  const colors = `${Colors.heroFrom}, ${Colors.petalRose}, ${Colors.petalGold}, ${Colors.petalBlush}, ${Colors.heroTo}, ${Colors.heroFrom}`;

  return (
    <View style={[{ borderRadius: radius + width, boxShadow: Colors.glowShadow }, style]}>
      <View
        style={[styles.clip, { borderRadius: radius + width, padding: width }]}
        onLayout={(e) => setBox(e.nativeEvent.layout)}
      >
        {side > 0 && (
          <Animated.View
            style={[
              styles.spin,
              {
                width: side,
                height: side,
                left: (box.width - side) / 2,
                top: (box.height - side) / 2,
              },
              image(`linear-gradient(90deg, ${colors})`),
              spinning,
            ]}
          />
        )}
        <View style={{ borderRadius: radius, backgroundColor: Colors.canvas, overflow: 'hidden' }}>
          {children}
        </View>
      </View>
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
  spin: {
    position: 'absolute',
    pointerEvents: 'none',
  },
});
