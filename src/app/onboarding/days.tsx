import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { setAnswers, useAnswers } from '@/features/onboarding/answers';
import { useChosenEvents } from '@/features/onboarding/chosen-events';
import { useFinishOnboarding } from '@/features/onboarding/finish';
import { OnboardingStep } from '@/features/onboarding/onboarding-step';
import { OptionRow } from '@/features/onboarding/option-row';
import { DayList } from '@/features/planner/day-list';
import { hasOwnDay, mainDay, shownDates } from '@/features/planner/days';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

/**
 * Question 3, the last: the day of each event, since a Mehndi is rarely on
 * the Nikah's day. The events they chose run down the page with their days;
 * a tap opens a calendar, and the link between two puts them on one day
 * (a Nikah and Walima together). The date from Home's card starts on the
 * first wedding-day event. Continue makes the plan in their account
 * (signing in first if they somehow got here signed out), then shows it.
 */
export default function DaysStep() {
  const { t } = useLocale();
  const answers = useAnswers();
  const { requireSignIn } = useSession();
  const { finish, saving } = useFinishOnboarding();
  const [failed, setFailed] = useState(false);
  const { inOrder, loading, failed: loadFailed, retry } = useChosenEvents();
  const events = inOrder.filter(hasOwnDay);
  const dates = shownDates(events, answers.eventDates, answers.weddingDate);
  const anyDay = Object.keys(dates).length > 0;

  const save = () =>
    requireSignIn(async () => {
      setFailed(false);
      try {
        await finish();
        successHaptic();
        router.replace('/onboarding/ready');
      } catch {
        setFailed(true);
      }
    });

  return (
    <OnboardingStep
      step="days"
      title={t('onboarding.days.title')}
      subtitle={t('onboarding.days.subtitle')}
      canContinue={anyDay || answers.noDateYet}
      continueLabel={t('onboarding.days.finish')}
      loading={saving}
      error={failed ? t('onboarding.days.failed') : undefined}
      onContinue={save}
      onSkip={save}
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
            onChange={(next) =>
              setAnswers({
                eventDates: next.dates,
                joined: next.joined,
                // The countdown counts to the wedding-day event's day
                weddingDate: mainDay(events, next.dates),
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
