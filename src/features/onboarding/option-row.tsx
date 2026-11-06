import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { makeStyles, Sizes, Spacing, Timing, useColors } from '@/constants/theme';
import { selectionHaptic } from '@/lib/haptics';
import { iosEasing, Motion } from '@/lib/motion';

export type OptionRowProps = {
  label: string;
  /** A second line, e.g. a tradition's main events. */
  detail?: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
  /** 'radio' when picking one turns the others off; 'checkbox' when several can be on. */
  role?: 'radio' | 'checkbox';
  /** Its place in the list: every row after the first has a hairline above it. */
  index?: number;
};

/**
 * One answer in the first questions, like Hinge's: plain words on white, a
 * hairline between rows, and a mark at the end that fills black with a tick
 * when it's picked (round when it's one of a kind, square when several can
 * be ticked). It dims under the finger the moment it's touched, the way iOS
 * rows do, and arrives with its page rather than after it.
 */
export function OptionRow({
  label,
  detail,
  icon,
  selected,
  onPress,
  role = 'radio',
  index = 0,
}: OptionRowProps) {
  const Colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const on = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    const target = selected ? 1 : 0;
    on.value = reduceMotion
      ? target
      : withTiming(target, { duration: Timing.press + 60, easing: iosEasing });
  }, [on, reduceMotion, selected]);

  const [offFill, onFill, offEdge, onEdge] = [
    Colors.canvas,
    Colors.text,
    Colors.borderInput,
    Colors.text,
  ];
  const mark = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [offFill, onFill]),
    borderColor: interpolateColor(on.value, [0, 1], [offEdge, onEdge]),
  }));

  return (
    <View style={index > 0 && styles.divider}>
      <Pressable
        accessibilityRole={role}
        accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
        accessibilityLabel={detail ? `${label}, ${detail}` : label}
        onPress={() => {
          selectionHaptic();
          onPress();
        }}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {icon && <Icon name={icon} size={24} color={Colors.text} />}
        <View style={styles.text}>
          <AppText variant="bodyLg" weight={600}>
            {label}
          </AppText>
          {detail && (
            <AppText variant="label" weight={400} color="text2">
              {detail}
            </AppText>
          )}
        </View>
        <Animated.View style={[styles.mark, role === 'checkbox' && styles.square, mark]}>
          {selected && (
            <Animated.View entering={Motion.popIn} exiting={Motion.popOut}>
              <Icon name="checkmark" size={15} color={Colors.canvas} weight="bold" />
            </Animated.View>
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separator,
  },
  row: {
    minHeight: Sizes.row + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  pressed: {
    opacity: 0.55,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  mark: {
    width: Sizes.checkbox,
    height: Sizes.checkbox,
    borderRadius: Sizes.checkbox / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  square: {
    borderRadius: 8,
  },
}));
