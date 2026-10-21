import { Text, useWindowDimensions, type TextProps } from 'react-native';

import {
  type ColorToken,
  fontStyle,
  type FontWeight,
  serifFamily,
  Typography,
  type TypographyVariant,
  useColors,
  useTextScale,
} from '@/constants/theme';

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: ColorToken;
  weight?: FontWeight;
  /** Fraunces (serifFamily) for a big display line. */
  serif?: boolean;
};

type TypeStyleOptions = {
  variant?: TypographyVariant;
  weight?: FontWeight;
  serif?: boolean;
};

/**
 * Font family (and weight, for the system font), size, line height and
 * scaling cap for a type variant. AppText uses it; so does anything that
 * can't render AppText itself, like TextInput.
 */
export function useTypeStyle({ variant = 'body', weight, serif = false }: TypeStyleOptions) {
  const textScale = useTextScale();
  const spec = Typography[variant];
  const fontSize = spec.size * textScale;
  const fontWeight = weight ?? spec.weight;

  return {
    ...(serif ? { fontFamily: serifFamily(fontWeight) } : fontStyle(fontWeight)),
    fontSize,
    lineHeight: Math.round(fontSize * spec.lineHeight),
    ...('tracking' in spec ? { letterSpacing: fontSize * spec.tracking } : {}),
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
 * The one Text component for the app. Picks the font family, sets an
 * explicit line height, and caps font scaling per variant so large-text mode
 * never truncates.
 */
export function AppText({
  variant = 'body',
  color = 'text',
  weight,
  serif,
  style,
  children,
  ...rest
}: AppTextProps) {
  const Colors = useColors();
  const { maxFontSizeMultiplier, ...type } = useTypeStyle({ variant, weight, serif });

  return (
    <Text
      accessibilityLanguage="en"
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...rest}
      style={[{ ...type, color: Colors[color] }, style]}
    >
      {children}
    </Text>
  );
}
