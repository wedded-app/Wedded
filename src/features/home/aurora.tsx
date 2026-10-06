import { useEffect } from 'react';
import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const glow = (color: string) => {
  const image = `radial-gradient(circle at center, ${color} 0%, rgba(0,0,0,0) 70%)`;
  return (
    Platform.OS === 'web' ? { backgroundImage: image } : { experimental_backgroundImage: image }
  ) as ViewStyle;
};

// Marigold and rose, the wedding colours, softly lit behind the maroon
const MARIGOLD = glow('rgba(240,160,48,0.55)');
const ROSE = glow('rgba(255,110,150,0.45)');

/**
 * Two soft glows drifting slowly behind a maroon card, like light moving
 * over silk. Background only, so the text on the card keeps its contrast;
 * still when the phone's Reduce Motion is on. Fill the card with it
 * (it positions itself) and give the card `overflow: 'hidden'`.
 */
export function Aurora({ size = 260 }: { size?: number }) {
  const reduceMotion = useReducedMotion();
  const drift = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    drift.set(
      withRepeat(withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
  }, [drift, reduceMotion]);

  const first = useAnimatedStyle(() => ({
    transform: [{ translateX: -40 + drift.value * 90 }, { translateY: drift.value * 30 }],
  }));
  const second = useAnimatedStyle(() => ({
    transform: [{ translateX: 30 - drift.value * 80 }, { translateY: 20 - drift.value * 40 }],
  }));

  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          MARIGOLD,
          { width: size, height: size, top: -size / 2.4, right: -size / 3 },
          first,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          ROSE,
          { width: size, height: size, bottom: -size / 2, left: -size / 3 },
          second,
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  glow: {
    position: 'absolute',
  },
});
