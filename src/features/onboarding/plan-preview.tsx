import { Image, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { makeStyles, Spacing } from '@/constants/theme';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { useSearchLocation } from '@/features/location/search-location';
import { daysUntil } from '@/features/planner/plan';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { Motion } from '@/lib/motion';

import { useAnswers } from './answers';
import { useChosenEvents } from './chosen-events';
import { previewEvents } from './faith';
import type { Step } from './steps';

const RIBBON = require('../../../assets/images/ribbon.png');

/**
 * Their plan so far, plain lines beside the arrow on each question after the
 * first (no box, like the rest of the page): the plan, then the events their
 * answers lead to (Jaago · Baraat · Anand Karaj +6 more), or the ones they
 * chose once they've chosen, then the countdown once they pick a day. On
 * the last two questions the events become a count, with where it is and
 * the guests beside it (8 events · Yuba City · 300 guests). It
 * changes as they tap, so by the last question they've watched the app
 * build their plan. Each screen mounts its own copy, so only what changes
 * animates.
 */
export function PlanPreview({ step }: { step: Step }) {
  const styles = useStyles();
  const { t } = useLocale();
  const answers = useAnswers();
  const { picked, chosen, inOrder } = useChosenEvents();
  const { place } = useSearchLocation();
  const settling = step === 'where' || step === 'guests';

  const { events, more } =
    answers.events === null
      ? previewEvents(picked)
      : { events: inOrder.slice(0, 3), more: Math.max(0, inOrder.length - 3) };

  const who = answers.planningFor
    ? t(`onboarding.plan.who.${answers.planningFor}`)
    : t('onboarding.plan.untitled');

  let plans: string | null = null;
  if (settling && chosen.length > 0) {
    plans = [
      t('onboarding.plan.events', { count: chosen.length }),
      place?.label.split(' · ').pop(),
      answers.guestCount ? t('onboarding.plan.guests', { count: answers.guestCount }) : null,
    ]
      .filter((part) => !!part)
      .join(' · ');
  } else if (events.length > 0) {
    plans = events.map((event) => localized(event.name)).join(' · ');
    if (more > 0) plans += `  ${t('onboarding.plan.more', { count: more })}`;
  } else if (answers.otherTradition) {
    plans = t('onboarding.kind.otherDetail');
  } else if (step === 'kind' || step === 'roots') {
    plans = t('onboarding.plan.eventsSoon');
  }

  // The countdown is to the main day, or the first day they've picked
  const countTo = answers.weddingDate ?? Object.values(answers.eventDates).sort()[0] ?? null;
  let date: string | null = null;
  if (countTo) {
    const days = daysUntil(countTo);
    const day = formatDate(countTo);
    date =
      days === 0
        ? t('onboarding.plan.today', { date: day })
        : t('onboarding.plan.date', { date: day, count: days });
  } else if (answers.noDateYet) {
    date = t('onboarding.plan.noDate');
  } else if (step === 'days') {
    date = t('onboarding.plan.dateSoon');
  }
  const waiting = {
    plans: settling ? chosen.length === 0 : events.length === 0,
    date: !countTo && !answers.noDateYet,
  };

  return (
    <Animated.View
      layout={Motion.layout}
      style={styles.strip}
      accessible
      accessibilityLabel={[t('onboarding.plan.label'), who, plans, date]
        .filter((part) => !!part)
        .join('. ')}
    >
      <Image source={RIBBON} style={styles.ribbon} resizeMode="contain" />
      <View style={styles.lines}>
        <LayoutAnimationConfig skipEntering>
          <AppText variant="label" weight={700} numberOfLines={1}>
            {who}
          </AppText>
          {plans && (
            <Animated.View key={plans} entering={Motion.enter}>
              <AppText
                variant="label"
                weight={waiting.plans ? 400 : 500}
                color={waiting.plans ? 'text2' : 'text'}
                numberOfLines={2}
              >
                {plans}
              </AppText>
            </Animated.View>
          )}
          {date && (
            <Animated.View key={date} entering={Motion.enter}>
              <AppText
                variant="label"
                weight={waiting.date ? 400 : 500}
                color={waiting.date ? 'text2' : 'text'}
                numberOfLines={1}
              >
                {date}
              </AppText>
            </Animated.View>
          )}
        </LayoutAnimationConfig>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles(() => ({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  ribbon: {
    width: 30,
    height: 26,
  },
  lines: {
    flex: 1,
    gap: 1,
  },
}));
