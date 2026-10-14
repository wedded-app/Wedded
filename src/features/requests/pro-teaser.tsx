import { router } from 'expo-router';
import { Platform, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Spacing, useColors } from '@/constants/theme';
import { useLocale } from '@/i18n/locale-context';

import { useFamiliesLookingSummary } from './requests-source';
import { useRequestWords } from './use-request-words';

/**
 * For vendors not on Wedded Pro (#221): how many families near them are
 * looking, as a number, and Go Pro. Counts only, never a family's details.
 * `compact` is the card on My business; the full one fills Families looking.
 */
export function ProTeaser({ vendorId, compact = false }: { vendorId: string; compact?: boolean }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const words = useRequestWords();
  const summary = useFamiliesLookingSummary(vendorId);
  const s = summary.data;
  const image = `linear-gradient(135deg, ${Colors.heroFrom} 0%, ${Colors.heroTo} 100%)`;

  const headline = !s
    ? t('looking.teaser.loading')
    : s.categorySlug && s.categoryCount > 0
      ? t('looking.teaser.category', {
          count: s.categoryCount,
          category: words.category(s.categorySlug),
        })
      : t('looking.teaser.total', { count: s.total });

  return (
    <View
      style={[
        styles.card,
        (Platform.OS === 'web'
          ? { backgroundImage: image }
          : { experimental_backgroundImage: image }) as unknown as ViewStyle,
      ]}
    >
      <View style={styles.eyebrow}>
        <Icon name="sparkles" size={16} color={Colors.onHero2} />
        <AppText variant="label" weight={600} color="onHero2">
          {t('looking.teaser.eyebrow')}
        </AppText>
      </View>
      <AppText
        variant={compact ? 'heading' : 'title'}
        color="onHero"
        accessibilityLiveRegion="polite"
      >
        {headline}
      </AppText>
      {!compact && <AppText color="onHero2">{t('looking.teaser.body')}</AppText>}
      <Button
        variant="secondary"
        label={t('looking.teaser.goPro')}
        onPress={() => router.push('/business/pro')}
        style={styles.button}
      />
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.heroFrom,
    overflow: 'hidden',
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  button: {
    backgroundColor: Colors.surface,
  },
}));
