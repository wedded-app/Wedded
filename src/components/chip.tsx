import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { selectionHaptic } from '@/lib/haptics';

export type ChipProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  /** Ignored for role 'button'. */
  selected?: boolean;
  /** 'checkbox' when several chips in a row can be on (the default); 'radio'
   * when picking one turns the others off; 'button' when the chip goes
   * somewhere instead of toggling. Screen readers announce the difference. */
  role?: 'checkbox' | 'radio' | 'button';
  /** 'ink' fills a selected chip with the text colour instead of the app colour. */
  tone?: 'primary' | 'ink';
  style?: StyleProp<ViewStyle>;
};

// The capsule is 40 tall; the slop makes the tap target 48.
// Put chips in a wrapping row with at least `Spacing.sm` between rows.
const HIT_SLOP = (Sizes.tapTarget - Sizes.chip) / 2;

/**
 * A capsule: selectable, or a plain button (role 'button'). Grey fill like
 * iOS filter buttons; selected chips fill with the app colour and get a tick,
 * so colour is never the only signal. Picking one gives a light haptic tick.
 * Labels wrap rather than clip.
 */
export function Chip({
  label,
  selected: selectedProp = false,
  role = 'checkbox',
  tone = 'primary',
  disabled,
  style,
  accessibilityLabel,
  onPress,
  ...rest
}: ChipProps) {
  const Colors = useColors();
  const styles = useStyles();
  const scale = useFontScale('label');
  const selected = role !== 'button' && selectedProp;

  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={
        role === 'button'
          ? { disabled: !!disabled }
          : role === 'radio'
            ? { selected, disabled: !!disabled }
            : { checked: selected, disabled: !!disabled }
      }
      disabled={disabled}
      hitSlop={{ top: HIT_SLOP, bottom: HIT_SLOP }}
      {...rest}
      onPress={(event: GestureResponderEvent) => {
        if (role !== 'button') selectionHaptic();
        onPress?.(event);
      }}
      style={({ pressed }) => [
        styles.chip,
        selected && (tone === 'ink' ? styles.selectedInk : styles.selected),
        pressed &&
          (selected ? (tone === 'ink' ? styles.pressed : styles.selectedPressed) : styles.pressed),
        disabled && styles.disabled,
        style,
      ]}
    >
      {selected && (
        <Icon
          name="checkmark"
          size={Sizes.iconSmall * scale * 0.85}
          color={tone === 'ink' ? Colors.surface : Colors.onPrimary}
          weight="bold"
        />
      )}
      <AppText
        variant="label"
        weight={selected ? 600 : 500}
        color={
          disabled ? 'textDisabled' : selected ? (tone === 'ink' ? 'surface' : 'onPrimary') : 'text'
        }
        style={styles.label}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  chip: {
    minHeight: Sizes.chip,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.chip,
    // White and outlined, on the page or on a grey card
    backgroundColor: Colors.bg,
    boxShadow: `inset 0 0 0 1px ${Colors.border}`,
  },
  selected: {
    backgroundColor: Colors.primaryFill,
    boxShadow: 'none',
  },
  selectedInk: {
    backgroundColor: Colors.text,
    boxShadow: 'none',
  },
  pressed: {
    backgroundColor: Colors.rowPressed,
  },
  selectedPressed: {
    backgroundColor: Colors.primaryFillPressed,
  },
  disabled: {
    backgroundColor: Colors.fill,
    boxShadow: 'none',
  },
  label: {
    flexShrink: 1,
  },
}));
