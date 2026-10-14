import {
  ActivityIndicator,
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { type ColorToken, makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';

export type ButtonProps = Omit<PressableProps, 'children' | 'style' | 'disabled'> & {
  label: string;
  /** primary: the one main action on a screen, a filled capsule. secondary: a
   * tinted capsule (iOS "bordered"). text: a plain link-style action.
   * danger: red, for actions that can't be undone (delete account). */
  variant?: ButtonVariant;
  /** Optional icon before the label. */
  icon?: IconName;
  /** Shows a spinner and ignores taps, e.g. while sending. */
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const LABEL_COLOR: Record<ButtonVariant, ColorToken> = {
  primary: 'onPrimary',
  secondary: 'primary',
  text: 'primary',
  danger: 'onPrimary',
};

/**
 * The app's button, an iOS 26 capsule at least 52 tall that stretches to the
 * width of its container, and lets long (Punjabi) labels wrap onto a second
 * line instead of clipping.
 */
export function Button({
  label,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const Colors = useColors();
  const styles = useStyles();
  const pressedStyles = usePressedStyles();
  const labelColor: ColorToken = disabled ? 'textDisabled' : LABEL_COLOR[variant];
  const scale = useFontScale('button');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && pressedStyles[variant],
        disabled && variant !== 'text' && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={Colors[labelColor]} />
      ) : (
        icon && (
          <Icon
            name={icon}
            size={Sizes.iconSmall * scale}
            color={Colors[labelColor]}
            weight="semibold"
          />
        )
      )}
      <AppText variant="button" color={labelColor} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  base: {
    minHeight: Sizes.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.button,
  },
  primary: {
    backgroundColor: Colors.primaryFill,
    // A soft sheen from top to bottom, like satin ribbon
    ...(Platform.OS === 'web'
      ? { backgroundImage: Colors.buttonSheen }
      : { experimental_backgroundImage: Colors.buttonSheen }),
    boxShadow: '0px 6px 16px rgba(122, 23, 41, 0.28)',
  },
  secondary: {
    backgroundColor: Colors.primaryTint,
  },
  text: {
    paddingHorizontal: Spacing.lg,
  },
  danger: {
    backgroundColor: Colors.errorFill,
  },
  disabled: {
    backgroundColor: Colors.fill,
  },
  label: {
    flexShrink: 1,
    textAlign: 'center',
  },
}));

const usePressedStyles = makeStyles((Colors) => ({
  primary: {
    backgroundColor: Colors.primaryFillPressed,
    ...(Platform.OS === 'web'
      ? { backgroundImage: 'none' }
      : { experimental_backgroundImage: 'none' }),
  },
  secondary: {
    backgroundColor: Colors.fillPressed,
  },
  text: {
    opacity: 0.5,
  },
  danger: {
    backgroundColor: Colors.errorFillPressed,
  },
}));
