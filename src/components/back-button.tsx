import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { AppText, useFontScale } from '@/components/app-text';
import { Glass } from '@/components/glass';
import { Icon } from '@/components/icon';
import { Sizes, Spacing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

/** Where Back goes with nothing to go back to, instead of Home: "Wed" and the Wed chat. */
export type BackFallback = { href: Href; label: string };

/**
 * "‹ Back" in a glass capsule, the iOS 26 back button, but keeping the word
 * for people who don't know the gesture. With nothing to go back to (a cold
 * deep link, or a web page opened from a QR code or a shared link) it says
 * Home and goes there, or names and opens `fallback` (a Wed page goes back
 * to the Wed chat).
 */
export function BackButton({ fallback }: { fallback?: BackFallback } = {}) {
  const Colors = useColors();
  const router = useRouter();
  const { t } = useLocale();
  const scale = Math.min(useFontScale('button'), 1.3);
  const canGoBack = router.canGoBack();
  const label = canGoBack ? t('common.back') : (fallback?.label ?? t('tabs.home'));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() =>
        canGoBack ? router.back() : fallback ? router.navigate(fallback.href) : router.navigate('/')
      }
      hitSlop={4}
    >
      {({ pressed }) => (
        <Glass interactive style={[styles.capsule, pressed && styles.pressed]}>
          <Icon
            name={canGoBack || fallback ? 'chevron-back' : 'home-outline'}
            size={20 * scale}
            color={Colors.primary}
            weight="semibold"
          />
          <AppText variant="button" color="primary" maxFontSizeMultiplier={1.3}>
            {label}
          </AppText>
        </Glass>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  capsule: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: Spacing.sm + 2,
    paddingRight: Spacing.lg,
    borderRadius: Sizes.glassButton / 2,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
  },
});
