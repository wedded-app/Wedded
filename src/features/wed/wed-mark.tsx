import { Image } from 'expo-image';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

import { type ColorToken, useColors } from '@/constants/theme';

// The ribbon knot as a flat silhouette (no satin shading, so a tint reads as
// one solid colour). Small marks use a bolder cut whose strokes hold together
// at tab-bar size. The shaded ribbon.png stays for the app icon and intro.
const RIBBON = require('../../../assets/images/ribbon-flat.png');
const GLYPH = require('../../../assets/images/ribbon-glyph.png');
const ASPECT = 509 / 430;
const GLYPH_UP_TO = 32;

/**
 * Wed's mark: the Wedded ribbon, tinted with a theme colour. `size` is its
 * width; the height follows the ribbon's shape. It never moves: when Wed is
 * working, the words say so (ShimmerText), not the mark. Decorative, so
 * screen readers skip it.
 */
export function WedMark({
  size = 20,
  color = 'text',
  style,
}: {
  size?: number;
  color?: ColorToken;
  style?: StyleProp<ViewStyle>;
}) {
  const Colors = useColors();
  const height = Math.round(size / ASPECT);
  return (
    <View
      style={[{ width: size, height }, style]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Image
        source={size <= GLYPH_UP_TO ? GLYPH : RIBBON}
        tintColor={Colors[color]}
        contentFit="contain"
        style={{ width: size, height }}
        accessible={false}
      />
    </View>
  );
}
