import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

/** Home (#219): "Let vendors come to you", opening Post a request. */
export function PostRequestCard() {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('requests.home.title')}
      accessibilityHint={t('requests.post.hint')}
      onPress={() => router.push('/request-new')}
      style={styles.card}
    >
      <View style={styles.icon}>
        <Icon name="megaphone-outline" size={24} color={Colors.primary} />
      </View>
      <View style={styles.words}>
        <AppText weight={700}>{t('requests.home.title')}</AppText>
        <AppText color="text2">{t('requests.home.body')}</AppText>
      </View>
      <Icon name="chevron-forward" size={17} color={Colors.chevron} weight="semibold" />
    </PressableScale>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryTint,
  },
  words: {
    flex: 1,
    gap: 2,
  },
}));
