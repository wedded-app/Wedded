import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { FieldError } from '@/components/field-error';
import { Icon } from '@/components/icon';
import { BorderWidth, makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { selectionHaptic } from '@/lib/haptics';

export type CheckboxProps = Omit<PressableProps, 'children' | 'style' | 'onPress'> & {
  label: string;
  /** A second, grey line under the label, e.g. a phone number. */
  detail?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Shown in red under the row, e.g. when a required box is left empty. */
  error?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A round 28-point check (as in Reminders) with its label in one 52-tall row;
 * tapping anywhere on the row toggles it. Used for "I am 18 or older".
 */
export function Checkbox({
  label,
  detail,
  checked,
  onChange,
  error,
  disabled,
  style,
  accessibilityLabel,
  ...rest
}: CheckboxProps) {
  const Colors = useColors();
  const styles = useStyles();
  return (
    <View style={[styles.container, style]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={accessibilityLabel ?? (detail ? `${label}, ${detail}` : label)}
        accessibilityHint={error}
        accessibilityState={{ checked, disabled: !!disabled }}
        disabled={disabled}
        {...rest}
        onPress={() => {
          selectionHaptic();
          onChange(!checked);
        }}
        style={styles.row}
      >
        {({ pressed }) => (
          <>
            <View
              style={[
                styles.box,
                !!error && styles.boxInvalid,
                pressed && styles.boxPressed,
                checked && styles.boxChecked,
                disabled && (checked ? styles.boxCheckedDisabled : styles.boxDisabled),
              ]}
            >
              {checked && (
                <Icon name="checkmark" size={17} color={Colors.onPrimary} weight="bold" />
              )}
            </View>
            <View style={styles.label}>
              <AppText variant="bodyLg" color={disabled ? 'textDisabled' : 'text'}>
                {label}
              </AppText>
              {detail ? (
                <AppText variant="label" weight={400} color="text2">
                  {detail}
                </AppText>
              ) : null}
            </View>
          </>
        )}
      </Pressable>
      {error && <FieldError message={error} />}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  container: {
    gap: Spacing.xs,
  },
  row: {
    minHeight: Sizes.input,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  box: {
    width: Sizes.checkbox,
    height: Sizes.checkbox,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.checkbox,
    borderWidth: BorderWidth.control,
    borderColor: Colors.borderInput,
    backgroundColor: Colors.surface,
  },
  boxInvalid: {
    borderWidth: BorderWidth.strong,
    borderColor: Colors.error,
  },
  boxPressed: {
    backgroundColor: Colors.rowPressed,
  },
  boxChecked: {
    borderColor: Colors.primaryFill,
    backgroundColor: Colors.primaryFill,
  },
  boxDisabled: {
    borderColor: Colors.border,
    backgroundColor: Colors.fill,
  },
  // Ticked and can't be unticked here, e.g. a guest already invited
  boxCheckedDisabled: {
    borderColor: Colors.chevron,
    backgroundColor: Colors.chevron,
  },
  label: {
    flex: 1,
    gap: 2,
  },
}));
