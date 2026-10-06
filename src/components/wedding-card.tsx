import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { CheckCircle } from '@/components/check-circle';
import { groupIcon } from '@/components/group-icon';
import { Icon } from '@/components/icon';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { CountdownCard } from '@/features/planner/countdown-card';
import { findForPlan } from '@/features/planner/find-for-plan';
import { StartPlanCard } from '@/features/planner/start-plan-card';
import { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

/**
 * The wedding on Home: the countdown card (opens My Wedding) and under it the
 * next few essentials to book, each with a tick and Find, so what to book is
 * one tap from the first screen. Without a plan (signed out, or not started)
 * it offers to start one. `compact` is just the countdown (Profile), and
 * nothing without a plan.
 */
export function WeddingCard({ compact = false }: { compact?: boolean }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t, locale } = useLocale();
  const { plan, wedding, loading, chosen, progress, next, isPending, canEdit, toggleBooked } =
    usePlanView();
  const openPlan = () => router.push('/plan');

  // While the account loads, the phone's copy of the plan stands in (if any).
  if (!wedding && (!loading || !plan.syncedWeddingId)) {
    if (compact || loading) return null;
    return (
      <Animated.View entering={Motion.rise}>
        <StartPlanCard />
      </Animated.View>
    );
  }
  const countdown = (
    <CountdownCard
      plan={plan}
      progress={progress}
      eventsCount={chosen.length}
      onPress={openPlan}
      accessibilityLabel={t('planner.title')}
    />
  );

  if (compact) return countdown;

  return (
    <Animated.View entering={Motion.rise} style={styles.wrap}>
      {countdown}

      {!isPending && chosen.length === 0 && canEdit && (
        <View style={styles.panel}>
          <AppText color="text2">{t('planner.pickEventsRow')}</AppText>
          <Button
            label={t('planner.chooseEvents')}
            icon="add"
            onPress={() => router.push('/plan-events')}
          />
        </View>
      )}

      {chosen.length > 0 && (
        <Animated.View layout={Motion.layout} style={[styles.panel, styles.list]}>
          <AppText variant="label" weight={600} color="text2" style={styles.heading}>
            {t('planner.nextTitle')}
          </AppText>
          {next.length === 0 && (
            <Animated.View entering={Motion.enter} style={styles.row}>
              <Icon name="checkmark-circle" size={Sizes.checkbox} color={Colors.success} />
              <AppText style={styles.grow}>{t('planner.nothingNext')}</AppText>
            </Animated.View>
          )}
          {next.map(({ eventSlug, eventName, need }) => {
            const name = localized(need.name, locale);
            return (
              <Animated.View
                key={`${eventSlug}:${need.categorySlug}`}
                layout={Motion.layout}
                entering={Motion.enter}
                exiting={Motion.exit}
                style={styles.row}
              >
                <CheckCircle
                  checked={(plan.booked[eventSlug] ?? []).includes(need.categorySlug)}
                  disabled={!canEdit}
                  accessibilityLabel={t('planner.markBooked', { name })}
                  onPress={() => {
                    successHaptic();
                    toggleBooked(eventSlug, need.categorySlug);
                  }}
                />
                <Icon name={groupIcon(need.groupSlug)} size={20} color={Colors.primary} />
                <View style={styles.grow}>
                  <AppText weight={500}>{name}</AppText>
                  <AppText variant="caption" color="text2">
                    {localized(eventName, locale)}
                  </AppText>
                </View>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel={t('planner.find', { name })}
                  hitSlop={6}
                  onPress={() => {
                    selectionHaptic();
                    findForPlan(
                      need.categorySlug,
                      need.groupSlug,
                      eventSlug,
                      plan.guests?.[eventSlug],
                    );
                  }}
                  style={({ pressed }) => [styles.find, pressed && styles.pressed]}
                >
                  <AppText variant="label" weight={600} color="primary">
                    {t('planner.findShort')}
                  </AppText>
                </Pressable>
              </Animated.View>
            );
          })}
          <Pressable
            accessibilityRole="link"
            onPress={openPlan}
            style={({ pressed }) => [styles.row, styles.seeAll, pressed && styles.rowPressed]}
          >
            <AppText weight={600} color="primary" style={styles.grow}>
              {t('planner.openPlan')}
            </AppText>
            <Icon name="chevron-forward" size={17} color={Colors.chevron} weight="semibold" />
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  );
}

const useStyles = makeStyles((Colors) => ({
  wrap: {
    gap: Spacing.sm,
  },
  panel: {
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  list: {
    gap: 0,
    paddingVertical: Spacing.xs,
    paddingHorizontal: 0,
    overflow: 'hidden',
  },
  heading: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  row: {
    minHeight: Sizes.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  seeAll: {
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    marginTop: Spacing.xs,
  },
  rowPressed: {
    backgroundColor: Colors.rowPressed,
  },
  grow: {
    flex: 1,
  },
  find: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.button,
    backgroundColor: Colors.primaryTint,
  },
  pressed: {
    opacity: 0.6,
  },
}));
