import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Springs } from '@/constants/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type ProgressRingProps = {
  /** 0 to 1. */
  value: number;
  size?: number;
  stroke?: number;
  color: string;
  trackColor: string;
  /** What sits in the middle, e.g. "7/18". */
  children?: ReactNode;
};

/**
 * A ring that fills clockwise from the top and springs to each new value
 * (straight there with Reduce Motion), like Fitness on an iPhone. Drawing
 * only; the caller says what it means for screen readers.
 */
export function ProgressRing({
  value,
  size = 88,
  stroke = 9,
  color,
  trackColor,
  children,
}: ProgressRingProps) {
  const reduceMotion = useReducedMotion();
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const shown = useSharedValue(0);

  useEffect(() => {
    const target = Math.min(1, Math.max(0, value));
    shown.set(reduceMotion ? target : withSpring(target, Springs.smooth));
  }, [value, reduceMotion, shown]);

  const arc = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - shown.value) }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={styles.turned}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={length}
          fill="none"
          animatedProps={arc}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.middle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Svg starts arcs at 3 o'clock; a quarter turn back starts it at 12
  turned: {
    transform: [{ rotate: '-90deg' }],
  },
  middle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
