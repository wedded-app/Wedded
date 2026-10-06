import type { ReactNode } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  type SharedValue,
} from 'react-native-reanimated';

/** Where the first item starts in `progress`, the gap to the next, and how long each takes. */
const FIRST = 0.2;
const STEP = 0.07;
const SPAN = 0.45;
/** How far each item rises. */
const RISE = 26;

/**
 * One of a list of things that rise into place one after another as
 * `progress` goes from 0 to 1, and sink back in reverse as it returns (the
 * welcome screen's sign-in pills). One spring drives the whole list, so it
 * can turn around halfway without a jump. With Reduce Motion they only fade.
 */
export function Reveal({
  progress,
  index,
  children,
}: {
  progress: SharedValue<number>;
  /** Its place in the list; up to 5 fit in one pass of `progress`. */
  index: number;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const style = useAnimatedStyle(() => {
    const start = FIRST + index * STEP;
    const shown = Math.min(1, Math.max(0, (progress.value - start) / SPAN));
    return {
      opacity: shown,
      transform: [{ translateY: reduceMotion ? 0 : (1 - shown) * RISE }],
    };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}
