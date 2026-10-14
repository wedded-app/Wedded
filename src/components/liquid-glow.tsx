import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useColors, type ColorToken } from '@/constants/theme';

type Blob = {
  color: ColorToken;
  /** Where its centre starts and how big it is, as fractions of the card. */
  x: number;
  y: number;
  size: number;
  /** How far it wanders, as fractions of the card. */
  dx: number;
  dy: number;
  seconds: number;
};

const BLOBS: Blob[] = [
  { color: 'heroLiquidPink', x: 0.85, y: 0.1, size: 1.1, dx: -0.35, dy: 0.3, seconds: 9 },
  { color: 'heroLiquidGold', x: 0.1, y: 0.95, size: 0.95, dx: 0.4, dy: -0.25, seconds: 12 },
  { color: 'heroLiquidDeep', x: 0.2, y: 0.25, size: 1.2, dx: 0.3, dy: 0.35, seconds: 15 },
];

/**
 * Coloured light moving like liquid inside a card: soft pink, gold and deep
 * maroon pools that drift, stretch and melt into each other on a slow loop.
 * It fills its parent (which should clip it); with Reduce Motion it holds
 * still.
 */
export function LiquidGlow() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <View
      style={styles.fill}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setSize(e.nativeEvent.layout)}
    >
      {size.width > 0 &&
        BLOBS.map((blob) => (
          <Pool key={blob.color} blob={blob} width={size.width} height={size.height} />
        ))}
    </View>
  );
}

function Pool({ blob, width, height }: { blob: Blob; width: number; height: number }) {
  const Colors = useColors();
  const reduceMotion = useReducedMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    drift.set(
      withRepeat(
        withTiming(1, { duration: blob.seconds * 1000, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [blob.seconds, drift, reduceMotion]);

  // Stretching one way while squeezing the other, out of step with the
  // drift, is what makes it look liquid rather than a sliding circle
  const moving = useAnimatedStyle(() => {
    const wobble = Math.sin(drift.value * Math.PI * 2);
    return {
      transform: [
        { translateX: blob.dx * width * drift.value },
        { translateY: blob.dy * height * drift.value },
        { rotate: `${drift.value * 70}deg` },
        { scaleX: 1 + 0.28 * wobble },
        { scaleY: 1 - 0.2 * wobble },
      ],
    };
  });

  const side = width * blob.size;
  const color = Colors[blob.color];
  const clear = color.replace(/[\d.]+\)$/, '0)');

  return (
    <Animated.View
      style={[
        styles.pool,
        {
          left: blob.x * width - side / 2,
          top: blob.y * height - side / 2,
          width: side,
          height: side,
        },
        gradient(`radial-gradient(circle, ${color} 0%, ${clear} 68%)`),
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
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  pool: {
    position: 'absolute',
  },
});
