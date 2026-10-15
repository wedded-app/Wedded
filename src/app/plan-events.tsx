import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppText, useFontScale } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { SectionTitle } from '@/components/list';
import { Screen } from '@/components/screen';
import { SheetHeader } from '@/components/sheet-header';
import { StateView } from '@/components/state-view';
import { makeStyles, Spacing } from '@/constants/theme';
import type { TraditionEvent } from '@/data/reference';
import { EventChoice } from '@/features/planner/event-choice';
import { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic, successHaptic } from '@/lib/haptics';
import { Motion } from '@/lib/motion';

/**
 * "Your events" (vision S15b), a sheet from My Wedding: pick the traditions
 * that fit (several for a mixed wedding), then tap the events. Each
 * tradition's main events come first; the rest wait under More events.
 */
export default function PlanEventsScreen() {
  const styles = useStyles();
  const { t } = useLocale();
  const view = usePlanView();
  const { plan, traditions, active, events, canEdit } = view;
  const activeSlugs = active.map((tradition) => tradition.slug);
  const main = events.filter((event) => event.isCore);
  const more = events.filter((event) => !event.isCore);
  const picked = events.filter((event) => plan.events.includes(event.slug)).length;
  const allMainPicked = main.every((event) => plan.events.includes(event.slug));
  const [showMore, setShowMore] = useState(() =>
    more.some((event) => plan.events.includes(event.slug)),
  );
  const wide = useFontScale('body') > 1.3;
  const close = () => router.canGoBack() && router.back();

  const grid = (list: TraditionEvent[]) => (
    <View style={styles.grid}>
      {list.map((event) => (
        <EventChoice
          key={event.slug}
          event={event}
          wide={wide}
          disabled={!canEdit}
          selected={plan.events.includes(event.slug)}
          onPress={() => {
            selectionHaptic();
            view.toggleEvent(event.slug);
          }}
        />
      ))}
    </View>
  );

  let content;
  if (view.isError) {
    content = <StateView state="error" onRetry={() => void view.refetch()} />;
  } else if (view.isPending) {
    content = <StateView state="loading" />;
  } else {
    content = (
      <>
        <View style={styles.block}>
          <View style={styles.heading}>
            <SectionTitle>{t('planner.picker.traditions')}</SectionTitle>
            <AppText color="text2" style={styles.hint}>
              {t('planner.picker.traditionsHint')}
            </AppText>
          </View>
          <View style={styles.chips}>
            {traditions.map((tradition) => (
              <Chip
                key={tradition.slug}
                label={localized(tradition.name)}
                selected={activeSlugs.includes(tradition.slug)}
                disabled={!canEdit}
                onPress={() => view.toggleTradition(tradition.slug, activeSlugs)}
              />
            ))}
          </View>
        </View>

        <Animated.View layout={Motion.layout} style={styles.block}>
          <View style={styles.titleRow}>
            <SectionTitle>{t('planner.picker.main')}</SectionTitle>
            {canEdit && !allMainPicked && (
              <Pressable
                accessibilityRole="button"
                hitSlop={12}
                onPress={() => {
                  successHaptic();
                  view.addEvents(main.map((event) => event.slug));
                }}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <AppText weight={600} color="primary">
                  {t('planner.picker.addAll')}
                </AppText>
              </Pressable>
            )}
          </View>
          {grid(main)}
        </Animated.View>

        {more.length > 0 && (
          <Animated.View layout={Motion.layout} style={styles.block}>
            <SectionTitle>{t('planner.picker.more')}</SectionTitle>
            {showMore && grid(more)}
            <Button
              variant="secondary"
              label={
                showMore
                  ? t('planner.showLess')
                  : t('planner.picker.showMore', { count: more.length })
              }
              icon={showMore ? 'chevron-up' : 'chevron-down'}
              onPress={() => setShowMore((shown) => !shown)}
            />
          </Animated.View>
        )}
      </>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <SheetHeader onClose={close} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <AppText variant="title" accessibilityRole="header">
            {t('planner.picker.title')}
          </AppText>
          <AppText color="text2">{t('planner.picker.body')}</AppText>
        </View>
        {content}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          label={
            picked > 0 ? t('planner.picker.picked', { count: picked }) : t('planner.picker.done')
          }
          onPress={close}
        />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((Colors) => ({
  content: {
    gap: Spacing.xxl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  intro: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  block: {
    gap: Spacing.md,
  },
  heading: {
    gap: Spacing.xs,
  },
  hint: {
    paddingHorizontal: Spacing.xs,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingRight: Spacing.xs,
  },
  pressed: {
    opacity: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.md,
  },
  footer: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.separator,
    backgroundColor: Colors.bg,
  },
}));
