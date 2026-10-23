import { useState, type Ref } from 'react';
import {
  Platform,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
  type TextInputInstance,
} from 'react-native';

import { AppText, useTypeStyle } from '@/components/app-text';
import { FieldError } from '@/components/field-error';
import { BorderWidth, makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';

export type TextFieldType = 'text' | 'name' | 'email' | 'phone' | 'city';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  /** Always shown above the box; placeholders alone disappear once you type. */
  label: string;
  /** One plain sentence under the label, e.g. why we ask. */
  hint?: string;
  /** Shown in red under the box; also read out by screen readers. */
  error?: string;
  /** Picks the keyboard and autofill: email and phone get their own keyboards. */
  type?: TextFieldType;
  ref?: Ref<TextInputInstance>;
  style?: StyleProp<ViewStyle>;
};

const TYPE_PROPS: Record<TextFieldType, TextInputProps> = {
  text: {},
  name: {
    autoComplete: 'name',
    textContentType: 'name',
    autoCapitalize: 'words',
    autoCorrect: false,
  },
  email: {
    autoComplete: 'email',
    textContentType: 'emailAddress',
    keyboardType: 'email-address',
    autoCapitalize: 'none',
    autoCorrect: false,
    spellCheck: false,
  },
  phone: {
    autoComplete: 'tel',
    textContentType: 'telephoneNumber',
    keyboardType: 'phone-pad',
  },
  city: {
    // Android has its own autofill hint for city; iOS uses textContentType.
    autoComplete: Platform.OS === 'android' ? 'postal-address-locality' : undefined,
    textContentType: 'addressCity',
    autoCapitalize: 'words',
  },
};

/**
 * A labelled text box, 52 tall: white with a thin grey outline on the grey
 * page, the outline turning the app colour while you type. The label stays
 * visible above the box, and the box grows with large system text. Pass
 * `ref` to move focus between fields.
 */
export function TextField({
  label,
  hint,
  error,
  type = 'text',
  ref,
  style,
  value,
  multiline,
  onFocus,
  onBlur,
  ...rest
}: TextFieldProps) {
  const Colors = useColors();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const { lineHeight, maxFontSizeMultiplier, ...font } = useTypeStyle({ variant: 'bodyLg' });

  return (
    <View style={[styles.container, style]}>
      {/* The input carries the label for screen readers, so this copy is hidden from them. */}
      <AppText variant="label" weight={600} style={styles.label} aria-hidden>
        {label}
      </AppText>
      {hint && (
        <AppText color="text2" style={styles.label} aria-hidden>
          {hint}
        </AppText>
      )}
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={Colors.text2}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        selectionColor={Colors.primary}
        cursorColor={Colors.primary}
        {...TYPE_PROPS[type]}
        {...rest}
        value={value}
        multiline={multiline}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[
          styles.input,
          font,
          // A line height on a single-line iOS input misplaces the text, so
          // only multiline boxes get one.
          multiline && { lineHeight },
          multiline && styles.multiline,
          focused && styles.focused,
          !!error && styles.invalid,
        ]}
      />
      {error && <FieldError message={error} />}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  container: {
    gap: Spacing.sm,
  },
  label: {
    paddingHorizontal: Spacing.xs,
  },
  input: {
    minHeight: Sizes.input,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.field,
    borderCurve: 'continuous',
    borderWidth: BorderWidth.hairline,
    borderColor: Colors.borderInput,
    backgroundColor: Colors.surface,
    color: Colors.text,
    outlineWidth: 0,
  },
  multiline: {
    minHeight: Sizes.input * 2,
    textAlignVertical: 'top',
  },
  focused: {
    borderWidth: BorderWidth.strong,
    borderColor: Colors.primary,
    // Keep the text still when the outline thickens.
    paddingHorizontal: Spacing.lg - 1,
    paddingVertical: Spacing.md - 1,
  },
  invalid: {
    borderWidth: BorderWidth.strong,
    borderColor: Colors.error,
    paddingHorizontal: Spacing.lg - 1,
    paddingVertical: Spacing.md - 1,
  },
}));
