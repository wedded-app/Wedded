import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { Spacing } from '@/constants/theme';
import { useTraditions } from '@/data/reference';
import { setAnswers, toggleIn, useAnswers } from '@/features/onboarding/answers';
import { OnboardingStep } from '@/features/onboarding/onboarding-step';
import { OptionCard } from '@/features/onboarding/option-card';
import { nextHref } from '@/features/onboarding/steps';
import { signatureEvents } from '@/features/planner/plan';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * Question 2: what kind of wedding it is, one card per tradition in
 * `cultures` with a few of its events underneath (Jaago · Baraat · Anand
 * Karaj), so it reads as the ceremonies more than the faith. Several can be
 * picked for a mixed family; "Something else" means they'll pick events
 * themselves. Their main events start the plan.
 */
export default function KindStep() {
  const { t, locale } = useLocale();
  const answers = useAnswers();
  const traditions = useTraditions();
  const next = () => router.push(nextHref('kind'));

  return (
    <OnboardingStep
      step="kind"
      title={t('onboarding.kind.title')}
      subtitle={t('onboarding.kind.subtitle')}
      canContinue={answers.traditions.length > 0 || answers.otherTradition}
      onContinue={next}
      onSkip={next}
    >
      {traditions.isPending && <StateView state="loading" />}
      {traditions.isError && <StateView state="error" onRetry={() => void traditions.refetch()} />}
      <View style={styles.list}>
        {(traditions.data ?? []).map((tradition, index) => (
          <OptionCard
            key={tradition.slug}
            index={index}
            role="checkbox"
            label={localized(tradition.name, locale)}
            detail={signatureEvents(tradition)
              .map((event) => localized(event.name, locale))
              .join(' · ')}
            selected={answers.traditions.includes(tradition.slug)}
            onPress={() =>
              setAnswers({
                traditions: toggleIn(answers.traditions, tradition.slug),
                otherTradition: false,
              })
            }
          />
        ))}
        {traditions.data && (
          <OptionCard
            index={traditions.data.length}
            role="checkbox"
            label={t('onboarding.kind.other')}
            detail={t('onboarding.kind.otherDetail')}
            selected={answers.otherTradition}
            onPress={() => setAnswers({ otherTradition: !answers.otherTradition, traditions: [] })}
          />
        )}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.sm + 2,
  },
});
