import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Glass } from '@/components/glass';
import { Spacing, Timing } from '@/constants/theme';
import { iosEasing } from '@/lib/motion';

// Over the video in light and dark mode alike, like the rest of a reel
const PILL = 'rgba(255,255,255,0.95)';
const ON_PILL = '#000000';
const OFF = 'rgba(255,255,255,0.9)';
const PAD = 3;

type Slot = { x: number; width: number };

/**
 * For you and Following at the top of Reels, as an iOS segmented switch: a
 * dark glass capsule with the two names, and a white pill that slides behind
 * the one you're on (220 ms on iOS's curve; it jumps with Reduce Motion).
 */
export function FeedSwitch<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [slots, setSlots] = useState<Partial<Record<T, Slot>>>({});
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const placed = useRef(false);
  const slot = slots[value];

  useEffect(() => {
    if (!slot) return;
    // The first time it appears where it belongs; after that it slides
    if (!placed.current || reduceMotion) {
      x.value = slot.x;
      width.value = slot.width;
      placed.current = true;
      return;
    }
    const timing = { duration: Timing.quick, easing: iosEasing };
    x.value = withTiming(slot.x, timing);
    width.value = withTiming(slot.width, timing);
  }, [slot, reduceMotion, x, width]);

  const pill = useAnimatedStyle(() => ({
    width: width.value,
    transform: [{ translateX: x.value }],
  }));

  const measure = (option: T) => (event: LayoutChangeEvent) => {
    const { x: left, width: wide } = event.nativeEvent.layout;
    setSlots((all) => {
      const now = all[option];
      return now && now.x === left && now.width === wide
        ? all
        : { ...all, [option]: { x: left, width: wide } };
    });
  };

  return (
    <View accessibilityRole="tablist">
      <Glass scheme="dark" style={styles.capsule}>
        {slot && <Animated.View pointerEvents="none" style={[styles.pill, pill]} />}
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChange(option.value)}
              onLayout={measure(option.value)}
              // Slim over the video; its touch area is 48 tall
              hitSlop={{ top: 5, bottom: 5 }}
              style={styles.segment}
            >
              <AppText
                variant="label"
                weight={600}
                numberOfLines={1}
                maxFontSizeMultiplier={1.4}
                style={selected ? styles.on : styles.off}
              >
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  capsule: {
    flexDirection: 'row',
    padding: PAD,
    borderRadius: 999,
  },
  pill: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: 0,
    borderRadius: 999,
    backgroundColor: PILL,
  },
  segment: {
    minHeight: 38,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  on: {
    color: ON_PILL,
  },
  off: {
    color: OFF,
  },
});
