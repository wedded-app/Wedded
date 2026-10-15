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
import { eventIcon } from '@/components/event-icon';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import type { TraditionEvent } from '@/data/reference';
import { localized } from '@/i18n/localized';
import { Motion } from '@/lib/motion';

export type EventChoiceProps = {
  event: TraditionEvent;
  selected: boolean;
  onPress: () => void;
  /** Full width instead of half, for very large text. */
  wide?: boolean;
  /** Shown but not changeable (a relative who can only view the plan). */
  disabled?: boolean;
};

/**
 * One event to pick in the "Your events" sheet: its icon, name and when it
 * happens. Picking it tints the card, fills the icon and pops a checkmark in.
 */
export function EventChoice({ event, selected, onPress, wide, disabled }: EventChoiceProps) {
  const Colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const on = useSharedValue(selected ? 1 : 0);
  const [off, tint, edge, onEdge] = [
    Colors.surface,
    Colors.primaryTint,
    Colors.border,
    Colors.primary,
  ];

  useEffect(() => {
    on.value = reduceMotion ? (selected ? 1 : 0) : withTiming(selected ? 1 : 0, { duration: 200 });
  }, [on, reduceMotion, selected]);

  const card = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [off, tint]),
    borderColor: interpolateColor(on.value, [0, 1], [edge, onEdge]),
  }));

  return (
    <Animated.View
      layout={Motion.layout}
      entering={Motion.enter}
      exiting={Motion.exit}
      style={[styles.slot, wide && styles.wide]}
    >
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected, disabled: !!disabled }}
        accessibilityLabel={localized(event.name)}
        disabled={disabled}
        onPress={onPress}
        pressedScale={0.95}
        style={styles.fill}
      >
        <Animated.View style={[styles.card, card]}>
          <View style={styles.top}>
            <View style={[styles.iconWell, selected && styles.iconWellOn]}>
              <Icon
                name={eventIcon(event.slug)}
                size={22}
                color={selected ? Colors.onPrimary : Colors.primary}
              />
            </View>
            {selected && (
              <Animated.View entering={Motion.popIn} exiting={Motion.popOut}>
                <Icon name="checkmark-circle" size={26} color={Colors.primary} />
              </Animated.View>
            )}
          </View>
          <AppText variant="body" weight={600}>
            {localized(event.name)}
          </AppText>
          {event.timing && (
            <AppText variant="caption" color="text2" numberOfLines={2}>
              {localized(event.timing)}
            </AppText>
          )}
        </Animated.View>
      </PressableScale>
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  slot: {
    width: '48.5%',
  },
  wide: {
    width: '100%',
  },
  fill: {
    flex: 1,
  },
  card: {
    flex: 1,
    minHeight: 132,
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.photo,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  iconWell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  iconWellOn: {
    backgroundColor: Colors.primaryFill,
  },
}));
