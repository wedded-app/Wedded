import { router } from 'expo-router';
import { Platform, View, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { ProgressBar } from '@/components/progress-bar';
import { makeStyles, Radius, Spacing, useColors, type Palette } from '@/constants/theme';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { findForPlan } from '@/features/planner/find-for-plan';
import { daysUntil } from '@/features/planner/plan';
import { StartPlanCard } from '@/features/planner/start-plan-card';
import { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';
import { useCountUp } from '@/lib/use-count-up';

import { Aurora } from './aurora';

const gradient = (Colors: Palette) => {
  const image = `linear-gradient(150deg, ${Colors.heroFrom} 0%, ${Colors.heroTo} 100%)`;
  return (
    Platform.OS === 'web' ? { backgroundImage: image } : { experimental_backgroundImage: image }
  ) as ViewStyle;
};

/**
 * The top of Home: the wedding on maroon silk with light drifting over it.
 * The countdown, the date and how much is booked (tap for My Wedding), then
 * the one thing to do next with a Find button, so the first screen says
 * exactly where the family is. Without a wedding in the account (signed out,
 * or not started) it's the StartPlanCard; with no events yet, Choose your events.
 */
export function HomeHero() {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const { plan, wedding, loading, chosen, progress, next, isPending, canEdit } = usePlanView();
  const days = plan.weddingDate ? daysUntil(plan.weddingDate) : null;
  const counting = days !== null && days >= 0;
  const shownDays = useCountUp(counting ? days : 0);
  const share = progress.total > 0 ? progress.done / progress.total : 0;
  const first = next[0];

  // A plan belongs to an account. While it loads, the phone's copy (if any) stands in.
  if (!wedding && (!loading || !plan.syncedWeddingId)) {
    if (loading) return null;
    return (
      <Animated.View entering={Motion.rise}>
        <StartPlanCard />
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={Motion.rise} style={[styles.card, gradient(Colors)]}>
      <Aurora />

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('planner.title')}
        onPress={() => router.push('/plan')}
        pressedScale={0.98}
        style={styles.top}
      >
        <View style={styles.eyebrowRow}>
          <AppText variant="label" weight={600} color="onHero2">
            {t('planner.yourWedding')}
          </AppText>
          <Icon name="chevron-forward" size={17} color={Colors.onHero2} weight="semibold" />
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

        {chosen.length > 0 && (
          <View style={styles.progress}>
            <ProgressBar value={share} color={Colors.onHero} trackColor={Colors.heroTrack} />
            <AppText variant="label" weight={500} color="onHero2">
              {[
                t('planner.progress', { done: progress.done, total: progress.total }),
                t('planner.eventsCount', { count: chosen.length }),
              ].join(' · ')}
            </AppText>
          </View>
        )}
      </PressableScale>

      {!isPending && chosen.length === 0 && canEdit && (
        <PressableScale
          accessibilityRole="button"
          onPress={() => router.push('/plan-events')}
          style={styles.startButton}
        >
          <Icon name="sparkles" size={20} color={Colors.heroFrom} />
          <AppText weight={700} style={styles.startText}>
            {t('planner.chooseEvents')}
          </AppText>
        </PressableScale>
      )}

      {chosen.length > 0 && first && (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('planner.find', { name: localized(first.need.name, locale) })}
          onPress={() => {
            selectionHaptic();
            findForPlan(
              first.need.categorySlug,
              first.need.groupSlug,
              first.eventSlug,
              plan.guests?.[first.eventSlug],
            );
          }}
          style={styles.next}
        >
          <View style={styles.nextIcon}>
            <Icon name={groupIcon(first.need.groupSlug)} size={22} color={Colors.onHero} />
          </View>
          <View style={styles.grow}>
            <AppText variant="caption" weight={600} color="onHero2">
              {t('home.nextUp')}
            </AppText>
            <AppText weight={700} color="onHero" numberOfLines={1}>
              {localized(first.need.name, locale)}
            </AppText>
            <AppText variant="label" weight={400} color="onHero2" numberOfLines={1}>
              {localized(first.eventName, locale)}
            </AppText>
          </View>
          <View style={styles.findPill}>
            <AppText variant="label" weight={700} style={styles.startText}>
              {t('planner.findShort')}
            </AppText>
          </View>
        </PressableScale>
      )}

      {chosen.length > 0 && !first && (
        <View style={styles.next}>
          <Icon name="checkmark-circle" size={26} color={Colors.onHero} />
          <AppText weight={600} color="onHero" style={styles.grow}>
            {t('planner.nothingNext')}
          </AppText>
        </View>
      )}
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  card: {
    gap: Spacing.lg,
    padding: Spacing.xl,
    borderRadius: Radius.card + 4,
    borderCurve: 'continuous',
    backgroundColor: Colors.heroFrom,
    overflow: 'hidden',
  },
  top: {
    gap: Spacing.md,
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
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 52,
    borderRadius: Radius.button,
    backgroundColor: Colors.onHero,
  },
  startText: {
    color: Colors.heroFrom,
  },
  next: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 64,
    paddingVertical: Spacing.sm,
    paddingLeft: Spacing.sm,
    paddingRight: Spacing.sm,
    borderRadius: Radius.card - 6,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  nextIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  grow: {
    flex: 1,
  },
  findPill: {
    minHeight: 40,
    minWidth: 64,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.button,
    backgroundColor: Colors.onHero,
  },
}));
