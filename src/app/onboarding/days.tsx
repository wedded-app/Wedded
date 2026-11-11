import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { Spacing } from '@/constants/theme';
import { setAnswers, useAnswers } from '@/features/onboarding/answers';
import { useChosenEvents } from '@/features/onboarding/chosen-events';
import { OnboardingStep } from '@/features/onboarding/onboarding-step';
import { OptionRow } from '@/features/onboarding/option-row';
import { nextHref } from '@/features/onboarding/steps';
import { DayList } from '@/features/planner/day-list';
import { hasOwnDay, mainDay, shownDates } from '@/features/planner/days';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * Question 3: the day of each event, since a Mehndi is rarely on the
 * Anand Karaj's day. The events they chose run down the page as day cards;
 * a tap opens a calendar, and "Same day as the …" under an event puts it on
 * the day before it (a Baraat and Anand Karaj together). A date they gave
 * before starts on the first wedding-day event. Then where it is.
 */
export default function DaysStep() {
  const { t } = useLocale();
  const answers = useAnswers();
  const { inOrder, loading, failed: loadFailed, retry } = useChosenEvents();
  const events = inOrder.filter(hasOwnDay);
  const dates = shownDates(events, answers.eventDates, answers.weddingDate);
  const anyDay = Object.keys(dates).length > 0;
  const next = () => router.push(nextHref('days'));

  return (
    <OnboardingStep
      step="days"
      title={t('onboarding.days.title')}
      subtitle={t('onboarding.days.subtitle')}
      canContinue={anyDay || answers.noDateYet}
      onContinue={next}
      onSkip={next}
    >
      {loading && <StateView state="loading" />}
      {loadFailed && <StateView state="error" onRetry={retry} />}
      {!loading && !loadFailed && (
        <View style={styles.list}>
          <DayList
            events={events.map((event) => ({
              slug: event.slug,
              name: localized(event.name),
              timing: event.timing ? localized(event.timing) : null,
            }))}
            state={{ dates, joined: answers.joined }}
            onChange={(change) =>
              setAnswers({
                eventDates: change.dates,
                joined: change.joined,
                // The countdown counts to the wedding-day event's day
                weddingDate: mainDay(events, change.dates),
                noDateYet: false,
              })
            }
          />
          {!anyDay && (
            <OptionRow
              index={1}
              role="checkbox"
              label={t('onboarding.days.notYet')}
              detail={t('onboarding.days.notYetDetail')}
              selected={answers.noDateYet}
              onPress={() => setAnswers({ noDateYet: !answers.noDateYet })}
            />
          )}
        </View>
      )}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.lg,
  },
});
