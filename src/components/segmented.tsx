import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { makeStyles, Sizes, Springs } from '@/constants/theme';
import { selectionHaptic } from '@/lib/haptics';

export type SegmentedOption<T extends string> = { value: T; label: string };

export type SegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** What the choice is, e.g. "Text size". */
  accessibilityLabel: string;
};

const PAD = 3;

/**
 * The iOS 26 segmented control: a grey capsule with a raised thumb that
 * springs to the picked option. Labels wrap rather than clip.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedProps<T>) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const itemWidth = width > 0 ? (width - PAD * 2) / options.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    const target = index * itemWidth;
    x.value = reduceMotion || itemWidth === 0 ? target : withSpring(target, Springs.snappy);
  }, [index, itemWidth, reduceMotion, x]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      style={styles.track}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {itemWidth > 0 && <Animated.View style={[styles.thumb, { width: itemWidth }, thumb]} />}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={option.label}
            onPress={() => {
              if (!selected) selectionHaptic();
              onChange(option.value);
            }}
            style={styles.option}
          >
            <AppText variant="label" weight={selected ? 600 : 500} style={styles.label}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  track: {
    minHeight: Sizes.tapTarget - 4,
    flexDirection: 'row',
    padding: PAD,
    borderRadius: 999,
    backgroundColor: Colors.fill,
  },
  thumb: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: 999,
    backgroundColor: Colors.thumb,
    boxShadow: '0 3px 8px rgba(0, 0, 0, 0.12), 0 1px 1px rgba(0, 0, 0, 0.06)',
    pointerEvents: 'none',
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  label: {
    textAlign: 'center',
  },
}));
