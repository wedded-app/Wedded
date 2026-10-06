import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-field';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/features/auth/session';
import { setAnswers, useAnswers } from '@/features/onboarding/answers';
import { useFinishOnboarding } from '@/features/onboarding/finish';
import { OnboardingStep } from '@/features/onboarding/onboarding-step';
import { OptionCard } from '@/features/onboarding/option-card';
import { useLocale } from '@/i18n/locale-context';
import { successHaptic } from '@/lib/haptics';

/**
 * Question 3, the last: the wedding day, for the countdown, or "not picked
 * yet". Continue makes the plan in their account (signing in first if they
 * somehow got here signed out), then shows it.
 */
export default function DateStep() {
  const { t } = useLocale();
  const answers = useAnswers();
  const { requireSignIn } = useSession();
  const { finish, saving } = useFinishOnboarding();
  const [failed, setFailed] = useState(false);

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
      step="date"
      title={t('onboarding.date.title')}
      subtitle={t('onboarding.date.subtitle')}
      canContinue={answers.weddingDate !== null || answers.noDateYet}
      continueLabel={t('onboarding.date.finish')}
      loading={saving}
      error={failed ? t('onboarding.date.failed') : undefined}
      onContinue={save}
      onSkip={save}
    >
      <View style={styles.list}>
        <DateField
          value={answers.weddingDate}
          onChange={(date) => setAnswers({ weddingDate: date, noDateYet: false })}
          placeholder={t('planner.pickDate')}
        />
        <OptionCard
          index={1}
          role="checkbox"
          icon="time-outline"
          label={t('onboarding.date.notYet')}
          detail={t('onboarding.date.notYetDetail')}
          selected={answers.noDateYet}
          onPress={() => setAnswers({ noDateYet: !answers.noDateYet, weddingDate: null })}
        />
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.md,
  },
});
