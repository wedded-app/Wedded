import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { type ColorToken, makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger' | 'neutral' | 'plain';

export type ButtonProps = Omit<PressableProps, 'children' | 'style' | 'disabled'> & {
  label: string;
  /** primary: the one main action on a screen, a filled capsule. secondary: a
   * tinted capsule (iOS "bordered"). text: a plain link-style action.
   * danger: red, for actions that can't be undone (delete account).
   * neutral: a grey capsule in the text colour, for a second choice where
   * maroon should stay on the one main action (Wed). plain: a link-style
   * action in the text colour (Wed's Not now, Change, Pause). */
  variant?: ButtonVariant;
  /** The label's colour instead of the variant's, e.g. text2 for a dismissive plain action. */
  labelColor?: ColorToken;
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
  neutral: 'text',
  plain: 'text',
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
  labelColor: labelColorProp,
  ...rest
}: ButtonProps) {
  const Colors = useColors();
  const styles = useStyles();
  const pressedStyles = usePressedStyles();
  const labelColor: ColorToken = disabled
    ? 'textDisabled'
    : (labelColorProp ?? LABEL_COLOR[variant]);
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
        disabled && variant !== 'text' && variant !== 'plain' && styles.disabled,
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
  neutral: {
    backgroundColor: Colors.fill,
  },
  plain: {
    paddingHorizontal: Spacing.lg,
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
  neutral: {
    backgroundColor: Colors.fillPressed,
  },
  plain: {
    opacity: 0.5,
  },
}));
