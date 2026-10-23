import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Sizes, useColors } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { useLocale } from '@/i18n/locale-context';

/**
 * Your initial in a circle at the top right of Home, beside the chat button:
 * opens Profile (saved, requests, messages, settings), which used to be a tab
 * before Wedding took its place (DECISIONS.md, 2026-10-23). Signed out, a
 * person glyph.
 */
export function ProfileButton() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const router = useRouter();
  const { profile } = useSession();
  const initial = profile?.full_name?.trim().charAt(0).toUpperCase() ?? '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('tabs.profile')}
      onPress={() => router.push('/profile')}
      hitSlop={4}
      style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
    >
      {initial ? (
        <AppText variant="heading" weight={600} color="primary" maxFontSizeMultiplier={1.2}>
          {initial}
        </AppText>
      ) : (
        <Icon name="person-outline" size={24} color={Colors.primary} weight="semibold" />
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((Colors) => ({
  circle: {
    width: Sizes.tapTarget,
    height: Sizes.tapTarget,
    borderRadius: Sizes.tapTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  pressed: {
    opacity: 0.7,
  },
}));
