import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { LineField } from '@/components/line-field';
import { StateView } from '@/components/state-view';
import { startBusinessErrorKind, useStartMyBusiness } from '@/data/business';
import { useCities } from '@/data/places';
import { useSession } from '@/features/auth/session';
import { markOnboarding } from '@/features/onboarding/onboarding-state';
import { OptionRow } from '@/features/onboarding/option-row';
import {
  getJoinDraft,
  setJoinDraft,
  townChoice,
  useJoinDraft,
} from '@/features/vendor-join/join-draft';
import { JoinQuestion } from '@/features/vendor-join/join-question';
import { useLocale } from '@/i18n/locale-context';

/**
 * List your business, question 3: the town they work from, matched to one
 * of our cities so families nearby find them. "Make my page" then makes the
 * business's page (start_my_business, a draft a founder publishes). Signed
 * out, it first opens sign-in as a business, and makes the page as soon as
 * they're in.
 */
export default function TownStep() {
  const { t } = useLocale();
  const draft = useJoinDraft();
  const cities = useCities();
  const { status, requireSignIn } = useSession();
  const start = useStartMyBusiness();
  const [failed, setFailed] = useState<string>();

  const { matches, picked } = cities.data
    ? townChoice(cities.data, draft.town, draft.citySlug)
    : { matches: [], picked: null };
  const typed = draft.town.trim().length >= 2;
  const noMatch = !!cities.data && typed && matches.length === 0;

  // Read when it runs, not when it was made: after sign-in the answers are the latest
  async function make() {
    const answers = getJoinDraft();
    const city = cities.data
      ? townChoice(cities.data, answers.town, answers.citySlug).picked
      : null;
    if (!answers.categorySlug || !city) return;
    setFailed(undefined);
    try {
      await start.mutateAsync({
        name: answers.name,
        categorySlug: answers.categorySlug,
        citySlug: city.slug,
      });
      // A business doesn't get the wedding questions
      markOnboarding('done');
      router.push('/for-vendors/ready');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setFailed(t(`signIn.business.errors.${startBusinessErrorKind(message)}`));
    }
  }

  return (
    <JoinQuestion
      step="town"
      title={t('vendorJoin.town.title')}
      subtitle={t('vendorJoin.town.subtitle')}
      canContinue={!!picked && !!draft.categorySlug && draft.name.trim().length >= 2}
      finishLabel={t('vendorJoin.make')}
      loading={start.isPending}
      error={failed}
      onContinue={() => {
        if (status === 'signedIn') void make();
        else requireSignIn(() => void make(), { joinAs: 'business' });
      }}
    >
      <LineField
        type="city"
        label={t('vendorJoin.town.label')}
        placeholder={t('vendorJoin.town.label')}
        value={draft.town}
        onChangeText={(town) => setJoinDraft({ town, citySlug: null })}
        autoCorrect={false}
        autoFocus
        maxLength={60}
        error={noMatch ? t('signIn.business.townError') : undefined}
      />
      {cities.isError && <StateView state="error" onRetry={() => void cities.refetch()} />}
      {matches.length > 0 && (
        <View accessibilityRole="radiogroup" accessibilityLabel={t('vendorJoin.town.label')}>
          {matches.map((city, index) => (
            <OptionRow
              key={city.slug}
              index={index}
              label={city.name}
              icon="location-outline"
              selected={picked?.slug === city.slug}
              onPress={() => setJoinDraft({ citySlug: city.slug, town: city.name })}
            />
          ))}
        </View>
      )}
    </JoinQuestion>
  );
}
