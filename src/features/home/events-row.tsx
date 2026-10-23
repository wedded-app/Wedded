import { router } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PressableScale } from '@/components/pressable-scale';
import { makeStyles, Radius, Sizes, Spacing, useColors } from '@/constants/theme';
import { essentialNeeds } from '@/features/planner/plan';
import { stillNeedsText, unbookedNames } from '@/features/planner/still-needs';
import type { usePlanView } from '@/features/planner/use-plan-view';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

import { SectionHeader } from './section-header';
import { stubParts } from './greeting';

type PlanView = ReturnType<typeof usePlanView>;

/**
 * Your events on Home: each chosen event, its day, and in words what it
 * still needs, or All set. It takes the place of a booked count ("12 of 22")
 * with the same facts, calmer (the final look, 2026-10-23). A tap opens
 * that event on the Wedding tab.
 */
export function EventsRow({ view }: { view: PlanView }) {
  const Colors = useColors();
  const styles = useStyles();
  const { t } = useLocale();
  const { plan, chosen, needsByEvent } = view;
  if (chosen.length === 0) return null;

  return (
    <View style={styles.block}>
      <SectionHeader title={t('home.events.title')} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.bleed}
        contentContainerStyle={styles.track}
      >
        {chosen.map((event) => {
          const names = unbookedNames(
            essentialNeeds(needsByEvent[event.slug]),
            plan.booked[event.slug] ?? [],
          );
          const status = stillNeedsText(names, t);
          const stub = stubParts(plan.eventDates?.[event.slug] ?? plan.weddingDate);
          const name = localized(event.name);
          return (
            <PressableScale
              key={event.slug}
              accessibilityRole="button"
              accessibilityLabel={`${name}. ${status}`}
              pressedScale={0.97}
              onPress={() => {
                selectionHaptic();
                router.navigate({ pathname: '/plan', params: { event: event.slug } });
              }}
              style={styles.card}
            >
              <View style={styles.top}>
                {stub && (
                  <AppText variant="caption" weight={600} color="text2" style={styles.caps}>
                    {`${stub.weekday} · ${stub.month} ${stub.day}`}
                  </AppText>
                )}
                <AppText variant="heading" weight={600} numberOfLines={2}>
                  {name}
                </AppText>
              </View>
              <View style={styles.status}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: names.length === 0 ? Colors.success : Colors.primary },
                  ]}
                />
                <AppText
                  variant="caption"
                  weight={600}
                  color={names.length === 0 ? 'success' : 'primary'}
                  numberOfLines={2}
                  style={styles.grow}
                >
                  {status}
                </AppText>
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const useStyles = makeStyles((Colors) => ({
  block: {
    gap: Spacing.md,
  },
  // Runs to the screen's edges, past Home's side padding
  bleed: {
    flexGrow: 0,
    marginHorizontal: -Sizes.pageGutter,
  },
  track: {
    gap: Spacing.sm,
    paddingHorizontal: Sizes.pageGutter,
  },
  card: {
    width: 160,
    minHeight: 124,
    justifyContent: 'space-between',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    backgroundColor: Colors.surface,
  },
  top: {
    gap: Spacing.xs,
  },
  caps: {
    letterSpacing: 0.6,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 5,
  },
  grow: {
    flex: 1,
  },
}));
