import { router } from 'expo-router';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import {
  backgroundCss,
  makeStyles,
  Radius,
  SchemeContext,
  Spacing,
  useColors,
} from '@/constants/theme';
import { useFamiliesLookingSummary } from '@/data/requests';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { useCountUp } from '@/lib/use-count-up';

/**
 * On My business, for vendors not on Wedded Pro (#221): a small night card,
 * the real number of families looking counting up in gold, what they need,
 * and Wedded Pro. Counts only, never a family's details.
 */
export function ProTeaser({ vendorId }: { vendorId: string }) {
  return (
    <SchemeContext.Provider value="dark">
      <TeaserCard vendorId={vendorId} />
    </SchemeContext.Provider>
  );
}

/**
 * How many families near a vendor are looking, and what they need in words:
 * "3 families need a Dhol player" when it's all one kind, else "3 families
 * are looking". Counts only, never a family's details.
 */
export function useLookingTeaser(vendorId: string) {
  const { t } = useLocale();
  const summary = useFamiliesLookingSummary(vendorId);
  const total = summary.data?.total ?? 0;
  const kinds = summary.data?.byCategory ?? [];
  const what =
    kinds.length === 1
      ? t('looking.teaser.needCategory', {
          count: total,
          category: localized(kinds[0].categoryName),
        })
      : t('looking.teaser.need', { count: total });
  return { total, what };
}

function TeaserCard({ vendorId }: { vendorId: string }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { total, what } = useLookingTeaser(vendorId);
  const shown = useCountUp(total, 1000);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${total} ${what}`}
      accessibilityHint={t('looking.teaser.hint')}
      onPress={() => router.push('/business/pro')}
      pressedScale={0.98}
      style={[styles.card, glow(Colors.glowBlush, Colors.glowGold)]}
    >
      <View style={styles.eyebrow}>
        <Icon name="sparkles" size={15} color={Colors.champagne} />
        <AppText variant="label" weight={700} color="champagne">
          {t('pro.eyebrow')}
        </AppText>
      </View>
      <View style={styles.row}>
        <AppText weight={600} style={styles.number} maxFontSizeMultiplier={1.2}>
          {String(shown)}
        </AppText>
        <AppText variant="heading" weight={500} style={styles.grow}>
          {what}
        </AppText>
      </View>
      <View style={styles.cta}>
        <AppText weight={700}>{t('looking.teaser.goPro')}</AppText>
        <Icon name="arrow-forward" size={18} color={Colors.text} weight="semibold" />
      </View>
    </PressableScale>
  );
}

const glow = (a: string, b: string) => {
  const css = `radial-gradient(circle at 85% 0%, ${a} 0%, rgba(0,0,0,0) 55%), radial-gradient(circle at 0% 100%, ${b} 0%, rgba(0,0,0,0) 50%)`;
  return backgroundCss(css);
};

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.night,
    overflow: 'hidden',
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  number: {
    fontSize: 64,
    lineHeight: 72,
    color: Colors.champagne,
    fontVariant: ['tabular-nums'],
  },
  grow: {
    flex: 1,
    minWidth: 160,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: 24,
    backgroundColor: Colors.nightCardStrong,
    borderWidth: 1,
    borderColor: Colors.nightLine,
  },
}));
