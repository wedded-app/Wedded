import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon } from '@/components/icon';
import { Springs, useColors } from '@/constants/theme';
import { selectionHaptic } from '@/lib/haptics';

/** How far to pull a message before letting go replies to it. */
const THRESHOLD = 56;
/** The furthest it follows the finger. */
const MAX_PULL = 80;

/**
 * Swipe a message to the right to reply to it, as in WhatsApp: it follows
 * the finger, a reply arrow fades in behind it, the phone ticks once the pull
 * is far enough, and letting go there replies. Scrolling up and down always
 * wins. With Reduce Motion it snaps back instead of springing. Screen
 * readers can't swipe: give the message itself a "Reply" accessibility action.
 */
export function SwipeToReply({
  children,
  onReply,
  enabled = true,
  align,
}: {
  children: ReactNode;
  onReply: () => void;
  enabled?: boolean;
  /** Where the message sits in its row: its side, or the full width for cards. */
  align: 'left' | 'right' | 'stretch';
}) {
  const Colors = useColors();
  const reduceMotion = useReducedMotion();
  const pull = useSharedValue(0);
  const armed = useSharedValue(false);

  const pan = Gesture.Pan()
    .enabled(enabled)
    // Right only, and only once it's clearly sideways
    .activeOffsetX(12)
    .failOffsetX(-12)
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      const next = Math.min(MAX_PULL, Math.max(0, event.translationX * 0.75));
      pull.set(next);
      const past = next >= THRESHOLD;
      if (past !== armed.get()) {
        armed.set(past);
        if (past) scheduleOnRN(selectionHaptic);
      }
    })
    .onEnd(() => {
      if (armed.get()) scheduleOnRN(onReply);
    })
    .onFinalize(() => {
      armed.set(false);
      pull.set(reduceMotion ? 0 : withSpring(0, Springs.snappy));
    });

  const moving = useAnimatedStyle(() => ({ transform: [{ translateX: pull.get() }] }));
  const arrow = useAnimatedStyle(() => ({
    opacity: interpolate(pull.get(), [0, THRESHOLD], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(pull.get(), [0, THRESHOLD], [0.6, 1], 'clamp') }],
  }));

  return (
    <View style={styles[align]}>
      <Animated.View pointerEvents="none" style={[styles.arrow, arrow]}>
        <Icon name="arrow-undo" size={20} color={Colors.text2} />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={moving}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  left: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  right: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  stretch: {
    alignSelf: 'stretch',
  },
  // Behind the message, showing in the space it leaves as it slides right
  arrow: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
