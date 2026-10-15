import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import type { TypographyVariant } from '@/constants/theme';

// How wide the bright band is, and how long it takes to cross the text
const BAND = 64;
const CROSS_MS = 1600;

/**
 * The one thing in Wed that moves while it works: a line of grey text with a
 * brighter band sweeping across it, like ChatGPT's "Thinking". The band is a
 * 64-point window holding a second copy of the text in the full text colour,
 * slid the other way so the letters line up, even across two lines; no
 * masking needed. Inactive, or with Reduce Motion, it's still grey text
 * ending in "…".
 */
export function ShimmerText({
  text,
  active,
  variant = 'body',
}: {
  text: string;
  active: boolean;
  variant?: TypographyVariant;
}) {
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const x = useSharedValue(-BAND);
  const moving = active && !reduceMotion && size.width > 0;

  useEffect(() => {
    if (!moving) {
      cancelAnimation(x);
      x.value = -BAND;
      return;
    }
    x.value = -BAND;
    x.value = withRepeat(
      withTiming(size.width, { duration: CROSS_MS, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(x);
  }, [moving, size.width, x]);

  const band = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const copy = useAnimatedStyle(() => ({ transform: [{ translateX: -x.value }] }));

  if (!active || reduceMotion) {
    return (
      <AppText variant={variant} color="text2">
        {`${text}…`}
      </AppText>
    );
  }

  return (
    <View
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize((was) => (was.width === width && was.height === height ? was : { width, height }));
      }}
    >
      <AppText variant={variant} color="text2">
        {text}
      </AppText>
      {moving && (
        <Animated.View
          style={[styles.band, { height: size.height }, band]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          aria-hidden
        >
          <Animated.View style={[{ width: size.width }, copy]}>
            <AppText variant={variant} color="text">
              {text}
            </AppText>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: BAND,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
});
