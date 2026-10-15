import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { type ColorToken, useColors } from '@/constants/theme';

// Each bar breathes at its own pace, so together they read as a voice
const PACES = [520, 380, 610, 450, 560, 400, 500];
// Where each bar rests with Reduce Motion: a still waveform
const STILL = [0.45, 0.75, 1, 0.6, 0.85, 0.5, 0.7];

/**
 * Seven rounded bars that rise and fall while Wed listens (the composer's
 * dictation and the voice screen). Decorative. Still with Reduce Motion.
 * `height` is the tallest a bar gets; the bars' width follows it.
 */
export function VoiceBars({
  color = 'text',
  height = 44,
}: {
  color?: ColorToken;
  height?: number;
}) {
  const barWidth = Math.max(3, Math.round(height / 7));
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: barWidth, height }}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {PACES.map((pace, index) => (
        <Bar
          key={index}
          pace={pace}
          still={STILL[index]}
          color={color}
          height={height}
          width={barWidth}
        />
      ))}
    </View>
  );
}

function Bar({
  pace,
  still,
  color,
  height,
  width,
}: {
  pace: number;
  still: number;
  color: ColorToken;
  height: number;
  width: number;
}) {
  const Colors = useColors();
  const reduceMotion = useReducedMotion();
  const level = useSharedValue(reduceMotion ? still : 0.2);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(level);
      level.value = still;
      return;
    }
    level.value = withRepeat(
      withTiming(1, { duration: pace, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(level);
  }, [pace, still, reduceMotion, level]);

  const style = useAnimatedStyle(() => ({ height: Math.max(width, height * level.value) }));

  return (
    <Animated.View
      style={[{ width, borderRadius: width / 2, backgroundColor: Colors[color] }, style]}
    />
  );
}
