import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { StateView } from '@/components/state-view';
import { Spacing, useColors } from '@/constants/theme';
import { setAnswers, toggleIn, useAnswers } from '@/features/onboarding/answers';
import { useChosenEvents } from '@/features/onboarding/chosen-events';
import { OnboardingStep } from '@/features/onboarding/onboarding-step';
import { OptionRow } from '@/features/onboarding/option-row';
import { nextHref } from '@/features/onboarding/steps';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';
import { selectionHaptic } from '@/lib/haptics';

/**
 * Question 2: which events they're having. Their tradition's main events
 * come ticked (Engagement · Mehndi · Nikah · Walima); under More events are
 * the rest of their tradition's and their faith's (a Dholki, a Mayun), so
 * a family adds what they're really having instead of fixing it later.
 * With "Something else" every event is offered and none is ticked.
 */
export default function EventsStep() {
  const Colors = useColors();
  const { t } = useLocale();
  const answers = useAnswers();
  const { main, more, chosen, loading, failed, retry } = useChosenEvents();
  const [showMore, setShowMore] = useState(
    () => main.length === 0 || more.some((event) => chosen.includes(event.slug)),
  );
  const open = showMore || main.length === 0;

  const row = (event: (typeof main)[number], index: number) => (
    <OptionRow
      key={event.slug}
      index={index}
      role="checkbox"
      label={localized(event.name)}
      detail={event.timing ? localized(event.timing) : undefined}
      selected={chosen.includes(event.slug)}
      onPress={() => setAnswers({ events: toggleIn(chosen, event.slug) })}
    />
  );

  return (
    <OnboardingStep
      step="events"
      title={t('onboarding.events.title')}
      subtitle={
        main.length > 0 ? t('onboarding.events.subtitle') : t('onboarding.events.subtitleOther')
      }
      canContinue={chosen.length > 0}
      onContinue={() => {
        // What they saw ticked is what they're having, even untouched
        if (answers.events === null) setAnswers({ events: chosen });
        router.push(nextHref('events'));
      }}
      onSkip={() => router.push(nextHref('events'))}
    >
      {loading && <StateView state="loading" />}
      {failed && <StateView state="error" onRetry={retry} />}
      {!loading && !failed && (
        <View style={styles.lists}>
          {main.length > 0 && <View>{main.map(row)}</View>}
          {more.length > 0 && (
            <View>
              {main.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => {
                    selectionHaptic();
                    setShowMore((shown) => !shown);
                  }}
                  style={({ pressed }) => [styles.more, pressed && styles.pressed]}
                >
                  <AppText variant="bodyLg" weight={600} style={styles.grow}>
                    {t('onboarding.events.more')}
                  </AppText>
                  <AppText color="text2">
                    {open
                      ? t('onboarding.events.showLess')
                      : t('onboarding.events.showMore', { count: more.length })}
                  </AppText>
                  <Icon
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={Colors.text2}
                    weight="semibold"
                  />
                </Pressable>
              )}
              {open && more.map(row)}
            </View>
          )}
        </View>
      )}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  lists: {
    gap: Spacing.xl,
  },
  more: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  pressed: {
    opacity: 0.55,
  },
  grow: {
    flex: 1,
  },
});
