import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { StateView } from '@/components/state-view';
import { useFaiths, useTraditions } from '@/data/reference';
import { useMyWeddings } from '@/data/wedding';
import { setAnswers, toggleIn, useAnswers } from '@/features/onboarding/answers';
import { faithOptions, faithsNeedingRoots, faithWide } from '@/features/onboarding/faith';
import { markOnboarding } from '@/features/onboarding/onboarding-state';
import { OnboardingStep } from '@/features/onboarding/onboarding-step';
import { OptionRow } from '@/features/onboarding/option-row';
import { nextHref } from '@/features/onboarding/steps';
import { signatureEvents } from '@/features/planner/plan';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * Question 1: what kind of wedding, by faith first (Sikh, Hindu, Muslim,
 * Christian), broad enough that a Fijian Sikh family isn't left guessing.
 * Each row shows a few of its ceremonies underneath (Jaago · Baraat · Anand
 * Karaj), so it reads as the wedding more than the religion. Several can be
 * picked for a mixed family; "Something else" means they'll pick events
 * themselves. Only faiths with a tradition in the database are offered.
 * When a picked faith has several traditions, "Where are the families
 * from?" comes next. The faiths and traditions are loaded on the welcome
 * screen (prefetchFirstQuestions), so this opens with its answers showing.
 */
export default function KindStep() {
  const { t } = useLocale();
  const answers = useAnswers();
  const traditions = useTraditions();
  const faiths = useFaiths();
  const weddings = useMyWeddings();
  const all = traditions.data ?? [];
  const options = faithOptions(faiths.data ?? [], all);
  const askRoots = faithsNeedingRoots(answers.faiths, all).length > 0;
  const loading = traditions.isPending || faiths.isPending;
  const failed = traditions.isError || faiths.isError;

  // Signed in to start planning, but the account already has a plan (they
  // planned on another phone): straight to it. Only while this question is
  // showing: it stays mounted under the others while the new plan is saved.
  const existing = weddings.data?.[0];
  useFocusEffect(
    useCallback(() => {
      if (existing && existing.events.length > 0) {
        markOnboarding('done');
        router.replace('/plan');
      }
    }, [existing]),
  );

  return (
    <OnboardingStep
      step="kind"
      title={t('onboarding.kind.title')}
      subtitle={t('onboarding.kind.subtitle')}
      canContinue={answers.faiths.length > 0 || answers.otherTradition}
      onContinue={() => router.push(nextHref('kind', askRoots))}
      onSkip={() => router.push(nextHref('kind'))}
      // Half of this question's share of the bar when the roots question may follow
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
        <View>
          {options.map(({ faith, traditions: own }, index) => {
            const lead = faithWide(own);
            return (
              <OptionRow
                key={faith.slug}
                index={index}
                role="checkbox"
                label={localized(faith.name)}
                detail={
                  lead &&
                  signatureEvents(lead)
                    .map((event) => localized(event.name))
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
          <OptionRow
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
