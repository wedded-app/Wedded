import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';

import { Palettes, useScheme, type Palette, type Scheme } from '@/constants/theme';

// Real Liquid Glass needs iOS 26; some iOS 26 betas crash without the API
// check. Everything else gets a stand-in drawn below.
const nativeGlass =
  Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

export type GlassProps = {
  children?: ReactNode;
  /** Size, shape (borderRadius) and layout. Never animate its opacity to 0:
   * iOS drops the glass effect on a transparent view. */
  style?: StyleProp<ViewStyle>;
  /** Glows under the finger on iOS 26; use for buttons and bars you tap. */
  interactive?: boolean;
  /** For the one prominent action: tints the glass with the app colour. */
  tinted?: boolean;
  /** Force light or dark glass, e.g. dark over the Reels videos. */
  scheme?: Scheme;
};

/**
 * Apple's Liquid Glass, for floating chrome only: the tab bar, buttons over
 * photos and bars that float above content. Never for cards or rows (glass
 * on content muddles the hierarchy). On iOS 26 it is the system material;
 * on the web a blurred, saturated translucent layer; on Android and older
 * iPhones a milky white that keeps the text on it readable.
 */
export function Glass({ children, style, interactive, tinted, scheme: forced }: GlassProps) {
  const appScheme = useScheme();
  const scheme = forced ?? appScheme;
  const Colors = Palettes[scheme];
  if (nativeGlass) {
    return (
      <GlassView
        glassEffectStyle="regular"
        isInteractive={interactive}
        tintColor={tinted ? Colors.primaryFill : undefined}
        colorScheme={scheme}
        style={style}
      >
        {children}
      </GlassView>
    );
  }

  return (
    <View
      style={[
        Platform.OS === 'web' ? webStyle(Colors) : fallbackStyle(Colors),
        tinted && { backgroundColor: Colors.primaryFill },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const edge = (Colors: Palette) =>
  `0 0 0 0.5px rgba(0, 0, 0, 0.06), inset 0 1px 0 ${Colors.glassEdge}`;

const webStyle = (Colors: Palette): ViewStyle => ({
  backgroundColor: Colors.glassWeb,
  // Not in React Native's types; the web passes it through (with -webkit-).
  ...({ backdropFilter: 'blur(24px) saturate(190%)' } as ViewStyle),
  boxShadow: `0 8px 28px ${Colors.glassShadow}, ${edge(Colors)}`,
});

const fallbackStyle = (Colors: Palette): ViewStyle => ({
  backgroundColor: Colors.glassFallback,
  boxShadow: `0 6px 20px ${Colors.glassShadow}, ${edge(Colors)}`,
});
