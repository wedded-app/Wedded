import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { makeStyles, Spacing } from '@/constants/theme';

const DOT = 8;
const BEAT_MS = 360;

/**
 * "Harjit K. is typing…": three dots in a bubble on their side, rising one
 * after another, with the words under it. With Reduce Motion the dots stay
 * still. Screen readers hear the words once, when they appear.
 */
export function TypingIndicator({ label }: { label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.row} accessibilityLiveRegion="polite" accessible accessibilityLabel={label}>
      <View style={styles.bubble}>
        {[0, 1, 2].map((i) => (
          <Dot key={i} index={i} />
        ))}
      </View>
      <AppText variant="caption" color="text2">
        {label}
      </AppText>
    </View>
  );
}

function Dot({ index }: { index: number }) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    lift.set(
      withDelay(
        index * (BEAT_MS / 2),
        withRepeat(
          withSequence(
            withTiming(1, { duration: BEAT_MS }),
            withTiming(0, { duration: BEAT_MS }),
            withTiming(0, { duration: BEAT_MS / 2 }),
          ),
          -1,
        ),
      ),
    );
  }, [index, lift, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.4 + lift.value * 0.6,
    transform: [{ translateY: -lift.value * 3 }],
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

const useStyles = makeStyles((Colors) => ({
  row: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    gap: 3,
    marginTop: Spacing.sm,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 40,
    paddingHorizontal: Spacing.md + 2,
    borderRadius: 20,
    borderCurve: 'continuous',
    borderBottomLeftRadius: 6,
    backgroundColor: Colors.surface,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: Colors.text2,
  },
}));
