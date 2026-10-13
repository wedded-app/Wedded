import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { Spacing } from '@/constants/theme';
import { useFaiths, useTraditions } from '@/data/reference';
import { setAnswers, toggleIn, useAnswers } from '@/features/onboarding/answers';
import { faithOptions, faithsNeedingRoots, faithWide } from '@/features/onboarding/faith';
import { OnboardingStep } from '@/features/onboarding/onboarding-step';
import { OptionCard } from '@/features/onboarding/option-card';
import { nextHref } from '@/features/onboarding/steps';
import { signatureEvents } from '@/features/planner/plan';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * Question 2: what kind of wedding, by faith first (Sikh, Hindu, Muslim,
 * Christian), broad enough that a Fijian Sikh family isn't left guessing.
 * Each card shows a few of its ceremonies underneath (Jaago · Baraat · Anand
 * Karaj), so it reads as the wedding more than the religion. Several can be
 * picked for a mixed family; "Something else" means they'll pick events
 * themselves. Only faiths with a tradition in the database are offered.
 * When a picked faith has several traditions, "Where are the families
 * from?" comes next.
 */
export default function KindStep() {
  const { t, locale } = useLocale();
  const answers = useAnswers();
  const traditions = useTraditions();
  const faiths = useFaiths();
  const all = traditions.data ?? [];
  const options = faithOptions(faiths.data ?? [], all);
  const askRoots = faithsNeedingRoots(answers.faiths, all).length > 0;
  const loading = traditions.isPending || faiths.isPending;
  const failed = traditions.isError || faiths.isError;

  return (
    <OnboardingStep
      step="kind"
      title={t('onboarding.kind.title')}
      subtitle={t('onboarding.kind.subtitle')}
      canContinue={answers.faiths.length > 0 || answers.otherTradition}
      onContinue={() => router.push(nextHref('kind', askRoots))}
      onSkip={() => router.push(nextHref('kind'))}
      // Half of this question's bar when the roots question may follow
      fill={options.some((option) => option.traditions.length > 1) ? 0.5 : 1}
    >
      {loading && <StateView state="loading" />}
      {failed && (
        <StateView
          state="error"
          onRetry={() => {
            void traditions.refetch();
            void faiths.refetch();
          }}
        />
      )}
      {!loading && !failed && (
        <View style={styles.list}>
          {options.map(({ faith, traditions: own }, index) => {
            const lead = faithWide(own);
            return (
              <OptionCard
                key={faith.slug}
                index={index}
                role="checkbox"
                label={localized(faith.name, locale)}
                detail={
                  lead &&
                  signatureEvents(lead)
                    .map((event) => localized(event.name, locale))
                    .join(' · ')
                }
                selected={answers.faiths.includes(faith.slug)}
                onPress={() =>
                  setAnswers({
                    faiths: toggleIn(answers.faiths, faith.slug),
                    otherTradition: false,
                  })
                }
              />
            );
          })}
          <OptionCard
            index={options.length}
            role="checkbox"
            label={t('onboarding.kind.other')}
            detail={t('onboarding.kind.otherDetail')}
            selected={answers.otherTradition}
            onPress={() =>
              setAnswers({ otherTradition: !answers.otherTradition, faiths: [], roots: [] })
            }
          />
        </View>
      )}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.sm + 2,
  },
});
