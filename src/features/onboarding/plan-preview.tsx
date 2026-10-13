import { Image, View } from 'react-native';
import Animated, { LayoutAnimationConfig } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { makeStyles, Spacing } from '@/constants/theme';
import { useTraditions } from '@/data/reference';
import { formatDate } from '@/features/inquiry/inquiry-helpers';
import { daysUntil } from '@/features/planner/plan';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { Motion } from '@/lib/motion';

import { useAnswers } from './answers';
import { previewEvents, traditionsForFaiths } from './faith';
import type { Step } from './steps';

const RIBBON = require('../../../assets/images/ribbon.png');

/**
 * Their plan so far, a slim tan strip above Continue on each question after
 * the first: whose wedding it is, then the events their answers lead to
 * (Jaago · Baraat · Anand Karaj +6 more), then the countdown once they pick
 * a date. It changes as they tap, so by the last question they've watched
 * the app build their plan. Each screen mounts its own copy, so only what
 * changes animates.
 */
export function PlanPreview({ step }: { step: Step }) {
  const styles = useStyles();
  const { t, locale } = useLocale();
  const answers = useAnswers();
  const traditions = useTraditions();

  const picked = traditionsForFaiths(answers.faiths, answers.roots, traditions.data ?? []);
  const { events, more } = previewEvents(picked);

  const who = answers.planningFor
    ? t(`onboarding.plan.who.${answers.planningFor}`)
    : t('onboarding.plan.untitled');

  let plans: string | null = null;
  if (events.length > 0) {
    plans = events.map((event) => localized(event.name, locale)).join(' · ');
    if (more > 0) plans += `  ${t('onboarding.plan.more', { count: more })}`;
  } else if (answers.otherTradition) {
    plans = t('onboarding.kind.otherDetail');
  } else if (step === 'kind' || step === 'roots') {
    plans = t('onboarding.plan.eventsSoon');
  }

  let date: string | null = null;
  if (answers.weddingDate) {
    const days = daysUntil(answers.weddingDate);
    const day = formatDate(answers.weddingDate);
    date =
      days === 0
        ? t('onboarding.plan.today', { date: day })
        : t('onboarding.plan.date', { date: day, count: days });
  } else if (answers.noDateYet) {
    date = t('onboarding.plan.noDate');
  } else if (step === 'date') {
    date = t('onboarding.plan.dateSoon');
  }
  const waiting = { plans: events.length === 0, date: !answers.weddingDate && !answers.noDateYet };

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

const useStyles = makeStyles((Colors) => ({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.lg,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: Colors.sand,
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
