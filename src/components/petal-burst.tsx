import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useColors, type ColorToken } from '@/constants/theme';

const PIECES = 34;
const DURATION = 2200;
const COLORS: ColorToken[] = ['petalRose', 'petalBlush', 'petalMaroon', 'petalGold', 'petalGold'];

type Piece = {
  color: ColorToken;
  /** A petal (leaf-shaped) or a speck of gold dust. */
  dust: boolean;
  size: number;
  /** Launch speed in points per run, up and out from the middle. */
  vx: number;
  vy: number;
  spin: number;
  /** Side-to-side sway as it falls, like a petal on the air. */
  sway: number;
  delay: number;
};

// Fixed per seed, so a re-render never reshuffles a burst mid-flight
function pieces(seed: number): Piece[] {
  let n = seed * 9301 + 49297;
  const random = () => {
    n = (n * 9301 + 49297) % 233280;
    return n / 233280;
  };
  return Array.from({ length: PIECES }, (_, i) => {
    const angle = -Math.PI / 2 + (random() - 0.5) * Math.PI * 0.95;
    const speed = 280 + random() * 480;
    const dust = i % 3 === 0;
    return {
      color: dust ? 'petalGold' : COLORS[Math.floor(random() * COLORS.length)],
      dust,
      size: dust ? 5 + random() * 4 : 11 + random() * 8,
      vx: Math.cos(angle) * speed * 0.75,
      vy: Math.sin(angle) * speed,
      spin: (random() - 0.5) * 900,
      sway: 10 + random() * 26,
      delay: random() * 0.08,
    };
  });
}

/**
 * A short burst of rose petals and gold dust for the big moments: an event
 * all booked, the plan made, a request sent. It fires whenever `play`
 * changes (after the first value), never takes a tap, and with Reduce
 * Motion it shows nothing.
 */
export function PetalBurst({ play, origin = 0.4 }: { play: number; origin?: number }) {
  const reduceMotion = useReducedMotion();
  // Its own box, not the window: in a computer's browser the app sits in a phone frame
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const progress = useSharedValue(0);
  const list = useMemo(() => pieces(play + 1), [play]);

  useEffect(() => {
    if (reduceMotion || play === 0) return;
    progress.set(0);
    progress.set(withTiming(1, { duration: DURATION, easing: Easing.linear }));
  }, [play, progress, reduceMotion]);

  if (reduceMotion || play === 0) return null;
  return (
    <View
      style={styles.fill}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setSize(e.nativeEvent.layout)}
    >
      {width > 0 &&
        list.map((piece, i) => (
          <Petal
            key={`${play}-${i}`}
            piece={piece}
            progress={progress}
            x={width / 2}
            y={height * origin}
            floor={height}
          />
        ))}
    </View>
  );
}

function Petal({
  piece,
  progress,
  x,
  y,
  floor,
}: {
  piece: Piece;
  progress: SharedValue<number>;
  x: number;
  y: number;
  floor: number;
}) {
  const Colors = useColors();
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, (progress.value - piece.delay) / (1 - piece.delay));
    if (t <= 0 || t >= 1) return { opacity: 0 };
    // Up and out fast, then drifting down slowly like something light
    const rise = 1 - Math.pow(1 - Math.min(t / 0.35, 1), 3);
    const fall = Math.max(0, t - 0.25);
    const dy = piece.vy * 0.5 * rise + fall * fall * floor * 0.9;
    const dx = piece.vx * 0.5 * rise + Math.sin(t * 9 + piece.spin) * piece.sway * fall * 2;
    return {
      opacity: t < 0.7 ? 1 : (1 - t) / 0.3,
      transform: [
        { translateX: dx },
        { translateY: dy },
        { rotate: `${piece.spin * t}deg` },
        { rotateX: `${piece.spin * t * 0.8}deg` },
        { scale: Math.min(1, t * 8) },
      ],
    };
  });
  const size = piece.size;
  return (
    <Animated.View
      style={[
        piece.dust ? styles.dust : styles.petal,
        {
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: piece.dust ? size : size * 1.3,
          borderRadius: piece.dust ? size / 2 : undefined,
          backgroundColor: Colors[piece.color],
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: 10,
  },
  petal: {
    position: 'absolute',
    // A teardrop: round on two corners, pointed on the others
    borderTopLeftRadius: 999,
    borderBottomRightRadius: 999,
    borderTopRightRadius: 3,
    borderBottomLeftRadius: 3,
  },
  dust: {
    position: 'absolute',
  },
});
