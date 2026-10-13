import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { StateView } from '@/components/state-view';
import { Spacing } from '@/constants/theme';
import { useBackgrounds, useFaiths, useTraditions } from '@/data/reference';
import { setAnswers, toggleIn, useAnswers } from '@/features/onboarding/answers';
import { faithsNeedingRoots, faithWide, tellingEvents } from '@/features/onboarding/faith';
import { OnboardingStep } from '@/features/onboarding/onboarding-step';
import { OptionCard } from '@/features/onboarding/option-card';
import { nextHref } from '@/features/onboarding/steps';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/**
 * The second half of question 2, asked only when a faith they picked has
 * more than one tradition (Muslim: Pakistani, Arab or the faith-wide one):
 * where the families are from, named as places (Pakistan, Middle East), with
 * the ceremonies that set each one apart underneath (Dholki · Mayun · Shadi). The faith-wide
 * tradition is "Somewhere else". Two can be picked for two families; skipped,
 * the faith-wide tradition stands in. The answer isn't stored, only the
 * traditions it leads to.
 */
export default function RootsStep() {
  const { t, locale } = useLocale();
  const answers = useAnswers();
  const traditions = useTraditions();
  const faiths = useFaiths();
  const backgrounds = useBackgrounds();
  const all = traditions.data ?? [];
  const asking = faithsNeedingRoots(answers.faiths, all);
  const next = () => router.push(nextHref('roots'));
  const loading = traditions.isPending || faiths.isPending || backgrounds.isPending;
  const failed = traditions.isError || faiths.isError || backgrounds.isError;

  const place = (slug: string | null) => {
    const name = backgrounds.data?.find((b) => b.slug === slug)?.name;
    return name ? localized(name, locale) : t('onboarding.roots.elsewhere');
  };

  return (
    <OnboardingStep
      step="roots"
      title={t('onboarding.roots.title')}
      subtitle={t('onboarding.roots.subtitle')}
      canContinue={asking.every((faith) =>
        all.some((tr) => tr.faithSlug === faith && answers.roots.includes(tr.slug)),
      )}
      onContinue={next}
      onSkip={next}
      fill={1}
      fillFrom={0.5}
    >
      {loading && <StateView state="loading" />}
      {failed && (
        <StateView
          state="error"
          onRetry={() => {
            void traditions.refetch();
            void faiths.refetch();
            void backgrounds.refetch();
          }}
        />
      )}
      {!loading &&
        !failed &&
        asking.map((faith) => {
          // Places first, in the founders' order; the faith-wide one last
          const own = all.filter((tr) => tr.faithSlug === faith);
          const wide = faithWide(own);
          const ordered = [
            ...own.filter((tr) => tr.backgroundSlug !== null),
            ...own.filter((tr) => tr.backgroundSlug === null),
          ];
          const faithName = faiths.data?.find((f) => f.slug === faith)?.name;
          return (
            <View key={faith} style={styles.list}>
              {/* Named only for a mixed wedding asked about two faiths */}
              {asking.length > 1 && faithName && (
                <AppText variant="label" weight={600} color="text2" style={styles.heading}>
                  {localized(faithName, locale)}
                </AppText>
              )}
              {ordered.map((tradition, index) => (
                <OptionCard
                  key={tradition.slug}
                  index={index}
                  role="checkbox"
                  label={place(tradition.backgroundSlug)}
                  detail={tellingEvents(tradition, wide)
                    .map((event) => localized(event.name, locale))
                    .join(' · ')}
                  selected={answers.roots.includes(tradition.slug)}
                  onPress={() => setAnswers({ roots: toggleIn(answers.roots, tradition.slug) })}
                />
              ))}
            </View>
          );
        })}
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.sm + 2,
  },
  heading: {
    paddingHorizontal: Spacing.xs,
  },
});
