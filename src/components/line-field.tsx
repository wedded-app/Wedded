import { useEffect, useState, type Ref } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppText, useTypeStyle } from '@/components/app-text';
import { FieldError } from '@/components/field-error';
import { TYPE_PROPS, type TextFieldType } from '@/components/text-field';
import { makeStyles, Spacing, Timing, useColors } from '@/constants/theme';
import { iosEasing } from '@/lib/motion';

export type LineFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  /**
   * What the field is, for screen readers. On a one-question page the
   * question above it is what people read, so there's no visible label.
   */
  label: string;
  /** One plain line under the line, e.g. what the answer is used for. */
  hint?: string;
  error?: string;
  type?: TextFieldType;
  /** 'large' for the one answer on a question page; 'medium' for a search above a list. */
  size?: 'large' | 'medium';
  ref?: Ref<TextInputInstance>;
};

/**
 * A text field as one line, like Hinge's questions: the words big and bold
 * on the page, a hairline under them that an ink line draws across from the
 * left while you type, and nothing boxed in. For pages that ask one thing;
 * forms with several fields keep TextField, which shows its label.
 */
export function LineField({
  label,
  hint,
  error,
  type = 'text',
  size = 'large',
  ref,
  onFocus,
  onBlur,
  ...rest
}: LineFieldProps) {
  const Colors = useColors();
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const [focused, setFocused] = useState(false);
  const { lineHeight, maxFontSizeMultiplier, ...font } = useTypeStyle({
    variant: size === 'large' ? 'title' : 'heading',
    weight: size === 'large' ? 700 : 600,
  });
  const drawn = useSharedValue(0);

  useEffect(() => {
    const target = focused || !!error ? 1 : 0;
    drawn.value = reduceMotion
      ? target
      : withTiming(target, { duration: Timing.page, easing: iosEasing });
  }, [drawn, focused, error, reduceMotion]);

  const ink = useAnimatedStyle(() => ({ transform: [{ scaleX: drawn.value }] }));

  return (
    <View style={styles.container}>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={Colors.textDisabled}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        selectionColor={Colors.primary}
        cursorColor={Colors.text}
        {...TYPE_PROPS[type]}
        {...rest}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, font]}
      />
      <View style={styles.track}>
        <View style={styles.hairline} />
        <Animated.View
          style={[styles.ink, ink, { backgroundColor: error ? Colors.error : Colors.text }]}
        />
      </View>
      {error ? (
        <FieldError message={error} />
      ) : hint ? (
        <AppText variant="label" weight={400} color="text2" aria-hidden>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  container: {
    gap: Spacing.sm + 2,
    paddingHorizontal: Spacing.xs,
  },
  input: {
    minHeight: 48,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 0,
    color: Colors.text,
    outlineWidth: 0,
  },
  // The hairline at rest; the ink line grows over it from the left
  track: {
    height: 2,
  },
  hairline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: Colors.borderInput,
  },
  ink: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    transformOrigin: 'left',
  },
}));
