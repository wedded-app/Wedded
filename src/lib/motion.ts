import {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  ZoomIn,
  ZoomOut,
} from 'react-native-reanimated';

import { Timing } from '@/constants/theme';

/** iOS's own curve: quick off the mark, settling without overshoot. */
export const iosEasing = Easing.bezier(...Timing.curve);

/**
 * Layout animations for things that appear, go, or move because something
 * else changed (a checklist opening, a ticked row leaving a list). Crisp, on
 * iOS's curve, like the rest of the app (the final look, 2026-10-23), and
 * Reanimated skips them when the phone's Reduce Motion is on.
 */
export const Motion = {
  /** Siblings sliding into their new place. */
  layout: LinearTransition.duration(Timing.quick).easing(iosEasing),
  /** Content fading in, e.g. the rows of a checklist that opened. */
  enter: FadeIn.duration(200),
  /** Content fading out. */
  exit: FadeOut.duration(160),
  /** A card arriving on screen: up a little while it fades in. */
  rise: FadeInDown.duration(Timing.quick).easing(iosEasing),
  /** A checkmark or badge appearing and going. */
  popIn: ZoomIn.duration(200).easing(iosEasing),
  popOut: ZoomOut.duration(140),
  /** The nth item of a list arriving just after the one before it. */
  stagger: (index: number) =>
    FadeInDown.duration(Timing.quick)
      .easing(iosEasing)
      .delay(40 + index * 30),
};
