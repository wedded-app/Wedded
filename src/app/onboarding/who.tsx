import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import type { IconName } from '@/components/icon';
import { Spacing } from '@/constants/theme';
import { useMyWeddings } from '@/data/wedding';
import { setAnswers, useAnswers, type PlanningFor } from '@/features/onboarding/answers';
import { markOnboarding } from '@/features/onboarding/onboarding-state';
import { OnboardingStep } from '@/features/onboarding/onboarding-step';
import { OptionCard } from '@/features/onboarding/option-card';
import { nextHref } from '@/features/onboarding/steps';
import { useLocale } from '@/i18n/locale-context';

const OPTIONS: { value: PlanningFor; icon: IconName }[] = [
  { value: 'self', icon: 'sparkles-outline' },
  { value: 'child', icon: 'people-outline' },
  { value: 'sibling', icon: 'person-outline' },
  { value: 'relative', icon: 'home-outline' },
  { value: 'friend', icon: 'hand-left-outline' },
];

/** Question 1: whose wedding it is (weddings.planning_for), as Shaadi.com asks. */
export default function WhoStep() {
  const { t } = useLocale();
  const answers = useAnswers();
  const weddings = useMyWeddings();
  const next = () => router.push(nextHref('who'));

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
      step="who"
      title={t('onboarding.who.title')}
      subtitle={t('onboarding.who.subtitle')}
      canContinue={answers.planningFor !== null}
      onContinue={next}
      onSkip={next}
    >
      <View style={styles.list} accessibilityRole="radiogroup">
        {OPTIONS.map((option, index) => (
          <OptionCard
            key={option.value}
            index={index}
            icon={option.icon}
            label={t(`onboarding.who.${option.value}`)}
            selected={answers.planningFor === option.value}
            onPress={() => setAnswers({ planningFor: option.value })}
          />
        ))}
      </View>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push('/for-vendors')}
        style={({ pressed }) => [styles.vendor, pressed && styles.pressed]}
      >
        <AppText color="text2">{t('onboarding.who.vendorPrompt')}</AppText>
        <AppText weight={600} style={styles.link}>
          {t('onboarding.who.vendorLink')}
        </AppText>
      </Pressable>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.sm + 2,
  },
  vendor: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.sm,
  },
  link: {
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.5,
  },
});
