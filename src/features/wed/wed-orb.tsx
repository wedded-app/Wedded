import { useEffect } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@/constants/theme';

import { OrbMesh } from './orb-mesh';
import { WedMark } from './wed-mark';

/**
 * Wed's face: a glowing satin orb (Apple's mesh gradient on phones, soft
 * radial light on the web) with the white ribbon in the middle. It turns and
 * breathes slowly; with Reduce Motion it holds still. Decorative.
 */
export function WedOrb({ size = 88 }: { size?: number }) {
  const Colors = useColors();
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    turn.set(withRepeat(withTiming(1, { duration: 18000, easing: Easing.linear }), -1));
    breathe.set(
      withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [breathe, reduceMotion, turn]);

  const spinning = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 360}deg` }],
  }));
  const breathing = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.04 * breathe.value }],
    opacity: 0.55 + 0.25 * breathe.value,
  }));

  const round = { width: size, height: size, borderRadius: size / 2 };
  return (
    <View
      style={[styles.center, { width: size * 1.5, height: size * 1.5 }]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {/* The glow around it */}
      <Animated.View
        style={[
          styles.halo,
          { width: size * 1.5, height: size * 1.5, borderRadius: size },
          image(`radial-gradient(circle, ${Colors.glowBlush} 0%, ${clear(Colors.glowBlush)} 70%)`),
          breathing,
        ]}
      />
      <View style={[styles.clip, round, { boxShadow: Colors.cardShadow }]}>
        <Animated.View style={[StyleSheet.absoluteFill, spinning]}>
          <OrbMesh />
        </Animated.View>
        {/* A glossy top light, as on a pearl */}
        <View
          style={[
            StyleSheet.absoluteFill,
            image(
              'radial-gradient(ellipse at 50% 12%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 55%)',
            ),
          ]}
        />
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <WedMark size={Math.round(size * 0.46)} color="onHero" />
        </View>
      </View>
    </View>
  );
}

// The same colour at no opacity, so a fade never turns grey
function clear(color: string) {
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0)`;
  }
  return color.replace(/[\d.]+\)$/, '0)');
}

const image = (css: string) =>
  (Platform.OS === 'web'
    ? { backgroundImage: css }
    : { experimental_backgroundImage: css }) as unknown as ViewStyle;

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
  clip: {
    overflow: 'hidden',
  },
});
