import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import type { IconName } from '@/components/icon';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { Spacing } from '@/constants/theme';
import { startBusinessErrorKind, useStartMyBusiness } from '@/data/business';
import { matchCities, useCities } from '@/data/places';
import { useCategories } from '@/data/reference';
import { OptionCard } from '@/features/onboarding/option-card';
import { matchCategories } from '@/features/search/match-categories';
import { localized } from '@/i18n/localized';
import { useLocale } from '@/i18n/locale-context';

/** What someone new came for (profiles.joined_as, R5 #222). */
export type JoinedAs = 'planning' | 'looking' | 'business';

// Enough to find yours without a wall of chips
const MAX_TYPE_MATCHES = 6;

const CHOICES: { value: JoinedAs; icon: IconName }[] = [
  { value: 'planning', icon: 'heart-outline' },
  { value: 'looking', icon: 'play-circle-outline' },
  { value: 'business', icon: 'storefront-outline' },
];

/** Before About you, for a new account: planning, just looking, or a wedding business. */
export function JoinChoiceStep({ onChoose }: { onChoose: (choice: JoinedAs) => void }) {
  const { t } = useLocale();
  const [picked, setPicked] = useState<JoinedAs | null>(null);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText variant="title" accessibilityRole="header">
        {t('signIn.join.title')}
      </AppText>
      <View style={styles.list} accessibilityRole="radiogroup">
        {CHOICES.map((choice, index) => (
          <OptionCard
            key={choice.value}
            index={index}
            icon={choice.icon}
            label={t(`signIn.join.${choice.value}`)}
            detail={t(`signIn.join.${choice.value}Detail`)}
            selected={picked === choice.value}
            onPress={() => setPicked(choice.value)}
          />
        ))}
      </View>
      <Button
        label={t('signIn.join.continue')}
        disabled={!picked}
        onPress={() => picked && onChoose(picked)}
      />
    </ScrollView>
  );
}

/**
 * After About you, for "Wedding business": the name, the main vendor type (searched,
 * not picked from all of them) and the town, which make a draft listing they own (start_my_business). A founder publishes it.
 */
export function BusinessStep({ initialTown, onDone }: { initialTown: string; onDone: () => void }) {
  const { t } = useLocale();
  const categories = useCategories();
  const cities = useCities();
  const start = useStartMyBusiness();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [typeQuery, setTypeQuery] = useState('');
  const [town, setTown] = useState(initialTown);
  const [attempted, setAttempted] = useState(false);
  const [failed, setFailed] = useState<string>();

  if (!categories.data || !cities.data) {
    const error = categories.isError || cities.isError;
    return (
      <StateView
        state={error ? 'error' : 'loading'}
        onRetry={() => {
          void categories.refetch();
          void cities.refetch();
        }}
      />
    );
  }

  const typeMatches = matchCategories(categories.data, typeQuery).slice(0, MAX_TYPE_MATCHES);
  // One match left counts as picked, so "DJ" then Make my listing just works
  const picked = category ?? (typeMatches.length === 1 ? typeMatches[0].slug : null);
  const typeError = !picked && attempted ? t('signIn.business.typeError') : undefined;

  // The town as one of our cities, so families nearby find the listing
  const place = matchCities(cities.data, town, 1)[0] ?? null;

  function submit() {
    setAttempted(true);
    setFailed(undefined);
    if (!name.trim() || !picked || !place) return;
    start.mutate(
      { name, categorySlug: picked, citySlug: place.slug },
      {
        onSuccess: onDone,
        onError: (error) =>
          setFailed(t(`signIn.business.errors.${startBusinessErrorKind(error.message)}`)),
      },
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <AppText variant="title" accessibilityRole="header">
        {t('signIn.business.title')}
      </AppText>
      <AppText variant="bodyLg" color="text2">
        {t('signIn.business.intro')}
      </AppText>
      <TextField
        label={t('signIn.business.name')}
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        maxLength={80}
        error={attempted && !name.trim() ? t('signIn.business.nameError') : undefined}
      />
      <TextField
        type="city"
        label={t('signIn.business.town')}
        value={town}
        onChangeText={setTown}
        hint={place ? t('signIn.business.townMatch', { city: place.name }) : undefined}
        error={attempted && !place ? t('signIn.business.townError') : undefined}
      />
      <View style={styles.group}>
        <TextField
          label={t('signIn.business.type')}
          hint={t('signIn.business.typeHint')}
          value={typeQuery}
          onChangeText={(text) => {
            setTypeQuery(text);
            setCategory(null);
          }}
          autoCorrect={false}
          maxLength={60}
          error={
            typeQuery.trim() && typeMatches.length === 0
              ? t('signIn.business.typeNoMatch')
              : typeError
          }
        />
        {typeMatches.length > 0 ? (
          <View style={styles.chips} accessibilityRole="radiogroup">
            {typeMatches.map((c) => (
              <Chip
                key={c.slug}
                role="radio"
                label={localized(c.name)}
                selected={picked === c.slug}
                onPress={() => {
                  setCategory(c.slug);
                  setTypeQuery(localized(c.name));
                }}
              />
            ))}
          </View>
        ) : null}
      </View>
      {failed ? <AppText color="error">{failed}</AppText> : null}
      <Button label={t('signIn.business.submit')} loading={start.isPending} onPress={submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  list: {
    gap: Spacing.md,
  },
  group: {
    gap: Spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
});
