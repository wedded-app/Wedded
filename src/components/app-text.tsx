import { Text, useWindowDimensions, type TextProps } from 'react-native';

import {
  type ColorToken,
  fontStyle,
  type FontWeight,
  GURMUKHI_SIZE_MULTIPLIER,
  serifFamily,
  Typography,
  type TypographyVariant,
  useColors,
  useTextScale,
} from '@/constants/theme';
import { hasGurmukhi, type Locale } from '@/i18n';
import { useLocale } from '@/i18n/locale-context';

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: ColorToken;
  weight?: FontWeight;
  /** Force a script; by default the app language decides, and any string that
   * contains Gurmukhi is rendered in the Gurmukhi font regardless. */
  lang?: Locale;
  /** Fraunces (serifFamily) for a big display line, in English only. */
  serif?: boolean;
};

type TypeStyleOptions = {
  variant?: TypographyVariant;
  weight?: FontWeight;
  lang?: Locale;
  serif?: boolean;
  /** The text being shown; any Gurmukhi in it switches to the Gurmukhi font. */
  text?: string;
};

/**
 * Font family (and weight, for the system font), size, line height and
 * scaling cap for a type variant in the current script. AppText uses it; so
 * does anything that can't render AppText itself, like TextInput.
 */
export function useTypeStyle({
  variant = 'body',
  weight,
  lang,
  serif = false,
  text = '',
}: TypeStyleOptions) {
  const { locale } = useLocale();
  const textScale = useTextScale();
  const spec = Typography[variant];
  const script: Locale = lang ?? (locale === 'pa' || hasGurmukhi(text) ? 'pa' : 'en');
  const fontSize = (script === 'pa' ? spec.size * GURMUKHI_SIZE_MULTIPLIER : spec.size) * textScale;
  const fontWeight = weight ?? spec.weight;

  return {
    script,
    ...(serif && script === 'en'
      ? { fontFamily: serifFamily(fontWeight) }
      : fontStyle(script, fontWeight)),
    fontSize,
    lineHeight: Math.round(fontSize * (script === 'pa' ? spec.lineHeightPa : spec.lineHeight)),
    maxFontSizeMultiplier: spec.maxScale,
  };
}

/**
 * How much the phone's text size setting (capped the same way AppText caps
 * it) and the app's own Settings > Text size enlarge a variant. Multiply icon
 * sizes by it so icons next to text keep up.
 */
export function useFontScale(variant: TypographyVariant = 'body') {
  const { fontScale } = useWindowDimensions();
  return Math.min(fontScale, Typography[variant].maxScale) * useTextScale();
}

/**
 * The one Text component for the app. Picks the font family for the current
 * script, sets an explicit line height (Gurmukhi vowel marks clip without it),
 * and caps font scaling per variant so large-text mode never truncates.
 * Never apply `textTransform: 'uppercase'` or letter spacing to it: Gurmukhi
 * has no case, and mixed strings break.
 */
export function AppText({
  variant = 'body',
  color = 'text',
  weight,
  lang,
  serif,
  style,
  children,
  ...rest
}: AppTextProps) {
  const Colors = useColors();
  const text = typeof children === 'string' ? children : '';
  const { script, maxFontSizeMultiplier, ...type } = useTypeStyle({
    variant,
    weight,
    lang,
    serif,
    text,
  });

  return (
    <Text
      accessibilityLanguage={script}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
      style={[{ ...type, color: Colors[color] }, style]}
    >
      {children}
    </Text>
  );
}
