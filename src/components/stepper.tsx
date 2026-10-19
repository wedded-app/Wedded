import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

export type StepperProps = {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** What the number counts, read out with it, e.g. "People coming". */
  accessibilityLabel: string;
};

/**
 * − 4 +: a small count (how many people) between two round 48-point
 * buttons. Screen readers hear one control and swipe up or down to change it.
 */
export function Stepper({ value, min, max, onChange, accessibilityLabel }: StepperProps) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const step = (by: number) => {
    const next = Math.min(max, Math.max(min, value + by));
    if (next === value) return;
    selectionHaptic();
    onChange(next);
  };
  const button = (by: 1 | -1) => {
    const disabled = by < 0 ? value <= min : value >= max;
    return (
      <Pressable
        // Phones read the row as one control; the web can reach each button
        accessibilityRole="button"
        accessibilityLabel={t(by < 0 ? 'common.fewer' : 'common.more')}
        disabled={disabled}
        onPress={() => step(by)}
        hitSlop={4}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        <Icon
          name={by < 0 ? 'remove' : 'add'}
          size={24}
          color={disabled ? Colors.textDisabled : Colors.primary}
          weight="semibold"
        />
      </Pressable>
    );
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={styles.row}
    >
      {button(-1)}
      <AppText variant="title" style={styles.value}>
        {value}
      </AppText>
      {button(1)}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  button: {
    width: Sizes.tapTarget,
    height: Sizes.tapTarget,
    borderRadius: Sizes.tapTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    backgroundColor: Colors.fill,
  },
  value: {
    minWidth: 40,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
}));
