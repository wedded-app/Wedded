import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Sizes, Spacing, useColors } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { useLocale } from '@/i18n/locale-context';

/**
 * You, at the top right of Home (Fezy, 2026-11-11: the chat and gear bubbles
 * side by side looked odd). Signed out, a plain "Sign in"; signed in, your
 * initial in a tinted circle, which opens Settings (your profile is its first
 * row). Nothing while the session is still loading.
 */
export function YouButton() {
  const styles = useStyles();
  const { t } = useLocale();
  const router = useRouter();
  const { status, profile, requireSignIn } = useSession();

  if (status === 'loading') return null;
  if (status !== 'signedIn') {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => requireSignIn()}
        hitSlop={8}
        style={({ pressed }) => [styles.signIn, pressed && styles.pressed]}
      >
        <AppText variant="button" weight={600} maxFontSizeMultiplier={1.3}>
          {t('home.signIn')}
        </AppText>
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('settings.title')}
      onPress={() => router.push('/settings')}
      hitSlop={4}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Initial name={profile?.full_name} />
    </Pressable>
  );
}

/** Your initial in a tinted circle (top right of Home, and Settings' profile row). Signed out, a person. */
export function Initial({ name }: { name?: string | null }) {
  const Colors = useColors();
  const styles = useStyles();
  const initial = name?.trim().charAt(0).toUpperCase() ?? '';
  return (
    <View style={styles.initial} accessible={false}>
      {initial ? (
        <AppText variant="heading" weight={600} color="primary" maxFontSizeMultiplier={1.2}>
          {initial}
        </AppText>
      ) : (
        <Icon name="person-outline" size={24} color={Colors.primary} weight="semibold" />
      )}
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  signIn: {
    minHeight: Sizes.tapTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  initial: {
    width: Sizes.tapTarget,
    height: Sizes.tapTarget,
    borderRadius: Sizes.tapTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
}));
