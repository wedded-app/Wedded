import { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useColors, type ColorToken } from '@/constants/theme';

const GRAIN = require('../../assets/images/grain.png');

type Light = {
  color: ColorToken;
  /** Where its top-left corner starts, as a fraction of the card. */
  x: number;
  y: number;
  /** Its size, as a fraction of the card's width. */
  size: number;
  /** How far it drifts, as a fraction of the card. */
  dx: number;
  dy: number;
  /** How long one drift takes; each differs so they never line up. */
  seconds: number;
};

const LIGHTS: Light[] = [
  { color: 'ombreWine', x: -0.35, y: 0.2, size: 1.3, dx: 0.3, dy: -0.2, seconds: 13 },
  { color: 'ombreRose', x: 0.3, y: -0.6, size: 1.1, dx: -0.35, dy: 0.3, seconds: 9 },
  { color: 'ombreBlush', x: 0.7, y: 0.1, size: 0.8, dx: -0.4, dy: -0.25, seconds: 11 },
  { color: 'ombreGold', x: -0.2, y: -0.55, size: 0.75, dx: 0.45, dy: 0.35, seconds: 15 },
];

// A soft shine from the top left, like light on satin
const SHEEN =
  'linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 45%, rgba(0,0,0,0) 70%, rgba(0,0,0,0.18) 100%)';

/**
 * A slowly moving ombre for a card: wine, rose, blush and a little champagne
 * light drifting under a fine grain, so it looks like printed satin rather
 * than a flat gradient. Fills its parent (give the parent overflow: hidden
 * and rounded corners). Decoration only; still with Reduce Motion.
 */
export function OmbreBackground() {
  const Colors = useColors();
  const [size, setSize] = useState({ width: 0, height: 0 });

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: Colors.ombreBase }]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((was) => (was.width === width && was.height === height ? was : { width, height }));
      }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {size.width > 0 &&
        LIGHTS.map((light) => (
          <Glow key={light.color} light={light} width={size.width} height={size.height} />
        ))}
      <View style={[StyleSheet.absoluteFill, gradient(SHEEN)]} />
      <Image source={GRAIN} resizeMode="repeat" style={[StyleSheet.absoluteFill, styles.grain]} />
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
      { scale: 1 + 0.15 * drift.value },
    ],
  }));

  const size = width * light.size;
  const color = Colors[light.color];
  // Fading to the same colour at no opacity keeps the edge from turning grey
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
  light: {
    position: 'absolute',
  },
  grain: {
    width: '100%',
    height: '100%',
    opacity: 0.14,
    mixBlendMode: 'overlay',
  },
});
