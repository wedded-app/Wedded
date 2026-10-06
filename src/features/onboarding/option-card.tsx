import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import type { Locale } from '@/i18n';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

export type OptionCardProps = {
  label: string;
  labelLang?: Locale;
  /** A second line, e.g. a tradition's main events. */
  detail?: string;
  detailLang?: Locale;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
  /** 'radio' when picking one turns the others off; 'checkbox' when several can be on. */
  role?: 'radio' | 'checkbox';
  /** Its place in the list, so the cards arrive one after another. */
  index?: number;
};

const RADIUS = 24;

/**
 * A big answer to tap in the first questions: a soft grey bubble with black
 * text. Picking it turns it white with a black outline and pops a tick in.
 */
export function OptionCard({
  label,
  labelLang,
  detail,
  detailLang,
  icon,
  selected,
  onPress,
  role = 'radio',
  index = 0,
}: OptionCardProps) {
  const Colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const on = useSharedValue(selected ? 1 : 0);
  const [off, offEdge, picked, pickedEdge] = [
    Colors.canvasCard,
    Colors.canvasCard,
    Colors.canvas,
    Colors.text,
  ];

  useEffect(() => {
    on.value = reduceMotion ? (selected ? 1 : 0) : withTiming(selected ? 1 : 0, { duration: 180 });
  }, [on, reduceMotion, selected]);

  const card = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [off, picked]),
    borderColor: interpolateColor(on.value, [0, 1], [offEdge, pickedEdge]),
  }));

  return (
    <Animated.View entering={Motion.stagger(index)}>
      <PressableScale
        accessibilityRole={role}
        accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
        accessibilityLabel={detail ? `${label}, ${detail}` : label}
        pressedScale={0.97}
        onPress={() => {
          selectionHaptic();
          onPress();
        }}
      >
        <Animated.View style={[styles.card, card]}>
          {icon && (
            <View style={[styles.icon, selected && styles.iconOn]}>
              <Icon name={icon} size={22} color={selected ? Colors.canvas : Colors.text} />
            </View>
          )}
          <View style={styles.text}>
            <AppText variant="bodyLg" weight={600} lang={labelLang}>
              {label}
            </AppText>
            {detail && (
              <AppText variant="label" weight={400} color="text2" lang={detailLang}>
                {detail}
              </AppText>
            )}
          </View>
          {/* Round when it's one of a kind, square when several can be ticked. */}
          <View
            style={[styles.mark, role === 'checkbox' && styles.square, selected && styles.markOn]}
          >
            {selected && (
              <Animated.View entering={Motion.popIn} exiting={Motion.popOut}>
                <Icon name="checkmark" size={15} color={Colors.canvas} weight="bold" />
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </PressableScale>
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    minHeight: Sizes.row + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg + 2,
    paddingVertical: Spacing.md + 2,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    borderWidth: 2,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.canvas,
  },
  iconOn: {
    backgroundColor: Colors.text,
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
    borderColor: Colors.borderInput,
    alignItems: 'center',
    justifyContent: 'center',
  },
  square: {
    borderRadius: 8,
  },
  markOn: {
    borderColor: Colors.text,
    backgroundColor: Colors.text,
  },
}));
