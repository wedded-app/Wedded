import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { makeStyles, Sizes, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

/**
 * The gear at the top right of Home, beside the chat button: opens Settings in
 * one tap, with your profile as its first row (Fezy, 2026-11-05: Settings was
 * two taps deep behind your initial). The same solid circle as the chat button.
 */
export function SettingsButton() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const router = useRouter();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('settings.title')}
      onPress={() => router.push('/settings')}
      hitSlop={4}
      style={({ pressed }) => [styles.circle, pressed && styles.pressed]}
    >
      <Icon name="settings-outline" size={24} color={Colors.primary} weight="semibold" />
    </Pressable>
  );
}

/** Your initial in a tinted circle, for the profile row at the top of Settings. Signed out, a person. */
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
  circle: {
    width: Sizes.tapTarget,
    height: Sizes.tapTarget,
    borderRadius: Sizes.tapTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  },
  pressed: {
    opacity: 0.7,
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
