import { Platform, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { ProgressBar } from '@/components/progress-bar';
import { makeStyles, Radius, Spacing, useColors, type Palette } from '@/constants/theme';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { useLocale } from '@/i18n/locale-context';
import { useCountUp } from '@/lib/use-count-up';

import { daysUntil, type WeddingPlan } from './plan';

export type CountdownCardProps = {
  plan: WeddingPlan;
  progress: { done: number; total: number };
  eventsCount: number;
  /** Makes the card a button (Home opens My Wedding with it). */
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** The card's maroon-to-rose gradient (also behind "Plan your wedding"). */
export const gradient = (Colors: Palette) => {
  const image = `linear-gradient(135deg, ${Colors.heroFrom} 0%, ${Colors.heroTo} 100%)`;
  return (
    Platform.OS === 'web' ? { backgroundImage: image } : { experimental_backgroundImage: image }
  ) as ViewStyle;
};

/**
 * The wedding at a glance, like an Apple Invites card: "41 days to go" in
 * big white numbers on maroon, the date, and how much is booked. Before a
 * date is set it asks when the wedding is.
 */
export function CountdownCard({
  plan,
  progress,
  eventsCount,
  onPress,
  accessibilityLabel,
}: CountdownCardProps) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const days = plan.weddingDate ? daysUntil(plan.weddingDate) : null;
  const counting = days !== null && days >= 0;
  const shownDays = useCountUp(counting ? days : 0);
  const share = progress.total > 0 ? progress.done / progress.total : 0;

  const content = (
    <>
      <Icon name="sparkles" size={120} color={Colors.onHero} style={styles.glow} />
      <View style={styles.eyebrowRow}>
        <AppText variant="label" weight={600} color="onHero2">
          {t('planner.yourWedding')}
        </AppText>
        {onPress && (
          <Icon name="chevron-forward" size={17} color={Colors.onHero2} weight="semibold" />
        )}
      </View>

      {counting && plan.weddingDate ? (
        <View>
          <View style={styles.countRow}>
            <AppText weight={800} color="onHero" style={styles.count} maxFontSizeMultiplier={1.4}>
              {String(shownDays)}
            </AppText>
            <AppText variant="heading" weight={600} color="onHero2">
              {t('planner.days', { count: days })}
            </AppText>
          </View>
          <AppText variant="bodyLg" weight={600} color="onHero">
            {formatDate(plan.weddingDate)}
          </AppText>
        </View>
      ) : days !== null ? (
        <AppText variant="title" color="onHero">
          {t('planner.married')}
        </AppText>
      ) : (
        <View style={styles.askDate}>
          <AppText variant="title" color="onHero">
            {t('planner.whenTitle')}
          </AppText>
          <AppText color="onHero2">{t('planner.whenBody')}</AppText>
        </View>
      )}

      {eventsCount > 0 && (
        <View style={styles.progress}>
          <ProgressBar value={share} color={Colors.onHero} trackColor={Colors.heroTrack} />
          <AppText variant="label" weight={500} color="onHero2">
            {[
              t('planner.progress', { done: progress.done, total: progress.total }),
              t('planner.eventsCount', { count: eventsCount }),
            ].join(' · ')}
          </AppText>
        </View>
      )}
    </>
  );

  if (!onPress) return <View style={[styles.card, gradient(Colors)]}>{content}</View>;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      pressedScale={0.98}
      style={[styles.card, gradient(Colors)]}
    >
      {content}
    </PressableScale>
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
  glow: {
    position: 'absolute',
    top: -14,
    right: -18,
    opacity: 0.12,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    columnGap: Spacing.sm,
  },
  count: {
    fontSize: 72,
    lineHeight: 80,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
  },
  askDate: {
    gap: Spacing.xs,
  },
  progress: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
}));
