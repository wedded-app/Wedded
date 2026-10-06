import { useEffect } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useColors, type ColorToken } from '@/constants/theme';

type Light = {
  color: ColorToken;
  /** Where its top-left corner starts, as a fraction of the screen. */
  x: number;
  y: number;
  /** Its size, as a fraction of the screen's width. */
  size: number;
  /** How far it drifts, as a fraction of the screen. */
  dx: number;
  dy: number;
  /** How long one drift takes; each light differs so they never line up. */
  seconds: number;
};

const LIGHTS: Light[] = [
  { color: 'glowBlush', x: -0.35, y: -0.18, size: 1.35, dx: 0.22, dy: 0.12, seconds: 11 },
  { color: 'glowGold', x: 0.3, y: 0.02, size: 1.15, dx: -0.2, dy: 0.16, seconds: 14 },
  { color: 'glowRose', x: -0.2, y: 0.42, size: 1.5, dx: 0.24, dy: -0.14, seconds: 17 },
];

/**
 * Soft coloured lights drifting slowly behind a page, like the glow behind
 * Apple's setup screens: blush, champagne and rose radial gradients that
 * wander and breathe on a loop. Purely decoration; with Reduce Motion they
 * stand still.
 */
export function AmbientGlow() {
  const { width, height } = useWindowDimensions();
  return (
    <View style={styles.fill} accessible={false} importantForAccessibility="no-hide-descendants">
      {LIGHTS.map((light) => (
        <Glow key={light.color} light={light} width={width} height={height} />
      ))}
    </View>
  );
}

function Glow({ light, width, height }: { light: Light; width: number; height: number }) {
  const Colors = useColors();
  const reduceMotion = useReducedMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    drift.set(
      withRepeat(
        withTiming(1, { duration: light.seconds * 1000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [drift, light.seconds, reduceMotion]);

  const moving = useAnimatedStyle(() => ({
    transform: [
      { translateX: light.dx * width * drift.value },
      { translateY: light.dy * height * drift.value },
      { scale: 1 + 0.12 * drift.value },
    ],
  }));

  const size = width * light.size;
  const color = Colors[light.color];
  // Fading to the same colour at no opacity, not to "transparent" (black at
  // no opacity), keeps the edge from turning grey.
  const clear = color.replace(/[\d.]+\)$/, '0)');

  return (
    <Animated.View
      style={[
        styles.light,
        { left: light.x * width, top: light.y * height, width: size, height: size },
        gradient(`radial-gradient(circle, ${color} 0%, ${clear} 70%)`),
        moving,
      ]}
    />
  );
}

const gradient = (css: string) =>
  (Platform.OS === 'web'
    ? { backgroundImage: css }
    : { experimental_backgroundImage: css }) as unknown as ViewStyle;

const styles = StyleSheet.create({
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  light: {
    position: 'absolute',
  },
});
